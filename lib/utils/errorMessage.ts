/**
 * Преобразует ошибку (в т.ч. обобщённую от Next.js в production)
 * в сообщение, которое можно показывать пользователю.
 */
export function getUserFacingErrorMessage(error: unknown, fallback = "Произошла ошибка"): string {
  if (error instanceof Error && error.message) {
    if (
      error.message.includes("Server Components render") &&
      error.message.includes("omitted in production")
    ) {
      return "Серверная ошибка. Проверьте переменные окружения (Supabase, YouTube API и т.п.) и логи хостинга.";
    }
    return error.message;
  }
  return typeof error === "string" ? error : fallback;
}
