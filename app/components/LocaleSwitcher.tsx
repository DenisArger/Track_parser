"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, type Locale } from "@/lib/i18n/config";
import { useI18n } from "./I18nProvider";

function switchLocale(pathname: string, nextLocale: Locale) {
  const segments = pathname.split("/");
  const current = segments[1];
  if (current && locales.includes(current as Locale)) {
    segments[1] = nextLocale;
  } else {
    segments.splice(1, 0, nextLocale);
  }
  const nextPath = segments.join("/");
  return nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
}

export default function LocaleSwitcher() {
  const pathname = usePathname() || "/";
  const { locale, t } = useI18n();

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{t("layout.language")}:</span>
      {locales.map((l) => (
        <Link
          key={l}
          href={switchLocale(pathname, l)}
          className={`px-2 py-1 rounded border text-xs font-medium transition-colors ${
            l === locale
              ? "border-primary-600 text-primary-700 dark:border-primary-400 dark:text-primary-300"
              : "border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-300"
          }`}
          aria-current={l === locale ? "page" : undefined}
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
