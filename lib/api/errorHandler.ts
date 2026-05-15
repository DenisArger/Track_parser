import { NextResponse } from "next/server";
import { buildErrorReport, logServerError } from "@/lib/utils/errorReporter";

/**
 * Обрабатывает ошибки и возвращает стандартизированный ответ
 */
export function handleApiError(
  error: unknown,
  defaultMessage: string = "An error occurred",
  context: {
    operation?: string;
    endpoint?: string;
    statusCode?: number;
  } = {},
): NextResponse {
  const report = buildErrorReport(error, {
    operation: context.operation,
    endpoint: context.endpoint,
    statusCode: context.statusCode,
  });

  logServerError(report);

  const message = error instanceof Error ? error.message : defaultMessage;

  return NextResponse.json(
    {
      error: message,
      success: false,
    },
    { status: context.statusCode ?? 500 },
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
    { status: 400 },
  );
}

/**
 * Обрабатывает ошибки "не найдено"
 */
export function handleNotFoundError(
  message: string = "Resource not found",
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      success: false,
    },
    { status: 404 },
  );
}
