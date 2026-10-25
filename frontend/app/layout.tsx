import type { Metadata, Viewport } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Providers } from "@/components/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "سیر | سوپراپ سفر ایران",
    template: "%s | سیر",
  },
  description:
    "سیر، سوپراپ هوشمند سفر: جستجوی بلیت و هتل، رزرو آنلاین، برنامه‌ریزی سفر با هوش مصنوعی، تجربه‌های محلی و پاسپورت سفر.",
  keywords: ["سفر", "رزرو هتل", "بلیت هواپیما", "گردشگری", "ایران", "سیر"],
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://seir.ir"),
  icons: { icon: "/brand-mark.svg", apple: "/brand-mark.svg" },
  openGraph: {
    title: "سیر | سوپراپ سفر ایران",
    description: "همه‌چیز برای یک سفر بی‌دغدغه؛ از جستجو و رزرو تا برنامه‌ریزی هوشمند.",
    locale: "fa_IR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e7c66",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="font-sans antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
