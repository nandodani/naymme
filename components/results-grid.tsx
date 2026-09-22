"use client";

import { motion } from "motion/react";

import type { AvailabilityResponse } from "@/lib/availability.js";
import { providerGroup } from "@/lib/provider-meta.js";
import type { AvailabilityResult } from "@/src/types.js";
import type { NameScore } from "@/src/scoring/score.js";
import { BrandScoreCard } from "./brand-score-card.js";
import { ProviderCard } from "./provider-card.js";
import { Button } from "./ui/button.js";

interface ResultsGridProps {
  name: string;
  score: NameScore | null;
  data: AvailabilityResponse | null;
  checking: boolean;
  error: string | null;
  onRetry: () => void;
  onCopy: (text: string, label: string) => void;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
};

/**
 * The searched state: a bento grid of the brand score card plus one card per
 * provider group. On xl, the Socials card anchors the right column; the score
 * and developer cards stack to its left, Domains spans underneath and the
 * Creator & community card fills the bottom-right slot.
 */
export function ResultsGrid({
  name,
  score,
  data,
  checking,
  error,
  onRetry,
  onCopy,
}: ResultsGridProps) {
  const resultsByProvider = new Map<string, AvailabilityResult>(
    (data?.results ?? []).map((r) => [r.provider, r]),
  );
  const pending = checking;
  const domains = providerGroup("domains");
  const developer = providerGroup("developer");
  const socials = providerGroup("socials");
  const community = providerGroup("community");

  return (
    <div className="flex flex-col gap-3">
      {error !== null ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5"
        >
          <p className="text-[12px] text-red-300">Availability check failed — {error}</p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : null}

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
      >
        <motion.div variants={item} className="md:col-span-2 xl:col-span-1 xl:col-start-1">
          <BrandScoreCard
            score={score}
            availability={data}
            checking={checking}
            name={name}
            onCopy={onCopy}
            className="h-full"
          />
        </motion.div>

        <motion.div
          variants={item}
          className="md:col-start-1 md:row-start-2 md:row-span-2 xl:col-start-3 xl:row-start-1"
        >
          <ProviderCard
            group={socials}
            name={name}
            resultsByProvider={resultsByProvider}
            pending={pending}
            className="h-full"
          />
        </motion.div>

        <motion.div variants={item} className="md:col-start-2 md:row-start-2 xl:row-start-1">
          <ProviderCard
            group={developer}
            name={name}
            resultsByProvider={resultsByProvider}
            pending={pending}
            className="h-full"
          />
        </motion.div>

        <motion.div
          variants={item}
          className="md:col-start-2 md:row-start-3 xl:col-span-2 xl:col-start-1 xl:row-start-2"
        >
          <ProviderCard
            group={domains}
            name={name}
            resultsByProvider={resultsByProvider}
            pending={pending}
            className="h-full"
          />
        </motion.div>

        <motion.div
          variants={item}
          className="md:col-start-1 md:row-start-3 xl:col-start-3 xl:row-start-2"
        >
          <ProviderCard
            group={community}
            name={name}
            resultsByProvider={resultsByProvider}
            pending={pending}
            className="h-full"
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
