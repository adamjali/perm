/**
 * The body copy of the confirmation emails, in the five languages. The subjects, the result pages and the
 * figure-table labels live Convex-side (convex/lib/alertEmailText.ts, convex/lib/mailPageText.ts); this file is
 * the prose inside the template itself. English is exactly today’s wording, so an English reader’s mail is
 * unchanged. Machine translations by a model; nothing claims a native-speaker review.
 *
 * DOL and the State Department, case numbers and status words stay as DOL prints them, glossed the first time.
 * The party who acts is the employer, never the reader.
 */

import type { MailMessages } from "../../lib/i18n/mailLang";

export interface CaseConfirmText {
  previewKnown: string;
  previewUnknown: string;
  footer: (nounWithArticle: string) => string;
  eyebrow: string;
  currently: (status: string, employer: string | null) => string;
  shownSince: (asOf: string) => string;
  noDate: string;
  notInRecords: string;
  bodyKnown: string;
  lag: string;
  bodyUnknown: string;
  news: string;
  newsletter: string;
  button: string;
  ignore: string;
}

export const CASE_CONFIRM_TEXT: MailMessages<CaseConfirmText> = {
  en: {
    previewKnown: "Confirm and we’ll email you when DOL’s status for this case changes.",
    previewUnknown: "We don’t hold this case number yet. Check it before you confirm.",
    footer: (n) => `This address was entered to be told when ${n}’s status changes. It isn’t confirmed yet, so nothing else will be sent.`,
    eyebrow: "Your case number",
    currently: (status, employer) => `Currently ${status}${employer ? ` at ${employer}` : ""}`,
    shownSince: (asOf) => `Shown since at least ${asOf}`,
    noDate: "We don’t have a date for this status yet",
    notInRecords: "Not in our records yet",
    bodyKnown:
      "If that’s your case, confirm below and we’ll email you every time DOL’s status for it changes, and for a year after it’s decided, in case it’s appealed or reopened. If it isn’t your case, ignore this and enter the number again.",
    lag: "We ask DOL about watched cases every 5 minutes on weekdays from 7 AM to 9 PM Eastern, and every half hour otherwise, and email a change as soon as we see it. Every alert says since when DOL’s record has shown the status.",
    bodyUnknown:
      "We don’t hold this case number yet, which is normal for a recent filing and is also what a typo looks like. Check it against your receipt first. Confirm and we’ll start watching it, then email you the first time its status moves after that.",
    news: "You also asked for occasional product news. The same click confirms that.",
    newsletter: "You also asked for the weekly digest. The same click confirms that.",
    button: "Confirm these alerts",
    ignore: "If you didn’t ask for this, ignore it. Nothing will be sent.",
  },
  es: {
    previewKnown: "Confirme y le escribiremos cuando cambie el estado de este caso en el DOL.",
    previewUnknown: "Todavía no tenemos este número de caso. Revíselo antes de confirmar.",
    footer: (n) => `Esta dirección se ingresó para avisar cuando cambie el estado de ${n}. Aún no está confirmada, así que no se enviará nada más.`,
    eyebrow: "Su número de caso",
    currently: (status, employer) => `Actualmente ${status}${employer ? ` en ${employer}` : ""}`,
    shownSince: (asOf) => `Mostrado desde al menos ${asOf}`,
    noDate: "Todavía no tenemos una fecha para este estado",
    notInRecords: "Todavía no está en nuestros registros",
    bodyKnown:
      "Si ese es su caso, confirme abajo y le escribiremos cada vez que cambie su estado en el Departamento de Trabajo (DOL), y durante un año después de que se decida, por si hay una apelación o se reabre. Si no es su caso, ignore esto y vuelva a ingresar el número.",
    lag: "Consultamos al DOL sobre los casos vigilados cada 5 minutos en días hábiles de 7 a. m. a 9 p. m. hora del Este, y cada media hora el resto del tiempo, y enviamos un cambio en cuanto lo vemos. Cada alerta dice desde cuándo el registro del DOL muestra el estado.",
    bodyUnknown:
      "Todavía no tenemos este número de caso, lo cual es normal en una presentación reciente y también es lo que parece un error de tecleo. Revíselo primero con su recibo. Confirme y empezaremos a vigilarlo, y le escribiremos la primera vez que su estado se mueva a partir de entonces.",
    news: "También pidió noticias ocasionales del producto. El mismo clic las confirma.",
    newsletter: "También pidió el resumen semanal. El mismo clic lo confirma.",
    button: "Confirmar estas alertas",
    ignore: "Si no pidió esto, ignórelo. No se enviará nada.",
  },
  zh: {
    previewKnown: "确认后，当劳工部对此案件的状态变化时，我们会发邮件通知您。",
    previewUnknown: "我们还没有这个案件号。请在确认前核对。",
    footer: (n) => `此邮箱是为在${n}状态变化时收到通知而填写的。尚未确认，因此不会发送其他内容。`,
    eyebrow: "您的案件号",
    currently: (status, employer) => `当前为 ${status}${employer ? `，雇主 ${employer}` : ""}`,
    shownSince: (asOf) => `至少自 ${asOf} 起显示`,
    noDate: "我们还没有此状态的日期",
    notInRecords: "还不在我们的记录中",
    bodyKnown:
      "如果这是您的案件，请在下方确认，此后每当劳工部（DOL）对它的状态变化时，我们都会发邮件通知您，案件决定后一年内也会，以防出现上诉或重新审理。如果不是您的案件，请忽略本邮件并重新输入案件号。",
    lag: "我们在工作日东部时间上午 7 点至晚上 9 点每 5 分钟、其余时间每半小时向劳工部查询一次所关注的案件，一看到变化就发邮件。每封提醒都会说明劳工部的记录自何时起显示该状态。",
    bodyUnknown:
      "我们还没有这个案件号，这在新近递交的案件中很正常，也可能是输入有误。请先对照您的收据核对。确认后我们会开始关注它，此后它的状态第一次变化时发邮件通知您。",
    news: "您还申请了偶尔的产品动态。同一个点击即可确认。",
    newsletter: "您还申请了每周摘要。同一个点击即可确认。",
    button: "确认这些提醒",
    ignore: "如果您没有申请本邮件，请忽略。不会发送任何内容。",
  },
  "pt-br": {
    previewKnown: "Confirme e vamos enviar um e-mail quando o status deste caso no DOL mudar.",
    previewUnknown: "Ainda não temos este número de caso. Confira antes de confirmar.",
    footer: (n) => `Este endereço foi inserido para avisar quando o status de ${n} mudar. Ainda não está confirmado, então nada mais será enviado.`,
    eyebrow: "Seu número de caso",
    currently: (status, employer) => `Atualmente ${status}${employer ? ` em ${employer}` : ""}`,
    shownSince: (asOf) => `Mostrado desde pelo menos ${asOf}`,
    noDate: "Ainda não temos uma data para este status",
    notInRecords: "Ainda não está em nossos registros",
    bodyKnown:
      "Se esse é o seu caso, confirme abaixo e vamos enviar um e-mail toda vez que o status dele no Departamento do Trabalho (DOL) mudar, e por um ano depois de decidido, caso haja recurso ou reabertura. Se não for o seu caso, ignore isto e insira o número de novo.",
    lag: "Consultamos o DOL sobre os casos acompanhados a cada 5 minutos nos dias úteis, das 7h às 21h no horário do Leste, e a cada meia hora no resto do tempo, e enviamos uma mudança assim que a vemos. Cada alerta diz desde quando o registro do DOL mostra o status.",
    bodyUnknown:
      "Ainda não temos este número de caso, o que é normal em um protocolo recente e também é a cara de um erro de digitação. Confira primeiro com o seu recibo. Confirme e começaremos a acompanhá-lo, e enviaremos um e-mail na primeira vez que o status se mover a partir daí.",
    news: "Você também pediu novidades ocasionais do produto. O mesmo clique as confirma.",
    newsletter: "Você também pediu o resumo semanal. O mesmo clique o confirma.",
    button: "Confirmar estes alertas",
    ignore: "Se você não pediu isto, ignore. Nada será enviado.",
  },
  ko: {
    previewKnown: "확인하시면 노동부의 이 케이스 상태가 바뀔 때 이메일을 보내 드립니다.",
    previewUnknown: "이 케이스 번호는 아직 저희 기록에 없습니다. 확인하기 전에 번호를 점검해 주세요.",
    footer: (n) => `이 주소는 ${n}의 상태가 바뀔 때 알림을 받기 위해 입력되었습니다. 아직 확인되지 않았으므로 다른 메일은 발송되지 않습니다.`,
    eyebrow: "귀하의 케이스 번호",
    currently: (status, employer) => `현재 ${status}${employer ? `, 고용주 ${employer}` : ""}`,
    shownSince: (asOf) => `최소 ${asOf}부터 표시됨`,
    noDate: "이 상태에 대한 날짜는 아직 없습니다",
    notInRecords: "아직 저희 기록에 없습니다",
    bodyKnown:
      "귀하의 케이스가 맞으면 아래에서 확인해 주세요. 그러면 노동부(DOL)의 상태가 바뀔 때마다 이메일을 보내 드리고, 결정된 뒤에도 항소나 재개에 대비해 1년간 보내 드립니다. 귀하의 케이스가 아니라면 이 메일을 무시하고 번호를 다시 입력해 주세요.",
    lag: "저희는 지켜보는 케이스를 평일 동부 시간 오전 7시부터 오후 9시까지는 5분마다, 그 외 시간에는 30분마다 노동부에 조회하고, 변화를 보는 즉시 이메일을 보냅니다. 모든 알림은 노동부 기록이 언제부터 그 상태를 보였는지 알려 드립니다.",
    bodyUnknown:
      "이 케이스 번호는 아직 저희 기록에 없습니다. 최근에 접수된 케이스라면 정상이며, 오타일 때도 이렇게 보입니다. 먼저 접수증과 대조해 주세요. 확인하시면 지켜보기 시작하고, 그 뒤 상태가 처음 바뀔 때 이메일을 보내 드립니다.",
    news: "가끔 전해 드리는 제품 소식도 신청하셨습니다. 같은 클릭으로 함께 확인됩니다.",
    newsletter: "주간 요약도 신청하셨습니다. 같은 클릭으로 함께 확인됩니다.",
    button: "이 알림 확인",
    ignore: "신청하지 않으셨다면 무시해 주세요. 아무것도 발송되지 않습니다.",
  },
  vi: {
    previewKnown: "Xác nhận và chúng tôi sẽ gửi email khi tình trạng của hồ sơ này tại DOL thay đổi.",
    previewUnknown: "Chúng tôi chưa có số hồ sơ này. Hãy kiểm tra trước khi xác nhận.",
    footer: (n) => `Địa chỉ này được nhập để nhận thông báo khi tình trạng của ${n} thay đổi. Chưa được xác nhận, nên sẽ không gửi gì thêm.`,
    eyebrow: "Số hồ sơ của bạn",
    currently: (status, employer) => `Hiện là ${status}${employer ? `, chủ lao động ${employer}` : ""}`,
    shownSince: (asOf) => `Hiển thị từ ít nhất ${asOf}`,
    noDate: "Chúng tôi chưa có ngày cho tình trạng này",
    notInRecords: "Chưa có trong hồ sơ của chúng tôi",
    bodyKnown:
      "Nếu đó là hồ sơ của bạn, hãy xác nhận bên dưới và chúng tôi sẽ gửi email mỗi khi tình trạng của nó tại Bộ Lao động (DOL) thay đổi, và trong một năm sau khi có quyết định, phòng khi có kháng cáo hoặc mở lại. Nếu không phải hồ sơ của bạn, hãy bỏ qua và nhập lại số.",
    lag: "Chúng tôi hỏi DOL về các hồ sơ đang theo dõi mỗi 5 phút vào ngày thường từ 7 giờ sáng đến 9 giờ tối giờ miền Đông, và mỗi nửa giờ vào lúc khác, và gửi email ngay khi thấy thay đổi. Mỗi thông báo cho biết hồ sơ của DOL đã hiển thị tình trạng này từ khi nào.",
    bodyUnknown:
      "Chúng tôi chưa có số hồ sơ này, điều bình thường với một hồ sơ mới nộp và cũng là dấu hiệu của lỗi gõ. Hãy đối chiếu với biên nhận của bạn trước. Xác nhận và chúng tôi sẽ bắt đầu theo dõi, rồi gửi email lần đầu tiên tình trạng của nó chuyển sau đó.",
    news: "Bạn cũng đã yêu cầu tin tức sản phẩm thỉnh thoảng. Cùng một cú nhấp sẽ xác nhận điều đó.",
    newsletter: "Bạn cũng đã yêu cầu bản tóm tắt hằng tuần. Cùng một cú nhấp sẽ xác nhận điều đó.",
    button: "Xác nhận các thông báo này",
    ignore: "Nếu bạn không yêu cầu điều này, hãy bỏ qua. Sẽ không gửi gì.",
  },
};

// ============================================================================
// Queue-month confirmation. The DOL queue name is kept English (a DOL term, as the site’s own translated forms
// keep "ANALYST REVIEW"); the month is localized by the Convex function before it reaches here.
// ============================================================================

export interface QueueConfirmText {
  preview: (month: string) => string;
  footer: (queueName: string, monthNoun: string) => string;
  monthNoun: (perm: boolean) => string;
  eyebrow: (perm: boolean) => string;
  body: (queueName: string) => string;
  news: string;
  button: string;
  ignore: string;
}

export const QUEUE_CONFIRM_TEXT: MailMessages<QueueConfirmText> = {
  en: {
    preview: (m) => `Confirm and we’ll email you once, on the day DOL reaches ${m}.`,
    footer: (q, n) => `This address was entered to be told when the Department of Labor’s ${q} reaches a ${n}. It isn’t confirmed yet, so nothing else will be sent.`,
    monthNoun: (perm) => (perm ? "filing month" : "submission month"),
    eyebrow: (perm) => (perm ? "Your filing month" : "Your submission month"),
    body: (q) => `You asked to be told when the Department of Labor’s ${q} reaches this month. Confirm the alert and we’ll email you once, on the day it happens.`,
    news: "You also asked for occasional product news. The same click confirms that.",
    button: "Confirm the alert",
    ignore: "If you didn’t ask for this, ignore it. Nothing will be sent.",
  },
  es: {
    preview: (m) => `Confirme y le escribiremos una vez, el día en que el DOL llegue a ${m}.`,
    footer: (q, n) => `Esta dirección se ingresó para avisar cuando la ${q} del Departamento de Trabajo (DOL) llegue a un ${n}. Aún no está confirmada, así que no se enviará nada más.`,
    monthNoun: (perm) => (perm ? "mes de presentación" : "mes de envío"),
    eyebrow: (perm) => (perm ? "Su mes de presentación" : "Su mes de envío"),
    body: (q) => `Pidió que le avisáramos cuando la ${q} del Departamento de Trabajo (DOL) llegue a este mes. Confirme la alerta y le escribiremos una vez, el día en que ocurra.`,
    news: "También pidió noticias ocasionales del producto. El mismo clic las confirma.",
    button: "Confirmar la alerta",
    ignore: "Si no pidió esto, ignórelo. No se enviará nada.",
  },
  zh: {
    preview: (m) => `确认后，当劳工部处理到 ${m} 时，我们会发一封邮件通知您。`,
    footer: (q, n) => `此邮箱是为在劳工部（DOL）的${q}处理到某个${n}时收到通知而填写的。尚未确认，因此不会发送其他内容。`,
    monthNoun: (perm) => (perm ? "递交月份" : "提交月份"),
    eyebrow: (perm) => (perm ? "您的递交月份" : "您的提交月份"),
    body: (q) => `您申请了在劳工部（DOL）的${q}处理到这个月份时收到通知。确认提醒后，我们会在它发生的那天发一封邮件给您。`,
    news: "您还申请了偶尔的产品动态。同一个点击即可确认。",
    button: "确认提醒",
    ignore: "如果您没有申请本邮件，请忽略。不会发送任何内容。",
  },
  "pt-br": {
    preview: (m) => `Confirme e vamos enviar um e-mail uma vez, no dia em que o DOL chegar a ${m}.`,
    footer: (q, n) => `Este endereço foi inserido para avisar quando a ${q} do Departamento do Trabalho (DOL) chegar a um ${n}. Ainda não está confirmado, então nada mais será enviado.`,
    monthNoun: (perm) => (perm ? "mês de protocolo" : "mês de envio"),
    eyebrow: (perm) => (perm ? "Seu mês de protocolo" : "Seu mês de envio"),
    body: (q) => `Você pediu para ser avisado quando a ${q} do Departamento do Trabalho (DOL) chegar a este mês. Confirme o alerta e vamos enviar um e-mail uma vez, no dia em que acontecer.`,
    news: "Você também pediu novidades ocasionais do produto. O mesmo clique as confirma.",
    button: "Confirmar o alerta",
    ignore: "Se você não pediu isto, ignore. Nada será enviado.",
  },
  ko: {
    preview: (m) => `확인하시면 노동부가 ${m}에 도달하는 날 이메일을 한 통 보내 드립니다.`,
    footer: (q, n) => `이 주소는 노동부(DOL)의 ${q}이(가) ${n}에 도달할 때 알림을 받기 위해 입력되었습니다. 아직 확인되지 않았으므로 다른 메일은 발송되지 않습니다.`,
    monthNoun: (perm) => (perm ? "접수 월" : "제출 월"),
    eyebrow: (perm) => (perm ? "귀하의 접수 월" : "귀하의 제출 월"),
    body: (q) => `노동부(DOL)의 ${q}이(가) 이 달에 도달하면 알려 달라고 신청하셨습니다. 알림을 확인하시면, 그 일이 일어나는 날 이메일을 한 통 보내 드립니다.`,
    news: "가끔 전해 드리는 제품 소식도 신청하셨습니다. 같은 클릭으로 함께 확인됩니다.",
    button: "알림 확인",
    ignore: "신청하지 않으셨다면 무시해 주세요. 아무것도 발송되지 않습니다.",
  },
  vi: {
    preview: (m) => `Xác nhận và chúng tôi sẽ gửi một email, vào ngày DOL xét đến ${m}.`,
    footer: (q, n) => `Địa chỉ này được nhập để nhận thông báo khi ${q} của Bộ Lao động (DOL) xét đến một ${n}. Chưa được xác nhận, nên sẽ không gửi gì thêm.`,
    monthNoun: (perm) => (perm ? "tháng nộp hồ sơ" : "tháng nộp"),
    eyebrow: (perm) => (perm ? "Tháng nộp hồ sơ của bạn" : "Tháng nộp của bạn"),
    body: (q) => `Bạn đã yêu cầu được báo khi ${q} của Bộ Lao động (DOL) xét đến tháng này. Xác nhận thông báo và chúng tôi sẽ gửi một email, vào ngày điều đó xảy ra.`,
    news: "Bạn cũng đã yêu cầu tin tức sản phẩm thỉnh thoảng. Cùng một cú nhấp sẽ xác nhận điều đó.",
    button: "Xác nhận thông báo",
    ignore: "Nếu bạn không yêu cầu điều này, hãy bỏ qua. Sẽ không gửi gì.",
  },
};

// ============================================================================
// Bulletin confirmation. The series label (e.g. "EB2 India") is kept as the bulletin prints it.
// ============================================================================

export interface BulletinConfirmText {
  preview: (series: string) => string;
  footer: (series: string) => string;
  eyebrow: string;
  body: string;
  news: string;
  newsletter: string;
  button: string;
  ignore: string;
}

export const BULLETIN_CONFIRM_TEXT: MailMessages<BulletinConfirmText> = {
  en: {
    preview: (s) => `Confirm and we’ll email you when the cutoff for ${s} moves.`,
    footer: (s) => `This address was entered to be told when the State Department’s final-action cutoff for ${s} moves. It isn’t confirmed yet, so nothing else will be sent.`,
    eyebrow: "Your series",
    body: "You asked to be told when the State Department’s final-action cutoff for this series moves in a new visa bulletin. Confirm the alert and we’ll email you when it does.",
    news: "You also asked for occasional product news. The same click confirms that.",
    newsletter: "You also asked for the weekly digest. The same click confirms that.",
    button: "Confirm the alert",
    ignore: "If you didn’t ask for this, ignore it. Nothing will be sent.",
  },
  es: {
    preview: (s) => `Confirme y le escribiremos cuando la fecha límite de ${s} se mueva.`,
    footer: (s) => `Esta dirección se ingresó para avisar cuando la fecha de acción final del Departamento de Estado para ${s} se mueva. Aún no está confirmada, así que no se enviará nada más.`,
    eyebrow: "Su serie",
    body: "Pidió que le avisáramos cuando la fecha de acción final del Departamento de Estado para esta serie se mueva en un nuevo boletín de visas. Confirme la alerta y le escribiremos cuando ocurra.",
    news: "También pidió noticias ocasionales del producto. El mismo clic las confirma.",
    newsletter: "También pidió el resumen semanal. El mismo clic lo confirma.",
    button: "Confirmar la alerta",
    ignore: "Si no pidió esto, ignórelo. No se enviará nada.",
  },
  zh: {
    preview: (s) => `确认后，当 ${s} 的排期日期变动时，我们会发邮件通知您。`,
    footer: (s) => `此邮箱是为在国务院对 ${s} 的最终行动日期变动时收到通知而填写的。尚未确认，因此不会发送其他内容。`,
    eyebrow: "您的类别",
    body: "您申请了在国务院对此类别的最终行动日期在新的签证公告中变动时收到通知。确认提醒后，当它变动时我们会发邮件通知您。",
    news: "您还申请了偶尔的产品动态。同一个点击即可确认。",
    newsletter: "您还申请了每周摘要。同一个点击即可确认。",
    button: "确认提醒",
    ignore: "如果您没有申请本邮件，请忽略。不会发送任何内容。",
  },
  "pt-br": {
    preview: (s) => `Confirme e vamos enviar um e-mail quando a data de corte de ${s} se mover.`,
    footer: (s) => `Este endereço foi inserido para avisar quando a data de ação final do Departamento de Estado para ${s} se mover. Ainda não está confirmado, então nada mais será enviado.`,
    eyebrow: "Sua série",
    body: "Você pediu para ser avisado quando a data de ação final do Departamento de Estado para esta série se mover em um novo boletim de vistos. Confirme o alerta e vamos enviar um e-mail quando isso acontecer.",
    news: "Você também pediu novidades ocasionais do produto. O mesmo clique as confirma.",
    newsletter: "Você também pediu o resumo semanal. O mesmo clique o confirma.",
    button: "Confirmar o alerta",
    ignore: "Se você não pediu isto, ignore. Nada será enviado.",
  },
  ko: {
    preview: (s) => `확인하시면 ${s}의 컷오프 날짜가 바뀔 때 이메일을 보내 드립니다.`,
    footer: (s) => `이 주소는 국무부의 ${s} 최종 조치 날짜가 바뀔 때 알림을 받기 위해 입력되었습니다. 아직 확인되지 않았으므로 다른 메일은 발송되지 않습니다.`,
    eyebrow: "귀하의 범주",
    body: "새 비자 공보에서 국무부의 이 범주 최종 조치 날짜가 바뀌면 알려 달라고 신청하셨습니다. 알림을 확인하시면, 바뀔 때 이메일을 보내 드립니다.",
    news: "가끔 전해 드리는 제품 소식도 신청하셨습니다. 같은 클릭으로 함께 확인됩니다.",
    newsletter: "주간 요약도 신청하셨습니다. 같은 클릭으로 함께 확인됩니다.",
    button: "알림 확인",
    ignore: "신청하지 않으셨다면 무시해 주세요. 아무것도 발송되지 않습니다.",
  },
  vi: {
    preview: (s) => `Xác nhận và chúng tôi sẽ gửi email khi ngày khóa sổ của ${s} thay đổi.`,
    footer: (s) => `Địa chỉ này được nhập để nhận thông báo khi ngày hành động cuối cùng của Bộ Ngoại giao cho ${s} thay đổi. Chưa được xác nhận, nên sẽ không gửi gì thêm.`,
    eyebrow: "Diện của bạn",
    body: "Bạn đã yêu cầu được báo khi ngày hành động cuối cùng của Bộ Ngoại giao cho diện này thay đổi trong một bản tin thị thực mới. Xác nhận thông báo và chúng tôi sẽ gửi email khi điều đó xảy ra.",
    news: "Bạn cũng đã yêu cầu tin tức sản phẩm thỉnh thoảng. Cùng một cú nhấp sẽ xác nhận điều đó.",
    newsletter: "Bạn cũng đã yêu cầu bản tóm tắt hằng tuần. Cùng một cú nhấp sẽ xác nhận điều đó.",
    button: "Xác nhận thông báo",
    ignore: "Nếu bạn không yêu cầu điều này, hãy bỏ qua. Sẽ không gửi gì.",
  },
};

// ============================================================================
// Digest confirmation.
// ============================================================================

export interface DigestConfirmText {
  preview: string;
  footer: string;
  eyebrow: string;
  what: string;
  body: string;
  button: string;
  ignore: string;
}

export const DIGEST_CONFIRM_TEXT: MailMessages<DigestConfirmText> = {
  en: {
    preview: "Confirm and the weekly digest comes to this address on Tuesdays.",
    footer: "This address was entered for PERM Tracker’s weekly digest. It isn’t confirmed yet, so nothing else will be sent.",
    eyebrow: "You asked for",
    what: "The weekly digest",
    body: "Every Tuesday: where DOL’s queue stands, what the visa bulletin moved, USCIS’s processing times and the rules on their way. Confirm and the next issue comes to this address.",
    button: "Confirm the digest",
    ignore: "If you didn’t ask for this, ignore it. Nothing will be sent.",
  },
  es: {
    preview: "Confirme y el resumen semanal llegará a esta dirección los martes.",
    footer: "Esta dirección se ingresó para el resumen semanal de PERM Tracker. Aún no está confirmada, así que no se enviará nada más.",
    eyebrow: "Usted pidió",
    what: "El resumen semanal",
    body: "Todos los martes: cómo está la fila del DOL, qué movió el boletín de visas, los tiempos de USCIS y las reglas en camino. Confirme y el próximo número llegará a esta dirección.",
    button: "Confirmar el resumen",
    ignore: "Si no pidió esto, ignórelo. No se enviará nada.",
  },
  zh: {
    preview: "确认后，每周摘要将在周二发送到此邮箱。",
    footer: "此邮箱是为 PERM Tracker 的每周摘要而填写的。尚未确认，因此不会发送其他内容。",
    eyebrow: "您申请了",
    what: "每周摘要",
    body: "每周二：劳工部排队的进度、签证公告的变动、USCIS 的处理时间，以及即将出台的规则。确认后，下一期将发送到此邮箱。",
    button: "确认每周摘要",
    ignore: "如果您没有申请本邮件，请忽略。不会发送任何内容。",
  },
  "pt-br": {
    preview: "Confirme e o resumo semanal chega a este endereço às terças.",
    footer: "Este endereço foi inserido para o resumo semanal do PERM Tracker. Ainda não está confirmado, então nada mais será enviado.",
    eyebrow: "Você pediu",
    what: "O resumo semanal",
    body: "Toda terça: como está a fila do DOL, o que o boletim de vistos moveu, os prazos do USCIS e as regras a caminho. Confirme e a próxima edição chega a este endereço.",
    button: "Confirmar o resumo",
    ignore: "Se você não pediu isto, ignore. Nada será enviado.",
  },
  ko: {
    preview: "확인하시면 주간 요약이 화요일마다 이 주소로 전달됩니다.",
    footer: "이 주소는 PERM Tracker 주간 요약을 위해 입력되었습니다. 아직 확인되지 않았으므로 다른 메일은 발송되지 않습니다.",
    eyebrow: "신청하신 것",
    what: "주간 요약",
    body: "매주 화요일: 노동부 대기열 현황, 비자 공보에서 바뀐 것, USCIS 처리 기간, 그리고 준비 중인 규정. 확인하시면 다음 호가 이 주소로 전달됩니다.",
    button: "주간 요약 확인",
    ignore: "신청하지 않으셨다면 무시해 주세요. 아무것도 발송되지 않습니다.",
  },
  vi: {
    preview: "Xác nhận và bản tóm tắt hằng tuần sẽ đến địa chỉ này vào thứ Ba.",
    footer: "Địa chỉ này được nhập cho bản tóm tắt hằng tuần của PERM Tracker. Chưa được xác nhận, nên sẽ không gửi gì thêm.",
    eyebrow: "Bạn đã yêu cầu",
    what: "Bản tóm tắt hằng tuần",
    body: "Mỗi thứ Ba: hàng chờ của DOL đang ở đâu, bản tin thị thực đã chuyển gì, thời gian xử lý của USCIS và các quy định sắp tới. Xác nhận và số tiếp theo sẽ đến địa chỉ này.",
    button: "Xác nhận bản tóm tắt",
    ignore: "Nếu bạn không yêu cầu điều này, hãy bỏ qua. Sẽ không gửi gì.",
  },
};
