"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastContextType {
  toast: (message: Omit<ToastMessage, "id">) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const toast = useCallback(({ title, description, variant = "success" }: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, description, variant }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 3800);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast floating container */}
      <div
        aria-live="polite"
        className="fixed bottom-6 left-6 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full"
      >
        {toasts.map((item) => {
          const isSuccess = item.variant === "success";
          const isError = item.variant === "error";
          const isWarning = item.variant === "warning";

          return (
            <div
              key={item.id}
              className={cx(
                "pointer-events-auto flex items-start gap-3 rounded-xl p-3.5 shadow-xl backdrop-blur-md border transition-all duration-300 animate-in slide-in-from-bottom-3",
                isSuccess
                  ? "bg-surface-container-lowest/95 border-moss-600/25 text-on-surface"
                  : isError
                    ? "bg-surface-container-lowest/95 border-error/30 text-on-surface"
                    : isWarning
                      ? "bg-surface-container-lowest/95 border-moss-600/30 text-on-surface"
                      : "bg-surface-container-lowest/95 border-outline-variant/40 text-on-surface",
              )}
            >
              <span
                className={cx(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5",
                  isSuccess
                    ? "bg-moss-100 text-moss-700"
                    : isError
                      ? "bg-error-container text-error"
                      : isWarning
                        ? "bg-moss-200 text-moss-800"
                        : "bg-surface-container text-moss-700",
                )}
              >
                <Icon
                  name={
                    isSuccess
                      ? "verified"
                      : isError
                        ? "error"
                        : isWarning
                          ? "warning"
                          : "info"
                  }
                  className="text-base"
                  filled
                />
              </span>

              <div className="flex flex-1 flex-col pr-1">
                <span className={cx(t.labelSm, "font-bold text-on-surface")}>{item.title}</span>
                {item.description && (
                  <span className={cx(t.bodySm, "text-on-surface-variant mt-0.5 leading-snug")}>
                    {item.description}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="text-outline hover:text-on-surface transition-colors p-1"
                aria-label="إغلاق الإشعار"
              >
                <Icon name="close" className="text-sm" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
