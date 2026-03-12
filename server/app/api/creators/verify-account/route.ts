import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const body = await req.json() as {
    bankCode: string;
    accountNumber: string;
    holderName: string;
  };

  if (!body.bankCode || !body.accountNumber || !body.holderName) {
    return NextResponse.json({ message: "bankCode, accountNumber, holderName 필수" }, { status: 400 });
  }

  // PortOne 계좌 실명 확인 API 연동
  // PORTONE_SECRET_KEY가 없으면 개발 환경 → 항상 성공 처리
  const portoneKey = process.env.PORTONE_SECRET_KEY;
  if (!portoneKey) {
    // 개발/스테이징: mock 성공
    return NextResponse.json({
      verified: true,
      holderName: body.holderName,
      message: "개발 환경: 실명 확인 생략",
    });
  }

  try {
    // PortOne V2 계좌 실명 조회
    const portoneRes = await fetch("https://api.portone.io/v2/bank-accounts/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `PortOne ${portoneKey}`,
      },
      body: JSON.stringify({
        bank_code: body.bankCode,
        account_number: body.accountNumber,
        account_holder_name: body.holderName,
      }),
    });

    if (!portoneRes.ok) {
      const err = await portoneRes.json();
      return NextResponse.json({
        verified: false,
        message: err.message ?? "계좌 확인 실패",
      }, { status: 422 });
    }

    const data = await portoneRes.json();
    return NextResponse.json({
      verified: true,
      holderName: data.account_holder_name ?? body.holderName,
    });
  } catch {
    return NextResponse.json({ message: "계좌 확인 서비스 오류" }, { status: 500 });
  }
}
