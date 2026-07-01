import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blaze Ignite — Tip-to-Action",
  description:
    "Real on-chain tips drive live, verified on-stream actions for Blaze creators.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
