/**
 * One source for how each PERM stage looks: its fill, the ink that reads on
 * that fill, the ink for text on paper, its label and its icon.
 *
 * Ink on fill is measured, not assumed. White reads on the PWD blue (4.9:1),
 * the recruitment purple (5.4:1) and the closed grey (4.8:1); black is needed
 * on the ETA 9089 amber (white measured 3.2:1) and the I-140 teal (white 3.8:1).
 */
import {
  MegaphoneIcon,
  MoneyIcon,
  FileTextIcon,
  SealCheckIcon,
  ArchiveIcon,
} from "@phosphor-icons/react/ssr";
// A type import is erased at compile, so the client-only main entry is safe here.
import type { Icon } from "@phosphor-icons/react";

import type { CaseStatus } from "@/lib/perm";

export interface StageVisual {
  /** Full name, as the rest of the app writes it. */
  label: string;
  /** Short code for tight spaces (a chip, a track block). */
  code: string;
  /** Background fill. */
  fill: string;
  /** Text that reads on `fill`. */
  onFill: string;
  /** Text in the stage colour that reads on the page (paper or ink). */
  ink: string;
  /** Border in the stage colour. */
  border: string;
  icon: Icon;
}

export const STAGE_VISUALS: Record<CaseStatus, StageVisual> = {
  pwd: {
    label: "PWD",
    code: "PWD",
    fill: "bg-stage-pwd",
    onFill: "text-white",
    ink: "text-stage-pwd-ink",
    border: "border-stage-pwd",
    icon: MoneyIcon,
  },
  recruitment: {
    label: "Recruitment",
    code: "Recruit",
    fill: "bg-stage-recruitment",
    onFill: "text-white",
    ink: "text-stage-recruitment-ink",
    border: "border-stage-recruitment",
    icon: MegaphoneIcon,
  },
  eta9089: {
    label: "ETA 9089",
    code: "9089",
    fill: "bg-stage-eta9089",
    onFill: "text-black",
    ink: "text-stage-eta9089-ink",
    border: "border-stage-eta9089",
    icon: FileTextIcon,
  },
  i140: {
    label: "I-140",
    code: "I-140",
    fill: "bg-stage-i140",
    onFill: "text-black",
    ink: "text-stage-i140-ink",
    border: "border-stage-i140",
    icon: SealCheckIcon,
  },
  closed: {
    label: "Closed",
    code: "Closed",
    fill: "bg-stage-closed",
    onFill: "text-white",
    ink: "text-stage-closed-ink",
    border: "border-stage-closed",
    icon: ArchiveIcon,
  },
};

/** The four working stages, in filing order. */
export const PERM_PATH: readonly CaseStatus[] = ["pwd", "recruitment", "eta9089", "i140"];
