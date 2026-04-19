import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 10;

type Mode = "blue" | "red";

async function attachUsers(
  admin: ReturnType<typeof createSupabaseAdmin>,
  rows: { id: string; profile_image_url?: string | null; [key: string]: unknown }[],
) {
  const ids = rows.map((r) => r.id);
  type UserRow = { id: string; profile_img: string | null; is_verified: boolean | null };
  const userById = new Map<string, UserRow>();
  if (ids.length === 0) return userById;
  const { data: userRows, error } = await admin
    .from("users")
    .select("id, profile_img, is_verified")
    .in("id", ids);
  if (!error && userRows) {
    for (const u of userRows as UserRow[]) {
      userById.set(u.id, u);
    }
  }
  return userById;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = (searchParams.get("mode") ?? "blue") as Mode;
  const period = (searchParams.get("period") ?? "weekly") as "weekly" | "monthly" | "all";
  const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10)));

  if (mode !== "blue" && mode !== "red") {
    return NextResponse.json({ message: "Invalid mode" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  if (period !== "all") {
    const days = period === "weekly" ? 7 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: sessions, error: sessionError } = await admin
      .from("call_sessions")
      .select("creator_id, duration_sec")
      .eq("status", "ended")
      .eq("mode", mode)
      .gte("ended_at", since)
      .not("duration_sec", "is", null);

    if (sessionError) {
      return NextResponse.json({ message: sessionError.message }, { status: 500 });
    }

    const totals: Record<string, number> = {};
    for (const session of sessions ?? []) {
      if (session.creator_id) {
        totals[session.creator_id] = (totals[session.creator_id] ?? 0) + (session.duration_sec ?? 0);
      }
    }

    const topIds = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    if (topIds.length === 0) {
      return getAllTimeRanking(admin, mode, limit, period);
    }

    let cq = admin
      .from("creators")
      .select("id, display_name, grade, is_online, profile_image_url")
      .in("id", topIds);

    if (mode === "blue") {
      cq = cq.or("mode_blue.is.null,mode_blue.eq.true");
    } else {
      cq = cq.eq("mode_red", true);
    }

    const { data: creators, error: creatorError } = await cq;

    if (creatorError) {
      return NextResponse.json({ message: creatorError.message }, { status: 500 });
    }

    const list = creators ?? [];
    const userById = await attachUsers(admin, list);

    const ranking = topIds
      .map((id, index) => {
        const creator = list.find((item: { id: string }) => item.id === id);
        if (!creator) {
          return null;
        }

        const user = userById.get(creator.id);

        return {
          rank: index + 1,
          id: creator.id,
          display_name: creator.display_name ?? "크리에이터",
          profile_image_url: user?.profile_img ?? creator.profile_image_url ?? null,
          grade: creator.grade ?? "루키",
          is_online: creator.is_online ?? false,
          is_verified: user?.is_verified ?? false,
          total_sec: totals[id] ?? 0,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ ranking, period });
  }

  return getAllTimeRanking(admin, mode, limit, period);
}

async function getAllTimeRanking(
  admin: ReturnType<typeof createSupabaseAdmin>,
  mode: Mode,
  limit: number,
  period: string,
) {
  let q = admin
    .from("creators")
    .select("id, display_name, grade, is_online, monthly_minutes, profile_image_url");

  if (mode === "blue") {
    q = q.or("mode_blue.is.null,mode_blue.eq.true");
  } else {
    q = q.eq("mode_red", true);
  }

  const { data: creators, error } = await q.order("monthly_minutes", { ascending: false }).limit(limit);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const list = creators ?? [];
  const userById = await attachUsers(admin, list);

  const ranking = list.map((creator: { id: string; display_name?: string; grade?: string; is_online?: boolean; monthly_minutes?: number; profile_image_url?: string | null }, index: number) => {
    const user = userById.get(creator.id);

    return {
      rank: index + 1,
      id: creator.id,
      display_name: creator.display_name ?? "크리에이터",
      profile_image_url: user?.profile_img ?? creator.profile_image_url ?? null,
      grade: creator.grade ?? "루키",
      is_online: creator.is_online ?? false,
      is_verified: user?.is_verified ?? false,
      total_sec: (creator.monthly_minutes ?? 0) * 60,
    };
  });

  return NextResponse.json({ ranking, period });
}
