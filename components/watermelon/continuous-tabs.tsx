"use client";

import { LayoutGroup, motion } from "motion/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils.js";

export type ContinuousTabItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
};

type ContinuousTabsProps = {
  tabs: ContinuousTabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Unique layout id so multiple tab groups can coexist on one page. */
  id: string;
  "aria-label": string;
  className?: string;
};

/**
 * Watermelon "continuous tabs": button-like tabs with a spring-animated
 * sliding background pill (adapted from registry `continuous-tabs-base`).
 */
export function ContinuousTabs({
  tabs,
  value,
  onChange,
  id,
  "aria-label": ariaLabel,
  className,
}: ContinuousTabsProps) {
  return (
    <LayoutGroup id={id}>
      <div
        role="group"
        aria-label={ariaLabel}
        className={cn(
          "relative flex items-center gap-0.5 rounded-lg border border-border bg-muted/30 p-1 shadow-[inset_0_-2px_4px_rgb(255_255_255/0.04),inset_0_1px_0_rgb(255_255_255/0.03)]",
          className,
        )}
      >
        {tabs.map((tab) => {
          const isActive = value === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              disabled={tab.disabled}
              aria-pressed={isActive}
              onClick={() => onChange(tab.id)}
              className="relative min-h-7 rounded-md px-3 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              {isActive ? (
                <motion.span
                  layoutId={`${id}-active-pill`}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 30,
                    mass: 0.9,
                  }}
                  className="absolute inset-0 rounded-md bg-foreground shadow-xs"
                />
              ) : null}
              <motion.span
                layout="position"
                className={cn(
                  "relative z-10 flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap transition-colors duration-200",
                  isActive ? "text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.icon}
                {tab.label}
              </motion.span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
