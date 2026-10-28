import type { Bolded } from "@/components/i18n/Bold";
import type { Messages } from "@/lib/i18n/lang";

/** The wall of undecided cases, the note for a case DOL has passed, and the neighbouring months. */
export interface CaseWallText {
  /** Under the subject's column: "Yours" for a case, "This month" for a month. */
  mark: { case: string; month: string };
  chartLabel: string;
  tipUndecided: (n: string) => string;
  tipShare: (pct: string) => string;
  tipSubject: { case: string; month: string };
  tipFront: string;
  dolHere: string;
  drawn: (n: string, ownCase: boolean) => Bolded;
  /** Starts with its own space where the language puts one between sentences. */
  earlier: (extra: string, ownCase: boolean, total: string) => string;
  published: (month: string, same: boolean) => Bolded;
  pastFront: (month: string, behind: number) => Bolded;
  pastStillOpen: (n: string, month: string, total: string) => Bolded;
  pastWhy: string;
  stillOpen: (pending: string, total: string) => Bolded;
  decidedShare: (pct: string) => string;
}

export const CASE_WALL = {
  en: {
    mark: { case: "Yours", month: "This month" },
    chartLabel: "Undecided cases by filing month, up to this case's month",
    tipUndecided: (n) => `${n} undecided in DOL's normal queue`,
    tipShare: (pct) => `${pct} of the cases drawn`,
    tipSubject: { case: "Your filing month", month: "The month this number decodes to" },
    tipFront: "The oldest month still open",
    dolHere: "DOL here",
    drawn: (n, own) => [
      "",
      `${n} undecided cases`,
      ` in DOL's normal queue sit in the months drawn here, between the oldest month still open and ${own ? "yours" : "this one"}.`,
    ],
    earlier: (extra, own, total) =>
      ` Another ${extra} were filed earlier still and remain open: cases held up in an audit, an appeal or a request for information, in months DOL has otherwise finished. Counting them takes the total filed before ${own ? "yours" : "that month"} to ${total}.`,
    published: (month, same) => [
      " DOL publishes its own analyst-review position as ",
      month,
      same
        ? ", which is the same month this count puts the front in."
        : ", a month apart from where these counts put the front. Both are shown rather than one being picked.",
    ],
    pastFront: (month, behind) => [
      "The oldest month still open is ",
      month,
      `, ${behind} ${behind === 1 ? "month" : "months"} newer than this case's filing month. So filing order is no longer what this case is waiting on. `,
    ],
    pastStillOpen: (n, month, total) => ["", `${n} cases`, ` filed in ${month} are still open, out of ${total} filed that month.`],
    pastWhy:
      "A case still open past its month is usually out of filing order: at an RFI, an audit, supervised recruitment or an appeal. The split below shows where the rest of its month sits.",
    stillOpen: (pending, total) => ["", pending, ` of ${total} still open`],
    decidedShare: (pct) => `(${pct} decided)`,
  },
  es: {
    mark: { case: "Su mes", month: "Este mes" },
    chartLabel: "Casos sin decidir por mes de presentación, hasta el mes de este caso",
    tipUndecided: (n) => `${n} sin decidir en la fila normal del DOL`,
    tipShare: (pct) => `${pct} de los casos que se muestran`,
    tipSubject: { case: "Su mes de presentación", month: "El mes que indica este número" },
    tipFront: "El mes más antiguo aún abierto",
    dolHere: "El DOL va aquí",
    drawn: (n, own) => [
      "",
      `${n} casos sin decidir`,
      ` de la fila normal del DOL están en los meses que se muestran aquí, entre el mes más antiguo aún abierto y ${own ? "el suyo" : "este"}.`,
    ],
    earlier: (extra, own, total) =>
      ` Otros ${extra} se presentaron todavía antes y siguen abiertos: casos detenidos por una auditoría, una apelación o una solicitud de información, en meses que el DOL ya terminó en lo demás. Con ellos, el total presentado antes ${own ? "del suyo" : "de ese mes"} llega a ${total}.`,
    published: (month, same) => [
      " El DOL publica su propia posición de revisión por un analista: ",
      month,
      same
        ? ", el mismo mes que este conteo marca como el más antiguo aún abierto."
        : ", un mes distinto del que marcan estos conteos. Se muestran los dos en lugar de elegir uno.",
    ],
    pastFront: (month, behind) => [
      "El mes más antiguo aún abierto es ",
      month,
      `, ${behind} ${behind === 1 ? "mes" : "meses"} posterior al mes de presentación de este caso. Así que este caso ya no espera por el orden de presentación. `,
    ],
    pastStillOpen: (n, month, total) => ["", `${n} casos`, ` presentados en ${month} siguen abiertos, de ${total} presentados ese mes.`],
    pastWhy:
      "Un caso que sigue abierto después de su mes suele estar fuera del orden de presentación: con una RFI, una auditoría, reclutamiento supervisado o una apelación. El desglose de abajo muestra dónde está el resto de su mes.",
    stillOpen: (pending, total) => ["", pending, ` de ${total} aún abiertos`],
    decidedShare: (pct) => `(${pct} decididos)`,
  },
  zh: {
    mark: { case: "您的月份", month: "本月" },
    chartLabel: "按递交月份统计的未判定案件，截至本案件的月份",
    tipUndecided: (n) => `劳工部正常队列中 ${n} 件未判定`,
    tipShare: (pct) => `占图中案件的 ${pct}`,
    tipSubject: { case: "您的递交月份", month: "这个编号对应的月份" },
    tipFront: "仍未审完的最早月份",
    dolHere: "劳工部在此",
    drawn: (n, own) => [
      `图中这些月份（从仍未审完的最早月份到${own ? "您的月份" : "这个月份"}）里，劳工部正常队列中有 `,
      `${n} 件未判定案件`,
      "。",
    ],
    earlier: (extra, own, total) =>
      `另有 ${extra} 件递交得更早，至今仍未结案：这些案件因审计、上诉或补充信息要求（RFI）而停滞，所在月份劳工部已基本审完。把它们算进去，在${own ? "您的案件" : "那个月"}之前递交的案件共 ${total} 件。`,
    published: (month, same) => [
      "劳工部自己公布的审查员审核进度是",
      month,
      same ? "，与这里统计出的进度是同一个月。" : "，与这里统计出的进度不在同一个月。两者都列出，不只取其一。",
    ],
    pastFront: (month, behind) => [
      "仍未审完的最早月份是",
      month,
      `，比本案件的递交月份晚 ${behind} 个月。所以本案件等待的已经不是递交顺序。`,
    ],
    pastStillOpen: (n, month, total) => [`${month}递交的 ${total} 件案件中，`, `${n} 件`, "仍未结案。"],
    pastWhy:
      "过了自己月份仍未结案的案件，通常已不按递交顺序：处于 RFI、审计、监督招聘或上诉阶段。下面的分类显示该月其余案件所处的位置。",
    stillOpen: (pending, total) => [`${total} 件中 `, pending, " 件仍未结案"],
    decidedShare: (pct) => `（已判定 ${pct}）`,
  },
  "pt-br": {
    mark: { case: "Seu mês", month: "Este mês" },
    chartLabel: "Casos sem decisão por mês de protocolo, até o mês deste caso",
    tipUndecided: (n) => `${n} sem decisão na fila normal do DOL`,
    tipShare: (pct) => `${pct} dos casos mostrados`,
    tipSubject: { case: "Seu mês de protocolo", month: "O mês que este número indica" },
    tipFront: "O mês mais antigo ainda aberto",
    dolHere: "O DOL está aqui",
    drawn: (n, own) => [
      "",
      `${n} casos sem decisão`,
      ` da fila normal do DOL estão nos meses mostrados aqui, entre o mês mais antigo ainda aberto e ${own ? "o seu" : "este"}.`,
    ],
    earlier: (extra, own, total) =>
      ` Outros ${extra} foram protocolados ainda antes e continuam abertos: casos parados por uma auditoria, um recurso ou um pedido de informações, em meses que o DOL já terminou no resto. Contando com eles, o total protocolado antes ${own ? "do seu" : "daquele mês"} chega a ${total}.`,
    published: (month, same) => [
      " O DOL publica sua própria posição de revisão por analista: ",
      month,
      same
        ? ", o mesmo mês que esta contagem indica como o mais antigo ainda aberto."
        : ", um mês diferente do que estas contagens indicam. Os dois são mostrados, em vez de escolher um.",
    ],
    pastFront: (month, behind) => [
      "O mês mais antigo ainda aberto é ",
      month,
      `, ${behind} ${behind === 1 ? "mês" : "meses"} depois do mês de protocolo deste caso. Então este caso já não espera pela ordem de protocolo. `,
    ],
    pastStillOpen: (n, month, total) => ["", `${n} casos`, ` protocolados em ${month} continuam abertos, de ${total} protocolados naquele mês.`],
    pastWhy:
      "Um caso ainda aberto depois do seu mês costuma estar fora da ordem de protocolo: com RFI, auditoria, recrutamento supervisionado ou recurso. A divisão abaixo mostra onde está o resto do mês.",
    stillOpen: (pending, total) => ["", pending, ` de ${total} ainda abertos`],
    decidedShare: (pct) => `(${pct} decididos)`,
  },
  ko: {
    mark: { case: "내 접수 월", month: "이 달" },
    chartLabel: "접수 월별 결정되지 않은 케이스, 이 케이스의 접수 월까지",
    tipUndecided: (n) => `노동부 일반 대기열에서 결정되지 않은 ${n}건`,
    tipShare: (pct) => `표시된 케이스의 ${pct}`,
    tipSubject: { case: "내 접수 월", month: "이 번호가 가리키는 달" },
    tipFront: "아직 끝나지 않은 가장 오래된 달",
    dolHere: "노동부 위치",
    drawn: (n, own) => [
      `여기 표시된 달, 즉 아직 끝나지 않은 가장 오래된 달부터 ${own ? "내 접수 월" : "이 달"}까지 노동부 일반 대기열에 `,
      `결정되지 않은 케이스 ${n}건`,
      "이 있습니다.",
    ],
    earlier: (extra, own, total) =>
      ` 이보다 더 일찍 접수되어 아직 열려 있는 케이스도 ${extra}건 있습니다. 노동부가 나머지를 끝낸 달에서 감사, 항소 또는 추가 정보 요청에 걸려 있는 케이스입니다. 이를 포함하면 ${own ? "내 케이스" : "그 달"}보다 먼저 접수된 케이스는 모두 ${total}건입니다.`,
    published: (month, same) => [
      " 노동부가 직접 공개하는 심사관 검토 위치는 ",
      month,
      same ? "로, 이 집계가 가리키는 달과 같습니다." : "로, 이 집계가 가리키는 달과 다릅니다. 하나를 고르지 않고 둘 다 보여 드립니다.",
    ],
    pastFront: (month, behind) => [
      "아직 끝나지 않은 가장 오래된 달은 ",
      month,
      `로, 이 케이스의 접수 월보다 ${behind}개월 늦습니다. 그러므로 이 케이스가 기다리는 것은 더 이상 접수 순서가 아닙니다. `,
    ],
    pastStillOpen: (n, month, total) => [`${month}에 접수된 ${total}건 중 `, `${n}건`, "이 아직 열려 있습니다."],
    pastWhy:
      "자기 달이 지나도 열려 있는 케이스는 보통 접수 순서 밖에 있습니다. RFI, 감사, 감독 하 모집 또는 항소 단계입니다. 아래 구분은 그 달의 나머지 케이스가 어디에 있는지 보여 줍니다.",
    stillOpen: (pending, total) => [`${total}건 중 `, `${pending}건`, " 열려 있음"],
    decidedShare: (pct) => `(${pct} 결정됨)`,
  },
  vi: {
    mark: { case: "Tháng của bạn", month: "Tháng này" },
    chartLabel: "Hồ sơ chưa có quyết định theo tháng nộp, đến tháng của hồ sơ này",
    tipUndecided: (n) => `${n} hồ sơ chưa có quyết định trong hàng chờ thông thường của DOL`,
    tipShare: (pct) => `${pct} số hồ sơ hiển thị ở đây`,
    tipSubject: { case: "Tháng nộp của bạn", month: "Tháng mà số này cho biết" },
    tipFront: "Tháng cũ nhất vẫn còn mở",
    dolHere: "DOL ở đây",
    drawn: (n, own) => [
      "",
      `${n} hồ sơ chưa có quyết định`,
      ` trong hàng chờ thông thường của DOL nằm ở các tháng hiển thị ở đây, từ tháng cũ nhất vẫn còn mở đến ${own ? "tháng của bạn" : "tháng này"}.`,
    ],
    earlier: (extra, own, total) =>
      ` Còn ${extra} hồ sơ khác được nộp sớm hơn nữa và vẫn còn mở: các hồ sơ bị giữ lại vì kiểm tra (audit), kháng cáo hoặc yêu cầu bổ sung thông tin, trong những tháng mà DOL đã xét xong phần còn lại. Tính cả chúng, tổng số hồ sơ nộp trước ${own ? "hồ sơ của bạn" : "tháng đó"} là ${total}.`,
    published: (month, same) => [
      " DOL tự công bố vị trí xét duyệt của chuyên viên là ",
      month,
      same
        ? ", trùng với tháng mà số liệu này cho thấy."
        : ", khác với tháng mà các số liệu này cho thấy. Cả hai đều được hiển thị thay vì chọn một.",
    ],
    pastFront: (month, behind) => [
      "Tháng cũ nhất vẫn còn mở là ",
      month,
      `, muộn hơn tháng nộp của hồ sơ này ${behind} tháng. Vì vậy, hồ sơ này không còn chờ theo thứ tự nộp nữa. `,
    ],
    pastStillOpen: (n, month, total) => ["", `${n} hồ sơ`, ` nộp trong ${month} vẫn còn mở, trên tổng số ${total} hồ sơ nộp trong tháng đó.`],
    pastWhy:
      "Một hồ sơ vẫn còn mở sau tháng của nó thường đã ra ngoài thứ tự nộp: đang ở RFI, kiểm tra (audit), tuyển dụng có giám sát hoặc kháng cáo. Phần chia bên dưới cho thấy phần còn lại của tháng đó đang ở đâu.",
    stillOpen: (pending, total) => ["", pending, ` trên ${total} vẫn còn mở`],
    decidedShare: (pct) => `(${pct} đã có quyết định)`,
  },
} satisfies Messages<CaseWallText>;
