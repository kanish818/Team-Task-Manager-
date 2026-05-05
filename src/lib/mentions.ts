const mentionPattern = /@([a-zA-Z0-9_-]{3,64})/g;

export function extractMentionIds(body: string): string[] {
  const ids: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = mentionPattern.exec(body))) {
    ids.push(match[1]);
  }

  return Array.from(new Set(ids));
}
