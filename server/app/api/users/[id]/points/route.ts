import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const authClient = createSupabaseClient(token);
  const {
    data: { user: authUser },
    error: authError,
  } = await authClient.auth.getUser(token);
  if (authError || !authUser) {
    return NextResponse.json({ message: "Invalid or expired token" }, { status: 401 });
  }

  const { id } = await params;
  if (id !== authUser.id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { data: row, error } = await authClient
    .from("users")
    .select("points, first_charge_deadline, is_first_charged")
    .eq("id", id)
    .single();

  if (error || !row) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    points: row.points ?? 0,
    first_charge_deadline: row.first_charge_deadline,
    is_first_charged: row.is_first_charged ?? false,
  });
}
