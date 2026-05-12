"use client";

/**
 * App-wide overlay dialogs for `/admin` (and future routes wrapped with `DialogProvider`).
 *
 * Usage:
 *   const { confirm, alert } = useDialogs();
 *   if (!(await confirm({ title, message, variant: 'danger', ... }))) return;
 *   await alert({ title, message });
 *
 * Labels fall back to `getUiMessage` for the current `useUiStore` locale.
 */

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AlertModal from "../components/ui/AlertModal";
import ConfirmModal from "../components/ui/ConfirmModal";
import { useUiStore } from "../store/uiStore";
import { getUiMessage } from "../utils/i18n";

export type ConfirmDialogOptions = {
  title: string;
  message: string;
  variant?: "danger" | "primary";
  confirmLabel?: string;
  cancelLabel?: string;
};

export type AlertDialogOptions = {
  title?: string;
  message: string;
  dismissLabel?: string;
};

type ConfirmState = ConfirmDialogOptions & { resolve: (value: boolean) => void };

type AlertState = AlertDialogOptions & { resolve: () => void };

type DialogContextValue = {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  alert: (options: AlertDialogOptions) => Promise<void>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const locale = useUiStore((state) => state.locale);
  const titleIdBase = useId();

  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [alertState, setAlertState] = useState<AlertState | null>(null);

  const confirmTitleId = `${titleIdBase}-confirm-title`;
  const alertTitleId = `${titleIdBase}-alert-title`;

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const alertFn = useCallback((options: AlertDialogOptions) => {
    return new Promise<void>((resolve) => {
      setAlertState({ ...options, resolve });
    });
  }, []);

  const handleConfirmCancel = useCallback(() => {
    setConfirmState((prev) => {
      prev?.resolve(false);
      return null;
    });
  }, []);

  const handleConfirmOk = useCallback(() => {
    setConfirmState((prev) => {
      prev?.resolve(true);
      return null;
    });
  }, []);

  const handleAlertDismiss = useCallback(() => {
    setAlertState((prev) => {
      prev?.resolve();
      return null;
    });
  }, []);

  const value = useMemo<DialogContextValue>(
    () => ({ confirm, alert: alertFn }),
    [confirm, alertFn],
  );

  return (
    <DialogContext.Provider value={value}>
      {children}

      <ConfirmModal
        open={confirmState !== null}
        locale={locale}
        titleId={confirmTitleId}
        title={confirmState?.title ?? ""}
        message={confirmState?.message ?? ""}
        cancelLabel={
          confirmState?.cancelLabel ?? getUiMessage("cancel", locale)
        }
        confirmLabel={
          confirmState?.confirmLabel ?? getUiMessage("dialogConfirm", locale)
        }
        variant={confirmState?.variant ?? "primary"}
        onCancel={handleConfirmCancel}
        onConfirm={handleConfirmOk}
      />

      <AlertModal
        open={alertState !== null}
        locale={locale}
        titleId={alertTitleId}
        title={alertState?.title}
        message={alertState?.message ?? ""}
        dismissLabel={
          alertState?.dismissLabel ?? getUiMessage("dialogDismiss", locale)
        }
        onDismiss={handleAlertDismiss}
      />
    </DialogContext.Provider>
  );
}

export function useDialogs(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useDialogs must be used within a DialogProvider");
  }
  return ctx;
}
