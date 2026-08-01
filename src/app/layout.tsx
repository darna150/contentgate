import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://contentgate.app"),
  title: "ContentGate",
  description:
    "Approved knowledge in, compliant content out. Generate localized marketing content from approved documents, gated by approval.",
  icons: {
    icon: [
      {
        url: "/brand/contentgate/favicon-16.svg",
        sizes: "16x16",
        type: "image/svg+xml",
      },
      {
        url: "/brand/contentgate/favicon-32.svg",
        sizes: "32x32",
        type: "image/svg+xml",
      },
      {
        url: "/brand/contentgate/favicon-64.svg",
        sizes: "64x64",
        type: "image/svg+xml",
      },
    ],
    shortcut: "/brand/contentgate/favicon-32.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
      >
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
