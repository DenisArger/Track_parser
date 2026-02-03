const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/api/radio/sync",
];
const AUTH_PREFIX = "/auth";

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/")))
    return true;
  if (pathname.startsWith(AUTH_PREFIX)) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico" || pathname.startsWith("/favicon."))
    return true;
  return false;
}
