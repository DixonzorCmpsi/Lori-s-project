import { describe, it, expect } from "vitest";
import { sanitizeMarkdown } from "@/server/markdown";

describe("Markdown sanitization", () => {
  // DIR-20: XSS script tag in Markdown
  it("strips script tags", () => {
    const input = "Hello <script>alert('xss')</script> world";
    expect(sanitizeMarkdown(input)).toBe("Hello alert('xss') world");
  });

  // SEC-02: XSS payloads in bulletin posts
  it("strips iframe tags", () => {
    const input = 'Check <iframe src="evil.com"></iframe> this';
    expect(sanitizeMarkdown(input)).toBe("Check  this");
  });

  it("strips img tags with onerror", () => {
    const input = '<img src=x onerror=alert(1)>';
    expect(sanitizeMarkdown(input)).toBe("");
  });

  it("strips event handler attributes in divs", () => {
    const input = '<div onmouseover="alert(1)">hover me</div>';
    expect(sanitizeMarkdown(input)).toBe("hover me");
  });

  it("preserves Markdown formatting", () => {
    const input = "**bold** and *italic* and `code`";
    expect(sanitizeMarkdown(input)).toBe("**bold** and *italic* and `code`");
  });

  it("preserves Markdown links", () => {
    const input = "[click here](https://example.com)";
    expect(sanitizeMarkdown(input)).toBe("[click here](https://example.com)");
  });

  it("preserves Markdown lists", () => {
    const input = "- item 1\n- item 2\n- item 3";
    expect(sanitizeMarkdown(input)).toBe("- item 1\n- item 2\n- item 3");
  });

  it("preserves Markdown headings", () => {
    const input = "# Heading 1\n## Heading 2\n### Heading 3";
    expect(sanitizeMarkdown(input)).toBe("# Heading 1\n## Heading 2\n### Heading 3");
  });

  it("handles nested HTML tags", () => {
    const input = "<div><span><script>alert(1)</script></span></div>";
    expect(sanitizeMarkdown(input)).toBe("alert(1)");
  });

  it("handles empty input", () => {
    expect(sanitizeMarkdown("")).toBe("");
  });
});
