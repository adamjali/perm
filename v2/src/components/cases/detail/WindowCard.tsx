"use client";

import { motion } from "motion/react";
import { itemVariants, fmtISOShort, type WindowStatus } from "./case-detail-utils";

interface WindowCardProps {
  ws: WindowStatus;
  title: string;
  stageColor: string;
  startDate?: string | null;
  endDate?: string | null;
}

/**
 * Shared window status card used by RecruitmentTab, ETA9089Tab, and I140Tab.
 * Displays a progress bar showing how far through a date window we are.
 */
export function WindowCard({ ws, title, stageColor, startDate, endDate }: WindowCardProps) {
  return (
    <motion.div variants={itemVariants}>
      <div className="win-card">
        <div className="win-accent" style={{ background: stageColor }} />
        <div className="win-inner">
          <div className="win-header">
            <span className="win-title">{title}</span>
            <span className="win-chip" style={ws.chipStyle}>{ws.chip}</span>
          </div>
          <div className="win-hero">
            <div>
              <span className="win-hero-num" style={{ color: stageColor }}>{ws.days}</span>
              <span className="win-hero-unit">days</span>
            </div>
            <div className="win-hero-label">{ws.label}</div>
          </div>
          <div className="win-progress">
            <span className="win-date">{fmtISOShort(startDate)}</span>
            <div className="win-bar">
              <div
                className="win-bar-fill"
                // scaleX, not width. See .win-bar-fill in globals.css.
                style={{
                  transform: `scaleX(${ws.pct / 100})`,
                  background: stageColor,
                }}
              />
            </div>
            <span className="win-date">{fmtISOShort(endDate)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
