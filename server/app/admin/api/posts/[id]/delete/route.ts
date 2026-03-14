import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminSession } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await verifyAdminSession(req);
  if (!adminUser) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id: postId } = await params;
  const admin = createSupabaseAdmin();

  const { error } = await admin
    .from("posts")
    .update({ is_deleted: true })
    .eq("id", postId);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
