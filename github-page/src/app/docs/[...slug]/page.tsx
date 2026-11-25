import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DOC_PAGES, findDocPage } from "@/data/docs";
import { DocsShell } from "@/components/docs/DocsShell";

export function generateStaticParams() {
  return DOC_PAGES.map((page) => ({
    slug: page.slug.split("/"),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const resolved = await params;
  const slugPath = resolved.slug.join("/");
  const page = findDocPage(slugPath);
  if (!page) {
    return { title: "Docs - AutaKimi" };
  }
  return {
    title: `${page.title} - AutaKimi Docs`,
    description: page.subtitle,
    alternates: {
      canonical: `https://anasx07.github.io/AutaKimi/docs/${page.slug}/`,
    },
  };
}

export default async function DocArticlePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const resolved = await params;
  const slugPath = resolved.slug.join("/");
  const page = findDocPage(slugPath);

  if (!page) {
    notFound();
  }

  return <DocsShell page={page} />;
}
