import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

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
    userId: string;
    signatureData: string;
  };

  if (!body.userId || !body.signatureData) {
    return NextResponse.json({ message: "userId, signatureData 필수" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";

  // creator_profiles 업서트
  const { error } = await admin
    .from("creator_profiles")
    .upsert({
      user_id: authUser.id,
      contract_signed_at: new Date().toISOString(),
      contract_ip: ip,
      status: "PENDING",
    }, {
      onConflict: "user_id",
    });

  if (error && error.code !== "42P01") {
    return NextResponse.json({ message: "계약서 저장 실패" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
