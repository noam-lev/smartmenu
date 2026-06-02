import type { ReactNode } from "react";
import { categoryHeaderStyle } from "../utils/categoryHeaderStyle";

type CategoryHeaderColorProps = {
  headerColor?: string | null;
};

type CategorySectionHeaderProps = CategoryHeaderColorProps & {
  children: ReactNode;
  className?: string;
};

/** Shared category section title — used on the diner menu and admin preview. */
export function CategorySectionHeader({
  children,
  headerColor,
  className = "",
}: CategorySectionHeaderProps) {
  const colored = Boolean(headerColor);
  return (
    <h2
      className={`px-4 py-3 text-base font-bold ${
        colored ? "" : "border-b border-zinc-200 text-zinc-900"
      } ${className}`.trim()}
      style={categoryHeaderStyle(headerColor)}
    >
      {children}
    </h2>
  );
}

type CategoryHeaderBarProps = CategoryHeaderColorProps & {
  children: ReactNode;
  className?: string;
};

/** Admin category row background — wraps drag handle, title, and action buttons. */
export function CategoryHeaderBar({
  children,
  headerColor,
  className = "",
}: CategoryHeaderBarProps) {
  const colored = Boolean(headerColor);
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${
        colored ? "" : "border-b border-zinc-200"
      } ${className}`.trim()}
      style={categoryHeaderStyle(headerColor)}
    >
      {children}
    </div>
  );
}

/** Title inside {@link CategoryHeaderBar} — inherits bar background, no double styling. */
export function CategoryHeaderTitle({
  children,
  headerColor,
  className = "",
}: CategorySectionHeaderProps) {
  const colored = Boolean(headerColor);
  return (
    <h2
      className={`min-w-0 truncate text-base font-bold ${
        colored ? "" : "text-zinc-900"
      } ${className}`.trim()}
    >
      {children}
    </h2>
  );
}
