/** Relative luminance threshold (WCAG-style) for picking header text color. */
const LUMINANCE_TEXT_LIGHT = 0.55;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().toLowerCase();
  const match = /^#([0-9a-f]{6})$/.exec(normalized);
  if (!match) {
    return null;
  }
  const value = match[1];
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (channel: number) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export type CategoryHeaderStyle = {
  backgroundColor?: string;
  color?: string;
};

/** Inline styles for category section headers; null/undefined color uses default zinc styling. */
export function categoryHeaderStyle(headerColor: string | null | undefined): CategoryHeaderStyle {
  if (!headerColor) {
    return {};
  }

  const rgb = hexToRgb(headerColor);
  if (!rgb) {
    return {};
  }

  const lum = relativeLuminance(rgb.r, rgb.g, rgb.b);
  return {
    backgroundColor: headerColor,
    color: lum > LUMINANCE_TEXT_LIGHT ? "#18181b" : "#ffffff",
  };
}
