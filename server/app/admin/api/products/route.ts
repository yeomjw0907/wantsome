import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminSession } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUser = await verifyAdminSession(req);
  if (!adminUser) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit    = 30;
  const category = searchParams.get("category") ?? "all";
  const q        = searchParams.get("q") ?? "";

  const admin = createSupabaseAdmin();

  let query = admin
    .from("products")
    .select("id, name, description, price, original_price, category, tags, images, stock, is_active, sold_count, creator_id, created_at");

  if (category !== "all") query = query.eq("category", category);
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ products: data ?? [], hasMore: (data ?? []).length >= limit });
}

export async function POST(req: NextRequest) {
  const adminUser = await verifyAdminSession(req);
  if (!adminUser) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, price, original_price, category, tags, images, stock } = body;

  if (!name || !price || !category) {
    return NextResponse.json({ message: "name, price, category는 필수입니다." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("products")
    .insert({
      name,
      description: description ?? null,
      price: parseInt(price, 10),
      original_price: original_price ? parseInt(original_price, 10) : null,
      category,
      tags: tags ?? [],
      images: images ?? [],
      stock: stock ?? -1,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ id: data.id }, { status: 201 });
}
