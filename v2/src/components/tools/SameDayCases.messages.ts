import type { Bolded } from "@/components/i18n/Bold";
import type { DayGroup } from "@/lib/sameDay";
import type { Messages } from "@/lib/i18n/lang";

/** The cases filed the same day: the section's words, its bar's hover detail and the numbered tiles. */
export interface SameDayText {
  title: string;
  /** "<b>412</b> PERM cases were filed on May 5, 2026. <b>51</b> have been decided." */
  lede: (total: string, day: string, decided: string) => readonly [Bolded, Bolded];
  chartLabel: (day: string) => string;
  tip: (label: string, count: string, total: string, day: string) => string;
  group: Record<DayGroup, string>;
  nearbyTitle: string;
  /** The tile for the case itself, where the others show their last three digits. */
  thisShort: string;
  thisCase: string;
  noStatus: string;
  digitsNote: string;
}

export const SAME_DAY = {
  en: {
    title: "Filed the same day",
    lede: (total, day, decided) => [
      ["", total, ` PERM cases were filed on ${day}. `],
      ["", decided, " have been decided."],
    ],
    chartLabel: (day) => `Cases filed on ${day}, by what has happened to them`,
    tip: (label, count, total, day) => `${label}\n${count} of the ${total} filed ${day}`,
    group: {
      certified: "Certified",
      denied: "Denied",
      withdrawn: "Withdrawn",
      aside: "On hold, RFI or appeal",
      inLine: "Still in line",
    },
    nearbyTitle: "The cases numbered beside it",
    thisShort: "this",
    thisCase: "This case",
    noStatus: "no status",
    digitsNote: "Last three digits of each case number, in the order DOL issued them. Tap one to look it up.",
  },
  es: {
    title: "Presentados el mismo día",
    lede: (total, day, decided) => [
      ["", total, ` casos PERM se presentaron el ${day}. `],
      ["", decided, " ya se decidieron."],
    ],
    chartLabel: (day) => `Casos presentados el ${day}, según lo que les ha pasado`,
    tip: (label, count, total, day) => `${label}\n${count} de los ${total} presentados el ${day}`,
    group: {
      certified: "Certificados",
      denied: "Negados",
      withdrawn: "Retirados",
      aside: "En espera, RFI o apelación",
      inLine: "Aún en la fila",
    },
    nearbyTitle: "Los casos con números junto al suyo",
    thisShort: "este",
    thisCase: "Este caso",
    noStatus: "sin estado",
    digitsNote:
      "Los últimos tres dígitos de cada número de caso, en el orden en que el DOL los emitió. Toque uno para consultarlo.",
  },
  zh: {
    title: "同一天递交的案件",
    lede: (total, day, decided) => [
      [`${day}共递交了 `, total, " 件 PERM 案件，"],
      ["其中 ", decided, " 件已判定。"],
    ],
    chartLabel: (day) => `${day}递交的案件，按目前的结果分类`,
    tip: (label, count, total, day) => `${label}\n${day}递交的 ${total} 件中的 ${count} 件`,
    group: {
      certified: "已获批",
      denied: "被拒",
      withdrawn: "已撤回",
      aside: "暂缓、RFI 或上诉",
      inLine: "仍在排队",
    },
    nearbyTitle: "编号相邻的案件",
    thisShort: "本案",
    thisCase: "本案件",
    noStatus: "无状态",
    digitsNote: "每个案件编号的最后三位，按劳工部发出的顺序排列。点一下即可查询。",
  },
  "pt-br": {
    title: "Protocolados no mesmo dia",
    lede: (total, day, decided) => [
      ["", total, ` casos PERM foram protocolados em ${day}. `],
      ["", decided, " já foram decididos."],
    ],
    chartLabel: (day) => `Casos protocolados em ${day}, pelo que aconteceu com eles`,
    tip: (label, count, total, day) => `${label}\n${count} dos ${total} protocolados em ${day}`,
    group: {
      certified: "Certificados",
      denied: "Negados",
      withdrawn: "Retirados",
      aside: "Em espera, RFI ou recurso",
      inLine: "Ainda na fila",
    },
    nearbyTitle: "Os casos com números ao lado do seu",
    thisShort: "este",
    thisCase: "Este caso",
    noStatus: "sem status",
    digitsNote:
      "Os três últimos dígitos de cada número de caso, na ordem em que o DOL os emitiu. Toque em um para consultá-lo.",
  },
  ko: {
    title: "같은 날 접수된 케이스",
    lede: (total, day, decided) => [
      [`${day}에 PERM 케이스 `, `${total}건`, "이 접수되었습니다. "],
      ["그중 ", `${decided}건`, "이 결정되었습니다."],
    ],
    chartLabel: (day) => `${day}에 접수된 케이스, 현재 결과별`,
    tip: (label, count, total, day) => `${label}\n${day}에 접수된 ${total}건 중 ${count}건`,
    group: {
      certified: "승인됨",
      denied: "거부됨",
      withdrawn: "철회됨",
      aside: "보류, RFI 또는 항소",
      inLine: "아직 대기열에 있음",
    },
    nearbyTitle: "번호가 이웃한 케이스",
    thisShort: "이 건",
    thisCase: "이 케이스",
    noStatus: "상태 없음",
    digitsNote: "각 케이스 번호의 마지막 세 자리로, 노동부가 발급한 순서대로입니다. 하나를 누르면 조회합니다.",
  },
  vi: {
    title: "Nộp cùng ngày",
    lede: (total, day, decided) => [
      ["", total, ` hồ sơ PERM được nộp vào ngày ${day}. `],
      ["", decided, " hồ sơ đã có quyết định."],
    ],
    chartLabel: (day) => `Hồ sơ nộp ngày ${day}, theo kết quả hiện nay`,
    tip: (label, count, total, day) => `${label}\n${count} trong ${total} hồ sơ nộp ngày ${day}`,
    group: {
      certified: "Được chứng nhận",
      denied: "Bị từ chối",
      withdrawn: "Đã rút",
      aside: "Tạm giữ, RFI hoặc kháng cáo",
      inLine: "Vẫn trong hàng chờ",
    },
    nearbyTitle: "Các hồ sơ có số ngay cạnh",
    thisShort: "này",
    thisCase: "Hồ sơ này",
    noStatus: "chưa có tình trạng",
    digitsNote: "Ba chữ số cuối của mỗi số hồ sơ, theo thứ tự DOL cấp. Chạm vào một số để tra cứu.",
  },
} satisfies Messages<SameDayText>;
