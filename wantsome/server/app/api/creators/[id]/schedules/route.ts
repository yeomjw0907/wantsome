/**
 * GET  /api/creators/[id]/schedules — 예정 방송 목록 (최근 5개)
 * POST /api/creators/[id]/schedules — 방송 일정 등록 (크리에이터 본인)
 * DELETE /api/creators/[id]/schedules?schedule_id=xxx — 일정 취소
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("creator_schedules")
    .select("id, scheduled_at, note, is_cancelled")
    .eq("creator_id", id)
    .eq("is_cancelled", false)
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(5);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ schedules: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user || user.id !== id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { scheduled_at, note } = await req.json() as { scheduled_at: string; note?: string };
  if (!scheduled_at) return NextResponse.json({ message: "scheduled_at 필요" }, { status: 400 });

  const scheduledDate = new Date(scheduled_at);
  if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
    return NextResponse.json({ message: "미래 시간을 입력해주세요." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("creator_schedules")
    .insert({ creator_id: id, scheduled_at, note: note?.slice(0, 100) ?? null })
    .select("id, scheduled_at, note")
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ schedule: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user || user.id !== id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scheduleId = searchParams.get("schedule_id");
  if (!scheduleId) return NextResponse.json({ message: "schedule_id 필요" }, { status: 400 });

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("creator_schedules")
    .update({ is_cancelled: true })
    .eq("id", scheduleId)
    .eq("creator_id", id);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
