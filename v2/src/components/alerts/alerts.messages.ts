import type { FlagProgram } from "@/lib/flagCaseNumber";
import type { Lang, Messages } from "@/lib/i18n/lang";

/**
 * The words of a case's two alert boxes (the email and the browser notification), in every language the case
 * page is published in. The terms follow each language's guide and case page: DOL stays "DOL", status names stay
 * as DOL prints them.
 *
 * The server's replies are fixed sentences, the same for every address (a reply that varied would tell a
 * stranger whether an address is signed up), so the browser can say them in the reader's language without
 * revealing anything: `serverReply` maps each fixed English reply to its translation and passes anything else
 * through as the server wrote it.
 */
export interface AlertText {
  /** "Email me when DOL changes this PERM case's status": the label over the email box. */
  label: (program: FlagProgram) => string;
  button: string;
  note: string;
  /** Only on a translated page: the emails themselves are in English. */
  emailLanguage: string;
  doneQueued: string;
  doneSent: string;
  doneRules: string;
  otherEmails: string;
  added: (n: number) => string;
  newsletter: string;
  news: string;
  optInNote: string;
  failed: string;
  dropped: string;
  push: {
    summary: string;
    explain: string;
    turnOn: string;
    turnOff: string;
    on: string;
    off: string;
    blocked: string;
    unsupported: string;
    noAnswer: string;
    failed: string;
    dropped: string;
  };
  /** The weekly digest's own sign-up box. */
  digest: { label: string; button: string };
  /** The server's fixed replies, by their exact English. */
  replies: Record<string, string>;
}

/** The server's fixed English replies a translation covers (convex/caseAlerts.ts, convex/confirmationQueue.ts). */
export const NEUTRAL_REPLY = "Check your inbox to confirm.";
export const BAD_EMAIL_REPLY = "That email address does not look right.";
export const BAD_NUMBER_REPLY = "That does not look like a DOL case number (G-, A-, P-, I-, H-, JO-A- or C-).";
export const QUEUED_REPLY =
  "We're sending a lot of email right now, so your confirmation is in a short queue. " +
  "It goes out on its own, usually within minutes; on the busiest days it can wait until the evening. " +
  "There's nothing else to do.";
export const PUSH_HOUR_REPLY = "That is enough for one hour. Try again later.";
export const PUSH_DAY_REPLY = "New browser alerts are paused for today. Try again tomorrow.";

export const ALERT_TEXT = {
  en: {
    label: (p) =>
      `Email me when DOL changes this ${{ perm: "PERM case", pwd: "prevailing wage request", lca: "LCA", seasonal: "H-2A, H-2B or CW-1 filing" }[p]}'s status`,
    button: "Email me changes",
    note: "No account needed. You confirm by email first, and one click turns it off.",
    emailLanguage: "",
    doneQueued: "Confirm it when it arrives; nothing is sent until you do.",
    doneSent: "Nothing is sent until you confirm.",
    doneRules:
      "No email within 10 minutes? Try again then. A change to a case is emailed at once; other alerts from one day come together in one email.",
    otherEmails: "Other emails",
    added: (n) => ` (${n} added)`,
    newsletter: "The weekly digest, Tuesdays: DOL's queue, visa bulletin moves, USCIS times and new rules.",
    news: "Product news, now and then.",
    optInNote: "Off unless you tick them; the same confirmation covers them.",
    failed: "That didn't go through. Try again in a moment, or check the case on DOL's own status page.",
    dropped: "That didn't go through, which usually means the connection dropped. Try again in a moment.",
    push: {
      summary: "Or a browser notification",
      explain:
        "No email and no account. The browser gives this site an address for itself, not for you, and one notification goes out minutes after the status changes. Turn it off here or in the browser's settings.",
      turnOn: "Notify this browser",
      turnOff: "Stop notifying this browser",
      on: "This browser will be notified when DOL's status changes.",
      off: "This browser will not be notified any more.",
      blocked: "Notifications are blocked for this site in the browser's settings.",
      unsupported: "This browser cannot receive notifications. On an iPhone, add the site to the home screen first.",
      noAnswer: "The browser didn't answer. Reload the page and try once more.",
      failed: "That didn't go through. Try again in a moment.",
      dropped: "That didn't go through, which usually means the connection dropped.",
    },
    digest: { label: "Your email", button: "Send me the digest" },
    replies: {},
  },
  es: {
    label: (p) =>
      `Avíseme por correo cuando el DOL cambie el estado de ${{ perm: "este caso PERM", pwd: "esta solicitud de salario prevaleciente", lca: "esta LCA", seasonal: "esta solicitud H-2A, H-2B o CW-1" }[p]}`,
    button: "Avisarme por correo",
    note: "No necesita cuenta. Primero confirma por correo, y un clic lo desactiva.",
    emailLanguage: "Los correos llegan en inglés.",
    doneQueued: "Confírmelo cuando llegue; no se envía nada hasta que lo haga.",
    doneSent: "No se envía nada hasta que confirme.",
    doneRules:
      "¿No llegó el correo en 10 minutos? Inténtelo de nuevo entonces. Un cambio en un caso se avisa de inmediato; las demás alertas de un mismo día llegan juntas en un solo correo.",
    otherEmails: "Otros correos",
    added: (n) => ` (${n} ${n === 1 ? "añadido" : "añadidos"})`,
    newsletter:
      "El resumen semanal, los martes: la fila del DOL, los movimientos del boletín de visas, los tiempos de USCIS y las normas nuevas (en inglés).",
    news: "Novedades del sitio, de vez en cuando (en inglés).",
    optInNote: "Están desactivados si no los marca; la misma confirmación los cubre.",
    failed: "No se pudo enviar. Inténtelo de nuevo en un momento o consulte el caso en la página de estado del propio DOL.",
    dropped: "No se pudo enviar; por lo general se cortó la conexión. Inténtelo de nuevo en un momento.",
    push: {
      summary: "O una notificación del navegador",
      explain:
        "Sin correo y sin cuenta. El navegador le da a este sitio una dirección propia del navegador, no suya, y llega una notificación minutos después de que cambie el estado. Desactívela aquí o en la configuración del navegador.",
      turnOn: "Notificar a este navegador",
      turnOff: "Dejar de notificar a este navegador",
      on: "Este navegador recibirá una notificación cuando cambie el estado en el DOL.",
      off: "Este navegador ya no recibirá notificaciones.",
      blocked: "Las notificaciones de este sitio están bloqueadas en la configuración del navegador.",
      unsupported: "Este navegador no puede recibir notificaciones. En un iPhone, primero agregue el sitio a la pantalla de inicio.",
      noAnswer: "El navegador no respondió. Vuelva a cargar la página e inténtelo una vez más.",
      failed: "No se pudo enviar. Inténtelo de nuevo en un momento.",
      dropped: "No se pudo enviar; por lo general se cortó la conexión.",
    },
    digest: { label: "Su correo electrónico", button: "Enviarme el resumen" },
    replies: {
      [PUSH_HOUR_REPLY]: "Es suficiente por una hora. Inténtelo más tarde.",
      [PUSH_DAY_REPLY]: "Las nuevas alertas del navegador están en pausa por hoy. Inténtelo mañana.",
      [NEUTRAL_REPLY]: "Revise su bandeja de entrada para confirmar.",
      [BAD_EMAIL_REPLY]: "Esa dirección de correo no parece correcta.",
      [BAD_NUMBER_REPLY]: "Eso no parece un número de caso del DOL (G-, A-, P-, I-, H-, JO-A- o C-).",
      [QUEUED_REPLY]:
        "Estamos enviando muchos correos en este momento, así que su confirmación está en una fila corta. Sale sola, por lo general en minutos; en los días de más movimiento puede esperar hasta la noche. No tiene que hacer nada más.",
    },
  },
  zh: {
    label: (p) =>
      `当劳工部（DOL）更改此${{ perm: " PERM 案件", pwd: "现行工资申请", lca: " LCA", seasonal: " H-2A、H-2B 或 CW-1 申请" }[p]}的状态时，发邮件通知我`,
    button: "有变化时发邮件给我",
    note: "无需注册账户。您先通过邮件确认，点一下即可取消。",
    emailLanguage: "邮件内容为英文。",
    doneQueued: "收到后请确认；确认之前不会发送任何邮件。",
    doneSent: "确认之前不会发送任何邮件。",
    doneRules: "10 分钟内没收到邮件？请再试一次。案件一有变化就会立即发邮件；同一天的其他提醒合并在一封邮件里。",
    otherEmails: "其他邮件",
    added: (n) => `（已添加 ${n} 项）`,
    newsletter: "每周摘要，每周二发送：劳工部的排队进度、签证公告的变动、USCIS 处理时间和新规定（英文）。",
    news: "网站动态，不定期发送（英文）。",
    optInNote: "不勾选就不会发送；同一次确认即可生效。",
    failed: "没有提交成功。请稍后再试，或在劳工部自己的状态查询页面查看案件。",
    dropped: "没有提交成功，通常是网络连接中断了。请稍后再试。",
    push: {
      summary: "或者使用浏览器通知",
      explain:
        "不需要邮箱，也不需要账户。浏览器给本网站的是浏览器自己的地址，而不是您的信息；状态变化几分钟后会收到一条通知。可以在这里或浏览器设置中关闭。",
      turnOn: "通知此浏览器",
      turnOff: "停止通知此浏览器",
      on: "劳工部的状态变化时，此浏览器会收到通知。",
      off: "此浏览器将不再收到通知。",
      blocked: "此网站的通知已在浏览器设置中被屏蔽。",
      unsupported: "此浏览器无法接收通知。如果使用 iPhone，请先把网站添加到主屏幕。",
      noAnswer: "浏览器没有响应。请刷新页面后再试一次。",
      failed: "没有提交成功。请稍后再试。",
      dropped: "没有提交成功，通常是网络连接中断了。",
    },
    digest: { label: "您的邮箱", button: "给我发每周摘要" },
    replies: {
      [PUSH_HOUR_REPLY]: "一小时内的次数已经够多了。请稍后再试。",
      [PUSH_DAY_REPLY]: "今天暂停新增浏览器提醒。请明天再试。",
      [NEUTRAL_REPLY]: "请查看收件箱并确认。",
      [BAD_EMAIL_REPLY]: "这个邮箱地址看起来不对。",
      [BAD_NUMBER_REPLY]: "这看起来不是劳工部的案件编号（G-、A-、P-、I-、H-、JO-A- 或 C-）。",
      [QUEUED_REPLY]:
        "我们现在发送的邮件很多，所以您的确认邮件正在短暂排队。它会自动发出，通常几分钟内送达；最忙的日子可能要等到晚上。您无需再做任何事。",
    },
  },
  "pt-br": {
    label: (p) =>
      `Avise-me por e-mail quando o DOL mudar o status ${{ perm: "deste caso PERM", pwd: "deste pedido de salário prevalecente", lca: "desta LCA", seasonal: "deste pedido H-2A, H-2B ou CW-1" }[p]}`,
    button: "Avisar por e-mail",
    note: "Não precisa de conta. Você confirma por e-mail primeiro, e um clique desativa.",
    emailLanguage: "Os e-mails chegam em inglês.",
    doneQueued: "Confirme quando chegar; nada é enviado até você confirmar.",
    doneSent: "Nada é enviado até você confirmar.",
    doneRules:
      "Nenhum e-mail em 10 minutos? Tente de novo então. Uma mudança no caso é avisada na hora; os outros alertas do mesmo dia chegam juntos em um só e-mail.",
    otherEmails: "Outros e-mails",
    added: (n) => ` (${n} ${n === 1 ? "adicionado" : "adicionados"})`,
    newsletter:
      "O resumo semanal, às terças: a fila do DOL, as mudanças do boletim de vistos, os prazos do USCIS e as novas regras (em inglês).",
    news: "Novidades do site, de vez em quando (em inglês).",
    optInNote: "Ficam desligados se você não marcar; a mesma confirmação vale para eles.",
    failed: "Não foi enviado. Tente de novo em instantes ou consulte o caso na página de status do próprio DOL.",
    dropped: "Não foi enviado; em geral a conexão caiu. Tente de novo em instantes.",
    push: {
      summary: "Ou uma notificação do navegador",
      explain:
        "Sem e-mail e sem conta. O navegador dá a este site um endereço do próprio navegador, não seu, e uma notificação chega minutos depois que o status muda. Desative aqui ou nas configurações do navegador.",
      turnOn: "Notificar este navegador",
      turnOff: "Parar de notificar este navegador",
      on: "Este navegador será notificado quando o status mudar no DOL.",
      off: "Este navegador não será mais notificado.",
      blocked: "As notificações deste site estão bloqueadas nas configurações do navegador.",
      unsupported: "Este navegador não recebe notificações. No iPhone, adicione o site à tela de início primeiro.",
      noAnswer: "O navegador não respondeu. Recarregue a página e tente mais uma vez.",
      failed: "Não foi enviado. Tente de novo em instantes.",
      dropped: "Não foi enviado; em geral a conexão caiu.",
    },
    digest: { label: "Seu e-mail", button: "Quero o resumo" },
    replies: {
      [PUSH_HOUR_REPLY]: "Já chega por uma hora. Tente mais tarde.",
      [PUSH_DAY_REPLY]: "Novos alertas do navegador estão pausados por hoje. Tente amanhã.",
      [NEUTRAL_REPLY]: "Veja sua caixa de entrada para confirmar.",
      [BAD_EMAIL_REPLY]: "Esse endereço de e-mail não parece correto.",
      [BAD_NUMBER_REPLY]: "Isso não parece um número de caso do DOL (G-, A-, P-, I-, H-, JO-A- ou C-).",
      [QUEUED_REPLY]:
        "Estamos enviando muitos e-mails agora, então sua confirmação está em uma fila curta. Ela sai sozinha, em geral em minutos; nos dias mais movimentados pode esperar até a noite. Não precisa fazer mais nada.",
    },
  },
  ko: {
    label: (p) =>
      `노동부(DOL)가 이 ${{ perm: "PERM 케이스", pwd: "적정 임금 신청", lca: "LCA", seasonal: "H-2A, H-2B 또는 CW-1 신청" }[p]}의 상태를 바꾸면 이메일로 알려 주세요`,
    button: "변경 시 이메일 받기",
    note: "계정이 필요 없습니다. 먼저 이메일로 확인하고, 클릭 한 번으로 끌 수 있습니다.",
    emailLanguage: "이메일은 영어로 옵니다.",
    doneQueued: "도착하면 확인해 주세요. 확인하기 전에는 아무것도 보내지 않습니다.",
    doneSent: "확인하기 전에는 아무것도 보내지 않습니다.",
    doneRules:
      "10분 안에 이메일이 오지 않았나요? 그때 다시 시도해 주세요. 케이스가 바뀌면 바로 이메일을 보내고, 같은 날의 다른 알림은 한 통으로 모아 보냅니다.",
    otherEmails: "다른 이메일",
    added: (n) => ` (${n}개 추가됨)`,
    newsletter: "주간 요약, 매주 화요일: 노동부 대기열, 비자 공보 변동, USCIS 처리 기간과 새 규정(영어).",
    news: "사이트 소식, 가끔(영어).",
    optInNote: "체크하지 않으면 받지 않습니다. 같은 확인으로 함께 적용됩니다.",
    failed: "전송되지 않았습니다. 잠시 후 다시 시도하거나 노동부의 상태 조회 페이지에서 케이스를 확인해 주세요.",
    dropped: "전송되지 않았습니다. 보통 연결이 끊긴 경우입니다. 잠시 후 다시 시도해 주세요.",
    push: {
      summary: "또는 브라우저 알림",
      explain:
        "이메일도 계정도 필요 없습니다. 브라우저는 이 사이트에 사용자가 아닌 브라우저 자체의 주소를 주고, 상태가 바뀌고 몇 분 뒤 알림이 하나 옵니다. 여기나 브라우저 설정에서 끌 수 있습니다.",
      turnOn: "이 브라우저에 알림",
      turnOff: "이 브라우저 알림 중지",
      on: "노동부의 상태가 바뀌면 이 브라우저에 알림이 옵니다.",
      off: "이 브라우저에는 더 이상 알림이 오지 않습니다.",
      blocked: "이 사이트의 알림이 브라우저 설정에서 차단되어 있습니다.",
      unsupported: "이 브라우저는 알림을 받을 수 없습니다. iPhone에서는 먼저 사이트를 홈 화면에 추가해 주세요.",
      noAnswer: "브라우저가 응답하지 않았습니다. 페이지를 새로 고친 뒤 한 번 더 시도해 주세요.",
      failed: "전송되지 않았습니다. 잠시 후 다시 시도해 주세요.",
      dropped: "전송되지 않았습니다. 보통 연결이 끊긴 경우입니다.",
    },
    digest: { label: "이메일 주소", button: "주간 요약 받기" },
    replies: {
      [PUSH_HOUR_REPLY]: "한 시간 동안은 여기까지입니다. 나중에 다시 시도해 주세요.",
      [PUSH_DAY_REPLY]: "오늘은 새 브라우저 알림을 잠시 멈췄습니다. 내일 다시 시도해 주세요.",
      [NEUTRAL_REPLY]: "받은편지함에서 확인해 주세요.",
      [BAD_EMAIL_REPLY]: "이메일 주소가 올바르지 않은 것 같습니다.",
      [BAD_NUMBER_REPLY]: "노동부 케이스 번호가 아닌 것 같습니다(G-, A-, P-, I-, H-, JO-A- 또는 C-).",
      [QUEUED_REPLY]:
        "지금 이메일을 많이 보내고 있어 확인 메일이 잠시 대기 중입니다. 보통 몇 분 안에 저절로 발송되며, 가장 바쁜 날에는 저녁까지 걸릴 수 있습니다. 더 하실 일은 없습니다.",
    },
  },
  vi: {
    label: (p) =>
      `Gửi email cho tôi khi DOL thay đổi trạng thái của ${{ perm: "hồ sơ PERM này", pwd: "đơn xin mức lương hiện hành này", lca: "LCA này", seasonal: "đơn H-2A, H-2B hoặc CW-1 này" }[p]}`,
    button: "Gửi email khi có thay đổi",
    note: "Không cần tài khoản. Bạn xác nhận qua email trước, và một cú nhấp là tắt.",
    emailLanguage: "Email được gửi bằng tiếng Anh.",
    doneQueued: "Hãy xác nhận khi email đến; không có gì được gửi cho đến khi bạn xác nhận.",
    doneSent: "Không có gì được gửi cho đến khi bạn xác nhận.",
    doneRules:
      "Sau 10 phút vẫn chưa có email? Hãy thử lại lúc đó. Thay đổi của hồ sơ được báo ngay; các thông báo khác trong cùng một ngày được gộp vào một email.",
    otherEmails: "Email khác",
    added: (n) => ` (đã thêm ${n})`,
    newsletter:
      "Bản tóm tắt hằng tuần, vào thứ Ba: hàng chờ của DOL, thay đổi trong bản tin thị thực, thời gian xử lý của USCIS và quy định mới (bằng tiếng Anh).",
    news: "Tin tức của trang, thỉnh thoảng (bằng tiếng Anh).",
    optInNote: "Không đánh dấu thì không nhận; cùng một lần xác nhận áp dụng cho cả hai.",
    failed: "Chưa gửi được. Hãy thử lại sau giây lát, hoặc xem hồ sơ trên trang tra cứu trạng thái của chính DOL.",
    dropped: "Chưa gửi được, thường là do mất kết nối. Hãy thử lại sau giây lát.",
    push: {
      summary: "Hoặc thông báo trên trình duyệt",
      explain:
        "Không cần email, không cần tài khoản. Trình duyệt đưa cho trang này một địa chỉ của chính trình duyệt, không phải của bạn, và một thông báo đến vài phút sau khi trạng thái thay đổi. Tắt tại đây hoặc trong cài đặt của trình duyệt.",
      turnOn: "Thông báo cho trình duyệt này",
      turnOff: "Ngừng thông báo cho trình duyệt này",
      on: "Trình duyệt này sẽ nhận thông báo khi trạng thái trên DOL thay đổi.",
      off: "Trình duyệt này sẽ không nhận thông báo nữa.",
      blocked: "Thông báo của trang này đang bị chặn trong cài đặt của trình duyệt.",
      unsupported: "Trình duyệt này không nhận được thông báo. Trên iPhone, hãy thêm trang vào màn hình chính trước.",
      noAnswer: "Trình duyệt không phản hồi. Hãy tải lại trang và thử thêm một lần.",
      failed: "Chưa gửi được. Hãy thử lại sau giây lát.",
      dropped: "Chưa gửi được, thường là do mất kết nối.",
    },
    digest: { label: "Email của bạn", button: "Gửi bản tóm tắt cho tôi" },
    replies: {
      [PUSH_HOUR_REPLY]: "Đã đủ cho một giờ. Hãy thử lại sau.",
      [PUSH_DAY_REPLY]: "Hôm nay tạm dừng nhận thông báo trình duyệt mới. Hãy thử lại vào ngày mai.",
      [NEUTRAL_REPLY]: "Hãy kiểm tra hộp thư để xác nhận.",
      [BAD_EMAIL_REPLY]: "Địa chỉ email này có vẻ không đúng.",
      [BAD_NUMBER_REPLY]: "Đây có vẻ không phải số hồ sơ của DOL (G-, A-, P-, I-, H-, JO-A- hoặc C-).",
      [QUEUED_REPLY]:
        "Hiện chúng tôi đang gửi rất nhiều email, nên email xác nhận của bạn đang chờ trong một hàng ngắn. Email sẽ tự gửi đi, thường trong vài phút; vào những ngày bận nhất có thể đợi đến tối. Bạn không cần làm gì thêm.",
    },
  },
} satisfies Messages<AlertText>;

/** A server reply in the reader's language: a known fixed reply translated, anything else as the server wrote it. */
export function serverReply(lang: Lang, message: string): string {
  const replies: Record<string, string> = ALERT_TEXT[lang].replies;
  return replies[message] ?? message;
}
