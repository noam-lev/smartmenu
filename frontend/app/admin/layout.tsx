"use client";

import type { ReactNode } from "react";
import { DialogProvider } from "../../context/DialogProvider";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <DialogProvider>{children}</DialogProvider>;
}
