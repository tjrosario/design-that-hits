import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getIntersections, intersectionSpec, resolveIntersection } from "@/lib/collections";
import { CatalogPage, catalogMetadata } from "@/components/collections/CatalogPage";

/*
  A product type crossed with a theme: `/collections/wrapping-paper/cats`.

  These are the pages that match how people actually search. "Cat wrapping paper" is a real
  query with real intent, and until this route existed the only URL serving it was
  `/?types=wrapping-paper&themes=cats`, which is noindex because arbitrary facet
  combinations are near-duplicates that multiply without limit.

  The sibling `pages` segment is static, so Next resolves `/collections/<type>/pages/2` to
  the type's own deeper-page route before it ever reaches this dynamic one.
*/
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ slug: string; theme: string }>;
}

export async function generateStaticParams() {
  return (await getIntersections()).map((i) => ({ slug: i.type.slug, theme: i.theme.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, theme } = await params;
  const intersection = await resolveIntersection(slug, theme);
  if (!intersection) return { title: "Collection not found" };
  return catalogMetadata(intersectionSpec(intersection), 1);
}

export default async function IntersectionRoute({ params }: PageProps) {
  const { slug, theme } = await params;
  const intersection = await resolveIntersection(slug, theme);
  if (!intersection) notFound();
  return <CatalogPage spec={intersectionSpec(intersection)} page={1} />;
}
