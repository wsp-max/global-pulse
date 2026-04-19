import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  JetBrains_Mono,
  Noto_Sans_JP,
  Noto_Sans_KR,
  Space_Mono,
} from "next/font/google";
import { HealthStrip } from "@/components/dashboard/HealthStrip";
import { Header } from "@/components/layout/Header";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import "./globals.css";

const displayFont = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-display",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const bodyFontKr = Noto_Sans_KR({
  subsets: ["latin"],
  variable: "--font-body-kr",
});

const bodyFontJp = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-body-jp",
});

export const metadata: Metadata = {
  title: "Global Pulse",
  description:
    "Real-time global community and social sentiment monitoring dashboard.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const langCookie = cookieStore.get("gp_lang")?.value;
  const htmlLang = langCookie === "en" ? "en" : "ko";

  return (
    <html
      lang={htmlLang}
      className={`${displayFont.variable} ${monoFont.variable} ${bodyFontKr.variable} ${bodyFontJp.variable}`}
    >
      <body className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased">
        <Header />
        <HealthStrip />
        <ErrorBoundary>
          <div className="min-h-screen pb-20 md:pb-0">{children}</div>
        </ErrorBoundary>
        <MobileBottomNav />
      </body>
    </html>
  );
}


