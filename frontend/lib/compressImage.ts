const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 0.85;

/**
 * Resize and compress a menu photo for upload (max 2000px, JPEG).
 * Keeps multi-image batch payloads within a reasonable size for the API.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Image compression is not supported in this browser.");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Failed to compress image."));
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  const baseName = file.name.replace(/\.[^.]+$/, "") || "menu";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

export async function compressImagesForUpload(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImageForUpload));
}
