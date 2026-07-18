import type { Metadata } from "next";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";

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
  description: "PrismForge tells first-time founders exactly what to test next and keeps their evidence, decisions, and progress organized until they get real users.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
