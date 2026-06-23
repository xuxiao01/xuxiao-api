export function success<T>(data: T) {
  return {
    success: true as const,
    data,
  };
}

export function fail(message: string) {
  return {
    success: false as const,
    message,
  };
}
