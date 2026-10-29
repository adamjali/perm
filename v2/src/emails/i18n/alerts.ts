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
