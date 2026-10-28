import type { Messages } from "@/lib/i18n/lang";

import { STAGE_META, type QueueStage } from "./stages";

/**
 * The three queues' words in every language: the legend, the bar's hover detail and the status table's
 * headings. English reads STAGE_META, so the English label stays in one place; DOL's status words in the
 * hover detail stay as DOL prints them.
 */
export interface StageText {
  label: Record<QueueStage, string>;
  gloss: Record<QueueStage, string>;
  /** "Analyst review: 1,200 cases" */
  tipCount: (label: string, count: string, n: number) => string;
  /** "Of 1,290 pending" */
  tipOf: (own: string) => string;
  censusStatus: string;
  censusCases: string;
}

const EN_LABEL = {
  analyst: STAGE_META.analyst.label,
  held: STAGE_META.held.label,
  appeal: STAGE_META.appeal.label,
};
const EN_GLOSS = {
  analyst: STAGE_META.analyst.gloss,
  held: STAGE_META.held.gloss,
  appeal: STAGE_META.appeal.gloss,
};

export const STAGE_TEXT = {
  en: {
    label: EN_LABEL,
    gloss: EN_GLOSS,
    tipCount: (label, count, n) => `${label}: ${count} ${n === 1 ? "case" : "cases"}`,
    tipOf: (own) => `Of ${own} pending`,
    censusStatus: "DOL status",
    censusCases: "Cases",
  },
  es: {
    label: {
      analyst: "Revisión por un analista",
      held: "Fuera del orden de presentación",
      appeal: "En apelación o revisión",
    },
    gloss: {
      analyst: "se trabaja en orden de presentación",
      held: "en espera, con RFI, NORD, auditoría o reclutamiento supervisado",
      appeal: "apelados tras una decisión desfavorable",
    },
    tipCount: (label, count, n) => `${label}: ${count} ${n === 1 ? "caso" : "casos"}`,
    tipOf: (own) => `De ${own} pendientes`,
    censusStatus: "Estado del DOL",
    censusCases: "Casos",
  },
  zh: {
    label: {
      analyst: "审查员审核",
      held: "不按递交顺序",
      appeal: "上诉或复审中",
    },
    gloss: {
      analyst: "按递交顺序审理",
      held: "暂缓、RFI、NORD、审计或监督招聘",
      appeal: "在不利判定后提出上诉",
    },
    tipCount: (label, count) => `${label}：${count} 件`,
    tipOf: (own) => `共 ${own} 件待审`,
    censusStatus: "劳工部状态",
    censusCases: "案件数",
  },
  "pt-br": {
    label: {
      analyst: "Revisão por analista",
      held: "Fora da ordem de protocolo",
      appeal: "Em recurso ou revisão",
    },
    gloss: {
      analyst: "analisado na ordem de protocolo",
      held: "em espera, com RFI, NORD, auditoria ou recrutamento supervisionado",
      appeal: "com recurso após uma decisão desfavorável",
    },
    tipCount: (label, count, n) => `${label}: ${count} ${n === 1 ? "caso" : "casos"}`,
    tipOf: (own) => `De ${own} pendentes`,
    censusStatus: "Status do DOL",
    censusCases: "Casos",
  },
  ko: {
    label: {
      analyst: "심사관 검토",
      held: "접수 순서 밖",
      appeal: "항소 또는 재검토 중",
    },
    gloss: {
      analyst: "접수 순서대로 심사",
      held: "보류, RFI, NORD, 감사 또는 감독 하 모집",
      appeal: "불리한 결정 후 항소",
    },
    tipCount: (label, count) => `${label}: ${count}건`,
    tipOf: (own) => `대기 중 ${own}건 중`,
    censusStatus: "노동부 상태",
    censusCases: "건수",
  },
  vi: {
    label: {
      analyst: "Chuyên viên xét duyệt",
      held: "Ngoài thứ tự nộp",
      appeal: "Đang kháng cáo hoặc xem xét lại",
    },
    gloss: {
      analyst: "xét theo thứ tự nộp",
      held: "tạm giữ, RFI, NORD, kiểm tra (audit) hoặc tuyển dụng có giám sát",
      appeal: "kháng cáo sau một quyết định bất lợi",
    },
    tipCount: (label, count) => `${label}: ${count} hồ sơ`,
    tipOf: (own) => `Trong ${own} hồ sơ đang chờ`,
    censusStatus: "Tình trạng của DOL",
    censusCases: "Số hồ sơ",
  },
} satisfies Messages<StageText>;
