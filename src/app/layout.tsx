import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      className={`${instrumentSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
