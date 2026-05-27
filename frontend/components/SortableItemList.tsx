"use client";

import type { CSSProperties } from "react";
import type { DraggableSyntheticListeners } from "@dnd-kit/core";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import type { Locale, MenuItem } from "../types/menu";
import MenuItemCard from "./MenuItemCard";
import { getUiMessage } from "../utils/i18n";

type SortableMenuItemRowProps = {
  item: MenuItem;
  locale: Locale;
  currency: string;
  unavailableLabel: string;
  isCreationPending: boolean;
  onEditClick: (item: MenuItem) => void;
  onDeleteClick: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem, newStatus: boolean) => void;
};

function SortableMenuItemRow({
  item,
  locale,
  currency,
  unavailableLabel,
  isCreationPending,
  onEditClick,
  onDeleteClick,
  onToggleAvailability,
}: SortableMenuItemRowProps) {
  const isDraft = item.id.startsWith("temp-");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: isDraft,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <MenuItemCard
        mode="admin"
        item={item}
        locale={locale}
        currency={currency}
        unavailableLabel={unavailableLabel}
        isCreationPending={isCreationPending}
        dragHandleListeners={listeners as DraggableSyntheticListeners}
        dragHandleAttributes={attributes}
        dragHandleLabel={getUiMessage("dragReorderHandleAria", locale)}
        onEditClick={onEditClick}
        onDeleteClick={onDeleteClick}
        onToggleAvailability={onToggleAvailability}
      />
    </div>
  );
}

export type SortableItemListProps = {
  items: MenuItem[];
  onReorder: (nextItems: MenuItem[]) => void;
  locale: Locale;
  currency: string;
  unavailableLabel: string;
  creationPendingItemId: string | null;
  onEditClick: (item: MenuItem) => void;
  onDeleteClick: (item: MenuItem) => void;
  onToggleAvailability: (item: MenuItem, newStatus: boolean) => void;
};

export default function SortableItemList({
  items,
  onReorder,
  locale,
  currency,
  unavailableLabel,
  creationPendingItemId,
  onEditClick,
  onDeleteClick,
  onToggleAvailability,
}: SortableItemListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  const ids = items.map((i) => i.id);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableMenuItemRow
            key={item.id}
            item={item}
            locale={locale}
            currency={currency}
            unavailableLabel={unavailableLabel}
            isCreationPending={creationPendingItemId === item.id}
            onEditClick={onEditClick}
            onDeleteClick={onDeleteClick}
            onToggleAvailability={onToggleAvailability}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}
