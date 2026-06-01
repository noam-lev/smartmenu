"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Settings2, Trash2 } from "lucide-react";
import type { Locale, ModifierGroup, ModifierGroupLibrary } from "../types/menu";
import { useDialogs } from "../context/DialogProvider";
import {
  attachModifierGroup,
  buildModifierNamePayload,
  createModifierGroup,
  deleteModifierGroup,
  detachModifierGroup,
  listModifierGroups,
  readModifierNameFields,
  updateModifierGroup,
  type ModifierOptionInput,
} from "../lib/modifierApi";
import { getLocalizedText, getUiMessage, getUiTemplate } from "../utils/i18n";

type OptionDraft = {
  id?: string;
  nameHe: string;
  nameEn: string;
  priceDelta: string;
  isDefault: boolean;
  isAvailable: boolean;
};

type GroupDraft = {
  nameHe: string;
  nameEn: string;
  selectionMode: "single" | "multi";
  minSelect: string;
  maxSelect: string;
  options: OptionDraft[];
};

function emptyOptionDraft(): OptionDraft {
  return {
    nameHe: "",
    nameEn: "",
    priceDelta: "0",
    isDefault: false,
    isAvailable: true,
  };
}

function emptyGroupDraft(): GroupDraft {
  return {
    nameHe: "",
    nameEn: "",
    selectionMode: "single",
    minSelect: "0",
    maxSelect: "1",
    options: [emptyOptionDraft()],
  };
}

function draftFromGroup(
  group: ModifierGroup | ModifierGroupLibrary,
): GroupDraft {
  const { nameHe, nameEn } = readModifierNameFields(group);
  return {
    nameHe,
    nameEn,
    selectionMode: group.selection_mode === "multi" ? "multi" : "single",
    minSelect: String(group.min_select ?? 0),
    maxSelect: String(group.max_select ?? 1),
    options:
      group.options.length > 0
        ? group.options.map((opt) => {
            const names = readModifierNameFields(opt);
            return {
              id: opt.id,
              nameHe: names.nameHe,
              nameEn: names.nameEn,
              priceDelta: String(opt.price_delta ?? 0),
              isDefault: Boolean(opt.is_default),
              isAvailable: opt.is_available !== false,
            };
          })
        : [emptyOptionDraft()],
  };
}

type GroupDraftValidationKey =
  | "modifierValidationGroupName"
  | "modifierValidationRules"
  | "modifierValidationOptionName";

function getGroupDraftValidationKey(
  draft: GroupDraft,
  defaultLocale: Locale,
): GroupDraftValidationKey | null {
  const groupNames = buildModifierNamePayload(
    draft.nameHe,
    draft.nameEn,
    defaultLocale,
  );
  if (!groupNames.name) {
    return "modifierValidationGroupName";
  }

  const minSelect = Number(draft.minSelect);
  const maxSelect = Number(draft.maxSelect);
  if (
    !Number.isFinite(minSelect) ||
    !Number.isFinite(maxSelect) ||
    minSelect < 0 ||
    maxSelect < 0 ||
    maxSelect < minSelect
  ) {
    return "modifierValidationRules";
  }

  let validOptionCount = 0;
  for (const row of draft.options) {
    const built = buildModifierNamePayload(row.nameHe, row.nameEn, defaultLocale);
    if (!built.name) {
      continue;
    }
    const priceDelta = Number(row.priceDelta);
    if (!Number.isFinite(priceDelta)) {
      return "modifierValidationRules";
    }
    validOptionCount += 1;
  }

  if (validOptionCount < 1) {
    return "modifierValidationOptionName";
  }

  return null;
}

function draftToPayload(
  draft: GroupDraft,
  defaultLocale: Locale,
): {
  name: string;
  translations: ReturnType<typeof buildModifierNamePayload>["translations"];
  selection_mode: "single" | "multi";
  min_select: number;
  max_select: number;
  options: ModifierOptionInput[];
} | null {
  const groupNames = buildModifierNamePayload(
    draft.nameHe,
    draft.nameEn,
    defaultLocale,
  );
  if (!groupNames.name) {
    return null;
  }

  const minSelect = Number(draft.minSelect);
  const maxSelect = Number(draft.maxSelect);
  if (
    !Number.isFinite(minSelect) ||
    !Number.isFinite(maxSelect) ||
    minSelect < 0 ||
    maxSelect < 0 ||
    maxSelect < minSelect
  ) {
    return null;
  }

  const options: ModifierOptionInput[] = [];
  for (const row of draft.options) {
    const built = buildModifierNamePayload(row.nameHe, row.nameEn, defaultLocale);
    if (!built.name) {
      continue;
    }
    const priceDelta = Number(row.priceDelta);
    if (!Number.isFinite(priceDelta)) {
      return null;
    }
    options.push({
      ...(row.id ? { id: row.id } : {}),
      name: built.name,
      translations: built.translations,
      price_delta: priceDelta,
      is_default: row.isDefault,
      is_available: row.isAvailable,
    });
  }

  if (options.length < 1) {
    return null;
  }

  return {
    name: groupNames.name,
    translations: groupNames.translations,
    selection_mode: draft.selectionMode,
    min_select: minSelect,
    max_select: maxSelect,
    options,
  };
}

export type ModifiersTabProps = {
  restaurantSlug: string;
  menuItemId: string;
  attachedGroups: ModifierGroup[];
  restaurantDefaultLocale: Locale;
  locale: Locale;
  isRtl: boolean;
  onRefreshMenu: () => Promise<void>;
};

const inputClass =
  "w-full rounded-lg border-0 bg-zinc-50/90 px-3 py-2 text-sm text-zinc-900 ring-1 ring-zinc-200/80 outline-none transition placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-zinc-300";

const selectClass =
  "w-full appearance-none rounded-xl border-0 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200/90 outline-none transition focus:ring-2 focus:ring-zinc-900/15";

function ToggleSwitch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          checked ? "bg-zinc-900" : "bg-zinc-200"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
            checked ? "start-[1.375rem]" : "start-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function RequirementRulesSection({
  draft,
  setDraft,
  locale,
  idPrefix,
}: {
  draft: GroupDraft;
  setDraft: React.Dispatch<React.SetStateAction<GroupDraft>>;
  locale: Locale;
  idPrefix: string;
}) {
  const isSingle = draft.selectionMode === "single";
  const isRequired = Number(draft.minSelect) >= 1;

  const setPickOne = () => {
    setDraft((p) => ({
      ...p,
      selectionMode: "single",
      minSelect: p.minSelect === "1" && p.selectionMode === "single" ? "1" : "0",
      maxSelect: "1",
    }));
  };

  const setPickMany = () => {
    setDraft((p) => ({
      ...p,
      selectionMode: "multi",
      minSelect: p.selectionMode === "multi" ? p.minSelect : "0",
      maxSelect: p.selectionMode === "multi" ? p.maxSelect : String(Math.max(2, p.options.length)),
    }));
  };

  return (
    <div className="rounded-xl bg-zinc-50/80 p-4 ring-1 ring-zinc-100">
      <p className="text-xs font-semibold tracking-wide text-zinc-500">
        {getUiMessage("modifierRequirementRules", locale)}
      </p>
      <div className="mt-3 flex gap-1 rounded-lg bg-zinc-100/80 p-1">
        <button
          type="button"
          onClick={setPickOne}
          className={`flex-1 rounded-md py-2 text-xs font-semibold transition ${
            isSingle ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          {getUiMessage("modifierGuestPicksOne", locale)}
        </button>
        <button
          type="button"
          onClick={setPickMany}
          className={`flex-1 rounded-md py-2 text-xs font-semibold transition ${
            !isSingle ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          {getUiMessage("modifierGuestPicksMany", locale)}
        </button>
      </div>

      {isSingle ? (
        <div className="mt-3">
          <ToggleSwitch
            checked={isRequired}
            onChange={(next) =>
              setDraft((p) => ({
                ...p,
                minSelect: next ? "1" : "0",
                maxSelect: "1",
              }))
            }
            label={getUiMessage("modifierRequiredChoice", locale)}
          />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor={`${idPrefix}-min`}
              className="text-[11px] font-medium text-zinc-500"
            >
              {getUiMessage("modifierHowManyMin", locale)}
            </label>
            <input
              id={`${idPrefix}-min`}
              type="number"
              min={0}
              value={draft.minSelect}
              onChange={(e) => setDraft((p) => ({ ...p, minSelect: e.target.value }))}
              className={`${inputClass} mt-1`}
            />
          </div>
          <div>
            <label
              htmlFor={`${idPrefix}-max`}
              className="text-[11px] font-medium text-zinc-500"
            >
              {getUiMessage("modifierHowManyMax", locale)}
            </label>
            <input
              id={`${idPrefix}-max`}
              type="number"
              min={0}
              value={draft.maxSelect}
              onChange={(e) => setDraft((p) => ({ ...p, maxSelect: e.target.value }))}
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function OptionRow({
  opt,
  locale,
  canRemove,
  onUpdate,
  onRemove,
}: {
  opt: OptionDraft;
  locale: Locale;
  canRemove: boolean;
  onUpdate: (patch: Partial<OptionDraft>) => void;
  onRemove: () => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <li className="group rounded-lg bg-white py-2 pl-2 pr-1 ring-1 ring-zinc-100">
      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <input
          type="text"
          value={opt.nameHe}
          onChange={(e) => onUpdate({ nameHe: e.target.value })}
          placeholder={getUiMessage("modifierOptionNameHe", locale)}
          className={`${inputClass} min-w-0 flex-1`}
          aria-label={getUiMessage("modifierOptionNameHe", locale)}
        />
        <input
          type="text"
          value={opt.nameEn}
          onChange={(e) => onUpdate({ nameEn: e.target.value })}
          placeholder={getUiMessage("modifierOptionNameEn", locale)}
          className={`${inputClass} min-w-0 flex-1`}
          aria-label={getUiMessage("modifierOptionNameEn", locale)}
        />
        <div className="flex w-full shrink-0 items-center gap-1 sm:w-24">
          <span className="text-xs font-medium text-zinc-400">+₪</span>
          <input
            type="number"
            step="any"
            value={opt.priceDelta}
            onChange={(e) => onUpdate({ priceDelta: e.target.value })}
            className={`${inputClass} w-full tabular-nums`}
            aria-label={getUiMessage("modifierExtraPrice", locale)}
          />
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 ${
              showAdvanced ? "bg-zinc-100 text-zinc-800" : ""
            }`}
            aria-expanded={showAdvanced}
            aria-label={getUiMessage("modifierOptionSettings", locale)}
          >
            <Settings2 className="h-4 w-4" strokeWidth={2} />
          </button>
          {canRemove ? (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
              aria-label={getUiMessage("modifierRemoveOptionAria", locale)}
            >
              <Trash2 className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>
      {showAdvanced ? (
        <div className="mt-2 space-y-1 border-t border-zinc-100 px-1 pt-2">
          <ToggleSwitch
            checked={opt.isDefault}
            onChange={(next) => onUpdate({ isDefault: next })}
            label={getUiMessage("modifierIsDefault", locale)}
          />
          <ToggleSwitch
            checked={opt.isAvailable}
            onChange={(next) => onUpdate({ isAvailable: next })}
            label={getUiMessage("modifierIsAvailable", locale)}
          />
        </div>
      ) : null}
    </li>
  );
}

function GroupFormFields({
  draft,
  setDraft,
  locale,
  idPrefix,
}: {
  draft: GroupDraft;
  setDraft: React.Dispatch<React.SetStateAction<GroupDraft>>;
  locale: Locale;
  idPrefix: string;
}) {
  const updateOption = (index: number, patch: Partial<OptionDraft>) => {
    setDraft((prev) => ({
      ...prev,
      options: prev.options.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  };

  const removeOption = (index: number) => {
    setDraft((prev) => {
      if (prev.options.length <= 1) {
        return prev;
      }
      return { ...prev, options: prev.options.filter((_, i) => i !== index) };
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-medium text-zinc-500">
          {getUiMessage("modifierGroupNameHint", locale)}
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input
            id={`${idPrefix}-name-he`}
            type="text"
            value={draft.nameHe}
            onChange={(e) => setDraft((p) => ({ ...p, nameHe: e.target.value }))}
            placeholder={getUiMessage("modifierGroupNameHe", locale)}
            className={inputClass}
          />
          <input
            id={`${idPrefix}-name-en`}
            type="text"
            value={draft.nameEn}
            onChange={(e) => setDraft((p) => ({ ...p, nameEn: e.target.value }))}
            placeholder={getUiMessage("modifierGroupNameEn", locale)}
            className={inputClass}
          />
        </div>
      </div>

      <RequirementRulesSection
        draft={draft}
        setDraft={setDraft}
        locale={locale}
        idPrefix={idPrefix}
      />

      <div>
        <p className="mb-2 text-xs font-semibold text-zinc-700">
          {getUiMessage("modifierChoicesHeading", locale)}
        </p>
        <ul className="space-y-2">
          {draft.options.map((opt, index) => (
            <OptionRow
              key={opt.id ?? `new-${index}`}
              opt={opt}
              locale={locale}
              canRemove={draft.options.length > 1}
              onUpdate={(patch) => updateOption(index, patch)}
              onRemove={() => removeOption(index)}
            />
          ))}
        </ul>
        <button
          type="button"
          onClick={() =>
            setDraft((p) => ({ ...p, options: [...p.options, emptyOptionDraft()] }))
          }
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 transition hover:text-zinc-900"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          {getUiMessage("modifierAddOption", locale)}
        </button>
      </div>
    </div>
  );
}

function AttachedGroupCard({
  group,
  locale,
  onEdit,
  onDetach,
}: {
  group: ModifierGroup;
  locale: Locale;
  onEdit: () => void;
  onDetach: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-100">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-zinc-900">
          {getLocalizedText(group, "name", locale)}
        </p>
        <p className="mt-0.5 text-xs text-zinc-400">
          {getUiTemplate("modifierOptionCount", locale, {
            count: String(group.options.length),
          })}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200/80 transition hover:bg-zinc-50"
        >
          {getUiMessage("modifierEditGroup", locale)}
        </button>
        <button
          type="button"
          onClick={onDetach}
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-100 transition hover:bg-red-50"
        >
          {getUiMessage("modifierDetach", locale)}
        </button>
      </div>
    </li>
  );
}

export default function ModifiersTab({
  restaurantSlug,
  menuItemId,
  attachedGroups,
  restaurantDefaultLocale,
  locale,
  isRtl,
  onRefreshMenu,
}: ModifiersTabProps) {
  const { confirm, alert } = useDialogs();
  const [library, setLibrary] = useState<ModifierGroupLibrary[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [attachGroupId, setAttachGroupId] = useState("");
  const [isAttaching, setIsAttaching] = useState(false);
  const [createDraft, setCreateDraft] = useState<GroupDraft>(emptyGroupDraft);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<GroupDraft>(emptyGroupDraft);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  const refreshLibrary = useCallback(async () => {
    setIsLoadingLibrary(true);
    try {
      const groups = await listModifierGroups(restaurantSlug);
      setLibrary(groups);
    } catch (error) {
      void alert({
        title: getUiMessage("dialogErrorTitle", locale),
        message:
          error instanceof Error
            ? error.message
            : getUiMessage("failedToSaveChanges", locale),
        dismissLabel: getUiMessage("dialogDismiss", locale),
      });
    } finally {
      setIsLoadingLibrary(false);
    }
  }, [alert, locale, restaurantSlug]);

  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  useEffect(() => {
    setAttachGroupId("");
  }, [menuItemId]);

  const attachedIds = useMemo(
    () => new Set(attachedGroups.map((g) => g.id)),
    [attachedGroups],
  );

  const attachCandidates = useMemo(
    () => library.filter((g) => !attachedIds.has(g.id)),
    [library, attachedIds],
  );

  const editingLibraryRow = useMemo(
    () => library.find((g) => g.id === editingGroupId) ?? null,
    [library, editingGroupId],
  );

  const closeCreateForm = () => {
    setIsCreateFormOpen(false);
    setCreateDraft(emptyGroupDraft());
  };

  const handleAttach = async () => {
    if (!attachGroupId) {
      return;
    }
    setIsAttaching(true);
    try {
      await attachModifierGroup(restaurantSlug, menuItemId, attachGroupId);
      setAttachGroupId("");
      await onRefreshMenu();
      await refreshLibrary();
    } catch (error) {
      void alert({
        title: getUiMessage("dialogErrorTitle", locale),
        message:
          error instanceof Error
            ? error.message
            : getUiMessage("failedToSaveChanges", locale),
        dismissLabel: getUiMessage("dialogDismiss", locale),
      });
    } finally {
      setIsAttaching(false);
    }
  };

  const showDraftValidationError = (draft: GroupDraft) => {
    const key = getGroupDraftValidationKey(draft, restaurantDefaultLocale);
    if (!key) {
      return false;
    }
    void alert({
      title: getUiMessage("dialogErrorTitle", locale),
      message: getUiMessage(key, locale),
      dismissLabel: getUiMessage("dialogDismiss", locale),
    });
    return true;
  };

  const handleCreate = async () => {
    if (showDraftValidationError(createDraft)) {
      return;
    }
    const payload = draftToPayload(createDraft, restaurantDefaultLocale);
    if (!payload) {
      return;
    }
    setIsCreating(true);
    try {
      await createModifierGroup(restaurantSlug, {
        ...payload,
        attach_to_item_id: menuItemId,
      });
      closeCreateForm();
      await onRefreshMenu();
      await refreshLibrary();
    } catch (error) {
      void alert({
        title: getUiMessage("dialogErrorTitle", locale),
        message:
          error instanceof Error
            ? error.message
            : getUiMessage("failedToSaveChanges", locale),
        dismissLabel: getUiMessage("dialogDismiss", locale),
      });
    } finally {
      setIsCreating(false);
    }
  };

  const startEdit = (group: ModifierGroup) => {
    const fromLibrary = library.find((row) => row.id === group.id);
    setEditingGroupId(group.id);
    setEditDraft(draftFromGroup(fromLibrary ?? group));
    setIsCreateFormOpen(false);
  };

  const cancelEdit = () => {
    setEditingGroupId(null);
    setEditDraft(emptyGroupDraft());
  };

  const handleSaveEdit = async () => {
    if (!editingGroupId) {
      return;
    }
    if (showDraftValidationError(editDraft)) {
      return;
    }
    const payload = draftToPayload(editDraft, restaurantDefaultLocale);
    if (!payload) {
      return;
    }
    setIsSavingEdit(true);
    try {
      await updateModifierGroup(restaurantSlug, editingGroupId, payload);
      cancelEdit();
      await onRefreshMenu();
      await refreshLibrary();
    } catch (error) {
      void alert({
        title: getUiMessage("dialogErrorTitle", locale),
        message:
          error instanceof Error
            ? error.message
            : getUiMessage("failedToSaveChanges", locale),
        dismissLabel: getUiMessage("dialogDismiss", locale),
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDetach = async (groupId: string) => {
    const confirmed = await confirm({
      title: getUiMessage("modifierConfirmDetachTitle", locale),
      message: getUiMessage("modifierConfirmDetachBody", locale),
      variant: "danger",
      confirmLabel: getUiMessage("modifierDetach", locale),
      cancelLabel: getUiMessage("cancel", locale),
    });
    if (!confirmed) {
      return;
    }
    try {
      await detachModifierGroup(restaurantSlug, menuItemId, groupId);
      if (editingGroupId === groupId) {
        cancelEdit();
      }
      await onRefreshMenu();
      await refreshLibrary();
    } catch (error) {
      void alert({
        title: getUiMessage("dialogErrorTitle", locale),
        message:
          error instanceof Error
            ? error.message
            : getUiMessage("failedToSaveChanges", locale),
        dismissLabel: getUiMessage("dialogDismiss", locale),
      });
    }
  };

  const handleDeleteGroup = async () => {
    if (!editingGroupId || !editingLibraryRow) {
      return;
    }
    if (editingLibraryRow.attached_item_count > 0) {
      return;
    }
    setIsDeletingGroup(true);
    try {
      await deleteModifierGroup(restaurantSlug, editingGroupId);
      cancelEdit();
      await onRefreshMenu();
      await refreshLibrary();
    } catch (error) {
      void alert({
        title: getUiMessage("dialogErrorTitle", locale),
        message:
          error instanceof Error
            ? error.message
            : getUiMessage("failedToSaveChanges", locale),
        dismissLabel: getUiMessage("dialogDismiss", locale),
      });
    } finally {
      setIsDeletingGroup(false);
    }
  };

  const editingAttachmentCount =
    editingLibraryRow?.attached_item_count ??
    (editingGroupId && attachedIds.has(editingGroupId) ? 1 : 0);
  const deleteDisabled = !editingGroupId || editingAttachmentCount > 0;

  return (
    <div className="space-y-8 pb-2" dir={isRtl ? "rtl" : "ltr"}>
      {editingGroupId ? (
        <section className="space-y-4 rounded-2xl bg-amber-50/60 p-4 ring-1 ring-amber-100/80">
          <p className="text-sm leading-snug text-amber-900/90">
            {getUiMessage("modifierSharedWarning", locale)}
          </p>
          <GroupFormFields
            draft={editDraft}
            setDraft={setEditDraft}
            locale={locale}
            idPrefix="edit-mod"
          />
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => void handleSaveEdit()}
              disabled={isSavingEdit}
              className="flex-1 rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            >
              {isSavingEdit
                ? getUiMessage("modifierSaving", locale)
                : getUiMessage("upsellSave", locale)}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isSavingEdit}
              className="rounded-full px-4 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-white/80 disabled:opacity-50"
            >
              {getUiMessage("cancel", locale)}
            </button>
          </div>
          <button
            type="button"
            onClick={() => void handleDeleteGroup()}
            disabled={deleteDisabled || isDeletingGroup || isSavingEdit}
            title={
              deleteDisabled
                ? getUiMessage("modifierDeleteGroupDisabledTooltip", locale)
                : undefined
            }
            className="w-full rounded-full py-2 text-xs font-medium text-red-600/80 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {isDeletingGroup
              ? getUiMessage("modifierSaving", locale)
              : getUiMessage("modifierDeleteGroup", locale)}
          </button>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-800">
          {getUiMessage("modifierAttachedTitle", locale)}
        </h3>
        {attachedGroups.length === 0 ? (
          <p className="text-sm text-zinc-400">{getUiMessage("modifierNoAttached", locale)}</p>
        ) : (
          <ul className="space-y-2">
            {attachedGroups.map((group) => (
              <AttachedGroupCard
                key={group.id}
                group={group}
                locale={locale}
                onEdit={() => startEdit(group)}
                onDetach={() => void handleDetach(group.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {isLoadingLibrary || library.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-800">
            {getUiMessage("modifierAttachExistingTitle", locale)}
          </h3>
          {isLoadingLibrary ? (
            <p className="text-sm text-zinc-400">
              {getUiMessage("modifierLoadingGroups", locale)}
            </p>
          ) : attachCandidates.length > 0 ? (
            <div className="space-y-3">
              <div className="relative">
                <select
                  value={attachGroupId}
                  onChange={(e) => setAttachGroupId(e.target.value)}
                  className={selectClass}
                >
                  <option value="">{getUiMessage("modifierSelectGroup", locale)}</option>
                  {attachCandidates.map((g) => (
                    <option key={g.id} value={g.id}>
                      {getLocalizedText(g, "name", locale)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 ltr:right-3 rtl:left-3"
                  aria-hidden
                />
              </div>
              <button
                type="button"
                onClick={() => void handleAttach()}
                disabled={isAttaching || !attachGroupId}
                className="w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-40"
              >
                {isAttaching
                  ? getUiMessage("modifierSaving", locale)
                  : getUiMessage("modifierAttachButton", locale)}
              </button>
            </div>
          ) : (
            <p className="text-sm text-zinc-400">
              {getUiMessage("modifierAllGroupsAttached", locale)}
            </p>
          )}
        </section>
      ) : null}

      <section className="space-y-3 border-t border-zinc-100 pt-6">
        {!isCreateFormOpen ? (
          <button
            type="button"
            onClick={() => {
              setIsCreateFormOpen(true);
              cancelEdit();
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-zinc-300 bg-white py-3 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50 active:scale-[0.99]"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            {getUiMessage("modifierCreateNewGroupButton", locale)}
          </button>
        ) : (
          <div className="space-y-5 rounded-2xl bg-zinc-50/50 p-4 ring-1 ring-zinc-100 animate-in fade-in duration-200">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-zinc-800">
                {getUiMessage("modifierCreateTitle", locale)}
              </h3>
              <button
                type="button"
                onClick={closeCreateForm}
                disabled={isCreating}
                className="text-xs font-semibold text-zinc-500 transition hover:text-zinc-800 disabled:opacity-50"
              >
                {getUiMessage("modifierCreateCancel", locale)}
              </button>
            </div>
            <GroupFormFields
              draft={createDraft}
              setDraft={setCreateDraft}
              locale={locale}
              idPrefix="create-mod"
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={isCreating}
              className="w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            >
              {isCreating
                ? getUiMessage("modifierSaving", locale)
                : getUiMessage("modifierCreateGroup", locale)}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
