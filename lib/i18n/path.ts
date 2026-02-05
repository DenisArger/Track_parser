import { defaultLocale, locales, type Locale } from "./config";

export function getLocaleFromPathname(pathname: string): Locale {
  const segment = pathname.split("/")[1];
  if (segment && locales.includes(segment as Locale)) {
    return segment as Locale;
  }
  return defaultLocale;
}

export function withLocalePath(pathname: string, locale: Locale) {
  const segments = pathname.split("/");
  if (segments[1] && locales.includes(segments[1] as Locale)) {
    segments[1] = locale;
  } else {
    segments.splice(1, 0, locale);
  }
  const nextPath = segments.join("/");
  return nextPath.startsWith("/") ? nextPath : `/${nextPath}`;
}
