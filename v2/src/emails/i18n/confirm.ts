/**
 * The body copy of the confirmation emails, in the five languages. The subjects, the result pages and the
 * figure-table labels live Convex-side (convex/lib/alertEmailText.ts, convex/lib/mailPageText.ts); this file is
 * the prose inside the template itself. English is exactly today's wording, so an English reader's mail is
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
    previewKnown: "Confirm and we'll email you when DOL's status for this case changes.",
    previewUnknown: "We don't hold this case number yet. Check it before you confirm.",
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
