import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { calcAgeKST } from "@/lib/ageGate";

export const dynamic = "force-dynamic";

interface Body {
  /** PortOne 인증 완료 후 받는 ID */
  identityVerificationId?: string;
}

/**
 * 본인인증 검증 + 19세 게이트 + CI 블랙리스트/중복 확인
 *
 * 보안 정책 (fail-closed):
 *  - PORTONE_API_SECRET 미설정 시 즉시 500 (운영 안전)
 *  - userId는 Authorization Bearer 토큰에서만 추출 (body.userId 무시 — IDOR 방어)
 *  - "test-portone-id" 등 임의 식별자 무조건 거절
 *  - fallback 모드(클라가 birth_date 직접 입력) 제거 (위조 위험)
 *
 * 호출처: app/(auth)/age-check.tsx + app/(auth)/phone-verify.tsx
 */
export async function POST(req: NextRequest) {
  try {
    // 1) PORTONE_API_SECRET 검증 — 미설정 시 fail-closed
    const portoneSecret = process.env.PORTONE_API_SECRET;
    if (!portoneSecret) {
      console.error("[verify-identity] PORTONE_API_SECRET not configured");
      return NextResponse.json(
        { message: "Server misconfigured: identity verification unavailable" },
        { status: 500 },
      );
    }

    const supabase = createSupabaseAdmin();

    // 2) Authorization 토큰에서만 userId 추출 (body.userId IDOR 방어)
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

    // 3) Body 검증
    const body = (await req.json()) as Body;
    const identityVerificationId = body.identityVerificationId;
    if (!identityVerificationId || typeof identityVerificationId !== "string") {
      return NextResponse.json(
        { message: "identityVerificationId가 필요합니다." },
        { status: 400 },
      );
    }
    // 임의 테스트 식별자 거절 (프로덕션 안전)
    // PortOne v2 ID는 보통 nanoid/UUID-like 20자 이상이라 16자 미만 거절
    if (identityVerificationId === "test-portone-id" || identityVerificationId.length < 16) {
      return NextResponse.json({ message: "Invalid identityVerificationId" }, { status: 400 });
    }

    // 4) PortOne v2 API 검증
    const portoneRes = await fetch(
      `https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`,
      {
        headers: { Authorization: `PortOne ${portoneSecret}` },
      },
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

    // 5) PortOne status 검증 — VERIFIED 외 거절 (status 누락도 거절)
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

    // 6) 만 19세 게이트 (한국 청소년보호법) — KST 기준
    const age = calcAgeKST(birthDate);
    if (Number.isNaN(age) || age < 19) {
      return NextResponse.json(
        { error: "UNDERAGE", message: "만 19세 이상만 이용 가능합니다." },
        { status: 403 },
      );
    }

    // 7) CI 블랙리스트 + 중복 확인 (CI 있을 때만)
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

    // 8) 인증 완료 저장 (service_role 사용 → 트리거 우회 OK)
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

// getAge는 server/lib/ageGate.ts (calcAgeKST) 공유 헬퍼 사용
