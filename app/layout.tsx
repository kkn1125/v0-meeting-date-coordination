import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import packageJson from "../package.json";
import { NotificationBell } from "@/components/notification-bell";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

// UI에 앱 버전을 표시하기 위해 package.json에서 가져옵니다.
// JSON import은 빌드/SSR 환경에서 결정적으로 렌더링됩니다.
const appVersion = (packageJson as { version?: string }).version ?? "unknown";

export const metadata: Metadata = {
  title: "모임 날짜 조율",
  description:
    "모임 날짜를 쉽게 조율하세요. 참석자들의 가능/불가능한 날짜를 한눈에 확인하세요.",
  generator: "v0.app",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        {children}
        <NotificationBell />
        <div className="fixed bottom-3 left-3 z-50 pointer-events-none select-none">
          <span className="rounded-md border bg-background/80 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur">
            v{appVersion}
          </span>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
