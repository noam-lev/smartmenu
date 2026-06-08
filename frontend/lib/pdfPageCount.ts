/**
 * Lightweight PDF page counter (no external deps — avoids Next webpack resolution issues).
 * Used only for pre-upload validation; the server re-validates with pypdfium2.
 */
export async function getPdfPageCount(file: File): Promise<number> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 8) {
    throw new Error("Could not read PDF.");
  }

  const header = new TextDecoder("latin1").decode(bytes.slice(0, 8));
  if (!header.startsWith("%PDF-")) {
    throw new Error("Could not read PDF.");
  }

  const text = new TextDecoder("latin1").decode(bytes);

  // Root Pages dictionary /Count is the most reliable signal in typical menu PDFs.
  const pagesCount = text.match(/\/Type\s*\/Pages\b[\s\S]{0,800}?\/Count\s+(\d+)/);
  if (pagesCount) {
    const count = Number.parseInt(pagesCount[1], 10);
    if (count > 0) return count;
  }

  // Fallback: count individual page objects.
  const pageObjects = text.match(/\/Type\s*\/Page(?!s)/g);
  if (pageObjects && pageObjects.length > 0) {
    return pageObjects.length;
  }

  throw new Error("Could not read PDF.");
}
