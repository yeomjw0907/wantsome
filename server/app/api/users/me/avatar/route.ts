import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ message: "file 필수" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ message: "파일 크기는 5MB 이하여야 합니다." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ message: "이미지 파일만 업로드 가능합니다." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const ext = file.name.split(".").pop() ?? "jpg";
  const fileName = `avatars/${authUser.id}/profile.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadErr } = await admin.storage
    .from("profiles")
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json({ message: "업로드 실패: " + uploadErr.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage.from("profiles").getPublicUrl(fileName);
  const publicUrl = urlData.publicUrl;

  // users 테이블 업데이트
  await admin
    .from("users")
    .update({ profile_img: publicUrl })
    .eq("id", authUser.id);

  return NextResponse.json({ url: publicUrl });
}
