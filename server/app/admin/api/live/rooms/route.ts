import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/adminAuth";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUser = verifyAdminSession(req);
  if (!adminUser) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "live";

  const admin = createSupabaseAdmin();
  let query = admin
    .from("live_rooms")
    .select(`
      id, host_id, title, thumbnail_url, entry_fee_points, viewer_limit,
      planned_duration_min, scheduled_end_at, status, started_at, ended_at, extension_count,
      users!live_rooms_host_id_fkey (
        nickname, profile_img
      ),
      creators!inner (
        display_name
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data: rooms, error } = await query;
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const rows = await Promise.all(
    (rooms ?? []).map(async (room: any) => {
      const creatorProfile = Array.isArray(room.creators) ? room.creators[0] : room.creators;
      const hostUser = Array.isArray(room.users) ? room.users[0] : room.users;

      const [viewerCount, adminCount, giftSum, revenueCount] = await Promise.all([
        admin
          .from("live_room_participants")
          .select("id", { count: "exact", head: true })
          .eq("room_id", room.id)
          .eq("role", "viewer")
          .eq("status", "joined"),
        admin
          .from("live_room_participants")
          .select("id", { count: "exact", head: true })
          .eq("room_id", room.id)
          .eq("role", "admin")
          .eq("status", "joined"),
        admin.from("gifts").select("amount").eq("live_room_id", room.id),
        admin.from("live_room_participants").select("paid_points").eq("room_id", room.id).eq("role", "viewer"),
      ]);

      return {
        id: room.id,
        title: room.title,
        host_name: creatorProfile?.display_name ?? hostUser?.nickname ?? "크리에이터",
        host_avatar_url: hostUser?.profile_img ?? null,
        status: room.status,
        started_at: room.started_at,
        scheduled_end_at: room.scheduled_end_at,
        ended_at: room.ended_at,
        extension_count: room.extension_count ?? 0,
        viewer_count: viewerCount.count ?? 0,
        admin_count: adminCount.count ?? 0,
        entry_fee_points: room.entry_fee_points,
        entry_revenue_points: (revenueCount.data ?? []).reduce(
          (sum: number, item: any) => sum + (item.paid_points ?? 0),
          0,
        ),
        gift_points: (giftSum.data ?? []).reduce((sum: number, item: any) => sum + (item.amount ?? 0), 0),
        viewer_limit: room.viewer_limit,
      };
    }),
  );

  return NextResponse.json({ rooms: rows });
}
