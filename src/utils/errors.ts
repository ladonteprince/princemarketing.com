// Error narrowing utilities
// WHY: Provides type-safe error handling without try-catch boilerplate

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred";
}

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// WHY: Wraps async operations to return Result instead of throwing
export async function trySafe<T>(
  fn: () => Promise<T>,
): Promise<Result<T, string>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return err(getErrorMessage(error));
  }
}
