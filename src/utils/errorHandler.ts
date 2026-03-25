export function logError(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[${scope}] ${message}`);
}

export async function withErrorFallback<T>(
  scope: string,
  operation: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logError(scope, error);
    return fallback;
  }
}
