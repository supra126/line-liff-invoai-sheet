import type { Metadata } from "next";
import { DM_Sans, Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
});

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  variable: "--font-noto-sans-tc",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: process.env.SITE_TITLE || "發票登錄",
  description: "拍照或手動輸入，快速登錄發票資訊",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body
        className={`${dmSans.variable} ${notoSansTC.variable} bg-background text-foreground antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
