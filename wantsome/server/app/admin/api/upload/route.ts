/**
 * POST /admin/api/upload — 관리자 이미지 업로드 (Supabase Storage)
 * multipart/form-data { file: File, bucket?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const bucket = (formData.get("bucket") as string | null) ?? "product-images";

  if (!file) return NextResponse.json({ message: "파일이 없습니다." }, { status: 400 });

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ message: "파일 크기는 10MB를 초과할 수 없습니다." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ message: "이미지 파일만 업로드 가능합니다." }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `admin/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await admin.storage
    .from(bucket)
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadErr) {
    return NextResponse.json({ message: uploadErr.message }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage.from(bucket).getPublicUrl(path);

  return NextResponse.json({ url: publicUrl }, { status: 201 });
}
