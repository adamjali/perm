"use client";

import { useEffect, useRef, useState, useCallback, type RefCallback } from "react";
import { TrendUpIcon as TrendingUp } from "@phosphor-icons/react";
import { parseISO, differenceInDays } from "date-fns";
import { extractMilestones } from "@/lib/timeline/milestones";
import { calculateNextDeadline } from "./next-up-section.utils";
import type { CaseDetailData } from "./case-detail-types";

interface QuickStatsPanelProps {
  caseData: CaseDetailData;
}

function useCountUp(target: number, duration = 1200): { value: number; ref: RefCallback<HTMLElement> } {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);
  const hasAnimated = useRef(false);
  const elementRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const startAnimation = useCallback(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    frameRef.current = requestAnimationFrame(animate);
  }, [target, duration]);

  useEffect(() => {
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  // Reset when target changes (e.g. tab switch)
  useEffect(() => {
    hasAnimated.current = false;
    setValue(0);
    cancelAnimationFrame(frameRef.current);
  }, [target]);

  const setRef = useCallback((el: HTMLElement | null) => {
    if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
    elementRef.current = el;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          startAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    observerRef.current = observer;
  }, [startAnimation]);

  return { value, ref: setRef };
}

function CountUpStat({ target, color, label, sub }: { target: number; color?: string; label: string; sub: string }) {
  const { value, ref } = useCountUp(target);
  return (
    <div className="stat" ref={ref}>
      <div className="stat-val" style={color ? { color } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

export function QuickStatsPanel({ caseData }: QuickStatsPanelProps) {
  const now = new Date();

  // PWD Expiry Days — use parseISO to avoid timezone shift
  let pwdExpiryDays = 0;
  if (caseData.pwdExpirationDate) {
    pwdExpiryDays = Math.max(0, differenceInDays(parseISO(caseData.pwdExpirationDate), now));
  }

  // Case Age
  const caseAge = Math.max(0, differenceInDays(now, new Date(caseData.createdAt)));

  // Milestones completed vs total
  const allMilestones = extractMilestones(caseData);
  const todayStr = now.toISOString().split("T")[0] as string;
  const completedMilestones = allMilestones.filter(
    (m) => m.date && m.date <= todayStr && !m.isCalculated
  ).length;

  // Next deadline — use canonical extractActiveDeadlines (same as NextUp section)
  const nextDeadline = calculateNextDeadline(caseData);
  const nextDeadlineDays = nextDeadline ? Math.max(0, nextDeadline.daysUntil) : 0;
  const nextDeadlineLabel = nextDeadline ? nextDeadline.label : "no deadline";

  return (
    <div className="detail-card">
      <div className="detail-card-head ch-muted">
        <span className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5" />
          Quick Stats
        </span>
      </div>
      <div className="stats-grid">
        <CountUpStat target={pwdExpiryDays} color="var(--stage-eta9089)" label="PWD Expiry" sub="days left" />
        <CountUpStat target={caseAge} label="Case Age" sub="days" />
        <CountUpStat target={completedMilestones} color="var(--stage-recruitment)" label="Milestones" sub={`of ${allMilestones.length} done`} />
        <CountUpStat target={nextDeadlineDays} color="var(--stage-pwd)" label="Next Deadline" sub={nextDeadlineLabel} />
      </div>
    </div>
  );
}
