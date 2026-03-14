/**
 * POST /api/posts/upload-image — 이미지 업로드 to Supabase Storage
 * multipart/form-data { file: File }
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();

  // 크리에이터 확인
  const { data: creator } = await admin
    .from("creators")
    .select("id")
    .eq("id", authUser.id)
    .single();
  if (!creator) return NextResponse.json({ message: "크리에이터만 이미지를 업로드할 수 있습니다." }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ message: "파일이 없습니다." }, { status: 400 });

  // 파일 크기 10MB 제한
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ message: "파일 크기는 10MB를 초과할 수 없습니다." }, { status: 400 });
  }

  // 이미지 형식 확인
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ message: "이미지 파일만 업로드 가능합니다." }, { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${authUser.id}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await admin.storage
    .from("post-images")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json({ message: uploadErr.message }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage
    .from("post-images")
    .getPublicUrl(path);

  return NextResponse.json({ url: publicUrl }, { status: 201 });
}
