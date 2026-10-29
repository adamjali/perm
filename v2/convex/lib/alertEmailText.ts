/**
 * The caller-side words of the alert emails and the pages their links open, in the five languages the site
 * publishes. The templates (`src/emails/*`) carry their own body copy; this file holds what the Convex functions
 * build and pass in: the subjects, the figure-table row labels, the rating question, the "Also on PERM Tracker"
 * fallback links, and the confirm/unsubscribe landing pages. English is exactly today's wording, so an English
 * reader's mail and pages are unchanged.
 *
 * DOL's status words, case numbers, form names (I-140) and regulation citations stay as printed; the party who
 * acts is always the employer. Terminology follows the site's own translations (src/components/alerts and the
 * case-status page). Machine translations by a model; nothing here claims a native-speaker review.
 *
 * @module convex/lib/alertEmailText
 */

import type { MailLang, MailMessages } from "../../src/lib/i18n/mailLang";
import type { FlagProgram } from "../../src/lib/flagCaseNumber";

/** The program noun, with its article, in the reader's language. */
const PROGRAM_NOUN: MailMessages<Record<FlagProgram, { noun: string; withArticle: string }>> = {
  en: {
    perm: { noun: "PERM case", withArticle: "a PERM case" },
    pwd: { noun: "prevailing wage request", withArticle: "a prevailing wage request" },
    lca: { noun: "LCA", withArticle: "an LCA" },
    seasonal: { noun: "H-2A, H-2B or CW-1 filing", withArticle: "an H-2A, H-2B or CW-1 filing" },
  },
  es: {
    perm: { noun: "caso PERM", withArticle: "un caso PERM" },
    pwd: { noun: "solicitud de salario prevaleciente", withArticle: "una solicitud de salario prevaleciente" },
    lca: { noun: "LCA", withArticle: "una LCA" },
    seasonal: { noun: "solicitud H-2A, H-2B o CW-1", withArticle: "una solicitud H-2A, H-2B o CW-1" },
  },
  zh: {
    perm: { noun: "PERM 案件", withArticle: "一个 PERM 案件" },
    pwd: { noun: "现行工资申请", withArticle: "一份现行工资申请" },
    lca: { noun: "LCA", withArticle: "一份 LCA" },
    seasonal: { noun: "H-2A、H-2B 或 CW-1 申请", withArticle: "一份 H-2A、H-2B 或 CW-1 申请" },
  },
  "pt-br": {
    perm: { noun: "caso PERM", withArticle: "um caso PERM" },
    pwd: { noun: "pedido de salário prevalecente", withArticle: "um pedido de salário prevalecente" },
    lca: { noun: "LCA", withArticle: "uma LCA" },
    seasonal: { noun: "pedido H-2A, H-2B ou CW-1", withArticle: "um pedido H-2A, H-2B ou CW-1" },
  },
  ko: {
    perm: { noun: "PERM 케이스", withArticle: "PERM 케이스" },
    pwd: { noun: "적정 임금 신청", withArticle: "적정 임금 신청" },
    lca: { noun: "LCA", withArticle: "LCA" },
    seasonal: { noun: "H-2A, H-2B 또는 CW-1 신청", withArticle: "H-2A, H-2B 또는 CW-1 신청" },
  },
  vi: {
    perm: { noun: "hồ sơ PERM", withArticle: "một hồ sơ PERM" },
    pwd: { noun: "đơn xin mức lương hiện hành", withArticle: "một đơn xin mức lương hiện hành" },
    lca: { noun: "LCA", withArticle: "một LCA" },
    seasonal: { noun: "đơn H-2A, H-2B hoặc CW-1", withArticle: "một đơn H-2A, H-2B hoặc CW-1" },
  },
};

export function programNounIn(program: FlagProgram, lang: MailLang): string {
  return PROGRAM_NOUN[lang][program].noun;
}
export function programNounWithArticleIn(program: FlagProgram, lang: MailLang): string {
  return PROGRAM_NOUN[lang][program].withArticle;
}

export interface AlertEmailText {
  /** Email subjects. Each takes what it needs; a case number or month stays as printed. */
  subject: {
    caseConfirm: (noun: string, caseNumber: string) => string;
    caseChanged: (noun: string, status: string) => string;
    queueConfirm: (perm: boolean) => string;
    queueReached: (perm: boolean, frontier: string) => string;
    bulletinConfirm: (series: string) => string;
    bulletinMoved: (series: string, month: string) => string;
    employerConfirm: (employer: string) => string;
    employerMoved: (employer: string) => string;
    digestConfirm: string;
    daily: (n: number) => string;
  };
  /** The "Where this sits" figure-table labels in a case-change email. */
  caseRows: {
    nowInStatus: string;
    cohortTotal: string;
    cohortPending: string;
    pendingAhead: string;
  };
  rfiRows: { resolved: string; certified: string; denied: string; withdrawn: string };
  employerRows: { total: string; certified: string; denied: string; medianDays: string };
  /** The rating boxes' question (passed to RatingRow). */
  ratingQuestion: string;
  /** The two fallback "Also on PERM Tracker" links when a case email names no employer-specific ones. */
  alsoQueue: string;
  alsoMethodology: string;
  /** The daily bundle ("DailyUpdate") chrome. */
  daily: {
    lead: (n: number) => string;
    one: string;
    more: (n: number) => string;
  };
}

export const ALERT_EMAIL_TEXT: MailMessages<AlertEmailText> = {
  en: {
    subject: {
      caseConfirm: (noun, c) => `Confirm alerts for ${noun} ${c}`,
      caseChanged: (noun, s) => `Your ${noun} is now ${s}`,
      queueConfirm: (perm) => (perm ? "Confirm your PERM queue alert" : "Confirm your prevailing-wage queue alert"),
      queueReached: (perm, f) => (perm ? `DOL has reached ${f} in the PERM queue` : `DOL has reached ${f} in the prevailing-wage queue`),
      bulletinConfirm: (series) => `Confirm your visa bulletin alert for ${series}`,
      bulletinMoved: (series, month) => `${series} moved in the ${month} visa bulletin`,
      employerConfirm: (e) => `Confirm alerts for ${e}`,
      employerMoved: (e) => `DOL moved ${e}'s cases`,
      digestConfirm: "Confirm the weekly PERM Tracker digest",
      daily: (n) => `${n} PERM Tracker updates`,
    },
    caseRows: {
      nowInStatus: "Cases now at this status",
      cohortTotal: "Filed the same month as yours",
      cohortPending: "Of those, still pending",
      pendingAhead: "Pending cases filed earlier",
    },
    rfiRows: { resolved: "Resolved RFIs observed", certified: "Of those, ended certified", denied: "Ended denied", withdrawn: "Withdrawn" },
    employerRows: { total: "Decisions DOL has published", certified: "Of those, certified", denied: "Denied", medianDays: "Median days to a decision" },
    ratingQuestion: "How useful were these alerts?",
    alsoQueue: "The filing month DOL's queue has reached",
    alsoMethodology: "Where every figure in this email comes from",
    daily: {
      lead: (n) => `${n} of your PERM Tracker alerts moved today.`,
      one: "One update",
      more: (n) => `and ${n} more`,
    },
  },
  es: {
    subject: {
      caseConfirm: (noun, c) => `Confirme las alertas de ${noun} ${c}`,
      caseChanged: (noun, s) => `Su ${noun} ahora está en ${s}`,
      queueConfirm: (perm) => (perm ? "Confirme su alerta de la fila PERM" : "Confirme su alerta de la fila de salario prevaleciente"),
      queueReached: (perm, f) => (perm ? `El DOL llegó a ${f} en la fila PERM` : `El DOL llegó a ${f} en la fila de salario prevaleciente`),
      bulletinConfirm: (series) => `Confirme su alerta del boletín de visas para ${series}`,
      bulletinMoved: (series, month) => `${series} se movió en el boletín de visas de ${month}`,
      employerConfirm: (e) => `Confirme las alertas de ${e}`,
      employerMoved: (e) => `El DOL movió los casos de ${e}`,
      digestConfirm: "Confirme el resumen semanal de PERM Tracker",
      daily: (n) => `${n} novedades de PERM Tracker`,
    },
    caseRows: {
      nowInStatus: "Casos ahora en este estado",
      cohortTotal: "Presentados el mismo mes que el suyo",
      cohortPending: "De esos, aún pendientes",
      pendingAhead: "Casos pendientes presentados antes",
    },
    rfiRows: { resolved: "RFI resueltos observados", certified: "De esos, terminaron certificados", denied: "Terminaron negados", withdrawn: "Retirados" },
    employerRows: { total: "Decisiones publicadas por el DOL", certified: "De esas, certificadas", denied: "Negadas", medianDays: "Días medianos hasta una decisión" },
    ratingQuestion: "¿Qué tan útiles fueron estas alertas?",
    alsoQueue: "El mes de presentación al que llegó la fila del DOL",
    alsoMethodology: "De dónde sale cada cifra de este correo",
    daily: {
      lead: (n) => `${n} de sus alertas de PERM Tracker se movieron hoy.`,
      one: "Una novedad",
      more: (n) => `y ${n} más`,
    },
  },
  zh: {
    subject: {
      caseConfirm: (noun, c) => `确认 ${noun} ${c} 的提醒`,
      caseChanged: (noun, s) => `您的${noun}现在是 ${s}`,
      queueConfirm: (perm) => (perm ? "确认您的 PERM 排队提醒" : "确认您的现行工资排队提醒"),
      queueReached: (perm, f) => (perm ? `劳工部在 PERM 排队中处理到了 ${f}` : `劳工部在现行工资排队中处理到了 ${f}`),
      bulletinConfirm: (series) => `确认您的 ${series} 签证公告提醒`,
      bulletinMoved: (series, month) => `${series} 在 ${month} 的签证公告中有变动`,
      employerConfirm: (e) => `确认 ${e} 的提醒`,
      employerMoved: (e) => `劳工部对 ${e} 的案件有批量操作`,
      digestConfirm: "确认 PERM Tracker 每周摘要",
      daily: (n) => `PERM Tracker 有 ${n} 项更新`,
    },
    caseRows: {
      nowInStatus: "目前处于此状态的案件",
      cohortTotal: "与您同月递交的案件",
      cohortPending: "其中仍待决的",
      pendingAhead: "更早递交且仍待决的案件",
    },
    rfiRows: { resolved: "已观察到结案的 RFI", certified: "其中最终获批的", denied: "最终被拒的", withdrawn: "撤回的" },
    employerRows: { total: "劳工部已公布的决定", certified: "其中获批的", denied: "被拒的", medianDays: "作出决定的中位天数" },
    ratingQuestion: "这些提醒有用吗？",
    alsoQueue: "劳工部排队已处理到的递交月份",
    alsoMethodology: "本邮件中每个数字的来源",
    daily: {
      lead: (n) => `您在 PERM Tracker 的提醒中有 ${n} 项今天有变动。`,
      one: "一项更新",
      more: (n) => `另有 ${n} 项`,
    },
  },
  "pt-br": {
    subject: {
      caseConfirm: (noun, c) => `Confirme os alertas de ${noun} ${c}`,
      caseChanged: (noun, s) => `Seu ${noun} agora está em ${s}`,
      queueConfirm: (perm) => (perm ? "Confirme seu alerta da fila PERM" : "Confirme seu alerta da fila de salário prevalecente"),
      queueReached: (perm, f) => (perm ? `O DOL chegou a ${f} na fila PERM` : `O DOL chegou a ${f} na fila de salário prevalecente`),
      bulletinConfirm: (series) => `Confirme seu alerta do boletim de vistos para ${series}`,
      bulletinMoved: (series, month) => `${series} mudou no boletim de vistos de ${month}`,
      employerConfirm: (e) => `Confirme os alertas de ${e}`,
      employerMoved: (e) => `O DOL movimentou os casos de ${e}`,
      digestConfirm: "Confirme o resumo semanal do PERM Tracker",
      daily: (n) => `${n} novidades do PERM Tracker`,
    },
    caseRows: {
      nowInStatus: "Casos agora neste status",
      cohortTotal: "Protocolados no mesmo mês que o seu",
      cohortPending: "Desses, ainda pendentes",
      pendingAhead: "Casos pendentes protocolados antes",
    },
    rfiRows: { resolved: "RFIs resolvidos observados", certified: "Desses, terminaram certificados", denied: "Terminaram negados", withdrawn: "Retirados" },
    employerRows: { total: "Decisões publicadas pelo DOL", certified: "Dessas, certificadas", denied: "Negadas", medianDays: "Dias medianos até uma decisão" },
    ratingQuestion: "Estes alertas foram úteis?",
    alsoQueue: "O mês de protocolo que a fila do DOL alcançou",
    alsoMethodology: "De onde vem cada número deste e-mail",
    daily: {
      lead: (n) => `${n} dos seus alertas do PERM Tracker mudaram hoje.`,
      one: "Uma novidade",
      more: (n) => `e mais ${n}`,
    },
  },
  ko: {
    subject: {
      caseConfirm: (noun, c) => `${noun} ${c} 알림을 확인해 주세요`,
      caseChanged: (noun, s) => `${noun} 상태가 이제 ${s}입니다`,
      queueConfirm: (perm) => (perm ? "PERM 대기열 알림을 확인해 주세요" : "적정 임금 대기열 알림을 확인해 주세요"),
      queueReached: (perm, f) => (perm ? `노동부가 PERM 대기열에서 ${f}에 도달했습니다` : `노동부가 적정 임금 대기열에서 ${f}에 도달했습니다`),
      bulletinConfirm: (series) => `${series} 비자 공보 알림을 확인해 주세요`,
      bulletinMoved: (series, month) => `${month} 비자 공보에서 ${series}가 바뀌었습니다`,
      employerConfirm: (e) => `${e} 알림을 확인해 주세요`,
      employerMoved: (e) => `노동부가 ${e}의 케이스를 일괄 처리했습니다`,
      digestConfirm: "PERM Tracker 주간 요약을 확인해 주세요",
      daily: (n) => `PERM Tracker 업데이트 ${n}건`,
    },
    caseRows: {
      nowInStatus: "현재 이 상태인 케이스",
      cohortTotal: "같은 달에 접수된 케이스",
      cohortPending: "그중 아직 심사 중인 건",
      pendingAhead: "더 일찍 접수되어 심사 중인 케이스",
    },
    rfiRows: { resolved: "관찰된 종결 RFI", certified: "그중 승인으로 끝난 건", denied: "거부로 끝난 건", withdrawn: "철회된 건" },
    employerRows: { total: "노동부가 공개한 결정", certified: "그중 승인된 건", denied: "거부된 건", medianDays: "결정까지의 중앙값 일수" },
    ratingQuestion: "이 알림이 유용했나요?",
    alsoQueue: "노동부 대기열이 도달한 접수 월",
    alsoMethodology: "이 이메일의 모든 수치 출처",
    daily: {
      lead: (n) => `오늘 PERM Tracker 알림 중 ${n}건이 바뀌었습니다.`,
      one: "업데이트 한 건",
      more: (n) => `외 ${n}건`,
    },
  },
  vi: {
    subject: {
      caseConfirm: (noun, c) => `Xác nhận thông báo cho ${noun} ${c}`,
      caseChanged: (noun, s) => `${noun} của bạn hiện là ${s}`,
      queueConfirm: (perm) => (perm ? "Xác nhận thông báo hàng chờ PERM của bạn" : "Xác nhận thông báo hàng chờ mức lương hiện hành của bạn"),
      queueReached: (perm, f) => (perm ? `DOL đã xét đến ${f} trong hàng chờ PERM` : `DOL đã xét đến ${f} trong hàng chờ mức lương hiện hành`),
      bulletinConfirm: (series) => `Xác nhận thông báo bản tin thị thực cho ${series}`,
      bulletinMoved: (series, month) => `${series} đã thay đổi trong bản tin thị thực tháng ${month}`,
      employerConfirm: (e) => `Xác nhận thông báo cho ${e}`,
      employerMoved: (e) => `DOL đã xử lý hàng loạt hồ sơ của ${e}`,
      digestConfirm: "Xác nhận bản tóm tắt hằng tuần của PERM Tracker",
      daily: (n) => `${n} cập nhật từ PERM Tracker`,
    },
    caseRows: {
      nowInStatus: "Hồ sơ hiện ở trạng thái này",
      cohortTotal: "Nộp cùng tháng với bạn",
      cohortPending: "Trong đó vẫn đang chờ",
      pendingAhead: "Hồ sơ đang chờ nộp sớm hơn",
    },
    rfiRows: { resolved: "RFI đã quan sát thấy giải quyết xong", certified: "Trong đó kết thúc được chứng nhận", denied: "Kết thúc bị từ chối", withdrawn: "Đã rút" },
    employerRows: { total: "Quyết định DOL đã công bố", certified: "Trong đó được chứng nhận", denied: "Bị từ chối", medianDays: "Số ngày trung vị đến một quyết định" },
    ratingQuestion: "Những thông báo này có hữu ích không?",
    alsoQueue: "Tháng nộp mà hàng chờ của DOL đã xét đến",
    alsoMethodology: "Mỗi con số trong email này lấy từ đâu",
    daily: {
      lead: (n) => `${n} thông báo PERM Tracker của bạn đã thay đổi hôm nay.`,
      one: "Một cập nhật",
      more: (n) => `và ${n} nữa`,
    },
  },
};

export function alertText(lang: MailLang): AlertEmailText {
  return ALERT_EMAIL_TEXT[lang];
}
