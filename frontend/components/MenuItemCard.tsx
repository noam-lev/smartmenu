import type { MenuItem } from "../types/menu";
import { formatILSCurrency } from "../utils/currency";
import { getLocalizedText } from "../utils/i18n";
import type { Locale } from "../types/menu";

type MenuItemCardProps = {
  item: MenuItem;
  locale: Locale;
  unavailableLabel: string;
  onClick?: () => void;
};

export default function MenuItemCard({
  item,
  locale,
  unavailableLabel,
  onClick,
}: MenuItemCardProps) {
  const formattedPrice = formatILSCurrency(item.base_price);
  const itemName = getLocalizedText(item, "name", locale);
  const itemDescription = getLocalizedText(item, "description", locale);

  return (
    <button
      type="button"
      aria-label={`Open ${itemName}`}
      onClick={onClick}
      className="group w-full border-b border-zinc-200 bg-white px-4 py-3 text-start transition-transform duration-100 active:scale-[0.985]"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold leading-5 text-zinc-900">
            {itemName}
          </p>
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
        </div>

        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
          <img
            src={item.image_url}
            alt={itemName}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </button>
  );
}
