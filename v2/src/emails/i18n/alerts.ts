/**
 * The chrome of the recurring case-status alert (CaseStatusChanged), in the five languages: the sentences the
 * template writes itself, around the data the Convex function passes in. The status meaning comes in already
 * translated (getStatusMeaning(status, lang) from permStatus); the figure-table row labels and the rating
 * question come from convex/lib/alertEmailText.ts; the "what comes next" guidance is passed in and stays in
 * English for now (it’s generated server-side). English is exactly today’s wording.
 *
 * DOL and its status words stay as printed. A final status IS the decision, so the "not a decision" caveat is
 * for the non-final statuses only, as in the English.
 */

import type { MailMessages } from "../../lib/i18n/mailLang";

export interface CaseAlertText {
  previewSince: (observedAt: string) => string;
  footerFinal: (caseNumber: string) => string;
  footerOngoing: (caseNumber: string) => string;
  meaningFallback: string;
  caveatSince: (observedAt: string) => string;
  caveatNoDate: string;
  notADecision: string;
  rfiHeading: string;
  rfiCaption: string;
  whereHeading: string;
  employerHeading: string;
  openCase: string;
  nextHeading: string;
  timelineAsk: string;
  timelineButton: string;
  alsoHeading: string;
  ratingQuestion: string;
}

export const CASE_ALERT_TEXT: MailMessages<CaseAlertText> = {
  en: {
    previewSince: (o) => ` DOL’s record has shown it since at least ${o}.`,
    footerFinal: (c) =>
      `You asked to be told when DOL's status for ${c} changed. DOL has decided it; we'll keep watching for a year in case it's appealed or reopened, and email you only if it moves.`,
    footerOngoing: (c) => `You asked to be told when DOL's status for ${c} changed. We'll email you again if it moves again.`,
    meaningFallback: "DOL doesn’t publish what this status means, and we’re not going to guess at it. The counts below are what we can say.",
    caveatSince: (o) => `DOL’s record has shown this status since at least ${o}.`,
    caveatNoDate: "We don’t have a date for when DOL’s record first showed this status.",
    notADecision: " It isn’t a decision on your case and it isn’t a prediction of one.",
    rfiHeading: "RFIs that have since resolved",
    rfiCaption: "That’s a count of other cases and the population it came from. It says nothing about how yours resolves.",
    whereHeading: "Where this sits",
    employerHeading: "This employer in DOL’s decided record",
    openCase: "Open this case",
    nextHeading: "What comes next",
    timelineAsk:
      "After certification the public record stops. USCIS doesn’t publish the I-140 or the I-485 case by case, so the only way the next person learns how long they take is from people who went through them. When yours move, you can add the dates to this case. PERM Tracker checks your PERM dates against DOL, keeps the case number off the public board, and shows your timeline there only if you tick the box.",
    timelineButton: "Add your dates when they come",
    alsoHeading: "Also on PERM Tracker",
    ratingQuestion: "How useful were these alerts?",
  },
  es: {
    previewSince: (o) => ` El registro del DOL lo muestra desde al menos ${o}.`,
    footerFinal: (c) =>
      `Pidió que le avisáramos cuando cambiara el estado de ${c} en el DOL. El DOL ya lo decidió; seguiremos vigilándolo un año por si hay una apelación o se reabre, y solo le escribiremos si se mueve.`,
    footerOngoing: (c) => `Pidió que le avisáramos cuando cambiara el estado de ${c} en el DOL. Le escribiremos otra vez si vuelve a moverse.`,
    meaningFallback: "El DOL no publica qué significa este estado, y no vamos a adivinarlo. Los conteos de abajo son lo que sí podemos decir.",
    caveatSince: (o) => `El registro del DOL muestra este estado desde al menos ${o}.`,
    caveatNoDate: "No tenemos una fecha de cuándo el registro del DOL mostró este estado por primera vez.",
    notADecision: " No es una decisión sobre su caso ni una predicción de una.",
    rfiHeading: "RFI que ya se resolvieron",
    rfiCaption: "Eso es un conteo de otros casos y la población de la que salió. No dice nada sobre cómo se resuelve el suyo.",
    whereHeading: "Dónde está esto",
    employerHeading: "Este empleador en el registro de decisiones del DOL",
    openCase: "Abrir este caso",
    nextHeading: "Qué viene después",
    timelineAsk:
      "Después de la certificación, el registro público se detiene. USCIS no publica el I-140 ni el I-485 caso por caso, así que la única forma en que la próxima persona sabe cuánto tardan es por quienes ya pasaron. Cuando los suyos avancen, puede agregar las fechas a este caso. PERM Tracker compara sus fechas de PERM con el DOL, mantiene el número de caso fuera del tablero público, y muestra su cronología allí solo si marca la casilla.",
    timelineButton: "Agregue sus fechas cuando lleguen",
    alsoHeading: "También en PERM Tracker",
    ratingQuestion: "¿Qué tan útiles fueron estas alertas?",
  },
  zh: {
    previewSince: (o) => ` 劳工部的记录至少自 ${o} 起显示。`,
    footerFinal: (c) =>
      `您申请了在劳工部对 ${c} 的状态变化时收到通知。劳工部已对它作出决定；我们会再关注一年，以防出现上诉或重新审理，只有在它变化时才给您发邮件。`,
    footerOngoing: (c) => `您申请了在劳工部对 ${c} 的状态变化时收到通知。如果它再次变化，我们会再发邮件给您。`,
    meaningFallback: "劳工部没有公布这个状态的含义，我们也不会去猜。下面的数字是我们能说的。",
    caveatSince: (o) => `劳工部的记录至少自 ${o} 起显示此状态。`,
    caveatNoDate: "我们没有劳工部记录首次显示此状态的日期。",
    notADecision: " 这不是对您案件的决定，也不是对决定的预测。",
    rfiHeading: "此后已解决的 RFI",
    rfiCaption: "这是其他案件的计数及其来源群体。它无法说明您的案件会如何解决。",
    whereHeading: "这个案件所处的位置",
    employerHeading: "此雇主在劳工部已决定记录中的情况",
    openCase: "打开此案件",
    nextHeading: "接下来会怎样",
    timelineAsk:
      "认证之后，公开记录就停止了。USCIS 不逐案公布 I-140 或 I-485，所以下一个人了解它们需要多久的唯一途径，就是经历过的人。当您的进展时，您可以把日期添加到此案件。PERM Tracker 会用劳工部核对您的 PERM 日期，把案件号排除在公开看板之外，只有在您勾选时才在那里显示您的时间线。",
    timelineButton: "进展时添加您的日期",
    alsoHeading: "PERM Tracker 上还有",
    ratingQuestion: "这些提醒有多大帮助？",
  },
  "pt-br": {
    previewSince: (o) => ` O registro do DOL o mostra desde pelo menos ${o}.`,
    footerFinal: (c) =>
      `Você pediu para ser avisado quando o status de ${c} no DOL mudasse. O DOL já decidiu; vamos continuar acompanhando por um ano caso haja recurso ou reabertura, e só enviaremos um e-mail se ele se mover.`,
    footerOngoing: (c) => `Você pediu para ser avisado quando o status de ${c} no DOL mudasse. Enviaremos outro e-mail se ele se mover de novo.`,
    meaningFallback: "O DOL não publica o que este status significa, e não vamos adivinhar. As contagens abaixo são o que podemos dizer.",
    caveatSince: (o) => `O registro do DOL mostra este status desde pelo menos ${o}.`,
    caveatNoDate: "Não temos uma data de quando o registro do DOL mostrou este status pela primeira vez.",
    notADecision: " Não é uma decisão sobre o seu caso nem uma previsão de uma.",
    rfiHeading: "RFIs que já se resolveram",
    rfiCaption: "Isso é uma contagem de outros casos e a população de onde veio. Não diz nada sobre como o seu se resolve.",
    whereHeading: "Onde isto está",
    employerHeading: "Este empregador no registro de decisões do DOL",
    openCase: "Abrir este caso",
    nextHeading: "O que vem a seguir",
    timelineAsk:
      "Depois da certificação, o registro público para. O USCIS não publica o I-140 nem o I-485 caso a caso, então a única forma de a próxima pessoa saber quanto demoram é por quem já passou. Quando os seus avançarem, você pode adicionar as datas a este caso. O PERM Tracker confere suas datas de PERM com o DOL, mantém o número do caso fora do painel público, e mostra sua linha do tempo lá só se você marcar a caixa.",
    timelineButton: "Adicione suas datas quando elas chegarem",
    alsoHeading: "Também no PERM Tracker",
    ratingQuestion: "Quão úteis foram estes alertas?",
  },
  ko: {
    previewSince: (o) => ` 노동부 기록에 최소 ${o}부터 표시되어 있습니다.`,
    footerFinal: (c) =>
      `${c}의 노동부 상태가 바뀌면 알려 달라고 신청하셨습니다. 노동부가 결정을 내렸습니다. 항소나 재개에 대비해 1년간 계속 지켜보고, 상태가 움직일 때만 이메일을 보내 드립니다.`,
    footerOngoing: (c) => `${c}의 노동부 상태가 바뀌면 알려 달라고 신청하셨습니다. 다시 움직이면 또 이메일을 보내 드립니다.`,
    meaningFallback: "노동부는 이 상태의 의미를 공개하지 않으며, 저희도 추측하지 않습니다. 아래 수치가 저희가 말씀드릴 수 있는 전부입니다.",
    caveatSince: (o) => `노동부 기록에 이 상태가 최소 ${o}부터 표시되어 있습니다.`,
    caveatNoDate: "노동부 기록이 이 상태를 처음 보인 날짜는 저희에게 없습니다.",
    notADecision: " 이것은 귀하의 케이스에 대한 결정도, 결정에 대한 예측도 아닙니다.",
    rfiHeading: "그 뒤 해결된 RFI",
    rfiCaption: "이는 다른 케이스들의 집계와 그 모집단입니다. 귀하의 케이스가 어떻게 해결될지는 말해 주지 않습니다.",
    whereHeading: "이 케이스의 현재 위치",
    employerHeading: "노동부의 결정된 기록에 나타난 이 고용주",
    openCase: "이 케이스 열기",
    nextHeading: "다음 단계",
    timelineAsk:
      "승인 이후에는 공개 기록이 멈춥니다. USCIS는 I-140이나 I-485를 케이스별로 공개하지 않으므로, 다음 사람이 얼마나 걸리는지 아는 유일한 길은 먼저 겪은 사람들입니다. 귀하의 단계가 진행되면 이 케이스에 날짜를 추가하실 수 있습니다. PERM Tracker는 귀하의 PERM 날짜를 노동부와 대조하고, 케이스 번호는 공개 보드에서 빼며, 체크하신 경우에만 거기에 귀하의 타임라인을 보여 줍니다.",
    timelineButton: "진행되면 날짜를 추가하세요",
    alsoHeading: "PERM Tracker에서 더 보기",
    ratingQuestion: "이 알림이 얼마나 유용했나요?",
  },
  vi: {
    previewSince: (o) => ` Hồ sơ của DOL đã hiển thị nó từ ít nhất ${o}.`,
    footerFinal: (c) =>
      `Bạn đã yêu cầu được báo khi tình trạng của ${c} tại DOL thay đổi. DOL đã quyết định; chúng tôi sẽ tiếp tục theo dõi trong một năm phòng khi có kháng cáo hoặc mở lại, và chỉ gửi email nếu nó chuyển.`,
    footerOngoing: (c) => `Bạn đã yêu cầu được báo khi tình trạng của ${c} tại DOL thay đổi. Chúng tôi sẽ gửi email lần nữa nếu nó lại chuyển.`,
    meaningFallback: "DOL không công bố ý nghĩa của tình trạng này, và chúng tôi sẽ không đoán. Các con số bên dưới là những gì chúng tôi có thể nói.",
    caveatSince: (o) => `Hồ sơ của DOL đã hiển thị tình trạng này từ ít nhất ${o}.`,
    caveatNoDate: "Chúng tôi không có ngày hồ sơ của DOL lần đầu hiển thị tình trạng này.",
    notADecision: " Đây không phải là quyết định về hồ sơ của bạn, cũng không phải dự đoán về một quyết định.",
    rfiHeading: "Các RFI đã được giải quyết kể từ đó",
    rfiCaption: "Đó là số đếm của các hồ sơ khác và nhóm mà nó lấy ra. Nó không nói gì về việc hồ sơ của bạn được giải quyết ra sao.",
    whereHeading: "Hồ sơ này đang ở đâu",
    employerHeading: "Chủ lao động này trong hồ sơ đã quyết định của DOL",
    openCase: "Mở hồ sơ này",
    nextHeading: "Tiếp theo là gì",
    timelineAsk:
      "Sau khi được chứng nhận, hồ sơ công khai dừng lại. USCIS không công bố I-140 hay I-485 theo từng hồ sơ, nên cách duy nhất để người tiếp theo biết chúng mất bao lâu là từ những người đã trải qua. Khi các bước của bạn tiến triển, bạn có thể thêm ngày vào hồ sơ này. PERM Tracker đối chiếu ngày PERM của bạn với DOL, giữ số hồ sơ ngoài bảng công khai, và chỉ hiển thị dòng thời gian của bạn ở đó nếu bạn đánh dấu ô.",
    timelineButton: "Thêm ngày của bạn khi chúng đến",
    alsoHeading: "Cũng có trên PERM Tracker",
    ratingQuestion: "Các thông báo này hữu ích đến mức nào?",
  },
};

/**
 * The chrome of the recurring queue alert (QueueReached), in the five languages. DOL's month labels and as-of
 * dates arrive already formatted in English (as the case alert embeds them), so a sentence embeds an English
 * month; the queue name itself is translated. English is exactly today's wording.
 */
export interface QueueAlertText {
  previewText: (asOf: string) => string;
  eyebrow: string;
  /** "PERM queue" / "prevailing-wage queue", the localized name used in the footer and the PWD provenance. */
  queueName: (perm: boolean) => string;
  provenance: (perm: boolean, asOf: string, queueName: string) => string;
  footerText: (queueName: string, filingMonth: string) => string;
  removeAddress: string;
  yourMonthLabel: (perm: boolean) => string;
  bodyMovedPast: (filingMonth: string, frontierMonth: string) => string;
  bodyReached: (filingMonth: string, perm: boolean) => string;
  notADecision: string;
  cta: string;
  alsoHeading: string;
  alsoDeadlines: string;
  alsoDecisions: string;
}

export const QUEUE_ALERT_TEXT: MailMessages<QueueAlertText> = {
  en: {
    previewText: (asOf) => `The Department of Labor’s published figure, as of ${asOf}.`,
    eyebrow: "DOL has reached",
    queueName: (perm) => (perm ? "PERM queue" : "prevailing-wage queue"),
    provenance: (perm, asOf, queueName) => (perm ? `Analyst review, as of ${asOf}` : `${queueName}, as of ${asOf}`),
    footerText: (queueName, filingMonth) =>
      `You asked to be told when the Department of Labor’s ${queueName} reached ${filingMonth}. This alert doesn’t repeat.`,
    removeAddress: "Remove this address",
    yourMonthLabel: (perm) => (perm ? "Your filing month" : "Your submission month"),
    bodyMovedPast: (filingMonth, frontierMonth) => `DOL has worked past ${filingMonth} and is now on ${frontierMonth}.`,
    bodyReached: (filingMonth, perm) =>
      perm
        ? `DOL is now adjudicating cases filed in ${filingMonth}.`
        : `DOL is now working prevailing-wage requests submitted in ${filingMonth}.`,
    notADecision: "It isn’t a decision on your case and it isn’t a prediction of one.",
    cta: "See the current figures",
    alsoHeading: "Also on PERM Tracker",
    alsoDeadlines: "The deadlines on your side of the process",
    alsoDecisions: "Every PERM decision DOL has published",
  },
  es: {
    previewText: (asOf) => `La cifra publicada por el Departamento de Trabajo, al ${asOf}.`,
    eyebrow: "El DOL llegó a",
    queueName: (perm) => (perm ? "fila PERM" : "fila de salario prevaleciente"),
    provenance: (perm, asOf, queueName) => (perm ? `Revisión por analista, al ${asOf}` : `${queueName}, al ${asOf}`),
    footerText: (queueName, filingMonth) =>
      `Pidió que le avisáramos cuando la ${queueName} del Departamento de Trabajo llegara a ${filingMonth}. Esta alerta no se repite.`,
    removeAddress: "Quitar esta dirección",
    yourMonthLabel: (perm) => (perm ? "Su mes de presentación" : "Su mes de solicitud"),
    bodyMovedPast: (filingMonth, frontierMonth) => `El DOL ya pasó de ${filingMonth} y ahora está en ${frontierMonth}.`,
    bodyReached: (filingMonth, perm) =>
      perm
        ? `El DOL ahora está resolviendo casos presentados en ${filingMonth}.`
        : `El DOL ahora está procesando solicitudes de salario prevaleciente presentadas en ${filingMonth}.`,
    notADecision: "No es una decisión sobre su caso ni una predicción de una.",
    cta: "Ver las cifras actuales",
    alsoHeading: "También en PERM Tracker",
    alsoDeadlines: "Los plazos que le corresponden a usted",
    alsoDecisions: "Todas las decisiones PERM que el DOL ha publicado",
  },
  zh: {
    previewText: (asOf) => `劳工部公布的数字，截至 ${asOf}。`,
    eyebrow: "劳工部已处理到",
    queueName: (perm) => (perm ? "PERM 排队" : "现行工资排队"),
    provenance: (perm, asOf, queueName) => (perm ? `分析员审理，截至 ${asOf}` : `${queueName}，截至 ${asOf}`),
    footerText: (queueName, filingMonth) =>
      `您申请了在劳工部的${queueName}处理到 ${filingMonth} 时收到通知。此提醒不会重复发送。`,
    removeAddress: "移除此地址",
    yourMonthLabel: (perm) => (perm ? "您的递交月份" : "您的申请月份"),
    bodyMovedPast: (filingMonth, frontierMonth) => `劳工部已处理过 ${filingMonth}，现在在处理 ${frontierMonth}。`,
    bodyReached: (filingMonth, perm) =>
      perm
        ? `劳工部现在正在审理 ${filingMonth} 递交的案件。`
        : `劳工部现在正在处理 ${filingMonth} 递交的现行工资申请。`,
    notADecision: "这不是对您案件的决定，也不是对决定的预测。",
    cta: "查看当前数字",
    alsoHeading: "PERM Tracker 上还有",
    alsoDeadlines: "您这一方需要注意的期限",
    alsoDecisions: "劳工部已公布的所有 PERM 决定",
  },
  "pt-br": {
    previewText: (asOf) => `O número publicado pelo Departamento do Trabalho, em ${asOf}.`,
    eyebrow: "O DOL chegou a",
    queueName: (perm) => (perm ? "fila PERM" : "fila de salário prevalecente"),
    provenance: (perm, asOf, queueName) => (perm ? `Revisão por analista, em ${asOf}` : `${queueName}, em ${asOf}`),
    footerText: (queueName, filingMonth) =>
      `Você pediu para ser avisado quando a ${queueName} do Departamento do Trabalho chegasse a ${filingMonth}. Este alerta não se repete.`,
    removeAddress: "Remover este endereço",
    yourMonthLabel: (perm) => (perm ? "Seu mês de apresentação" : "Seu mês de solicitação"),
    bodyMovedPast: (filingMonth, frontierMonth) => `O DOL já passou de ${filingMonth} e agora está em ${frontierMonth}.`,
    bodyReached: (filingMonth, perm) =>
      perm
        ? `O DOL agora está decidindo casos apresentados em ${filingMonth}.`
        : `O DOL agora está processando solicitações de salário prevalecente apresentadas em ${filingMonth}.`,
    notADecision: "Não é uma decisão sobre o seu caso nem uma previsão de uma.",
    cta: "Ver os números atuais",
    alsoHeading: "Também no PERM Tracker",
    alsoDeadlines: "Os prazos do seu lado do processo",
    alsoDecisions: "Todas as decisões PERM que o DOL publicou",
  },
  ko: {
    previewText: (asOf) => `노동부가 공개한 수치, ${asOf} 기준.`,
    eyebrow: "노동부가 도달한 지점",
    queueName: (perm) => (perm ? "PERM 대기열" : "적정 임금 대기열"),
    provenance: (perm, asOf, queueName) => (perm ? `분석관 심사, ${asOf} 기준` : `${queueName}, ${asOf} 기준`),
    footerText: (queueName, filingMonth) =>
      `노동부의 ${queueName}이 ${filingMonth}에 도달하면 알려 달라고 신청하셨습니다. 이 알림은 반복되지 않습니다.`,
    removeAddress: "이 주소 삭제",
    yourMonthLabel: (perm) => (perm ? "귀하의 접수 월" : "귀하의 신청 월"),
    bodyMovedPast: (filingMonth, frontierMonth) => `노동부는 ${filingMonth}을 지나 지금 ${frontierMonth}을 처리하고 있습니다.`,
    bodyReached: (filingMonth, perm) =>
      perm
        ? `노동부가 지금 ${filingMonth}에 접수된 케이스를 심사하고 있습니다.`
        : `노동부가 지금 ${filingMonth}에 접수된 적정 임금 신청을 처리하고 있습니다.`,
    notADecision: "이것은 귀하의 케이스에 대한 결정도, 결정에 대한 예측도 아닙니다.",
    cta: "현재 수치 보기",
    alsoHeading: "PERM Tracker에서 더 보기",
    alsoDeadlines: "귀하 쪽에 해당하는 기한",
    alsoDecisions: "노동부가 공개한 모든 PERM 결정",
  },
  vi: {
    previewText: (asOf) => `Con số do Bộ Lao động công bố, tính đến ${asOf}.`,
    eyebrow: "DOL đã xét đến",
    queueName: (perm) => (perm ? "hàng chờ PERM" : "hàng chờ mức lương hiện hành"),
    provenance: (perm, asOf, queueName) => (perm ? `Thẩm định viên xét, tính đến ${asOf}` : `${queueName}, tính đến ${asOf}`),
    footerText: (queueName, filingMonth) =>
      `Bạn đã yêu cầu được báo khi ${queueName} của Bộ Lao động xét đến ${filingMonth}. Thông báo này không lặp lại.`,
    removeAddress: "Xóa địa chỉ này",
    yourMonthLabel: (perm) => (perm ? "Tháng nộp của bạn" : "Tháng yêu cầu của bạn"),
    bodyMovedPast: (filingMonth, frontierMonth) => `DOL đã xét qua ${filingMonth} và hiện đang ở ${frontierMonth}.`,
    bodyReached: (filingMonth, perm) =>
      perm
        ? `DOL hiện đang xét các hồ sơ nộp trong ${filingMonth}.`
        : `DOL hiện đang xử lý các yêu cầu mức lương hiện hành nộp trong ${filingMonth}.`,
    notADecision: "Đây không phải là quyết định về hồ sơ của bạn, cũng không phải dự đoán về một quyết định.",
    cta: "Xem các con số hiện tại",
    alsoHeading: "Cũng có trên PERM Tracker",
    alsoDeadlines: "Các thời hạn thuộc phía bạn trong quy trình",
    alsoDecisions: "Mọi quyết định PERM mà DOL đã công bố",
  },
};

/**
 * The chrome of the recurring bulletin alert (BulletinMoved), in the five languages. The series label and the
 * cutoffs are State's own printed values and stay as printed; "Stop these alerts" and "Email preferences" come
 * from LAYOUT_TEXT. English is exactly today's wording.
 */
export interface BulletinAlertText {
  previewText: (series: string, from: string, to: string) => string;
  footerText: (series: string) => string;
  stampMoved: (series: string) => string;
  provenance: (month: string) => string;
  before: string;
  now: string;
  body: string;
  note: string;
}

export const BULLETIN_ALERT_TEXT: MailMessages<BulletinAlertText> = {
  en: {
    previewText: (series, from, to) => `${series}: ${from} to ${to}.`,
    footerText: (series) =>
      `You asked to be told when the final-action cutoff for ${series} moves. These alerts repeat whenever it does.`,
    stampMoved: (series) => `${series} moved`,
    provenance: (month) => `${month} visa bulletin, final action`,
    before: "Before",
    now: "Now",
    body: "This is the State Department’s own published figure. It isn’t advice and it isn’t a prediction of your case.",
    note: "The full board and every bulletin since October 2014:",
  },
  es: {
    previewText: (series, from, to) => `${series}: de ${from} a ${to}.`,
    footerText: (series) =>
      `Pidió que le avisáramos cuando la fecha de corte de acción final para ${series} se moviera. Estas alertas se repiten cada vez que lo hace.`,
    stampMoved: (series) => `${series} se movió`,
    provenance: (month) => `Boletín de visas de ${month}, acción final`,
    before: "Antes",
    now: "Ahora",
    body: "Esta es la cifra publicada por el propio Departamento de Estado. No es un consejo ni una predicción de su caso.",
    note: "El tablero completo y todos los boletines desde octubre de 2014:",
  },
  zh: {
    previewText: (series, from, to) => `${series}：从 ${from} 到 ${to}。`,
    footerText: (series) =>
      `您申请了在 ${series} 的最终裁定排期日变动时收到通知。只要它变动，这些提醒就会重复发送。`,
    stampMoved: (series) => `${series} 有变动`,
    provenance: (month) => `${month} 签证公告，最终裁定`,
    before: "之前",
    now: "现在",
    body: "这是美国国务院自己公布的数字。它不是建议，也不是对您案件的预测。",
    note: "完整排期表和自 2014 年 10 月以来的每一期公告：",
  },
  "pt-br": {
    previewText: (series, from, to) => `${series}: de ${from} para ${to}.`,
    footerText: (series) =>
      `Você pediu para ser avisado quando a data de corte de ação final de ${series} mudasse. Estes alertas se repetem sempre que ela muda.`,
    stampMoved: (series) => `${series} mudou`,
    provenance: (month) => `Boletim de vistos de ${month}, ação final`,
    before: "Antes",
    now: "Agora",
    body: "Este é o número publicado pelo próprio Departamento de Estado. Não é um conselho nem uma previsão do seu caso.",
    note: "O painel completo e todos os boletins desde outubro de 2014:",
  },
  ko: {
    previewText: (series, from, to) => `${series}: ${from}에서 ${to}로.`,
    footerText: (series) =>
      `${series}의 최종 심사 기준일이 바뀌면 알려 달라고 신청하셨습니다. 이 알림은 기준일이 바뀔 때마다 반복됩니다.`,
    stampMoved: (series) => `${series}가 바뀌었습니다`,
    provenance: (month) => `${month} 비자 공보, 최종 심사`,
    before: "이전",
    now: "지금",
    body: "이것은 국무부가 직접 공개한 수치입니다. 조언도 아니고 귀하의 케이스에 대한 예측도 아닙니다.",
    note: "전체 보드와 2014년 10월 이후 모든 공보:",
  },
  vi: {
    previewText: (series, from, to) => `${series}: từ ${from} đến ${to}.`,
    footerText: (series) =>
      `Bạn đã yêu cầu được báo khi ngày chốt hành động cuối cùng của ${series} thay đổi. Các thông báo này lặp lại mỗi khi nó thay đổi.`,
    stampMoved: (series) => `${series} đã thay đổi`,
    provenance: (month) => `Bản tin thị thực tháng ${month}, hành động cuối cùng`,
    before: "Trước",
    now: "Hiện tại",
    body: "Đây là con số do chính Bộ Ngoại giao công bố. Nó không phải là lời khuyên, cũng không phải dự đoán về hồ sơ của bạn.",
    note: "Toàn bộ bảng và mọi bản tin kể từ tháng 10 năm 2014:",
  },
};
