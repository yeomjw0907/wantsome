import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

    const { data: userRow } = await supabase
      .from("users")
      .select("is_verified")
      .eq("id", user.id)
      .single();

    const mode = process.env.PORTONE_API_SECRET ? "portone" : "fallback";
    const is_already_verified = userRow?.is_verified ?? false;

    return NextResponse.json({ mode, is_already_verified });
  } catch {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
