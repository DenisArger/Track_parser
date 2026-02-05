import type { Locale } from "./config";
import type { Messages } from "./types";

import ru from "./messages/ru.json";
import en from "./messages/en.json";

const allMessages: Record<Locale, Messages> = {
  ru,
  en,
};

export function getMessages(locale: Locale): Messages {
  return allMessages[locale] ?? allMessages.ru;
}
