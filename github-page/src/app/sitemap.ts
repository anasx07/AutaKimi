import { MetadataRoute } from "next";
import { DOC_PAGES } from "@/data/docs";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://anasx07.github.io/AutaKimi";
  const now = new Date();

  const docEntries: MetadataRoute.Sitemap = DOC_PAGES.map((p) => ({
    url: `${baseUrl}/docs/${p.slug}/`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/docs/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/changelog/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    ...docEntries,
  ];
}
