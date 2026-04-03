import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { StructuredData } from "@/components/StructuredData";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://princemarketing.com"),
  title: {
    default: "PrinceMarketing - Your marketing, handled.",
    template: "%s | PrinceMarketing",
  },
  description:
    "AI-powered marketing platform for solo business owners.",
  openGraph: {
    type: "website",
    url: "https://princemarketing.com",
    siteName: "PrinceMarketing",
    title: "PrinceMarketing - Your marketing, handled.",
    description: "AI-powered marketing platform for solo business owners.",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "PrinceMarketing - Your marketing, handled.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/og-image.png"],
  },
  robots: { index: true, follow: true },
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body className="overflow-x-hidden bg-void text-cloud">
        <GoogleAnalytics />
        <StructuredData />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
