import type { Metadata } from "next";
import { DocsClient } from "@/components/docs/DocsClient";

export const metadata: Metadata = {
  title: "Documentation - AutaKimi (Windows & Android)",
  description:
    "Learn how to get started with AutaKimi on Windows and Android, configure multi-repo extensions, sync over LAN, enable Floating PiP, browse screenshots, and download CBZ archives.",
  openGraph: {
    title: "Documentation - AutaKimi (Windows & Android)",
    description:
      "Learn how to get started with AutaKimi on Windows and Android, configure multi-repo extensions, sync over LAN, enable Floating PiP, browse screenshots, and download CBZ archives.",
    url: "https://anasx07.github.io/AutaKimi/docs/",
  },
  alternates: {
    canonical: "https://anasx07.github.io/AutaKimi/docs/",
  },
};

export default function DocsPage() {
  return <DocsClient />;
}
