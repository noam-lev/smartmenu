import { useState } from "react";
import type { MenuItem } from "../types/menu";
import { formatILSCurrency } from "../utils/currency";
import { getLocalizedText } from "../utils/i18n";
import type { Locale } from "../types/menu";
import { hasRenderableImage } from "../utils/media";

type MenuItemCardProps = {
  item: MenuItem;
  locale: Locale;
  unavailableLabel: string;
  mode?: "diner" | "admin";
  onClick?: () => void;
  onEditClick?: (item: MenuItem) => void;
  onToggleAvailability?: (item: MenuItem, newStatus: boolean) => void;
};

export default function MenuItemCard({
  item,
  locale,
  unavailableLabel,
  mode = "diner",
  onClick,
  onEditClick,
  onToggleAvailability,
}: MenuItemCardProps) {
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, true>>({});
  const formattedPrice = formatILSCurrency(item.base_price);
  const itemName = getLocalizedText(item, "name", locale);
  const itemDescription = getLocalizedText(item, "description", locale);
  const imageUrl = hasRenderableImage(item.image_url) ? item.image_url : null;
  const hasImage = imageUrl ? !failedImageUrls[imageUrl] : false;
  const cardContent = (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[17px] font-semibold leading-5 text-zinc-900">
            {itemName}
          </p>
          {mode === "admin" ? (
            <button
              type="button"
              aria-label={`Edit ${itemName}`}
              onClick={() => onEditClick?.(item)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm active:scale-[0.96]"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="h-4 w-4"
                fill="none"
              >
                <path
                  d="M4 13.5V16h2.5L14 8.5 11.5 6 4 13.5Z"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.6"
                />
                <path
                  d="m12 5.5 1-1a1.4 1.4 0 0 1 2 0l.5.5a1.4 1.4 0 0 1 0 2l-1 1"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.6"
                />
              </svg>
            </button>
          ) : null}
        </div>
        <p className="mt-1 line-clamp-2 text-sm leading-5 text-zinc-500">
          {itemDescription}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-900">
            {formattedPrice}
          </span>
          {!item.is_available ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
              {unavailableLabel}
            </span>
          ) : null}
        </div>
        {mode === "admin" ? (
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-zinc-50 px-3 py-2">
            <span className="text-xs font-semibold text-zinc-600">
              {item.is_available ? "Available" : "Out of stock"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={item.is_available}
              aria-label={`Toggle availability for ${itemName}`}
              onClick={() => onToggleAvailability?.(item, !item.is_available)}
              className={`relative h-6 w-11 rounded-full transition ${
                item.is_available ? "bg-zinc-900" : "bg-zinc-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                  item.is_available ? "start-[1.375rem]" : "start-0.5"
                }`}
              />
            </button>
          </div>
        ) : null}
      </div>

      {hasImage && imageUrl ? (
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
          <img
            src={imageUrl}
            alt={itemName}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(event) => {
              const failedUrl = event.currentTarget.currentSrc || imageUrl;
              if (!failedUrl) {
                return;
              }
              setFailedImageUrls((prev) => ({ ...prev, [failedUrl]: true }));
            }}
          />
        </div>
      ) : null}
    </div>
  );

  if (mode === "admin") {
    return (
      <article className="w-full border-b border-zinc-200 bg-white px-4 py-3 text-start">
        {cardContent}
      </article>
    );
  }

  return (
    <button
      type="button"
      aria-label={`Open ${itemName}`}
      onClick={onClick}
      className="group w-full border-b border-zinc-200 bg-white px-4 py-3 text-start transition-transform duration-100 active:scale-[0.985]"
    >
      {cardContent}
    </button>
  );
}
