import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  COLLECTION_PAGE_SIZE,
  collectionQuery,
  collectionSpec,
  getCollections,
  resolveCollection,
} from "@/lib/collections";
import { getListings } from "@/lib/shop";
import { CatalogPage, catalogMetadata } from "@/components/collections/CatalogPage";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ slug: string; n: string }>;
}

/** Only real page numbers resolve; `/pages/0`, `/pages/1` and junk all 404. */
function parsePageNumber(raw: string): number | null {
  if (!/^[2-9]\d*$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) ? n : null;
}

export async function generateStaticParams() {
  const collections = await getCollections();

  const params: { slug: string; n: string }[] = [];
  for (const collection of collections) {
    const result = await getListings({ ...collectionQuery(collection), limit: 1 });
    if (!result.ok) continue;

    const totalPages = Math.ceil(result.data.total / COLLECTION_PAGE_SIZE);
    for (let n = 2; n <= totalPages; n++) params.push({ slug: collection.slug, n: String(n) });
  }
  return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, n } = await params;
  const page = parsePageNumber(n);
  const collection = page ? await resolveCollection(slug) : null;
  if (!collection || !page) return { title: "Collection not found" };
  return catalogMetadata(await collectionSpec(collection), page);
}

export default async function CollectionPageRoute({ params }: PageProps) {
  const { slug, n } = await params;
  const page = parsePageNumber(n);
  if (!page) notFound();

  const collection = await resolveCollection(slug);
  if (!collection) notFound();

  return <CatalogPage spec={await collectionSpec(collection)} page={page} />;
}
