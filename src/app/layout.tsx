import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mallumeet - Talk with Strangers Online",
  description:
    "Mallumeet is a free online chat platform to meet and talk with strangers securely. Start chatting instantly without signup.",
  keywords: [
    "chat with strangers",
    "online chat",
    "video call strangers",
    "Mallumeet",
    "Omegle alternative",
    "free chat app",
  ],
  openGraph: {
    title: "Mallumeet - Talk with Strangers Online",
    description:
      "Mallumeet lets you chat and video call with strangers instantly. 100% free and secure.",
    url: "https://mallumeet.netlify.app",
    siteName: "Mallumeet",
    images: [
      {
        url: "https://mallumeet.netlify.app/og-image.jpg", // Replace with actual image
        width: 1200,
        height: 630,
        alt: "Mallumeet Chat with Strangers",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mallumeet - Talk with Strangers Online",
    description:
      "Mallumeet is a free online chat platform to meet and talk with strangers instantly.",
    images: ["https://mallumeet.netlify.app/og-image.jpg"], // Replace with actual image
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <meta
          name="google-site-verification"
          content="UwagtvATq-H_0ioBM6VrGThbBATf5bDOBsM28bPZbOs"
        />
      </head>
      <body className={`${inter.className} h-full bg-gray-100`}>
        <main className="h-full">{children}</main>
      </body>
    </html>
  );
}
