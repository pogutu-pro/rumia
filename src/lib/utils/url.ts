export function buildQueryString(params: Record<string, unknown>): string {
  return new URLSearchParams(
    Object.entries(params).reduce(
      (acc, [k, v]) => {
        if (v !== undefined) acc[k] = String(v);
        return acc;
      },
      {} as Record<string, string>,
    ),
  ).toString();
}
