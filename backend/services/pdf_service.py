"""Convert PDF menu uploads to JPEG page images (BSD-licensed pypdfium2)."""

from __future__ import annotations

import io

import pypdfium2 as pdfium

MAX_PAGE_DIMENSION_PX = 2000
JPEG_QUALITY = 85


class PdfConversionError(ValueError):
    """Raised when a PDF cannot be converted to images."""


def pdf_to_jpeg_pages(
    pdf_bytes: bytes,
    *,
    max_pages: int,
) -> list[bytes]:
    """Render each PDF page to a JPEG byte string in memory."""
    if not pdf_bytes:
        raise PdfConversionError("Uploaded PDF is empty.")

    try:
        pdf = pdfium.PdfDocument(pdf_bytes)
    except Exception as exc:
        raise PdfConversionError(
            "Could not open PDF. The file may be corrupted or password-protected."
        ) from exc

    try:
        page_count = len(pdf)
        if page_count == 0:
            raise PdfConversionError("PDF has no pages.")
        if page_count > max_pages:
            raise PdfConversionError(
                f"PDF has {page_count} pages; maximum allowed is {max_pages}."
            )

        pages: list[bytes] = []
        for index in range(page_count):
            page = pdf[index]
            width_pt, height_pt = page.get_size()
            max_pt = max(width_pt, height_pt)
            scale = min(3.0, max(1.0, MAX_PAGE_DIMENSION_PX / max_pt))
            bitmap = page.render(scale=scale)
            try:
                pil_image = bitmap.to_pil()
                buf = io.BytesIO()
                pil_image.save(
                    buf,
                    format="JPEG",
                    quality=JPEG_QUALITY,
                    optimize=True,
                )
                pages.append(buf.getvalue())
            finally:
                bitmap.close()

        return pages
    finally:
        pdf.close()
