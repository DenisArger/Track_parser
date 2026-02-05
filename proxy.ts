import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isPublicPath } from "@/lib/utils/authPaths";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/config";

const PUBLIC_FILE = /\.(.*)$/;

function getLocaleFromPathname(pathname: string): Locale | null {
  const seg = pathname.split("/")[1];
  if (seg && locales.includes(seg as Locale)) return seg as Locale;
  return null;
}

function stripLocale(pathname: string): string {
  const seg = pathname.split("/")[1];
  if (seg && locales.includes(seg as Locale)) {
    return pathname.replace(`/${seg}`, "") || "/";
  }
  return pathname;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/favicon.ico") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const locale = getLocaleFromPathname(pathname);
  if (!locale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const authPath = stripLocale(pathname);
  if (!user && !isPublicPath(authPath)) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
