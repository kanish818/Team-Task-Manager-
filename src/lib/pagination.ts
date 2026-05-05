export type CursorParams = {
  cursor?: string;
  take: number;
};

export function parseCursorParams(url: string): CursorParams {
  const { searchParams } = new URL(url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const takeParam = searchParams.get("take");
  const take = takeParam ? Number(takeParam) : 20;
  return { cursor, take: Number.isNaN(take) ? 20 : Math.min(Math.max(take, 1), 50) };
}
