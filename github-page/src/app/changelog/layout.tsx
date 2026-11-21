import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Changelog - AutaKimi",
  description: "Discover new features, bug fixes, performance improvements, and release history for AutaKimi.",
  openGraph: {
    title: "Changelog - AutaKimi",
    description: "Discover new features, bug fixes, performance improvements, and release history for AutaKimi.",
    url: "https://anasx07.github.io/AutaKimi/changelog/",
  },
  alternates: {
    canonical: "https://anasx07.github.io/AutaKimi/changelog/",
  },
};

export default function ChangelogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
