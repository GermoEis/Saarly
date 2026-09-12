export function normalizeNoteUrl(value: string): string | undefined {
  const clean = value.trim();
  if (!clean) return undefined;
  if (/\s/.test(clean)) return undefined;
  try {
    const parsed = new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`);
    return ['http:', 'https:'].includes(parsed.protocol) && parsed.hostname && !parsed.hostname.includes('%') ? parsed.toString() : undefined;
  } catch { return undefined; }
}
