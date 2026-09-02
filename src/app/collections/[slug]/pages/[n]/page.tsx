import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  COLLECTION_PAGE_SIZE,
  collectionQuery,
  getCollections,
  resolveCollection,
} from "@/lib/collections";
import { getListings } from "@/lib/shop";
import { CollectionView, collectionMetadata } from "@/components/collections/CollectionView";

/*
  Pages two and up of a collection.

  A path segment rather than `?page=2` so these prerender like every other page. It also
  keeps the pagination crawlable by plain link-following, which is how the deeper products
  in each category get discovered without leaning on the sitemap.
*/
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
  return collectionMetadata(collection, page);
}

export default async function CollectionPageN({ params }: PageProps) {
  const { slug, n } = await params;
  const page = parsePageNumber(n);
  if (!page) notFound();

  const collection = await resolveCollection(slug);
  if (!collection) notFound();

  return <CollectionView collection={collection} page={page} />;
}
