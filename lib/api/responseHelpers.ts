import { NextResponse } from "next/server";

/**
 * Создает успешный ответ API
 */
export function createSuccessResponse<T = unknown>(
  data?: T,
  message?: string
): NextResponse {
  return NextResponse.json({
    success: true,
    ...(data && { data }),
    ...(message && { message }),
  });
}

/**
 * Создает успешный ответ с треком
 */
export function createTrackResponse(
  track: unknown,
  message?: string
): NextResponse {
  return NextResponse.json({
    success: true,
    track,
    ...(message && { message }),
  });
}
