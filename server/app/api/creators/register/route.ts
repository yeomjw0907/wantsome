import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// 계좌번호 AES-256-GCM 암호화
function encryptAccount(plain: string): string {
  const key = Buffer.from(process.env.ACCOUNT_ENCRYPT_KEY ?? "0".repeat(64), "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), enc.toString("hex"), tag.toString("hex")].join(".");
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const body = await req.json() as {
    userId: string;
    bankCode: string;
    bankName: string;
    accountNumber: string;
    holderName: string;
  };

  if (!body.bankCode || !body.bankName || !body.accountNumber || !body.holderName) {
    return NextResponse.json({ message: "은행 정보 누락" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // 계좌번호 암호화
  const encryptedAccount = encryptAccount(body.accountNumber);

  // creator_profiles 최종 등록
  const { error } = await admin
    .from("creator_profiles")
    .upsert({
      user_id: authUser.id,
      bank_code: body.bankCode,
      bank_name: body.bankName,
      account_number_enc: encryptedAccount,
      account_holder: body.holderName,
      status: "PENDING",
      submitted_at: new Date().toISOString(),
    }, {
      onConflict: "user_id",
    });

  if (error && error.code !== "42P01") {
    return NextResponse.json({ message: "등록 실패" }, { status: 500 });
  }

  // users 테이블에 role 업데이트 (CREATOR_PENDING)
  const { error: userErr } = await admin
    .from("users")
    .update({ role: "CREATOR_PENDING" })
    .eq("id", authUser.id);

  if (userErr && userErr.code !== "42P01") {
    return NextResponse.json({ message: "역할 업데이트 실패" }, { status: 500 });
  }

  // 관리자 Slack 알림
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (slackUrl) {
    await fetch(slackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🆕 크리에이터 등록 심사 요청\n• userId: ${authUser.id}\n• email: ${authUser.email}\n• 은행: ${body.bankName} ${body.accountNumber.slice(-4).padStart(body.accountNumber.length, "*")}\n• 예금주: ${body.holderName}`,
      }),
    }).catch(() => null);
  }

  return NextResponse.json({ success: true });
}
