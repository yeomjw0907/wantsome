import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json({ message: "Invalid token" }, { status: 401 });
    }

    const portoneSecret = process.env.PORTONE_API_SECRET;
    const storeId = process.env.PORTONE_STORE_ID;
    const channelKey = process.env.PORTONE_CHANNEL_KEY;

    if (!portoneSecret || !storeId || !channelKey) {
      return NextResponse.json(
        { message: "PortOne이 아직 설정되지 않았습니다." },
        { status: 503 }
      );
    }

    // PortOne v2 API — 본인인증 요청 생성
    const res = await fetch("https://api.portone.io/identity-verifications", {
      method: "POST",
      headers: {
        Authorization: `PortOne ${portoneSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        storeId,
        requestedAt: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      return NextResponse.json(
        { message: err.message ?? "PortOne 요청 실패" },
        { status: 400 }
      );
    }

    const data = (await res.json()) as { identityVerificationId: string };
    const { identityVerificationId } = data;

    const url =
      `https://pay.portone.io/v2/identity-verification` +
      `?identityVerificationId=${identityVerificationId}` +
      `&channelKey=${channelKey}` +
      `&redirectUrl=wantsome://auth/verify-callback`;

    return NextResponse.json({ identityVerificationId, url });
  } catch {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
