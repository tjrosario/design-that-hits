import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCollections, resolveCollection } from "@/lib/collections";
import { CollectionView, collectionMetadata } from "@/components/collections/CollectionView";

/*
  Page one of a collection. Deeper pages live at ./pages/[n].

  Revalidated daily alongside the product pages: a collection's contents change only when
  the catalogue is re-synced, so there is nothing to gain from rendering per request.
*/
export const revalidate = 86400;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const collections = await getCollections();
  return collections.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const collection = await resolveCollection((await params).slug);
  if (!collection) return { title: "Collection not found" };
  return collectionMetadata(collection, 1);
}

export default async function CollectionPage({ params }: PageProps) {
  const collection = await resolveCollection((await params).slug);
  if (!collection) notFound();
  return <CollectionView collection={collection} page={1} />;
}
