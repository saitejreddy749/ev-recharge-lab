import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EV Recharge Lab | Charging stop and reservation demo",
  description: "An explainable EV charging planner with battery reserve estimates and a persistent demo booking network.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
