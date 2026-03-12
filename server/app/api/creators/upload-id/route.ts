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

  // 파일 크기 제한: 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ message: "파일 크기는 10MB 이하여야 합니다." }, { status: 400 });
  }

  // 이미지 타입만 허용
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ message: "이미지 파일만 업로드 가능합니다." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const ext = file.name.split(".").pop() ?? "jpg";
  const fileName = `${authUser.id}/id-card-${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // private bucket에 업로드
  const { error: uploadErr } = await admin.storage
    .from("id-cards")
    .upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json({ message: "업로드 실패: " + uploadErr.message }, { status: 500 });
  }

  // creator_profiles 업서트
  const { error: dbErr } = await admin
    .from("creator_profiles")
    .upsert({
      user_id: authUser.id,
      id_card_path: fileName,
      id_card_uploaded_at: new Date().toISOString(),
    }, {
      onConflict: "user_id",
    });

  if (dbErr && dbErr.code !== "42P01") {
    return NextResponse.json({ message: "DB 저장 실패" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
