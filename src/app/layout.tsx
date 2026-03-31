import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
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
  },
  twitter: { card: "summary_large_image" },
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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
