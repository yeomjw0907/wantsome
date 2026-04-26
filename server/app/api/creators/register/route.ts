import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";
import crypto from "crypto";

export const dynamic = "force-dynamic";

/**
 * 계좌번호 AES-256-GCM 암호화
 *
 * ⚠️ ACCOUNT_ENCRYPT_KEY 환경변수 미설정 시 throw (fail-closed)
 *    기존: 미설정 시 "0".repeat(64) zero-key 사용 → 누구나 복호화 가능
 *    변경: 시작 시점에 발견되어 운영 즉시 알림
 *
 * 키 생성: openssl rand -hex 32  (32 bytes = 64 hex chars)
 */
function getEncryptKey(): Buffer {
  const hex = process.env.ACCOUNT_ENCRYPT_KEY;
  if (!hex || hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(
      "ACCOUNT_ENCRYPT_KEY missing or invalid (expected 64 hex chars = 32 bytes for AES-256)",
    );
  }
  // 약한 키 거절 — distinct char count 8 미만이면 low-entropy
  // 단순 반복 (0+, f+ 등) 또는 짧은 반복 패턴 모두 거절
  const distinctChars = new Set(hex.toLowerCase()).size;
  if (distinctChars < 8) {
    throw new Error(
      `ACCOUNT_ENCRYPT_KEY is too weak (only ${distinctChars} distinct chars; need >= 8)`,
    );
  }
  return Buffer.from(hex, "hex");
}

function encryptAccount(plain: string): string {
  const key = getEncryptKey();
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

  // 계좌번호 암호화 (ACCOUNT_ENCRYPT_KEY 미설정 시 throw → 500)
  let encryptedAccount: string;
  try {
    encryptedAccount = encryptAccount(body.accountNumber);
  } catch (err) {
    console.error("[creators/register] encrypt key error:", err);
    return NextResponse.json(
      { message: "Server misconfigured: account encryption unavailable" },
      { status: 500 },
    );
  }

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

  // users 테이블에 role 업데이트 (creator 심사 진행 중)
  const { error: userErr } = await admin
    .from("users")
    .update({ role: "creator" })
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
    }).then(null, () => null);
  }

  return NextResponse.json({ success: true });
}
