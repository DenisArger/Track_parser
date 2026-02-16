import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import packageJson from "../../package.json";
import { getAuthUser } from "@/lib/supabase/server";
import { logoutAction } from "@/lib/actions/authActions";
import { locales, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/getMessages";
import ThemeToggle from "../components/ThemeToggle";
import LocaleSwitcher from "../components/LocaleSwitcher";
import { I18nProvider } from "../components/I18nProvider";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = locales.includes(locale as Locale) ? (locale as Locale) : "ru";
  const messages = getMessages(safeLocale);
  const title =
    typeof messages.layout === "object" && messages.layout && "title" in messages.layout
      ? String((messages.layout as Record<string, unknown>).title)
      : "Track Parser";
  const description =
    typeof messages.layout === "object" && messages.layout && "subtitle" in messages.layout
      ? String((messages.layout as Record<string, unknown>).subtitle)
      : "Automated radio track preparation application";

  return {
    title,
    description,
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  const typedLocale = locale as Locale;
  const messages = getMessages(typedLocale);
  const user = await getAuthUser();

  const layout = messages.layout as Record<string, string> | undefined;
  const title = layout?.title ?? "Track Parser";
  const subtitle = layout?.subtitle ?? "";
  const loginLabel = layout?.login ?? "Login";
  const signupLabel = layout?.signup ?? "Sign up";
  const logoutLabel = layout?.logout ?? "Logout";
  const appVersion = packageJson.version || "dev";

  return (
    <I18nProvider locale={typedLocale} messages={messages}>
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LocaleSwitcher />
            <ThemeToggle />
            {user ? (
              <>
                <span className="text-sm text-gray-600 dark:text-gray-400">{user.email}</span>
                <form action={logoutAction}>
                  <button type="submit" className="btn btn-secondary text-sm">
                    {logoutLabel}
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href={`/${typedLocale}/login`} className="btn btn-secondary text-sm">
                  {loginLabel}
                </Link>
                <Link href={`/${typedLocale}/signup`} className="btn btn-primary text-sm">
                  {signupLabel}
                </Link>
              </>
            )}
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-8 flex justify-end">
          <span className="text-[11px] text-gray-400 dark:text-gray-500 opacity-70 select-none">
            v{appVersion}
          </span>
        </footer>
      </div>
    </I18nProvider>
  );
}
