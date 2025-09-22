import { describe, it, expect } from "vitest";
import { splitIntoChunks, normalizeWhitespace } from "@/lib/chunk";

describe("chunking", () => {
  it("returns single chunk when under limit", () => {
    const text = "Hello world";
    const { chunks, warnings } = splitIntoChunks(text, 100);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(text);
    expect(warnings.length).toBe(0);
  });

  it("splits by paragraphs first", () => {
    const text = Array.from({ length: 5 }, (_, i) => `Para ${i + 1} `.repeat(50)).join("\n\n");
    const { chunks, warnings } = splitIntoChunks(text, 120);
    expect(chunks.length).toBeGreaterThan(1);
    expect(warnings.length).toBeGreaterThanOrEqual(0);
    // Ensure no chunk exceeds limit
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(120);
  });

  it("normalizes CRLF to LF", () => {
    const t = "a\r\nb\r\nc";
    expect(normalizeWhitespace(t)).toBe("a\nb\nc");
  });
});