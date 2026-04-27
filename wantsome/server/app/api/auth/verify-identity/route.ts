import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface Body {
  /** PortOne 인증 완료 후 받는 ID */
  identityVerificationId?: string;
  /** fallback 모드: 생년월일 직접 입력 (PORTONE_API_SECRET 미설정 시만 허용) */
  fallback?: boolean;
  birth_date?: string;
  /** 레거시 호환 — Authorization 헤더로 대체 */
  userId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const supabase = createSupabaseAdmin();

    // 1. Authorization 헤더에서 유저 ID 추출 (우선)
    let userId = body.userId ?? null;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (token) {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (!error && user) userId = user.id;
    }

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // 2. Fallback 모드 — 생년월일 직접 입력
    //    (PORTONE_API_SECRET이 없을 때만 허용, 보안 게이트)
    if (body.fallback && !process.env.PORTONE_API_SECRET) {
      const { birth_date } = body;
      if (!birth_date) {
        return NextResponse.json(
          { message: "birth_date가 필요합니다." },
          { status: 400 }
        );
      }

      const age = getAge(birth_date);
      if (age < 19) {
        return NextResponse.json(
          { error: "UNDERAGE", message: "만 19세 이상만 이용 가능합니다." },
          { status: 403 }
        );
      }

      const { error } = await supabase
        .from("users")
        .update({ birth_date })
        .eq("id", userId);

      if (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        is_adult: true,
        verified_name: null,
      });
    }

    // 3. PortOne / 테스트 모드
    const { identityVerificationId } = body;
    if (!identityVerificationId) {
      return NextResponse.json(
        { message: "identityVerificationId가 필요합니다." },
        { status: 400 }
      );
    }

    // 개발 테스트 또는 PortOne 미설정 시 자동 통과
    if (
      identityVerificationId === "test-portone-id" ||
      !process.env.PORTONE_API_SECRET
    ) {
      const { error } = await supabase
        .from("users")
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        is_adult: true,
        verified_name: "테스트",
      });
    }

    // 4. PortOne v2 API 검증
    const portoneRes = await fetch(
      `https://api.portone.io/identity-verifications/${identityVerificationId}`,
      {
        headers: {
          Authorization: `PortOne ${process.env.PORTONE_API_SECRET}`,
        },
      }
    );

    if (!portoneRes.ok) {
      return NextResponse.json(
        { message: "PortOne 인증 실패" },
        { status: 400 }
      );
    }

    const portone = (await portoneRes.json()) as {
      birthDate?: string;
      name?: string;
      ci?: string;
    };

    const birthDate = portone.birthDate;
    if (!birthDate) {
      return NextResponse.json(
        { message: "생년월일 정보를 가져올 수 없습니다." },
        { status: 400 }
      );
    }

    // 5. 나이 확인 — 만 19세 이상 (한국 청소년보호법)
    const age = getAge(birthDate);
    if (age < 19) {
      return NextResponse.json(
        { error: "UNDERAGE", message: "만 19세 이상만 이용 가능합니다." },
        { status: 403 }
      );
    }

    const ci = portone.ci;

    if (ci) {
      // 6. CI 블랙리스트 확인
      const { data: banned } = await supabase
        .from("ci_blacklist")
        .select("id")
        .eq("ci", ci)
        .maybeSingle();

      if (banned) {
        return NextResponse.json(
          { error: "BANNED", message: "이용이 제한된 계정입니다." },
          { status: 403 }
        );
      }

      // 7. CI 중복 확인 — 동일인 다른 계정 방지
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
          { status: 409 }
        );
      }
    }

    // 8. 인증 완료 저장
    const { error } = await supabase
      .from("users")
      .update({
        is_verified: true,
        ci: ci ?? null,
        birth_date: birthDate,
        verified_name: portone.name ?? null,
        verified_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      is_adult: true,
      verified_name: portone.name ?? "",
    });
  } catch {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

function getAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}
