import { ApiError } from "~/lib/api";
import { toErrorMessage } from "~/lib/errors";

export function resolveActionIntent<const T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

export function toActionErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return toErrorMessage(error, fallbackMessage);
}

export function getRedirectTarget(request: Request, fallbackPath: string) {
  const url = new URL(request.url);
  return url.searchParams.get("redirect") || fallbackPath;
}
