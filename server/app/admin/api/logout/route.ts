import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const response = NextResponse.redirect(new URL("/admin/login", req.url));
  response.cookies.delete("sb-access-token");
  return response;
}
