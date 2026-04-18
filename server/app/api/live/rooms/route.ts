import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import {
  LIVE_ENTRY_FEE_POINTS,
  LIVE_VIEWER_LIMIT,
  buildScheduledEndAt,
  getAuthenticatedUser,
  getLiveConfig,
  getLiveHostProfiles,
  type LiveRoomRecord,
} from "@/lib/live";

export const dynamic = "force-dynamic";

async function buildRoomSummary(
  admin: ReturnType<typeof createSupabaseAdmin>,
  room: LiveRoomRecord,
  hostProfile: {
    display_name: string | null;
    nickname: string | null;
    avatar_url: string | null;
    thumbnail_fallback_url: string | null;
  },
) {
  const [viewerCountRes, adminCountRes] = await Promise.all([
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
  ]);

  return {
    id: room.id,
    host_id: room.host_id,
    host_name: hostProfile.display_name ?? hostProfile.nickname ?? "크리에이터",
    host_avatar_url: hostProfile.avatar_url ?? null,
    title: room.title,
    thumbnail_url: room.thumbnail_url ?? hostProfile.thumbnail_fallback_url ?? null,
    entry_fee_points: room.entry_fee_points,
    viewer_limit: room.viewer_limit,
    viewer_count: viewerCountRes.count ?? 0,
    admin_count: adminCountRes.count ?? 0,
    planned_duration_min: room.planned_duration_min,
    scheduled_end_at: room.scheduled_end_at,
    status: room.status,
    started_at: room.started_at,
    extension_count: room.extension_count ?? 0,
  };
}

export async function GET(req: NextRequest) {
  const admin = createSupabaseAdmin();
  const { data: rooms, error } = await admin
    .from("live_rooms")
    .select(`
      id, host_id, title, thumbnail_url, entry_fee_points, viewer_limit,
      planned_duration_min, scheduled_end_at, status, agora_channel, started_at, ended_at, extension_count
    `)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(30);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const hostProfiles = await getLiveHostProfiles(
    admin,
    (rooms ?? []).map((room) => room.host_id),
  );

  const summaries = await Promise.all(
    (rooms ?? []).map((room) =>
      buildRoomSummary(
        admin,
        room,
        hostProfiles.get(room.host_id) ?? {
          display_name: null,
          nickname: null,
          avatar_url: null,
          thumbnail_fallback_url: null,
        },
      ),
    ),
  );

  return NextResponse.json({ rooms: summaries });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const user = await getAuthenticatedUser(token);
  if (!user) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const body = (await req.json()) as {
    title?: string;
    planned_duration_min?: number;
    thumbnail_url?: string | null;
  };

  const title = (body.title ?? "").trim();
  const plannedDurationMin = Number(body.planned_duration_min ?? 0);
  if (title.length < 2 || title.length > 50) {
    return NextResponse.json({ message: "제목은 2~50자여야 합니다." }, { status: 400 });
  }
  if (![30, 60].includes(plannedDurationMin)) {
    return NextResponse.json({ message: "예정 시간은 30분 또는 1시간만 가능합니다." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const [creatorRes, config] = await Promise.all([
    admin
      .from("creators")
      .select("id, live_enabled, is_live_now, is_busy, profile_image_url")
      .eq("id", user.id)
      .maybeSingle(),
    getLiveConfig(),
  ]);

  type LiveCreatorRow = { id: string; live_enabled: boolean | null; is_live_now: boolean; is_busy: boolean; profile_image_url: string | null };
  const creator = creatorRes.data as unknown as LiveCreatorRow | null;
  if (!creator?.live_enabled) {
    return NextResponse.json({ message: "라이브 권한이 없습니다." }, { status: 403 });
  }
  if (creator.is_live_now) {
    return NextResponse.json({ message: "이미 진행 중인 라이브가 있습니다." }, { status: 409 });
  }
  if (creator.is_busy) {
    return NextResponse.json({ message: "1:1 통화 중에는 라이브를 시작할 수 없습니다." }, { status: 409 });
  }

  const { data: existingLive } = await admin
    .from("live_rooms")
    .select("id")
    .eq("host_id", user.id)
    .in("status", ["ready", "live"])
    .limit(1);

  if (existingLive && existingLive.length > 0) {
    return NextResponse.json({ message: "이미 준비 중이거나 진행 중인 라이브가 있습니다." }, { status: 409 });
  }

  const scheduledEndAt = buildScheduledEndAt(plannedDurationMin);
  const thumbnailUrl = body.thumbnail_url?.trim() || creator.profile_image_url || user.profile_img || null;

  const { data: room, error } = await admin
    .from("live_rooms")
    .insert({
      host_id: user.id,
      title,
      thumbnail_url: thumbnailUrl,
      entry_fee_points: config.entryFeePoints || LIVE_ENTRY_FEE_POINTS,
      viewer_limit: config.viewerLimit || LIVE_VIEWER_LIMIT,
      planned_duration_min: plannedDurationMin,
      scheduled_end_at: scheduledEndAt,
      status: "ready",
    })
    .select("id, entry_fee_points, viewer_limit, status, scheduled_end_at")
    .single();

  if (error || !room) {
    return NextResponse.json({ message: error?.message ?? "라이브 방 생성에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json(
    {
      room_id: room.id,
      entry_fee_points: room.entry_fee_points,
      viewer_limit: room.viewer_limit,
      status: room.status,
      scheduled_end_at: room.scheduled_end_at,
    },
    { status: 201 },
  );
}
