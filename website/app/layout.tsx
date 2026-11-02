import type { Metadata } from "next";
import { Geist, Geist_Mono, Urbanist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Geometric display face for headlines; Geist stays the body font.
const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
});

const description =
  "A browser extension that gives VIT's VTOP portal a ⌘K command menu, dark mode, and helpers for attendance, marks and CGPA.";

export const metadata: Metadata = {
  title: "VTOP Command: a better VTOP",
  description,
  openGraph: { title: "VTOP Command", description, type: "website" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${urbanist.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
