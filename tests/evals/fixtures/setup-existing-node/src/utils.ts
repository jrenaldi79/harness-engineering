export function formatResponse<T>(data: T): { success: boolean; data: T; timestamp: string } {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
}

export function parseId(raw: string): number | null {
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? null : parsed;
}
