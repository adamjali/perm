import { ALERT_LANES } from "@/components/marketing/PageFigures";
import type { Messages } from "@/lib/i18n/lang";
import { ACCOUNT_KINDS, MAIL_KINDS, MAIL_RULES, SUBSCRIBER_KINDS, type MailKindId } from "@/lib/mailKinds";

/**
 * The email preferences page's words in every language it's published in. English reads the shared list of
 * emails (convex/lib/mailKinds.ts), so the page can't call a kind one thing and Settings another; the other
 * languages translate that list here, one entry per kind, and the type makes a missing one an error. A link to
 * a page that exists only in English says so in its label.
 */

export interface KindText {
  name: string;
  what: string;
  when: string;
  start: string;
}

export interface PrefsPageText {
  metaTitle: string;
  metaDescription: string;
  ogDescription: string;
  h1: string;
  intro: string;
  /** Under the form on a translated page: the link's page and its emails are in English. */
  emailLanguage: string;
  lanesLabel: string;
  lanes: readonly [string, string, string, string];
  caption: string;
  rules: readonly { title: string; body: string }[];
  kindsHeading: string;
  noAccount: string;
  withAccount: string;
  signedIn: { before: string; link: string; after: string };
  kinds: Record<MailKindId, KindText>;
}

const ENGLISH_KINDS = Object.fromEntries(
  [...SUBSCRIBER_KINDS, ...ACCOUNT_KINDS].map((id) => {
    const k = MAIL_KINDS[id];
    return [id, { name: k.name, what: k.what, when: k.when, start: k.start.label }];
  }),
) as Record<MailKindId, KindText>;

export const PREFS_PAGE = {
  en: {
    metaTitle: "Email Preferences",
    metaDescription:
      "See everything PERM Tracker emails you, from case and queue alerts to the weekly digest, and turn any of it off with one link.",
    ogDescription: "One link to see and stop everything PERM Tracker emails you.",
    h1: "Your email, in one place",
    intro: "See everything PERM Tracker sends you, and turn any of it off.",
    emailLanguage: "",
    lanesLabel: "Four kinds of change on the federal record, each sending one email",
    lanes: ALERT_LANES,
    caption: "One email per change. Nothing while nothing changes.",
    rules: MAIL_RULES,
    kindsHeading: "What you can get",
    noAccount: "No account needed",
    withAccount: "With an account",
    signedIn: { before: "Signed in? Everything sent to your address, alerts included, is in", link: "notification settings", after: "." },
    kinds: ENGLISH_KINDS,
  },
  es: {
    metaTitle: "Preferencias de correo",
    metaDescription:
      "Vea todo lo que PERM Tracker le envía, de las alertas de casos y de la fila al resumen semanal, y cancele cualquier envío con un enlace.",
    ogDescription: "Un enlace para ver y detener todo lo que PERM Tracker le envía.",
    h1: "Su correo, en un solo lugar",
    intro: "Vea todo lo que PERM Tracker le envía y cancele lo que quiera.",
    emailLanguage: "El correo y la página que abre el enlace están en inglés.",
    lanesLabel: "Cuatro tipos de cambio en el registro federal; cada uno envía un correo",
    lanes: [
      "Cambia el estado de un caso",
      "La fila del DOL llega a su mes",
      "Se mueve su fecha límite del boletín",
      "El DOL mueve los casos de un empleador",
    ],
    caption: "Un correo por cada cambio. Nada mientras nada cambia.",
    rules: [
      { title: "Usted confirma primero", body: "No se envía nada hasta que haga clic en el enlace del correo de confirmación." },
      { title: "Los cambios de un caso llegan al momento", body: "Las demás alertas del mismo día llegan juntas, en un correo." },
      { title: "Se cancela con un clic", body: "Cada correo trae un enlace a esta página, y cancelar nunca pide contraseña." },
    ],
    kindsHeading: "Lo que puede recibir",
    noAccount: "Sin cuenta",
    withAccount: "Con una cuenta",
    signedIn: {
      before: "¿Inició sesión? Todo lo que se envía a su dirección, alertas incluidas, está en",
      link: "los ajustes de notificaciones (en inglés)",
      after: ".",
    },
    kinds: {
      case: {
        name: "Alertas de estado del caso",
        what: "Cuando el DOL cambia el estado de un caso que usted sigue, y durante un año después de la decisión, por si hay una apelación o una revocación.",
        when: "Cuando cambia",
        start: "Consultar un caso",
      },
      queue: {
        name: "Alertas de la fila",
        what: "Un correo el día en que la fila del DOL llega a su mes de presentación.",
        when: "Una vez",
        start: "Tiempos de procesamiento (en inglés)",
      },
      bulletin: {
        name: "Alertas del boletín de visas",
        what: "Cuando se mueve en un nuevo boletín la fecha límite que usted sigue.",
        when: "Cuando se mueve",
        start: "Calculadora de fecha de prioridad (en inglés)",
      },
      employer: {
        name: "Alertas de empleadores",
        what: "Cuando el DOL mueve en grupo los casos de un empleador: suspensiones, liberaciones y grandes tandas de decisiones.",
        when: "Cuando ocurre",
        start: "La página de cualquier empleador (en inglés)",
      },
      newsletter: {
        name: "Resumen semanal",
        what: "La fila del DOL, los movimientos del boletín de visas, los tiempos de USCIS y las nuevas normas, en un correo (en inglés).",
        when: "Los martes",
        start: "Suscribirse al resumen",
      },
      news: {
        name: "Novedades del sitio",
        what: "Notas ocasionales sobre nuevos datos y herramientas (en inglés).",
        when: "De vez en cuando",
        start: "Una casilla en cualquier formulario de alerta",
      },
      reminders: {
        name: "Recordatorios de plazos",
        what: "Los plazos de sus casos antes de que venzan, reunidos en un correo al día.",
        when: "Antes de un plazo",
        start: "Ajustes de notificaciones (en inglés)",
      },
      updates: {
        name: "Novedades de casos",
        what: "Cuando un caso de su cuenta cambia de estado o recibe un RFI o un RFE.",
        when: "Cuando cambia",
        start: "Ajustes de notificaciones (en inglés)",
      },
      digest: {
        name: "Resumen semanal de casos",
        what: "Toda su cartera: lo vencido, lo que vence esta semana y lo que cambió. Solo se envía en una semana con cambios.",
        when: "Los lunes",
        start: "Ajustes de notificaciones (en inglés)",
      },
    },
  },
  zh: {
    metaTitle: "邮件偏好",
    metaDescription: "查看 PERM Tracker 发给您的全部邮件，从案件和排队提醒到每周摘要，用一个链接就能取消任何一项。",
    ogDescription: "用一个链接查看并停止 PERM Tracker 发给您的全部邮件。",
    h1: "您的邮件，集中在一处",
    intro: "查看 PERM Tracker 发给您的全部内容，随时取消任何一项。",
    emailLanguage: "邮件和链接打开的页面为英文。",
    lanesLabel: "联邦记录上的四种变化，每种发送一封邮件",
    lanes: ["案件状态变化", "劳工部的排队到达您的月份", "您的签证公告排期移动", "劳工部成批处理某个雇主的案件"],
    caption: "每次变化一封邮件。没有变化就不发。",
    rules: [
      { title: "先由您确认", body: "点击确认邮件里的链接之前，不会发送任何内容。" },
      { title: "案件变化立即发送", body: "同一天的其他提醒合并成一封邮件。" },
      { title: "一键取消", body: "每封邮件都有链接通往这里，取消从不需要密码。" },
    ],
    kindsHeading: "您可以收到的邮件",
    noAccount: "无需账户",
    withAccount: "需要账户",
    signedIn: { before: "已登录？发到您邮箱的全部内容，包括提醒，都在", link: "通知设置（英文页面）", after: "中。" },
    kinds: {
      case: {
        name: "案件状态提醒",
        what: "劳工部更改您关注的案件状态时通知您；案件裁定后再关注一年，以防上诉或改判。",
        when: "状态变化时",
        start: "查询案件",
      },
      queue: {
        name: "排队提醒",
        what: "劳工部的排队处理到您的递交月份那天，发一封邮件。",
        when: "一次",
        start: "处理时间（英文页面）",
      },
      bulletin: {
        name: "签证公告提醒",
        what: "新一期签证公告移动您关注的排期日期时通知您。",
        when: "排期移动时",
        start: "优先日期计算器（英文页面）",
      },
      employer: {
        name: "雇主提醒",
        what: "劳工部成批处理某个雇主的案件时通知您：暂停、放行和大批裁定。",
        when: "发生时",
        start: "任何雇主的页面（英文页面）",
      },
      newsletter: {
        name: "每周摘要",
        what: "劳工部的排队进度、签证公告的变动、USCIS 处理时间和新规定，合在一封邮件里（英文）。",
        when: "每周二",
        start: "订阅每周摘要",
      },
      news: {
        name: "网站动态",
        what: "不定期介绍新数据和新工具（英文）。",
        when: "不定期",
        start: "任何提醒表单上的一个勾选框",
      },
      reminders: {
        name: "截止日期提醒",
        what: "在您的案件截止日期之前提醒，每天合并成一封邮件。",
        when: "截止日期之前",
        start: "通知设置（英文页面）",
      },
      updates: {
        name: "案件更新",
        what: "您账户里的案件状态变化或收到 RFI、RFE 时通知您。",
        when: "状态变化时",
        start: "通知设置（英文页面）",
      },
      digest: {
        name: "每周案件汇总",
        what: "您的全部案件：已逾期的、本周到期的和有变化的。只在有变化的那一周发送。",
        when: "每周一",
        start: "通知设置（英文页面）",
      },
    },
  },
  "pt-br": {
    metaTitle: "Preferências de e-mail",
    metaDescription:
      "Veja tudo o que o PERM Tracker envia para você, de alertas de casos e da fila ao resumo semanal, e cancele qualquer envio com um link.",
    ogDescription: "Um link para ver e parar tudo o que o PERM Tracker envia para você.",
    h1: "Seus e-mails, em um só lugar",
    intro: "Veja tudo o que o PERM Tracker envia para você e cancele o que quiser.",
    emailLanguage: "O e-mail e a página que o link abre estão em inglês.",
    lanesLabel: "Quatro tipos de mudança no registro federal; cada um envia um e-mail",
    lanes: [
      "O status de um caso muda",
      "A fila do DOL chega ao seu mês",
      "Sua data de corte do boletim se move",
      "O DOL move os casos de um empregador",
    ],
    caption: "Um e-mail por mudança. Nada enquanto nada muda.",
    rules: [
      { title: "Você confirma primeiro", body: "Nada é enviado até você clicar no link do e-mail de confirmação." },
      { title: "Mudanças no caso chegam na hora", body: "Os outros alertas do mesmo dia chegam juntos, em um e-mail." },
      { title: "Cancela com um clique", body: "Todo e-mail traz um link para esta página, e cancelar nunca pede senha." },
    ],
    kindsHeading: "O que você pode receber",
    noAccount: "Sem conta",
    withAccount: "Com uma conta",
    signedIn: {
      before: "Entrou na sua conta? Tudo o que é enviado ao seu endereço, inclusive os alertas, está em",
      link: "configurações de notificação (em inglês)",
      after: ".",
    },
    kinds: {
      case: {
        name: "Alertas de status do caso",
        what: "Quando o DOL muda o status de um caso que você acompanha, e por um ano depois da decisão, caso haja recurso ou reversão.",
        when: "Quando muda",
        start: "Consultar um caso",
      },
      queue: {
        name: "Alertas da fila",
        what: "Um e-mail no dia em que a fila do DOL chega ao seu mês de apresentação.",
        when: "Uma vez",
        start: "Tempos de processamento (em inglês)",
      },
      bulletin: {
        name: "Alertas do boletim de vistos",
        what: "Quando a data de corte que você acompanha se move em um novo boletim.",
        when: "Quando se move",
        start: "Calculadora de data de prioridade (em inglês)",
      },
      employer: {
        name: "Alertas de empregadores",
        what: "Quando o DOL move em grupo os casos de um empregador: suspensões, liberações e grandes lotes de decisões.",
        when: "Quando acontece",
        start: "A página de qualquer empregador (em inglês)",
      },
      newsletter: {
        name: "Resumo semanal",
        what: "A fila do DOL, os movimentos do boletim de vistos, os tempos da USCIS e as novas regras, em um e-mail (em inglês).",
        when: "Às terças",
        start: "Assinar o resumo",
      },
      news: {
        name: "Novidades do site",
        what: "Notas ocasionais sobre novos dados e ferramentas (em inglês).",
        when: "De vez em quando",
        start: "Uma caixa em qualquer formulário de alerta",
      },
      reminders: {
        name: "Lembretes de prazos",
        what: "Os prazos dos seus casos antes do vencimento, reunidos em um e-mail por dia.",
        when: "Antes de um prazo",
        start: "Configurações de notificação (em inglês)",
      },
      updates: {
        name: "Atualizações de casos",
        what: "Quando um caso da sua conta muda de status ou recebe um RFI ou um RFE.",
        when: "Quando muda",
        start: "Configurações de notificação (em inglês)",
      },
      digest: {
        name: "Resumo semanal dos casos",
        what: "Toda a sua carteira: o que está vencido, o que vence nesta semana e o que mudou. Enviado só nas semanas com mudanças.",
        when: "Às segundas",
        start: "Configurações de notificação (em inglês)",
      },
    },
  },
  ko: {
    metaTitle: "이메일 설정",
    metaDescription:
      "PERM Tracker가 보내는 모든 이메일을 확인하세요. 케이스와 대기열 알림부터 주간 요약까지, 링크 하나로 무엇이든 끌 수 있습니다.",
    ogDescription: "PERM Tracker가 보내는 모든 이메일을 링크 하나로 확인하고 중지하세요.",
    h1: "내 이메일을 한곳에서",
    intro: "PERM Tracker가 보내는 모든 것을 확인하고 원하는 것을 끄세요.",
    emailLanguage: "이메일과 링크가 여는 페이지는 영문입니다.",
    lanesLabel: "연방 기록의 네 가지 변경, 각각 이메일 한 통",
    lanes: ["케이스 상태가 바뀜", "DOL 대기열이 내 달에 도달", "공보 컷오프 날짜가 움직임", "DOL이 고용주의 케이스를 묶어 처리"],
    caption: "변경마다 이메일 한 통. 변경이 없으면 보내지 않습니다.",
    rules: [
      { title: "먼저 확인합니다", body: "확인 이메일의 링크를 누르기 전에는 아무것도 보내지 않습니다." },
      { title: "케이스 변경은 바로 보냅니다", body: "같은 날의 다른 알림은 이메일 한 통으로 함께 보냅니다." },
      { title: "클릭 한 번으로 해지", body: "모든 이메일에 이 페이지 링크가 있고, 해지에 비밀번호가 필요 없습니다." },
    ],
    kindsHeading: "받을 수 있는 이메일",
    noAccount: "계정 없이",
    withAccount: "계정이 있으면",
    signedIn: { before: "로그인하셨나요? 알림을 포함해 내 주소로 가는 모든 것은", link: "알림 설정 (영문 페이지)", after: "에 있습니다." },
    kinds: {
      case: {
        name: "케이스 상태 알림",
        what: "구독한 케이스의 상태를 DOL이 바꿀 때, 그리고 결정 후 1년 동안 이의 신청이나 번복에 대비해 알려 드립니다.",
        when: "변경될 때",
        start: "케이스 조회",
      },
      queue: {
        name: "대기열 알림",
        what: "DOL 대기열이 제출 월에 도달한 날 이메일 한 통을 보냅니다.",
        when: "한 번",
        start: "처리 기간 (영문 페이지)",
      },
      bulletin: {
        name: "비자 공보 알림",
        what: "새 공보에서 구독한 컷오프 날짜가 움직이면 알려 드립니다.",
        when: "움직일 때",
        start: "우선일 계산기 (영문 페이지)",
      },
      employer: {
        name: "고용주 알림",
        what: "DOL이 한 고용주의 케이스를 묶어서 처리할 때 알려 드립니다: 보류, 해제, 대량 결정.",
        when: "있을 때",
        start: "아무 고용주 페이지 (영문 페이지)",
      },
      newsletter: {
        name: "주간 요약",
        what: "DOL 대기열, 비자 공보 변동, USCIS 처리 기간, 새 규정을 이메일 한 통으로 보냅니다 (영문).",
        when: "매주 화요일",
        start: "주간 요약 신청",
      },
      news: {
        name: "사이트 소식",
        what: "새 데이터와 도구에 관한 소식을 가끔 보냅니다 (영문).",
        when: "가끔",
        start: "아무 알림 양식의 확인란",
      },
      reminders: {
        name: "마감일 알림",
        what: "케이스 마감일 전에 알려 드리며, 하루 한 통으로 모아서 보냅니다.",
        when: "마감일 전",
        start: "알림 설정 (영문 페이지)",
      },
      updates: {
        name: "케이스 업데이트",
        what: "계정의 케이스 상태가 바뀌거나 RFI 또는 RFE를 받으면 알려 드립니다.",
        when: "변경될 때",
        start: "알림 설정 (영문 페이지)",
      },
      digest: {
        name: "주간 케이스 요약",
        what: "전체 케이스: 기한이 지난 것, 이번 주 마감, 바뀐 것. 변경이 있는 주에만 보냅니다.",
        when: "매주 월요일",
        start: "알림 설정 (영문 페이지)",
      },
    },
  },
  vi: {
    metaTitle: "Tùy chọn email",
    metaDescription:
      "Xem mọi email PERM Tracker gửi cho bạn, từ thông báo hồ sơ và hàng chờ đến bản tóm tắt hằng tuần, và tắt bất kỳ email nào bằng một liên kết.",
    ogDescription: "Một liên kết để xem và dừng mọi email PERM Tracker gửi cho bạn.",
    h1: "Email của bạn, ở một nơi",
    intro: "Xem mọi thứ PERM Tracker gửi cho bạn và tắt bất kỳ mục nào.",
    emailLanguage: "Email và trang mà liên kết mở ra đều bằng tiếng Anh.",
    lanesLabel: "Bốn loại thay đổi trong hồ sơ liên bang, mỗi loại gửi một email",
    lanes: [
      "Tình trạng hồ sơ thay đổi",
      "Hàng chờ của DOL đến tháng của bạn",
      "Ngày chốt trong bản tin thay đổi",
      "DOL xử lý hồ sơ của một nhà tuyển dụng",
    ],
    caption: "Mỗi thay đổi một email. Không có thay đổi thì không gửi.",
    rules: [
      { title: "Bạn xác nhận trước", body: "Không gửi gì cho đến khi bạn bấm vào liên kết trong email xác nhận." },
      { title: "Thay đổi hồ sơ được gửi ngay", body: "Các thông báo khác trong cùng ngày được gộp lại thành một email." },
      { title: "Tắt bằng một cú nhấp", body: "Mọi email đều có liên kết về trang này, và việc tắt không bao giờ cần mật khẩu." },
    ],
    kindsHeading: "Những gì bạn có thể nhận",
    noAccount: "Không cần tài khoản",
    withAccount: "Có tài khoản",
    signedIn: {
      before: "Đã đăng nhập? Mọi thứ gửi đến địa chỉ của bạn, kể cả thông báo, đều nằm trong",
      link: "cài đặt thông báo (trang tiếng Anh)",
      after: ".",
    },
    kinds: {
      case: {
        name: "Thông báo tình trạng hồ sơ",
        what: "Khi DOL thay đổi tình trạng của hồ sơ bạn theo dõi, và trong một năm sau khi có quyết định, phòng trường hợp kháng cáo hoặc đảo ngược.",
        when: "Khi thay đổi",
        start: "Tra cứu hồ sơ",
      },
      queue: {
        name: "Thông báo hàng chờ",
        what: "Một email vào ngày hàng chờ của DOL đến tháng nộp hồ sơ của bạn.",
        when: "Một lần",
        start: "Thời gian xử lý (trang tiếng Anh)",
      },
      bulletin: {
        name: "Thông báo bản tin thị thực",
        what: "Khi ngày chốt bạn theo dõi thay đổi trong bản tin mới.",
        when: "Khi thay đổi",
        start: "Công cụ tính ngày ưu tiên (trang tiếng Anh)",
      },
      employer: {
        name: "Thông báo về nhà tuyển dụng",
        what: "Khi DOL xử lý hồ sơ của một nhà tuyển dụng theo nhóm: tạm giữ, cho tiếp tục và các đợt quyết định lớn.",
        when: "Khi xảy ra",
        start: "Trang của bất kỳ nhà tuyển dụng nào (trang tiếng Anh)",
      },
      newsletter: {
        name: "Bản tóm tắt hằng tuần",
        what: "Hàng chờ của DOL, biến động bản tin thị thực, thời gian xử lý của USCIS và quy định mới, trong một email (tiếng Anh).",
        when: "Thứ Ba",
        start: "Đăng ký bản tóm tắt",
      },
      news: {
        name: "Tin tức trang web",
        what: "Thỉnh thoảng giới thiệu dữ liệu và công cụ mới (tiếng Anh).",
        when: "Thỉnh thoảng",
        start: "Một ô trên bất kỳ biểu mẫu thông báo nào",
      },
      reminders: {
        name: "Nhắc hạn chót",
        what: "Hạn chót của các hồ sơ trước khi đến hạn, gộp lại thành một email mỗi ngày.",
        when: "Trước hạn chót",
        start: "Cài đặt thông báo (trang tiếng Anh)",
      },
      updates: {
        name: "Cập nhật hồ sơ",
        what: "Khi một hồ sơ trong tài khoản thay đổi tình trạng hoặc nhận RFI hay RFE.",
        when: "Khi thay đổi",
        start: "Cài đặt thông báo (trang tiếng Anh)",
      },
      digest: {
        name: "Tóm tắt hồ sơ hằng tuần",
        what: "Toàn bộ hồ sơ: phần quá hạn, phần đến hạn tuần này và phần đã thay đổi. Chỉ gửi trong tuần có thay đổi.",
        when: "Thứ Hai",
        start: "Cài đặt thông báo (trang tiếng Anh)",
      },
    },
  },
} satisfies Messages<PrefsPageText>;
