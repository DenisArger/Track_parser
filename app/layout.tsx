import type { Metadata } from "next";
import "./globals.css";
import LocaleHtmlUpdater from "./components/LocaleHtmlUpdater";

export const metadata: Metadata = {
  title: "Track Parser - Radio Track Preparation",
  description: "Automated radio track preparation application",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-200">
        <LocaleHtmlUpdater />
        {children}
      </body>
    </html>
  );
}
