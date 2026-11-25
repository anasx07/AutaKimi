import type { Metadata } from "next";
import { DocsOverview } from "@/components/docs/DocsOverview";

export const metadata: Metadata = {
  title: "Documentation - AutaKimi (Windows & Android)",
  description:
    "Full AutaKimi documentation: setup guides, multi-repo extensions, Floating PiP, Night Eye-Care, LAN sync, FAQs, and screenshots.",
  openGraph: {
    title: "Documentation - AutaKimi (Windows & Android)",
    description:
      "Full AutaKimi documentation: setup guides, multi-repo extensions, Floating PiP, Night Eye-Care, LAN sync, FAQs, and screenshots.",
    url: "https://anasx07.github.io/AutaKimi/docs/",
  },
  alternates: {
    canonical: "https://anasx07.github.io/AutaKimi/docs/",
  },
};

export default function DocsPage() {
  return <DocsOverview />;
}
