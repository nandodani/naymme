"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";

/**
 * Lightweight copy-feedback toast — a single floating pill the page renders
 * while `message` is non-null. `role="status"` makes it a polite live region
 * so copy confirmations are announced without moving focus.
 */
export function CopyToast({ message }: { message: string | null }) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4"
    >
      <AnimatePresence>
        {message !== null ? (
          <motion.div
            key={message}
            role="status"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="flex items-center gap-2 rounded-full border border-border bg-popover px-3.5 py-1.5 text-xs font-medium text-popover-foreground shadow-lg"
          >
            <Check aria-hidden="true" className="size-3.5 text-primary" />
            {message}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
