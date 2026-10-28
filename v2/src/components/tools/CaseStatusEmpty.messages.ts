import type { Messages } from "@/lib/i18n/lang";

/** The case status page with nothing typed: the national picture and what a number gets you. */
export interface CaseStatusEmptyText {
  oldestOpen: string;
  oldestOpenNote: string;
  undecided: string;
  undecidedNote: string;
  dolWorking: string;
  /** Under "DOL is working" when DOL's date is known: "as of October 21, 2026". */
  asOf: (day: string) => string;
  analystReview: string;
  sectionTitle: string;
  bullets: readonly { lead: string; rest: string }[];
  searched: (count: string) => string;
}

export const CASE_STATUS_EMPTY = {
  en: {
    oldestOpen: "Oldest month still open",
    oldestOpenNote: "the oldest filing month DOL hasn't substantially decided",
    undecided: "Undecided cases",
    undecidedNote: "across every filing month, the whole wall",
    dolWorking: "DOL is working",
    asOf: (day) => `as of ${day}`,
    analystReview: "analyst review",
    sectionTitle: "What a case number gets you here",
    bullets: [
      {
        lead: "The status, decoded.",
        rest: "DOL shows one word and explains none of them. Some mean waiting and some mean a 30-day clock is running on the employer.",
      },
      {
        lead: "The position.",
        rest: "How many undecided cases were filed before it, and how far its filing month sits behind the month DOL is working.",
      },
      { lead: "An estimated decision date, and an email when it moves.", rest: "" },
      {
        lead: "For a decided case, DOL's own file.",
        rest: "The outcome, the days it took, the offered wage against its occupation, and the worksite state.",
      },
    ],
    searched: (count) =>
      `Searched against ${count} per-case statuses, read from DOL's own case-status search, plus DOL's published decisions since October 2015. Nothing is stored and nothing is sent anywhere else.`,
  },
  es: {
    oldestOpen: "Mes más antiguo aún abierto",
    oldestOpenNote: "el mes de presentación más antiguo que el DOL no ha decidido en su mayor parte",
    undecided: "Casos sin decidir",
    undecidedNote: "en todos los meses de presentación",
    dolWorking: "El DOL está trabajando",
    asOf: (day) => `al ${day}`,
    analystReview: "revisión por un analista",
    sectionTitle: "Qué obtiene aquí con un número de caso",
    bullets: [
      {
        lead: "El estado, explicado.",
        rest: "El DOL muestra una sola palabra y no explica ninguna. Algunas significan espera y otras que el empleador tiene un plazo de 30 días corriendo.",
      },
      {
        lead: "La posición.",
        rest: "Cuántos casos sin decidir se presentaron antes y cuánto le falta a su mes de presentación para llegar al mes en que trabaja el DOL.",
      },
      { lead: "Una fecha estimada de decisión, y un correo cuando cambie.", rest: "" },
      {
        lead: "Si el caso ya se decidió, el expediente del propio DOL.",
        rest: "El resultado, los días que tardó, el salario ofrecido frente a su ocupación y el estado donde está el trabajo.",
      },
    ],
    searched: (count) =>
      `Se busca entre ${count} estados de casos leídos de la búsqueda de estado de casos del propio DOL, más las decisiones que el DOL publica desde octubre de 2015. No se guarda nada ni se envía a ningún otro lugar.`,
  },
  zh: {
    oldestOpen: "仍未审完的最早月份",
    oldestOpenNote: "劳工部尚未大体审完的最早递交月份",
    undecided: "未判定案件",
    undecidedNote: "所有递交月份合计",
    dolWorking: "劳工部正在审理",
    asOf: (day) => `截至 ${day}`,
    analystReview: "审查员审核",
    sectionTitle: "输入案件编号可以看到什么",
    bullets: [
      {
        lead: "状态的含义。",
        rest: "劳工部只显示一个英文词，不做任何解释。有些表示仍在等待，有些表示雇主有 30 天的期限正在计算。",
      },
      { lead: "排队位置。", rest: "在它之前递交且尚未判定的案件有多少，以及它的递交月份离劳工部正在审理的月份还有多远。" },
      { lead: "预计的判定日期，并在状态变化时发邮件通知。", rest: "" },
      { lead: "已判定案件的劳工部档案。", rest: "结果、用时、所报工资与该职业的对比，以及工作地点所在的州。" },
    ],
    searched: (count) => `在 ${count} 个案件状态中查询（来自劳工部自己的案件状态查询），并包括劳工部自 2015 年 10 月起公布的判定。我们不保存任何内容，也不发送到其他地方。`,
  },
  "pt-br": {
    oldestOpen: "Mês mais antigo ainda aberto",
    oldestOpenNote: "o mês de protocolo mais antigo que o DOL ainda não decidiu em sua maior parte",
    undecided: "Casos sem decisão",
    undecidedNote: "em todos os meses de protocolo",
    dolWorking: "O DOL está trabalhando",
    asOf: (day) => `em ${day}`,
    analystReview: "revisão por analista",
    sectionTitle: "O que um número de caso mostra aqui",
    bullets: [
      {
        lead: "O status, explicado.",
        rest: "O DOL mostra uma única palavra e não explica nenhuma. Algumas significam espera e outras que o empregador tem um prazo de 30 dias correndo.",
      },
      {
        lead: "A posição.",
        rest: "Quantos casos sem decisão foram protocolados antes dele e quanto o mês de protocolo está atrás do mês em que o DOL trabalha.",
      },
      { lead: "Uma data estimada de decisão, e um e-mail quando mudar.", rest: "" },
      {
        lead: "Para um caso já decidido, o arquivo do próprio DOL.",
        rest: "O resultado, os dias que levou, o salário oferecido comparado à ocupação e o estado do local de trabalho.",
      },
    ],
    searched: (count) =>
      `A busca cobre ${count} status de casos lidos da busca de status de casos do próprio DOL, mais as decisões que o DOL publica desde outubro de 2015. Nada é guardado e nada é enviado a outro lugar.`,
  },
  ko: {
    oldestOpen: "아직 끝나지 않은 가장 오래된 달",
    oldestOpenNote: "노동부가 대부분 결정하지 않은 가장 오래된 접수 월",
    undecided: "결정되지 않은 케이스",
    undecidedNote: "모든 접수 월 합계",
    dolWorking: "노동부 심사 중",
    asOf: (day) => `${day} 기준`,
    analystReview: "심사관 검토",
    sectionTitle: "케이스 번호로 여기서 볼 수 있는 것",
    bullets: [
      {
        lead: "상태의 뜻.",
        rest: "노동부는 영어 단어 하나만 보여 주고 설명하지 않습니다. 어떤 것은 대기 중이라는 뜻이고, 어떤 것은 고용주에게 30일 기한이 진행 중이라는 뜻입니다.",
      },
      { lead: "대기 위치.", rest: "그보다 먼저 접수되어 아직 결정되지 않은 케이스 수와, 접수 월이 노동부가 심사 중인 달보다 얼마나 뒤에 있는지." },
      { lead: "예상 결정일, 그리고 상태가 바뀌면 이메일 알림.", rest: "" },
      { lead: "결정된 케이스라면 노동부 자체 기록.", rest: "결과, 걸린 날수, 직종 대비 제시 임금, 근무지 주." },
    ],
    searched: (count) =>
      `노동부 자체 케이스 상태 조회에서 읽어 온 ${count}건의 케이스 상태와, 2015년 10월부터 노동부가 공개한 결정에서 찾습니다. 아무것도 저장하지 않으며 다른 곳으로 보내지 않습니다.`,
  },
  vi: {
    oldestOpen: "Tháng cũ nhất vẫn còn mở",
    oldestOpenNote: "tháng nộp cũ nhất mà DOL chưa quyết định phần lớn",
    undecided: "Hồ sơ chưa có quyết định",
    undecidedNote: "trên mọi tháng nộp",
    dolWorking: "DOL đang xét",
    asOf: (day) => `tính đến ${day}`,
    analystReview: "chuyên viên xét duyệt",
    sectionTitle: "Số hồ sơ cho bạn biết gì ở đây",
    bullets: [
      {
        lead: "Ý nghĩa của tình trạng.",
        rest: "DOL chỉ hiện một từ tiếng Anh và không giải thích. Có từ nghĩa là đang chờ, có từ nghĩa là chủ lao động đang có thời hạn 30 ngày.",
      },
      {
        lead: "Vị trí trong hàng chờ.",
        rest: "Có bao nhiêu hồ sơ chưa có quyết định được nộp trước nó, và tháng nộp của nó còn cách tháng DOL đang xét bao xa.",
      },
      { lead: "Ngày quyết định ước tính, và email khi tình trạng thay đổi.", rest: "" },
      {
        lead: "Với hồ sơ đã có quyết định, hồ sơ của chính DOL.",
        rest: "Kết quả, số ngày đã mất, mức lương đưa ra so với nghề đó, và bang nơi làm việc.",
      },
    ],
    searched: (count) =>
      `Tra trong ${count} tình trạng hồ sơ đọc từ trang tra cứu tình trạng hồ sơ của chính DOL, cùng các quyết định DOL công bố từ tháng 10 năm 2015. Không lưu gì và không gửi đi đâu khác.`,
  },
} satisfies Messages<CaseStatusEmptyText>;
