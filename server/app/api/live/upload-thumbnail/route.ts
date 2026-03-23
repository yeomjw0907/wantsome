import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedUser } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const user = await getAuthenticatedUser(token);
  if (!user) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const { data: creator } = await admin
    .from("creators")
    .select("id, live_enabled")
    .eq("id", user.id)
    .maybeSingle();

  if (!creator?.live_enabled) {
    return NextResponse.json({ message: "라이브 권한이 없습니다." }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ message: "파일이 없습니다." }, { status: 400 });
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ message: "이미지 파일만 업로드 가능합니다." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ message: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await admin.storage
    .from("live-thumbnails")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json({ message: uploadErr.message }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage.from("live-thumbnails").getPublicUrl(path);
  return NextResponse.json({ url: publicUrl }, { status: 201 });
}
