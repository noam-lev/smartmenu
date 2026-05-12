import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { useState } from "react";
import type { MenuItem } from "../types/menu";
import { formatILSCurrency } from "../utils/currency";
import { getLocalizedText, getUiMessage, getUiTemplate } from "../utils/i18n";
import type { Locale } from "../types/menu";
import { hasRenderableImage } from "../utils/media";

type MenuItemCardProps = {
  item: MenuItem;
  locale: Locale;
  unavailableLabel: string;
  mode?: "diner" | "admin";
  /** Optimistic-create row: server save in flight */
  isCreationPending?: boolean;
  /** When set (admin + sortable), grip receives DnD listeners only — rest of card stays clickable. */
  dragHandleListeners?: DraggableSyntheticListeners;
  dragHandleAttributes?: DraggableAttributes;
  dragHandleLabel?: string;
  onClick?: () => void;
  onEditClick?: (item: MenuItem) => void;
  onDeleteClick?: (item: MenuItem) => void;
  onToggleAvailability?: (item: MenuItem, newStatus: boolean) => void;
};

export default function MenuItemCard({
  item,
  locale,
  unavailableLabel,
  mode = "diner",
  isCreationPending = false,
  dragHandleListeners,
  dragHandleAttributes,
  dragHandleLabel,
  onClick,
  onEditClick,
  onDeleteClick,
  onToggleAvailability,
}: MenuItemCardProps) {
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, true>>({});
  const isDraftItem = item.id.startsWith("temp-");
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
            isCreationPending ? (
              <span
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-zinc-500"
                aria-busy="true"
                aria-live="polite"
                aria-label={getUiMessage("creatingItem", locale)}
              >
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </span>
            ) : (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={getUiTemplate("editMenuItemAria", locale, { name: itemName })}
                  disabled={isDraftItem}
                  onClick={() => onEditClick?.(item)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
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
                <button
                  type="button"
                  aria-label={getUiTemplate("deleteMenuItemAria", locale, { name: itemName })}
                  disabled={isDraftItem}
                  onClick={() => onDeleteClick?.(item)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm transition-colors hover:border-red-200 hover:text-red-600 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-200 disabled:hover:text-zinc-500"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className="h-4 w-4"
                    fill="none"
                  >
                    <path
                      d="M6 6.5h8M8 6.5V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5m2.5 0v8.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 5.5 15V6.5h9Z"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M8 10v4M12 10v4"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                </button>
              </div>
            )
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
              {item.is_available
                ? getUiMessage("availabilityAvailable", locale)
                : getUiMessage("availabilityOutOfStock", locale)}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={item.is_available}
              aria-label={getUiTemplate("toggleAvailabilityAria", locale, {
                name: itemName,
              })}
              disabled={isDraftItem || isCreationPending}
              onClick={() => onToggleAvailability?.(item, !item.is_available)}
              className={`relative h-6 w-11 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40 ${
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
    const showHandle = Boolean(dragHandleListeners && dragHandleAttributes);

    return (
      <article className="flex w-full items-stretch border-b border-zinc-200 bg-white text-start">
        {showHandle ? (
          <button
            type="button"
            className="touch-none shrink-0 cursor-grab border-e border-zinc-100 px-2 py-3 text-zinc-400 active:cursor-grabbing"
            aria-label={dragHandleLabel ?? "Drag to reorder"}
            {...dragHandleAttributes}
            {...dragHandleListeners}
          >
            <GripVertical className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
        <div className="min-w-0 flex-1 px-4 py-3">{cardContent}</div>
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
