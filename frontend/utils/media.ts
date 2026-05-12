export function hasRenderableImage(imageUrl?: string | null): boolean {
  return typeof imageUrl === "string" && imageUrl.trim().length > 0;
}
