import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminSession } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = verifyAdminSession(req);
  if (!adminUser) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as { enabled?: boolean };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ message: "enabled 값이 필요합니다." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const updatePayload = body.enabled
    ? {
        live_enabled: true,
        live_enabled_at: new Date().toISOString(),
        live_enabled_by: adminUser.id,
      }
    : {
        live_enabled: false,
        live_enabled_at: null,
        live_enabled_by: null,
      };

  const { error } = await admin.from("creators").update(updatePayload).eq("id", id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ success: true, live_enabled: body.enabled });
}
