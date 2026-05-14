import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Assistant, Geist_Mono } from "next/font/google";
import "./globals.css";

const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tafrito.com"),
  title: "Tafrito — תפריט דיגיטלי חכם למסעדות",
  description:
    "הפוך את התפריט שלך לכלי מכירה עוצמתי. חוויית הזמנה מודרנית, מעוצבת ומהירה.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml" }],
  },
  robots: { index: false, follow: false },
  openGraph: {
    title: "Tafrito — תפריט דיגיטלי חכם למסעדות",
    description:
      "הפוך את התפריט שלך לכלי מכירה עוצמתי. חוויית הזמנה מודרנית, מעוצבת ומהירה.",
    url: "https://tafrito.com",
    siteName: "Tafrito",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    locale: "he_IL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Tafrito — תפריט דיגיטלי חכם למסעדות",
    description:
      "הפוך את התפריט שלך לכלי מכירה עוצמתי. חוויית הזמנה מודרנית, מעוצבת ומהירה.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" className={`${assistant.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-[100dvh] flex flex-col font-sans tracking-tight leading-snug">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
