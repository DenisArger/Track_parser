import { NextResponse } from "next/server";

/**
 * Обрабатывает ошибки и возвращает стандартизированный ответ
 */
export function handleApiError(
  error: unknown,
  defaultMessage: string = "An error occurred"
): NextResponse {
  const message = error instanceof Error ? error.message : defaultMessage;
  console.error("API Error:", error);

  return NextResponse.json(
    {
      error: message,
      success: false,
    },
    { status: 500 }
  );
}

/**
 * Обрабатывает ошибки валидации
 */
export function handleValidationError(message: string): NextResponse {
  return NextResponse.json(
    {
      error: message,
      success: false,
    },
    { status: 400 }
  );
}

/**
 * Обрабатывает ошибки "не найдено"
 */
export function handleNotFoundError(
  message: string = "Resource not found"
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      success: false,
    },
    { status: 404 }
  );
}
