import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { AuditProvider } from "@/context/AuditContext";

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  weight: ["400", "500", "600", "700"],
  subsets: ["arabic", "latin"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "موزون | مقياس أمانة النقل",
  description:
    "يقيس موزون أمانة نقل المعنى بين نص شرعي أصلي ونص مشتق منه: طبقة حتمية، وطبقة معجمية، وطبقة دلالية، وحكم واحد بثلاث حالات مع سجل قابل لإعادة التشغيل.",
};

export default function RootLayout(props: LayoutProps<"/">) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${plexArabic.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <head>
        {/*
          Theme resolution, before first paint.

          Runs synchronously in <head> so `data-theme` and `color-scheme` are
          on <html> before the browser paints: a stored choice wins, the OS
          preference is consulted only when nothing is stored, and the default
          is light. Without this the first frame is always light and a dark
          reader sees a flash.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var k="mawzun_theme";var s=localStorage.getItem(k);var m=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;var t=s==="dark"||s==="light"?s:(m?"dark":"light");var d=document.documentElement;d.setAttribute("data-theme",t);d.style.colorScheme=t;}catch(e){}})();',
          }}
        />
        {/*
          Material Symbols is an icon font, so it is not available through
          next/font and has to be loaded with a plain stylesheet link.
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="min-h-full">
        <AuditProvider>
          <AppShell>{props.children}</AppShell>
        </AuditProvider>
      </body>
    </html>
  );
}