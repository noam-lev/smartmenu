"use client";

import { useCallback, useState, type SyntheticEvent } from "react";

export function useImageLoadFailure() {
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, true>>({});

  const markImageFailed = useCallback((url: string | null | undefined) => {
    if (!url) {
      return;
    }
    setFailedImageUrls((prev) => {
      if (prev[url]) {
        return prev;
      }
      return { ...prev, [url]: true };
    });
  }, []);

  const hasLoadableImage = useCallback(
    (url: string | null | undefined) => Boolean(url && !failedImageUrls[url]),
    [failedImageUrls],
  );

  const createImgErrorHandler = useCallback(
    (fallbackUrl: string | null) =>
      (event: SyntheticEvent<HTMLImageElement>) => {
        const failedUrl = event.currentTarget.currentSrc || fallbackUrl;
        markImageFailed(failedUrl);
      },
    [markImageFailed],
  );

  return { hasLoadableImage, createImgErrorHandler, markImageFailed };
}
