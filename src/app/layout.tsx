import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
