import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = createSupabaseAdmin();

  const { data, error } = await admin
    .from("products")
    .select(
      `id, name, description, price, original_price, category, tags, images, stock, sold_count,
       owner_type, creator_id, created_at, creators:creator_id(display_name)`,
    )
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    return NextResponse.json({ message: "상품을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    product: {
      ...data,
      creator_display_name: (data.creators as { display_name?: string } | null)?.display_name ?? null,
      creators: undefined,
    },
  });
}
