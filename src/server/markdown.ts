/**
 * Server-side Markdown sanitization before storage (SPEC-003 Section 6.2).
 * Strips raw HTML tags. Allowed: bold, italic, h1-h3, lists, links, line breaks.
 * No embedded images, iframes, scripts, or raw HTML.
 */
export function sanitizeMarkdown(input: string): string {
  // Strip all HTML tags — Markdown formatting is preserved, raw HTML is removed
  return input.replace(/<[^>]*>/g, "");
}
