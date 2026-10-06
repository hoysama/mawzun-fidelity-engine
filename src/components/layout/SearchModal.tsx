"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { t } from "@/lib/typography";
import { STAGES, unlockedStageIds } from "@/lib/stages";
import { useAudit } from "@/context/AuditContext";
import { buildConstraintBank } from "@/lib/audit";

interface SearchResult {
  id: string;
  category: "المراحل" | "بنك القيود" | "القواعد والضوابط";
  title: string;
  subtitle: string;
  icon: string;
  action: () => void;
}

export function SearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Keyboard shortcut listener for Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const audit = useAudit();
  const unlocked = unlockedStageIds(audit.result !== null);

  const items = useMemo<SearchResult[]>(() => {
    const list: SearchResult[] = [];

    // Stages — only the ones that exist. An entry that scrolls to a section the
    // page has not rendered is a dead end dressed up as navigation.
    STAGES.filter((stage) => unlocked.includes(stage.id)).forEach((stage) => {
      list.push({
        id: `stage-${stage.id}`,
        category: "المراحل",
        title: `${stage.ordinal}. ${stage.title}`,
        subtitle: `الانتقال المباشر إلى قسم «${stage.title}»`,
        icon: stage.icon,
        action: () => {
          document.getElementById(stage.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
          onClose();
        },
      });
    });

    // The constraint bank lives inside the constraints section, so it is only
    // searchable once that section has been opened by a run.
    if (unlocked.includes("step-2")) {
      buildConstraintBank().constraints.forEach((constraint) => {
        list.push({
          id: `constraint-${constraint.id}`,
          category: "بنك القيود",
          title: constraint.source.join(" · ") || constraint.id,
          subtitle: constraint.rule,
          icon: "rule_folder",
          action: () => {
            document.getElementById("step-2")?.scrollIntoView({ behavior: "smooth", block: "start" });
            onClose();
          },
        });
      });
    }

    return list;
  }, [onClose, unlocked]);

  // Filter items by query
  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 10);
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    );
  }, [items, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-inverse-surface/40 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl border border-outline-variant/30 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-container">
          <Icon name="search" className="text-xl text-moss-700 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="ابحث في المراحل وبنك القيود..."
            autoFocus
            className={cx(
              t.body,
              "w-full bg-transparent text-on-surface placeholder:text-outline focus:outline-none",
            )}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-outline hover:text-on-surface p-1"
            >
              <Icon name="close" className="text-sm" />
            </button>
          )}
          <kbd className="hidden sm:inline-block rounded-sm bg-moss-50 px-2 py-0.5 font-code-sm text-[11px] text-moss-700">
            ESC
          </kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill text-on-surface-variant transition-colors hover:bg-moss-100 hover:text-moss-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-600"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 flex flex-col gap-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant flex flex-col items-center justify-center gap-2">
              <Icon name="search_off" className="text-3xl text-outline" />
              <p className={t.bodySm}>لم نجد أي نتائج مطابقة لعبارة البحث «{query}»</p>
              <span className={cx(t.labelSm, "text-outline")}>
                {unlocked.length === 1
                  ? "بنك القيود يُفتح بعد تنفيذ الفحص، فيصبح بحثه متاحًا هنا."
                  : "جرّب البحث عن «لا يجوز»، «الشرط»، «الشريعة»، أو «الفحص»."}
              </span>
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cx(
                    "flex items-center justify-between w-full p-3 rounded-xl text-right transition-colors",
                    isSelected
                      ? "bg-moss-600 text-on-primary shadow-xs"
                      : "hover:bg-surface-container-low text-on-surface",
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={cx(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        isSelected
                          ? "bg-moss-50 text-moss-700"
                          : "bg-moss-100 text-moss-700",
                      )}
                    >
                      <Icon name={item.icon} className="text-base" />
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className={cx(t.label, "font-semibold truncate")}>{item.title}</span>
                      <span
                        className={cx(
                          t.bodySm,
                          "truncate",
                          isSelected ? "text-on-primary/80" : "text-on-surface-variant",
                        )}
                      >
                        {item.subtitle}
                      </span>
                    </div>
                  </div>

                  <span
                    className={cx(
                      t.code,
                      "shrink-0 rounded px-2 py-0.5 text-[10px] mr-2",
                      isSelected
                        ? "bg-on-primary/20 text-on-primary"
                        : "bg-moss-100 text-moss-700",
                    )}
                  >
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-moss-50/60 border-t border-moss-200 text-[11px] text-on-surface-variant">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded bg-surface-container-lowest px-1.5 py-0.5 text-on-surface shadow-xs">
                ↵
              </kbd>{" "}
              للاختيار
            </span>
            <span>
              <kbd className="rounded bg-surface-container-lowest px-1.5 py-0.5 text-on-surface shadow-xs">
                ↑
              </kbd>{" "}
              <kbd className="rounded bg-surface-container-lowest px-1.5 py-0.5 text-on-surface shadow-xs">
                ↓
              </kbd>{" "}
              للتنقل
            </span>
          </div>
          <span>موزون • بحث نصّي في المراحل وبنك القيود</span>
        </div>
      </div>
    </div>
  );
}
