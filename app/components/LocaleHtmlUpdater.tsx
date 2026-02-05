"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { locales, defaultLocale, type Locale } from "@/lib/i18n/config";

function detectLocale(pathname: string): Locale {
  const seg = pathname.split("/")[1];
  if (seg && locales.includes(seg as Locale)) {
    return seg as Locale;
  }
  return defaultLocale;
}

export default function LocaleHtmlUpdater() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    const locale = detectLocale(pathname);
    document.documentElement.lang = locale;
  }, [pathname]);

  return null;
}
