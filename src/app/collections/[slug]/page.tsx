import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { collectionSpec, getCollections, resolveCollection } from "@/lib/collections";
import { CatalogPage, catalogMetadata } from "@/components/collections/CatalogPage";

// Revalidated daily alongside the product pages: a collection changes only when the
// catalog is re-synced.
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return (await getCollections()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const collection = await resolveCollection((await params).slug);
  if (!collection) return { title: "Collection not found" };
  return catalogMetadata(await collectionSpec(collection), 1);
}

export default async function CollectionRoute({ params }: PageProps) {
  const collection = await resolveCollection((await params).slug);
  if (!collection) notFound();
  return <CatalogPage spec={await collectionSpec(collection)} page={1} />;
}
