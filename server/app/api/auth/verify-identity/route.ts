import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { calcAgeKST } from "@/lib/ageGate";

export const dynamic = "force-dynamic";

interface Body {
  /** PortOne 인증 완료 후 받는 ID (PortOne 모드) */
  identityVerificationId?: string;
  /** Fallback(생년월일 self-attest) 모드 — PORTONE_API_SECRET 미설정 시에만 허용 */
  fallback?: boolean;
  birth_date?: string;
}

/**
 * 본인인증 검증 + 19세 게이트 + CI 블랙리스트/중복 확인
 *
 * 두 가지 모드 (identity-verification-status 의 분기와 일치):
 *  - PORTONE_API_SECRET 설정  → PortOne 실본인인증 (identityVerificationId 검증 + CI 확인)
 *  - PORTONE_API_SECRET 미설정 → fallback: 생년월일 self-attest (PG 승인 전 임시 게이트)
 *
 * 보안 정책:
 *  - userId는 Authorization Bearer 토큰에서만 추출 (body.userId 무시 — IDOR 방어)
 *  - PORTONE_API_SECRET 설정 시 fallback 요청은 무시되고 실검증만 허용
 *  - "test-portone-id" 등 임의 식별자 거절
 */
export async function POST(req: NextRequest) {
  try {
    const portoneSecret = process.env.PORTONE_API_SECRET;
    const supabase = createSupabaseAdmin();

    // Authorization 토큰에서만 userId 추출 (body.userId IDOR 방어)
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null;
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ message: "Invalid or expired token" }, { status: 401 });
    }
    const userId = user.id;

    const body = (await req.json()) as Body;

    // ──────────────────────────────────────────────────────────
    // Fallback 모드: PORTONE_API_SECRET 미설정 시에만 생년월일 self-attest 허용
    // (PortOne 승인 전 임시. identity-verification-status 가 mode="fallback" 반환)
    // ──────────────────────────────────────────────────────────
    if (!portoneSecret) {
      const birthDate = body.birth_date;
      if (body.fallback !== true || !birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
        return NextResponse.json(
          { message: "생년월일이 필요합니다 (YYYY-MM-DD)." },
          { status: 400 },
        );
      }
      const fage = calcAgeKST(birthDate);
      if (Number.isNaN(fage) || fage < 0 || fage > 130) {
        return NextResponse.json(
          { message: "올바른 생년월일을 입력해주세요." },
          { status: 400 },
        );
      }
      if (fage < 19) {
        return NextResponse.json(
          { error: "UNDERAGE", message: "만 19세 이상만 이용 가능합니다." },
          { status: 403 },
        );
      }
      const { error: fErr } = await supabase
        .from("users")
        .update({ is_verified: true, birth_date: birthDate })
        .eq("id", userId);
      if (fErr) {
        return NextResponse.json({ message: fErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, is_adult: true, verified_name: null });
    }

    // ──────────────────────────────────────────────────────────
    // PortOne 모드: identityVerificationId 실검증
    // ──────────────────────────────────────────────────────────
    const identityVerificationId = body.identityVerificationId;
    if (!identityVerificationId || typeof identityVerificationId !== "string") {
      return NextResponse.json(
        { message: "identityVerificationId가 필요합니다." },
        { status: 400 },
      );
    }
    // 임의 테스트 식별자 거절 (PortOne v2 ID는 보통 16자 이상)
    if (identityVerificationId === "test-portone-id" || identityVerificationId.length < 16) {
      return NextResponse.json({ message: "Invalid identityVerificationId" }, { status: 400 });
    }

    const portoneRes = await fetch(
      `https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`,
      { headers: { Authorization: `PortOne ${portoneSecret}` } },
    );
    if (!portoneRes.ok) {
      const detail = await portoneRes.text().catch(() => "");
      return NextResponse.json(
        { message: "PortOne 인증 실패", detail: detail.slice(0, 200) },
        { status: 400 },
      );
    }

    const portone = (await portoneRes.json()) as {
      status?: string;
      birthDate?: string;
      name?: string;
      ci?: string;
    };

    if (portone.status !== "VERIFIED") {
      return NextResponse.json(
        { message: `PortOne status not VERIFIED: ${portone.status ?? "missing"}` },
        { status: 400 },
      );
    }

    const birthDate = portone.birthDate;
    if (!birthDate) {
      return NextResponse.json(
        { message: "생년월일 정보를 가져올 수 없습니다." },
        { status: 400 },
      );
    }

    const age = calcAgeKST(birthDate);
    if (Number.isNaN(age) || age < 19) {
      return NextResponse.json(
        { error: "UNDERAGE", message: "만 19세 이상만 이용 가능합니다." },
        { status: 403 },
      );
    }

    const ci = portone.ci ?? null;
    if (ci) {
      const { data: banned } = await supabase
        .from("ci_blacklist")
        .select("id")
        .eq("ci", ci)
        .maybeSingle();
      if (banned) {
        return NextResponse.json(
          { error: "BANNED", message: "이용이 제한된 계정입니다." },
          { status: 403 },
        );
      }

      const { data: existingCi } = await supabase
        .from("users")
        .select("id")
        .eq("ci", ci)
        .neq("id", userId)
        .maybeSingle();
      if (existingCi) {
        return NextResponse.json(
          {
            error: "DUPLICATE_CI",
            message: "이미 가입된 계정이 있습니다. 기존 계정으로 로그인해주세요.",
          },
          { status: 409 },
        );
      }
    }

    const { error: updateErr } = await supabase
      .from("users")
      .update({
        is_verified: true,
        ci,
        birth_date: birthDate,
        verified_name: portone.name ?? null,
        verified_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateErr) {
      return NextResponse.json({ message: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      is_adult: true,
      verified_name: portone.name ?? "",
    });
  } catch (err) {
    console.error("[verify-identity] unexpected error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
