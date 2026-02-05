"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase/client";
import { getLocaleFromPathname, withLocalePath } from "@/lib/i18n/path";
import { useI18n } from "./I18nProvider";

export default function AuthLoginPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname() || "/";
  const locale = getLocaleFromPathname(pathname);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabase();
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
        return;
      }
      router.replace(`/${locale}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-16 card">
      <h2 className="text-xl font-semibold mb-4 dark:text-gray-100">{t("auth.loginTitle")}</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t("auth.emailLabel")}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
            autoComplete="email"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t("auth.passwordLabel")}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
            autoComplete="current-password"
          />
        </div>
        {error && (
          <div className="text-sm text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg p-2">
            {error}
          </div>
        )}
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? t("auth.loginActionLoading") : t("auth.loginAction")}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        <Link
          href={withLocalePath("/signup", locale)}
          className="text-primary-600 dark:text-primary-400 hover:underline"
        >
          {t("auth.signupLink")}
        </Link>
        {" · "}
        <Link
          href={withLocalePath("/forgot-password", locale)}
          className="text-primary-600 dark:text-primary-400 hover:underline"
        >
          {t("auth.forgotLink")}
        </Link>
      </p>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {t("auth.confirmEmailHint")}
      </p>
    </div>
  );
}
