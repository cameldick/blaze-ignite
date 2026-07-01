import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blaze Ignite — Support & Vote-to-Action",
  description:
    "Turn real Blaze events — Thanks, Backstage votes, subs, and follows — into live, animated OBS overlays. Powered by Blaze.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
