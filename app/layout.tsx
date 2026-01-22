import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getAuthUser } from "@/lib/supabase/server";
import { logoutAction } from "@/lib/actions/authActions";
import ThemeToggle from "./components/ThemeToggle";

export const metadata: Metadata = {
  title: "Track Parser - Radio Track Preparation",
  description: "Automated radio track preparation application",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-900 min-h-screen transition-colors duration-200">
        <div className="container mx-auto px-4 py-8">
          <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Track Parser
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Automated radio track preparation and management
              </p>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {user ? (
                <>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{user.email}</span>
                  <form action={logoutAction}>
                    <button type="submit" className="btn btn-secondary text-sm">
                      Выйти
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn btn-secondary text-sm">
                    Вход
                  </Link>
                  <Link href="/signup" className="btn btn-primary text-sm">
                    Регистрация
                  </Link>
                </>
              )}
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
