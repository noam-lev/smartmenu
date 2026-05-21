"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { GripVertical } from "lucide-react";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";
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
import { CSS } from "@dnd-kit/utilities";
import EditCategoryDrawer from "../components/EditCategoryDrawer";
import EditItemDrawer, {
  placeholderMenuItem,
} from "../components/EditItemDrawer";
import SortableItemList from "../components/SortableItemList";
import {
  createCategory,
  createMenuItem,
  deleteCategory,
  deleteMenuItem,
  deleteOwnerImage,
  fetchMenuBySlug,
  reorderCategories,
  reorderCategoryItems,
  updateCategory,
  updateItemAvailability,
  updateMenuItem,
  updateRestaurantBannerUrl,
  uploadOwnerImage,
} from "../lib/menuApi";
import { getMenuLoadErrorMessage } from "../lib/menuFetchError";
import { useDialogs } from "../context/DialogProvider";
import { useUiStore } from "../store/uiStore";
import type { Locale, MenuCategory, MenuItem, MenuPayload } from "../types/menu";
import {
  getLocalizedText,
  getUiMessage,
  getUiTemplate,
  isRtlLocale,
  localeFlagSrc,
  otherLocale,
} from "../utils/i18n";
import { hasRenderableImage } from "../utils/media";

type AdminMenuPageProps = {
  restaurantSlug?: string;
};

type SortableCategorySectionProps = {
  categoryId: string;
  children: (props: {
    dragHandleListeners?: DraggableSyntheticListeners;
    dragHandleAttributes: DraggableAttributes;
  }) => ReactNode;
};

function SortableCategorySection({ categoryId, children }: SortableCategorySectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: categoryId,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({
        dragHandleAttributes: attributes,
        dragHandleListeners: listeners,
      })}
    </div>
  );
}

export function TenantAdminPage({ restaurantSlug = "yossis-hummus" }: AdminMenuPageProps) {
  const [menuPayload, setMenuPayload] = useState<MenuPayload | null>(null);
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState("");
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [addingToCategory, setAddingToCategory] = useState<string | null>(null);
  const [creationPendingTempId, setCreationPendingTempId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBannerUploading, setIsBannerUploading] = useState(false);
  const [isBannerRemoving, setIsBannerRemoving] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const bannerFileInputRef = useRef<HTMLInputElement | null>(null);
  const locale = useUiStore((state) => state.locale);
  const setLocale = useUiStore((state) => state.setLocale);
  const { confirm, alert } = useDialogs();

  const categories = useMemo(
    () =>
      menuPayload
        ? [...menuPayload.menu.categories].sort((a, b) => a.sort_order - b.sort_order)
        : [],
    [menuPayload],
  );

  const allMenuItems = useMemo(
    () => (menuPayload ? menuPayload.menu.categories.flatMap((c) => c.items) : []),
    [menuPayload],
  );

  const refreshMenuForDrawer = useCallback(async () => {
    const data = await fetchMenuBySlug(restaurantSlug);
    setMenuPayload(data);
    setEditingItem((prev) => {
      if (!prev) {
        return null;
      }
      for (const category of data.menu.categories) {
        const hit = category.items.find((menuItem) => menuItem.id === prev.id);
        if (hit) {
          return hit;
        }
      }
      return prev;
    });
    setEditingCategory((prev) => {
      if (!prev) {
        return null;
      }
      return data.menu.categories.find((c) => c.id === prev.id) ?? prev;
    });
  }, [restaurantSlug]);

  const isRtl = isRtlLocale(locale);
  const categoryDnDSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  useEffect(() => {
    let isMounted = true;

    async function loadMenu() {
      try {
        setIsMenuLoading(true);
        setMenuError(null);

        const data = await fetchMenuBySlug(restaurantSlug);

        if (!isMounted) {
          return;
        }

        const sortedCategories = [...data.menu.categories].sort(
          (a, b) => a.sort_order - b.sort_order,
        );
        setMenuPayload(data);
        setLocale(data.restaurant.default_locale ?? "en");
        setActiveCategoryId(sortedCategories[0]?.id ?? "");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const uiLocale = useUiStore.getState().locale;
        setMenuError(getMenuLoadErrorMessage(error, uiLocale));
      } finally {
        if (isMounted) {
          setIsMenuLoading(false);
        }
      }
    }

    loadMenu();

    return () => {
      isMounted = false;
    };
    // setLocale from Zustand is stable for this one-time bootstrap load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantSlug]);

  useEffect(() => {
    const sections = categories
      .map((category) => sectionRefs.current[category.id])
      .filter((element): element is HTMLElement => Boolean(element));

    if (!sections.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!activeEntry) {
          return;
        }

        const nextCategoryId =
          activeEntry.target.getAttribute("data-category-id") ?? "";
        if (nextCategoryId) {
          setActiveCategoryId(nextCategoryId);
        }
      },
      {
        root: null,
        rootMargin: "-30% 0px -55% 0px",
        threshold: [0.1, 0.25, 0.5, 0.75],
      },
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [categories]);

  useEffect(() => {
    if (!isLanguageMenuOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setIsLanguageMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isLanguageMenuOpen]);

  const scrollToCategory = (category: MenuCategory) => {
    setActiveCategoryId(category.id);
    const sectionElement = sectionRefs.current[category.id];
    if (!sectionElement) {
      return;
    }

    const stickyNavOffset = 56;
    const targetTop =
      sectionElement.getBoundingClientRect().top + window.scrollY - stickyNavOffset;

    window.scrollTo({
      top: targetTop,
      behavior: "smooth",
    });
  };

  const handleEditClick = (item: MenuItem) => {
    setIsCategoryDrawerOpen(false);
    setEditingCategory(null);
    setAddingToCategory(null);
    setEditingItem(item);
    setIsDrawerOpen(true);
  };

  const handleAddItemClick = (categoryId: string) => {
    setIsCategoryDrawerOpen(false);
    setEditingCategory(null);
    setEditingItem(null);
    setAddingToCategory(categoryId);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setEditingItem(null);
    setAddingToCategory(null);
  };

  const handleCloseCategoryDrawer = () => {
    setIsCategoryDrawerOpen(false);
    setEditingCategory(null);
  };

  const handleEditCategoryClick = (category: MenuCategory) => {
    setIsDrawerOpen(false);
    setEditingItem(null);
    setAddingToCategory(null);
    setEditingCategory(category);
    setIsCategoryDrawerOpen(true);
  };

  const handleAddCategoryClick = () => {
    setIsDrawerOpen(false);
    setEditingItem(null);
    setAddingToCategory(null);
    setEditingCategory(null);
    setIsCategoryDrawerOpen(true);
  };

  const mergeCategoryOptimistic = (
    category: MenuCategory,
    defaultLocale: Locale,
    payload: { name: string; locale: Locale; translations: MenuCategory["translations"] },
  ): MenuCategory => ({
    ...category,
    name: payload.locale === defaultLocale ? payload.name : category.name,
    translations: payload.translations,
  });

  const handleSaveCategory = async (payload: {
    name: string;
    locale: Locale;
    translations: MenuCategory["translations"];
  }) => {
    if (!menuPayload) {
      return;
    }

    const defaultLocale = (menuPayload.restaurant.default_locale ?? "en") as Locale;

    if (!editingCategory) {
      const tempId = `temp-cat-${Date.now()}`;
      const nextSort =
        menuPayload.menu.categories.reduce(
          (max, c) => Math.max(max, c.sort_order),
          0,
        ) + 1;
      const optimistic: MenuCategory = {
        id: tempId,
        name: payload.name,
        sort_order: nextSort,
        translations: payload.translations,
        items: [],
      };
      const previousPayload = menuPayload;

      setMenuPayload({
        ...menuPayload,
        menu: {
          ...menuPayload.menu,
          categories: [...menuPayload.menu.categories, optimistic],
        },
      });

      try {
        const created = await createCategory({
          restaurantSlug,
          name: payload.name,
          locale: payload.locale,
        });
        setMenuPayload((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            menu: {
              ...prev.menu,
              categories: prev.menu.categories.map((c) =>
                c.id === tempId ? { ...created, items: [] } : c,
              ),
            },
          };
        });
        handleCloseCategoryDrawer();
      } catch (error) {
        setMenuPayload(previousPayload);
        void alert({
          title: getUiMessage("dialogErrorTitle", locale),
          message:
            error instanceof Error
              ? error.message
              : getUiMessage("failedToSaveChanges", locale),
          dismissLabel: getUiMessage("dialogDismiss", locale),
        });
      }

      return;
    }

    const categoryId = editingCategory.id;
    if (categoryId.startsWith("temp-cat-")) {
      return;
    }

    const previousPayload = menuPayload;
    const merged = mergeCategoryOptimistic(editingCategory, defaultLocale, payload);

    setMenuPayload({
      ...menuPayload,
      menu: {
        ...menuPayload.menu,
        categories: menuPayload.menu.categories.map((c) =>
          c.id === categoryId ? merged : c,
        ),
      },
    });

    try {
      const updated = await updateCategory(restaurantSlug, categoryId, payload.locale, { name: payload.name });
      setMenuPayload((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          menu: {
            ...prev.menu,
            categories: prev.menu.categories.map((c) =>
              c.id === categoryId
                ? {
                    ...c,
                    name: updated.name,
                    sort_order: updated.sort_order,
                    translations: updated.translations,
                  }
                : c,
            ),
          },
        };
      });
      setEditingCategory((prev) =>
        prev && prev.id === categoryId
          ? {
              ...prev,
              name: updated.name,
              sort_order: updated.sort_order,
              translations: updated.translations,
            }
          : prev,
      );
      handleCloseCategoryDrawer();
    } catch (error) {
      setMenuPayload(previousPayload);
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

  const handleDeleteCategory = async (category: MenuCategory) => {
    if (category.id.startsWith("temp-cat-")) {
      return;
    }

    if (!menuPayload) {
      return;
    }

    const confirmed = await confirm({
      title: getUiMessage("confirmDeleteCategoryTitle", locale),
      message: getUiMessage("confirmDeleteCategoryBody", locale),
      variant: "danger",
      confirmLabel: getUiMessage("dialogConfirmDelete", locale),
      cancelLabel: getUiMessage("cancel", locale),
    });

    if (!confirmed) {
      return;
    }

    if (editingCategory?.id === category.id) {
      handleCloseCategoryDrawer();
    }

    const previousPayload = menuPayload;
    const removedId = category.id;

    setMenuPayload({
      ...menuPayload,
      menu: {
        ...menuPayload.menu,
        categories: menuPayload.menu.categories.filter((c) => c.id !== removedId),
      },
    });

    setActiveCategoryId((prev) => {
      if (prev !== removedId) {
        return prev;
      }
      const remaining = menuPayload.menu.categories.filter((c) => c.id !== removedId);
      return remaining[0]?.id ?? "";
    });

    void deleteCategory(restaurantSlug, removedId).catch((error) => {
      setMenuPayload(previousPayload);
      void alert({
        title: getUiMessage("dialogErrorTitle", locale),
        message:
          error instanceof Error
            ? error.message
            : getUiMessage("failedToSaveChanges", locale),
        dismissLabel: getUiMessage("dialogDismiss", locale),
      });
    });
  };

  const handleReorderItems = async (categoryId: string, nextOrder: MenuItem[]) => {
    if (!menuPayload) {
      return;
    }
    if (nextOrder.some((i) => i.id.startsWith("temp-"))) {
      return;
    }

    const withSort = nextOrder.map((item, index) => ({
      ...item,
      sort_order: index,
    }));
    const previousPayload = menuPayload;

    setMenuPayload({
      ...menuPayload,
      menu: {
        ...menuPayload.menu,
        categories: menuPayload.menu.categories.map((c) =>
          c.id === categoryId ? { ...c, items: withSort } : c,
        ),
      },
    });

    try {
      await reorderCategoryItems(
        restaurantSlug,
        categoryId,
        withSort.map((item, index) => ({ id: item.id, sort_order: index })),
      );
    } catch (error) {
      setMenuPayload(previousPayload);
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

  const handleSaveItem = async (updatedData: Partial<MenuItem>) => {
    if (!menuPayload) {
      return;
    }

    if (addingToCategory) {
      const tempId = `temp-${Date.now()}`;
      const optimisticItem = placeholderMenuItem(tempId, updatedData);
      const previousPayload = menuPayload;
      const targetCategoryId = addingToCategory;

      setCreationPendingTempId(tempId);
      setMenuPayload({
        ...menuPayload,
        menu: {
          ...menuPayload.menu,
          categories: menuPayload.menu.categories.map((category) =>
            category.id !== targetCategoryId
              ? category
              : { ...category, items: [...category.items, optimisticItem] },
          ),
        },
      });

      try {
        const created = await createMenuItem(restaurantSlug, targetCategoryId, updatedData);
        setMenuPayload((prev) => {
          if (!prev) {
            return prev;
          }

          return {
            ...prev,
            menu: {
              ...prev.menu,
              categories: prev.menu.categories.map((category) =>
                category.id !== targetCategoryId
                  ? category
                  : {
                      ...category,
                      items: category.items.map((menuItem) =>
                        menuItem.id === tempId ? created : menuItem,
                      ),
                    },
              ),
            },
          };
        });
        handleCloseDrawer();
      } catch (error) {
        setMenuPayload(previousPayload);
        void alert({
          title: getUiMessage("dialogErrorTitle", locale),
          message:
            error instanceof Error
              ? error.message
              : getUiMessage("failedToSaveChanges", locale),
          dismissLabel: getUiMessage("dialogDismiss", locale),
        });
      } finally {
        setCreationPendingTempId(null);
      }

      return;
    }

    if (!editingItem) {
      return;
    }

    const itemId = editingItem.id;
    const previousPayload = menuPayload;

    setMenuPayload({
      ...menuPayload,
      menu: {
        ...menuPayload.menu,
        categories: menuPayload.menu.categories.map((category) => ({
          ...category,
          items: category.items.map((menuItem) =>
            menuItem.id === itemId ? { ...menuItem, ...updatedData } : menuItem,
          ),
        })),
      },
    });

    try {
      await updateMenuItem(restaurantSlug, itemId, updatedData);
      handleCloseDrawer();
    } catch (error) {
      setMenuPayload(previousPayload);
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

  const handleDeleteItem = async (item: MenuItem) => {
    if (item.id.startsWith("temp-")) {
      return;
    }

    if (!menuPayload) {
      return;
    }

    const confirmed = await confirm({
      title: getUiMessage("confirmDeleteItemTitle", locale),
      message: getUiMessage("confirmDeleteItemBody", locale),
      variant: "danger",
      confirmLabel: getUiMessage("dialogConfirmDelete", locale),
      cancelLabel: getUiMessage("cancel", locale),
    });

    if (!confirmed) {
      return;
    }

    if (editingItem?.id === item.id) {
      handleCloseDrawer();
    }

    const previousPayload = menuPayload;

    setMenuPayload({
      ...menuPayload,
      menu: {
        ...menuPayload.menu,
        categories: menuPayload.menu.categories.map((category) => ({
          ...category,
          items: category.items.filter((menuItem) => menuItem.id !== item.id),
        })),
      },
    });

    void deleteMenuItem(restaurantSlug, item.id).catch((error) => {
      setMenuPayload(previousPayload);
      void alert({
        title: getUiMessage("dialogErrorTitle", locale),
        message:
          error instanceof Error
            ? error.message
            : getUiMessage("failedToDeleteItem", locale),
        dismissLabel: getUiMessage("dialogDismiss", locale),
      });
    });
  };

  const handleToggleAvailability = (item: MenuItem, newStatus: boolean) => {
    if (item.id.startsWith("temp-")) {
      return;
    }

    const previousPayload = menuPayload;

    setMenuPayload((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        menu: {
          ...prev.menu,
          categories: prev.menu.categories.map((category) => ({
            ...category,
            items: category.items.map((menuItem) =>
              menuItem.id === item.id
                ? { ...menuItem, is_available: newStatus }
                : menuItem,
            ),
          })),
        },
      };
    });

    void updateItemAvailability(restaurantSlug, item.id, newStatus).catch((error) => {
      setMenuPayload(previousPayload);
      void alert({
        title: getUiMessage("dialogErrorTitle", locale),
        message:
          error instanceof Error
            ? error.message
            : getUiMessage("failedToUpdateAvailability", locale),
        dismissLabel: getUiMessage("dialogDismiss", locale),
      });
    });
  };

  const handleReorderCategories = async (nextOrder: MenuCategory[]) => {
    if (!menuPayload) {
      return;
    }

    const previousPayload = menuPayload;
    const normalizedNext = nextOrder.map((category, index) => ({
      ...category,
      sort_order: index,
    }));

    setMenuPayload({
      ...menuPayload,
      menu: {
        ...menuPayload.menu,
        categories: normalizedNext,
      },
    });

    try {
      await reorderCategories(
        restaurantSlug,
        normalizedNext.map((category) => category.id),
      );
    } catch (error) {
      setMenuPayload(previousPayload);
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

  const handleCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = categories.findIndex((category) => category.id === active.id);
    const newIndex = categories.findIndex((category) => category.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    void handleReorderCategories(arrayMove(categories, oldIndex, newIndex));
  };

  const bannerUrl = menuPayload?.restaurant.banner_url ?? null;
  const isBannerBusy = isBannerUploading || isBannerRemoving;

  const handleBannerPick = () => {
    if (isBannerBusy) {
      return;
    }
    bannerFileInputRef.current?.click();
  };

  const handleBannerFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setBannerError(getUiMessage("selectImageFileError", locale));
      return;
    }

    setBannerError(null);
    setIsBannerUploading(true);
    try {
      const uploadedUrl = await uploadOwnerImage(restaurantSlug, file);
      await updateRestaurantBannerUrl(restaurantSlug, uploadedUrl);

      setMenuPayload((prev) =>
        prev
          ? {
              ...prev,
              restaurant: {
                ...prev.restaurant,
                banner_url: uploadedUrl,
                banner_image_url: uploadedUrl,
              },
            }
          : prev,
      );
    } catch (error) {
      setBannerError(
        error instanceof Error ? error.message : getUiMessage("bannerUploadFailed", locale),
      );
    } finally {
      setIsBannerUploading(false);
    }
  };

  const handleRemoveBanner = async () => {
    if (!bannerUrl || isBannerBusy) {
      return;
    }
    setBannerError(null);
    setIsBannerRemoving(true);
    try {
      await deleteOwnerImage(restaurantSlug, bannerUrl);
      await updateRestaurantBannerUrl(restaurantSlug, null);
      setMenuPayload((prev) =>
        prev
          ? {
              ...prev,
              restaurant: {
                ...prev.restaurant,
                banner_url: null,
                banner_image_url: null,
              },
            }
          : prev,
      );
    } catch (error) {
      setBannerError(
        error instanceof Error ? error.message : getUiMessage("bannerRemoveFailed", locale),
      );
    } finally {
      setIsBannerRemoving(false);
    }
  };

  return (
    <div
      className="min-h-[100dvh] bg-zinc-50"
      lang={locale}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <main className="mx-auto max-w-md bg-white pb-10">
        <header className="border-b border-zinc-200 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {getUiMessage("ownerDashboard", locale)}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-zinc-900">
                {getUiMessage("menuEditor", locale)}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative" ref={languageMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsLanguageMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={isLanguageMenuOpen}
                  aria-label={getUiMessage("selectLanguage", locale)}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm"
                >
                  <img
                    src={localeFlagSrc[locale]}
                    alt=""
                    className="h-4 w-[1.375rem] rounded-[2px] object-cover"
                    aria-hidden
                  />
                  <span className="text-[10px] text-zinc-500">▾</span>
                </button>

                {isLanguageMenuOpen ? (
                  <div
                    role="menu"
                    className={`absolute z-30 mt-2 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg ${
                      isRtl ? "left-0" : "right-0"
                    }`}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      aria-label={getUiMessage(
                        otherLocale(locale) === "he"
                          ? "languageHebrew"
                          : "languageEnglish",
                        locale,
                      )}
                      onClick={() => {
                        setLocale(otherLocale(locale));
                        setIsLanguageMenuOpen(false);
                      }}
                      className="flex w-full justify-center rounded-lg px-3 py-2 hover:bg-zinc-100"
                    >
                      <img
                        src={localeFlagSrc[otherLocale(locale)]}
                        alt=""
                        className="h-4 w-[1.375rem] rounded-[2px] object-cover"
                      />
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm"
              >
                {getUiMessage("logout", locale)}
              </button>
            </div>
          </div>
        </header>
        {menuPayload ? (
          <section className="border-b border-zinc-200 px-4 py-4">
            <input
              ref={bannerFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleBannerFileChange(event)}
            />
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                {getUiMessage("restaurantBannerTitle", locale)}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBannerPick}
                  disabled={isBannerBusy}
                  className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {isBannerUploading ? (
                    <>
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      {getUiMessage("uploading", locale)}
                    </>
                  ) : (
                    getUiMessage("uploadBanner", locale)
                  )}
                </button>
                {hasRenderableImage(bannerUrl) ? (
                  <button
                    type="button"
                    onClick={() => void handleRemoveBanner()}
                    disabled={isBannerBusy}
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-60"
                  >
                    {isBannerRemoving ? (
                      <>
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
                        {getUiMessage("removing", locale)}
                      </>
                    ) : (
                      getUiMessage("removeBanner", locale)
                    )}
                  </button>
                ) : null}
              </div>
              {hasRenderableImage(bannerUrl) ? (
                <div className="mt-3 h-32 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white">
                  <img
                    src={bannerUrl!}
                    alt={getUiMessage("restaurantBannerPreviewAlt", locale)}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              {bannerError ? <p className="mt-2 text-xs text-red-600">{bannerError}</p> : null}
            </div>
          </section>
        ) : null}

        {isMenuLoading ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-500">
            {getUiMessage("loadingMenu", locale)}
          </div>
        ) : null}

        {menuError ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-zinc-900">
              {getUiMessage("couldNotLoadMenu", locale)}
            </p>
            <p className="mt-1 text-sm text-zinc-500">{menuError}</p>
          </div>
        ) : null}

        {menuPayload && !menuError ? (
          <>
            <nav className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-3 py-2 backdrop-blur">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.map((category) => {
                  const isActive = activeCategoryId === category.id;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => scrollToCategory(category)}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                        isActive
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-700 active:scale-[0.98]"
                      }`}
                    >
                      {getLocalizedText(category, "name", locale)}
                    </button>
                  );
                })}
              </div>
            </nav>

            <section>
              <DndContext
                sensors={categoryDnDSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleCategoryDragEnd}
              >
                <SortableContext
                  items={categories.map((category) => category.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {categories.map((category) => (
                    <SortableCategorySection key={category.id} categoryId={category.id}>
                      {({ dragHandleAttributes, dragHandleListeners }) => (
                        <div
                          ref={(el) => {
                            sectionRefs.current[category.id] = el;
                          }}
                          data-category-id={category.id}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3">
                            <div className="flex min-w-0 flex-1 items-center gap-2">
                              <button
                                type="button"
                                aria-label="Drag to reorder category"
                                className="inline-flex h-8 w-8 shrink-0 touch-none items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm active:cursor-grabbing"
                                {...dragHandleAttributes}
                                {...dragHandleListeners}
                              >
                                <GripVertical className="h-4 w-4" strokeWidth={2} aria-hidden />
                              </button>
                              <h2 className="min-w-0 truncate text-base font-bold text-zinc-900">
                                {getLocalizedText(category, "name", locale)}
                              </h2>
                              <button
                                type="button"
                                onClick={() => handleEditCategoryClick(category)}
                                aria-label={getUiTemplate("editCategoryAria", locale, {
                                  name: getLocalizedText(category, "name", locale),
                                })}
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 shadow-sm active:scale-[0.96]"
                              >
                                <svg
                                  aria-hidden="true"
                                  viewBox="0 0 20 20"
                                  className="h-3.5 w-3.5"
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
                                onClick={() => handleDeleteCategory(category)}
                                aria-label={getUiTemplate("deleteCategoryAria", locale, {
                                  name: getLocalizedText(category, "name", locale),
                                })}
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm active:scale-[0.96]"
                              >
                                <svg
                                  aria-hidden="true"
                                  viewBox="0 0 20 20"
                                  className="h-3.5 w-3.5"
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
                            <button
                              type="button"
                              onClick={() => handleAddItemClick(category.id)}
                              className="shrink-0 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white active:scale-[0.98]"
                            >
                              {getUiMessage("addItem", locale)}
                            </button>
                          </div>
                          <SortableItemList
                            items={category.items}
                            onReorder={(next) => void handleReorderItems(category.id, next)}
                            locale={locale}
                            unavailableLabel={getUiMessage("unavailable", locale)}
                            creationPendingItemId={creationPendingTempId}
                            onEditClick={handleEditClick}
                            onDeleteClick={handleDeleteItem}
                            onToggleAvailability={handleToggleAvailability}
                          />
                        </div>
                      )}
                    </SortableCategorySection>
                  ))}
                </SortableContext>
              </DndContext>
            </section>

            <div className="border-t border-zinc-200 px-4 py-4">
              <button
                type="button"
                onClick={handleAddCategoryClick}
                className="w-full rounded-full border border-dashed border-zinc-300 bg-zinc-50 py-2.5 text-sm font-semibold text-zinc-800 active:scale-[0.98]"
              >
                {getUiMessage("addCategoryButton", locale)}
              </button>
            </div>
          </>
        ) : null}
      </main>

      <EditCategoryDrawer
        category={editingCategory}
        restaurantDefaultLocale={(menuPayload?.restaurant.default_locale ?? "en") as Locale}
        isOpen={isCategoryDrawerOpen}
        onClose={handleCloseCategoryDrawer}
        onSave={handleSaveCategory}
      />

      <EditItemDrawer
        restaurantSlug={restaurantSlug}
        item={editingItem}
        categoryId={addingToCategory}
        restaurantDefaultLocale={menuPayload?.restaurant.default_locale ?? "en"}
        allMenuItems={allMenuItems}
        onRefreshMenu={refreshMenuForDrawer}
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onSave={handleSaveItem}
      />
    </div>
  );
}

export default function LegacyAdminRoutePage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-bold text-zinc-900">Tenant Admin Route Required</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Use
          <span className="mx-1 rounded bg-zinc-100 px-1.5 py-0.5 font-mono">/{`{restaurant_slug}`}/admin</span>
          to open a restaurant admin panel.
        </p>
      </div>
    </main>
  );
}
