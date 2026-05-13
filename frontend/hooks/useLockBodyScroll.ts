"use client";

import { useEffect } from "react";

let lockCount = 0;
let restoreScrollY = 0;
let restoreStyles: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
} | null = null;

function lockBodyScroll() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  lockCount += 1;
  if (lockCount > 1) {
    return;
  }

  const body = document.body;
  restoreScrollY = window.scrollY || window.pageYOffset || 0;
  restoreStyles = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
  };

  // iOS-safe lock: freeze body at current scroll position.
  body.style.position = "fixed";
  body.style.top = `-${restoreScrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
}

function unlockBodyScroll() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  if (lockCount === 0) {
    return;
  }

  lockCount -= 1;
  if (lockCount > 0) {
    return;
  }

  const body = document.body;
  if (restoreStyles) {
    body.style.position = restoreStyles.position;
    body.style.top = restoreStyles.top;
    body.style.left = restoreStyles.left;
    body.style.right = restoreStyles.right;
    body.style.width = restoreStyles.width;
    body.style.overflow = restoreStyles.overflow;
  } else {
    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    body.style.overflow = "";
  }

  window.scrollTo(0, restoreScrollY);
  restoreStyles = null;
}

export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) {
      return;
    }

    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [locked]);
}

