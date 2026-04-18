import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser || authUser.id !== id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { is_online } = await req.json() as { is_online: boolean };
  if (typeof is_online !== "boolean") {
    return NextResponse.json({ message: "is_online 필수" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("creators")
    .update({ is_online })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  // 온라인 전환 시 즐겨찾기한 유저에게 푸시 알림 (비동기, 실패 무시)
  if (is_online) {
    sendOnlinePush(admin, id).catch(() => {});
  }

  return NextResponse.json({ success: true });
}

async function sendOnlinePush(
  admin: ReturnType<typeof createSupabaseAdmin>,
  creatorId: string
) {
  const [{ data: creator }, { data: favs }] = await Promise.all([
    admin.from("creators").select("display_name, users(nickname)").eq("id", creatorId).single(),
    admin.from("favorites").select("user_id").eq("creator_id", creatorId),
  ]);

  if (!favs || favs.length === 0) return;

  type CreatorOnlineRow = { display_name: string | null; users: { nickname: string | null } | null };
  const creatorTyped = creator as unknown as CreatorOnlineRow | null;
  const creatorName = creatorTyped?.display_name ?? creatorTyped?.users?.nickname ?? "크리에이터";

  const { data: tokenRows } = await admin
    .from("push_tokens")
    .select("token")
    .in("user_id", (favs ?? []).map((f) => f.user_id));

  if (!tokenRows || tokenRows.length === 0) return;

  const messages = tokenRows.map((r) => ({
    to: r.token,
    title: `${creatorName}님이 접속했어요! 💫`,
    body: "지금 바로 통화해보세요",
    data: { creatorId, screen: "creator" },
    sound: "default",
  }));

  for (let i = 0; i < messages.length; i += 100) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
  }
}
