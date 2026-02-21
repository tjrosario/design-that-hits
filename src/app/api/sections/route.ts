import { NextResponse } from "next/server";
import { getShopSections } from "@/lib/etsy";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sections = await getShopSections();
    return NextResponse.json({ sections });
  } catch (err) {
    console.error("[/api/sections] Error:", err);
    return NextResponse.json({ error: "Failed to fetch sections." }, { status: 500 });
  }
}
