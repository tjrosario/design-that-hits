import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  COLLECTION_PAGE_SIZE,
  getIntersections,
  intersectionSpec,
  resolveIntersection,
} from "@/lib/collections";
import { CatalogPage, catalogMetadata } from "@/components/collections/CatalogPage";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ slug: string; theme: string; n: string }>;
}

// Numeric bound, not a leading-digit one: `/^[2-9]\d*$/` reads as "starts with 2 to 9"
// and so rejected every page from 10 to 19. See the sibling collection route.
function parsePageNumber(raw: string): number | null {
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 2 ? n : null;
}

export async function generateStaticParams() {
  const params: { slug: string; theme: string; n: string }[] = [];
  for (const i of await getIntersections()) {
    const totalPages = Math.ceil(i.count / COLLECTION_PAGE_SIZE);
    for (let n = 2; n <= totalPages; n++) {
      params.push({ slug: i.primary.slug, theme: i.secondary.slug, n: String(n) });
    }
  }
  return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, theme, n } = await params;
  const page = parsePageNumber(n);
  const intersection = page ? await resolveIntersection(slug, theme) : null;
  if (!intersection || !page) return { title: "Collection not found" };
  return catalogMetadata(intersectionSpec(intersection), page);
}

export default async function IntersectionPageRoute({ params }: PageProps) {
  const { slug, theme, n } = await params;
  const page = parsePageNumber(n);
  if (!page) notFound();

  const intersection = await resolveIntersection(slug, theme);
  if (!intersection) notFound();

  return <CatalogPage spec={intersectionSpec(intersection)} page={page} />;
}
