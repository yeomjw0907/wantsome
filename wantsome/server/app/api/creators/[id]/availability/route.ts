/**
 * GET  /api/creators/[id]/availability  — 크리에이터 주간 가용시간 조회 (공개)
 * PUT  /api/creators/[id]/availability  — 크리에이터 본인만 가용시간 설정
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin, createSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const admin = createSupabaseAdmin();

  const { data, error } = await admin
    .from("creator_availability")
    .select("day_of_week, start_time, end_time, slot_duration_min, is_active")
    .eq("creator_id", id)
    .order("day_of_week", { ascending: true });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ availability: data ?? [] });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  // 본인 크리에이터 계정 확인
  const admin = createSupabaseAdmin();
  const { data: creator } = await admin
    .from("creators")
    .select("id")
    .eq("id", id)
    .eq("user_id", authUser.id)
    .single();

  if (!creator) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const body = await req.json() as {
    availability: {
      day_of_week: number;
      start_time: string;
      end_time: string;
      slot_duration_min?: number;
      is_active: boolean;
    }[];
  };

  if (!body.availability || !Array.isArray(body.availability)) {
    return NextResponse.json({ message: "availability 필드가 필요합니다." }, { status: 400 });
  }

  const rows = body.availability.map((a) => ({
    creator_id: id,
    day_of_week: a.day_of_week,
    start_time: a.start_time,
    end_time: a.end_time,
    slot_duration_min: a.slot_duration_min ?? 30,
    is_active: a.is_active,
  }));

  // upsert (UNIQUE creator_id + day_of_week)
  const { error } = await admin
    .from("creator_availability")
    .upsert(rows, { onConflict: "creator_id,day_of_week" });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
