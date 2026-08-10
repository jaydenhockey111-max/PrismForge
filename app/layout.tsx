import type { Metadata } from "next";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const themeBootScript = `
  (() => {
    try {
      const saved = localStorage.getItem("prismforge-theme");
      const theme = saved === "light" || saved === "dark"
        ? saved
        : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    } catch {
      document.documentElement.dataset.theme = "light";
    }
  })();
`;

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "PrismForge remembers what founders are building, learns from real outcomes, and tells them exactly what to do next—or helps them do it.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
