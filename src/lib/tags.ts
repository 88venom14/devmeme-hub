export function parseTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[,\s]+/)
        .map((t) => t.trim().toLowerCase().replace(/^#/, ''))
        .filter((t) => /^[a-z0-9][a-z0-9_-]{0,30}$/.test(t)),
    ),
  );
}
