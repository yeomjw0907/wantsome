/**
 * POST /api/auth/age-verify
 *
 * 1차 연령 게이트 — 클라가 입력한 birth_date를 서버에 저장 + 19세 검증
 *
 * 보안 정책:
 *  - 1차 게이트라 self-attest (사용자가 거짓 입력 가능)
 *  - 2차 게이트는 verify-identity (PortOne 본인인증) — 진짜 검증
 *  - 한 번 저장된 birth_date는 변경 불가 (verified_at 있으면 PortOne 인증 완료 — 변경 X)
 *  - users.birth_date는 트리거로 보호되지만 service_role로 update (PR-2 트리거 우회)
 *
 * 호출처: app/(auth)/age-check.tsx
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { calcAgeKST } from "@/lib/ageGate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();
  const {
    data: { user },
    error: authErr,
  } = await admin.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  let body: { birth_date?: string };
  try {
    body = (await req.json()) as { birth_date?: string };
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const birth_date = body.birth_date;
  if (!birth_date || !/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
    return NextResponse.json(
      { message: "birth_date format invalid (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const age = calcAgeKST(birth_date);
  if (Number.isNaN(age) || age < 0 || age > 130) {
    return NextResponse.json(
      { message: "Invalid birth_date" },
      { status: 400 },
    );
  }
  if (age < 19) {
    return NextResponse.json(
      { error: "UNDERAGE", message: "만 19세 이상만 이용 가능합니다." },
      { status: 403 },
    );
  }

  // 기존 사용자 상태 확인
  const { data: existing } = await admin
    .from("users")
    .select("birth_date, verified_at")
    .eq("id", user.id)
    .single();

  // 이미 PortOne 본인인증 완료 → birth_date 변경 불가 (멱등 응답)
  if (existing?.verified_at) {
    return NextResponse.json({ success: true, already_verified: true });
  }

  // 기존 1차 birth_date가 있고 다르면 거절 (변조 시도 방어)
  if (existing?.birth_date && existing.birth_date !== birth_date) {
    return NextResponse.json(
      {
        error: "BIRTH_DATE_LOCKED",
        message: "이미 등록된 생년월일과 다릅니다. 본인인증을 통해 변경해주세요.",
      },
      { status: 409 },
    );
  }

  // service_role로 update — PR-2 트리거 우회 정상 동작
  const { error: updateErr } = await admin
    .from("users")
    .update({ birth_date })
    .eq("id", user.id);

  if (updateErr) {
    return NextResponse.json({ message: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// calcAgeKST는 server/lib/ageGate.ts 공유 헬퍼 사용
