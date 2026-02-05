"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/types";

type I18nContextValue = {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getNestedValue(messages: Messages, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, messages);
}

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return Object.keys(vars).reduce((result, k) => {
    return result.split(`{${k}}`).join(String(vars[k]));
  }, template);
}

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const t = useMemo(() => {
    return (key: string, vars?: Record<string, string | number>) => {
      const value = getNestedValue(messages, key);
      if (typeof value === "string") {
        return interpolate(value, vars);
      }
      return key;
    };
  }, [messages]);

  return <I18nContext.Provider value={{ locale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
