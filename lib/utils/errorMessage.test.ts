import { describe, it, expect } from "vitest";
import { getUserFacingErrorMessage } from "./errorMessage";

describe("getUserFacingErrorMessage", () => {
  it("returns Error.message for Error", () => {
    expect(getUserFacingErrorMessage(new Error("err"))).toBe("err");
  });

  it("returns string as-is", () => {
    expect(getUserFacingErrorMessage("some string")).toBe("some string");
  });

  it("returns special message for Server Components omitted in production", () => {
    const msg = getUserFacingErrorMessage(
      new Error("Server Components render xxx omitted in production yyy")
    );
    expect(msg).toBe(
      "Серверная ошибка. Проверьте переменные окружения (Supabase, YouTube API и т.п.) и логи хостинга."
    );
  });

  it("returns fallback for undefined", () => {
    expect(getUserFacingErrorMessage(undefined)).toBe("Произошла ошибка");
  });

  it("returns custom fallback for number", () => {
    expect(getUserFacingErrorMessage(42, "Custom")).toBe("Custom");
  });
});
