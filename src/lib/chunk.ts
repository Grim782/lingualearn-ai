// Robust text chunking by paragraphs/sentences without cutting mid-sentence
// Exports: splitIntoChunks, normalizeWhitespace

export type ChunkResult = {
  chunks: string[];
  warnings: string[];
};

const DEFAULT_LIMIT = Number(process.env.CHUNK_CHAR_LIMIT || 3000);

export function normalizeWhitespace(input: string) {
  return input.replace(/\r\n?/g, "\n");
}

export function splitIntoChunks(text: string, limit = DEFAULT_LIMIT): ChunkResult {
  const warnings: string[] = [];
  const clean = normalizeWhitespace(text).trim();
  if (clean.length <= limit) return { chunks: [clean], warnings };

  // First split by blank-line paragraphs
  const paragraphs = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim().length) chunks.push(current.trim());
    current = "";
  };

  const tryAdd = (piece: string) => {
    if ((current + (current ? "\n\n" : "") + piece).length <= limit) {
      current = current ? current + "\n\n" + piece : piece;
      return;
    }
    // If a single paragraph is too large, split by sentences
    if (piece.length > limit) {
      const sentences = piece.split(/(?<=[.!?])\s+/);
      let sBuf = "";
      for (const s of sentences) {
        if ((sBuf + (sBuf ? " " : "") + s).length <= limit) {
          sBuf = sBuf ? sBuf + " " + s : s;
        } else {
          if (sBuf) {
            if (current) flush();
            chunks.push(sBuf.trim());
            sBuf = "";
          }
          if (s.length > limit) {
            // Extremely long token; hard cut but avoid breaking words where possible
            let start = 0;
            while (start < s.length) {
              const slice = s.slice(start, start + limit);
              chunks.push(slice.trim());
              start += limit;
            }
          } else {
            sBuf = s;
          }
        }
      }
      if (sBuf) {
        if (current) flush();
        chunks.push(sBuf.trim());
        return;
      }
      return;
    }
    // Paragraph fits alone, flush current and start new
    if (current) flush();
    current = piece;
  };

  for (const p of paragraphs) tryAdd(p);
  if (current) flush();

  if (chunks.length > 1) warnings.push(`Input was chunked into ${chunks.length} parts to process safely.`);
  return { chunks, warnings };
}