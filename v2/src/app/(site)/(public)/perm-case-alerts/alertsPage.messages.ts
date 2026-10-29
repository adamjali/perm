import type { Messages } from "@/lib/i18n/lang";

/**
 * /perm-case-alerts in every language it's published in. The forms' own words are in
 * src/components/alerts/*.messages.ts. A link to a page that is only in English says so.
 */
export interface AlertsPageText {
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  already: string;
  alreadyLink: string;
  kinds: Record<"case" | "month" | "wage" | "bulletin" | "employer" | "digest", { title: string; note: string }>;
  navLabel: string;
  caseLede: string;
  caseLabel: string;
  caseButton: string;
  caseNote: string;
  steps: { title: string; body: string }[];
  stepsLabel: string;
  employerLede: string;
  employerBefore: string;
  employerLink: string;
  employerAfter: string;
  digestLede: string;
  faqHeading: string;
  faqs: { q: string; a: string }[];
}

export const ALERTS_PAGE = {
  en: {
    metaTitle: "Free PERM Case Status Alerts by Email",
    metaDescription:
      "Get an email the moment DOL changes your PERM case or wage request, reaches your filing month, or the visa bulletin moves your line. Free, no account.",
    h1: "Get an email when your PERM case changes",
    intro:
      "Free alerts for your case, your filing month, your wage request, the visa bulletin and any employer, and a weekly digest. No account, and one click to stop.",
    already: "Already signed up?",
    alreadyLink: "See and change everything your address gets",
    kinds: {
      case: { title: "Your case", note: "DOL changes its status" },
      month: { title: "Your filing month", note: "DOL reaches it" },
      wage: { title: "Your wage request", note: "DOL reaches its month" },
      bulletin: { title: "The visa bulletin", note: "your line's cutoff moves" },
      employer: { title: "An employer", note: "DOL moves its cases as a group" },
      digest: { title: "The weekly digest", note: "one email on Tuesdays" },
    },
    navLabel: "Alerts on this page",
    caseLede: "Enter its number. On the next page, add your email under the answer.",
    caseLabel: "Your case number",
    caseButton: "Next",
    caseNote:
      "Wage request and H-1B LCA numbers work in the same box, and so do H-2A, H-2B and CW-1 numbers. On the case's page you can also have your browser notify you, with no email at all.",
    steps: [
      { title: "Enter your case number", body: "The case page shows DOL's record for it, with an alert form under the answer." },
      { title: "Add your email, and confirm it once", body: "One click in the confirmation email turns the alert on." },
      { title: "Hear the moment it moves", body: "When DOL changes your case's status, the email goes out within minutes." },
    ],
    stepsLabel: "How a case alert works",
    employerLede: "Hear when DOL holds, releases or decides an employer's cases as a group.",
    employerBefore: "Each employer's page has a Follow box.",
    employerLink: "Find the employer",
    employerAfter: ", then follow it from its page.",
    digestLede:
      "Every Tuesday: where DOL's queue stands, what the visa bulletin moved, USCIS's processing times and the rules on their way.",
    faqHeading: "FAQs",
    faqs: [
      { q: "Is it really free?", a: "Yes. Every alert here is free and needs no account: an email address is all it asks for." },
      {
        q: "How quickly will I hear when my PERM case changes?",
        a: "Within minutes on a weekday. A watched case is checked against DOL's record every 5 minutes from 7 AM to 9 PM Eastern on weekdays, and every half hour otherwise, and a status change is emailed at once. DOL emails the employer's attorney itself, so the attorney may still hear first.",
      },
      {
        q: "Will you fill my inbox?",
        a: "No. A status change on your own case goes out at once. Everything else you follow, a filing month, the visa bulletin or an employer, is gathered into at most one email a day.",
      },
      {
        q: "What happens after DOL decides my case?",
        a: "The watch carries on for a year, in case of an appeal or a reversal, then stops by itself. A certification lapsing on its own clock isn't emailed.",
      },
      {
        q: "Can I get just the weekly digest?",
        a: "Yes. Sign up for it on its own at the end of this page. It comes on Tuesdays, and you can add it to any alert too.",
      },
      {
        q: "How do I see everything I've signed up for?",
        a: "The email preferences page sends a link to your address that lists every alert and email it gets, and turns any of them off.",
      },
      {
        q: "How do I stop the emails?",
        a: "Every email has a one-click link that stops it, and a link to a page listing everything your address follows, where each can be turned off.",
      },
    ],
  },
  es: {
    metaTitle: "Alertas gratis del estado de su caso PERM por correo",
    metaDescription:
      "Reciba un correo cuando el DOL cambie su caso PERM o su solicitud de salario, llegue a su mes o el boletín de visas mueva su fecha. Gratis, sin cuenta.",
    h1: "Reciba un correo cuando cambie su caso PERM",
    intro:
      "Alertas gratis para su caso, su mes de presentación, su solicitud de salario prevaleciente, el boletín de visas y cualquier empleador, y un resumen semanal. Sin cuenta, y un clic para dejar de recibirlas.",
    already: "¿Ya se registró?",
    alreadyLink: "Vea y cambie todo lo que recibe su dirección",
    kinds: {
      case: { title: "Su caso", note: "el DOL cambia su estado" },
      month: { title: "Su mes de presentación", note: "el DOL llega a él" },
      wage: { title: "Su solicitud de salario", note: "el DOL llega a su mes" },
      bulletin: { title: "El boletín de visas", note: "se mueve la fecha de su categoría" },
      employer: { title: "Un empleador", note: "el DOL mueve sus casos en grupo" },
      digest: { title: "El resumen semanal", note: "un correo los martes" },
    },
    navLabel: "Alertas en esta página",
    caseLede: "Escriba su número. En la página siguiente, agregue su correo debajo de la respuesta.",
    caseLabel: "Su número de caso",
    caseButton: "Siguiente",
    caseNote:
      "En la misma casilla funcionan los números de solicitudes de salario prevaleciente y de LCA H-1B, y también los de H-2A, H-2B y CW-1. En la página del caso también puede pedir una notificación del navegador, sin correo.",
    steps: [
      { title: "Escriba su número de caso", body: "La página del caso muestra el registro del DOL, con un formulario de alerta debajo de la respuesta." },
      { title: "Agregue su correo y confírmelo una vez", body: "Un clic en el correo de confirmación activa la alerta." },
      { title: "Entérese en cuanto se mueva", body: "Cuando el DOL cambia el estado de su caso, el correo sale en minutos." },
    ],
    stepsLabel: "Cómo funciona una alerta de caso",
    employerLede: "Entérese cuando el DOL detenga, libere o decida en grupo los casos de un empleador.",
    employerBefore: "La página de cada empleador tiene una casilla para seguirlo.",
    employerLink: "Busque el empleador (en inglés)",
    employerAfter: " y sígalo desde su página.",
    digestLede:
      "Cada martes: dónde va la fila del DOL, qué movió el boletín de visas, los tiempos de USCIS y las normas en camino. En inglés.",
    faqHeading: "Preguntas frecuentes",
    faqs: [
      { q: "¿De verdad es gratis?", a: "Sí. Todas las alertas de esta página son gratis y no necesitan cuenta: solo piden una dirección de correo." },
      {
        q: "¿Qué tan rápido sabré si cambia mi caso PERM?",
        a: "En minutos en un día hábil. Un caso vigilado se compara con el registro del DOL cada 5 minutos de 7 a. m. a 9 p. m., hora del Este, en días hábiles, y cada media hora el resto del tiempo, y un cambio de estado se avisa de inmediato. El DOL le escribe al abogado del empleador directamente, así que el abogado puede enterarse primero.",
      },
      {
        q: "¿Me van a llenar la bandeja de entrada?",
        a: "No. Un cambio de estado en su propio caso sale de inmediato. Todo lo demás que siga, un mes de presentación, el boletín de visas o un empleador, se junta en un solo correo al día como máximo.",
      },
      {
        q: "¿Qué pasa después de que el DOL decida mi caso?",
        a: "La vigilancia sigue un año, por si hay una apelación o un cambio de decisión, y luego se detiene sola. Una certificación que vence por su propio plazo no se avisa.",
      },
      {
        q: "¿Puedo recibir solo el resumen semanal?",
        a: "Sí. Regístrese solo para el resumen al final de esta página. Llega los martes, en inglés, y también puede agregarlo a cualquier alerta.",
      },
      {
        q: "¿Cómo veo todo lo que tengo activado?",
        a: "La página de preferencias de correo envía a su dirección un enlace que muestra cada alerta y correo que recibe, y permite desactivar cualquiera.",
      },
      {
        q: "¿Cómo dejo de recibir los correos?",
        a: "Cada correo tiene un enlace para dejar de recibirlo con un clic, y otro a una página con todo lo que sigue su dirección, donde puede desactivar cada cosa.",
      },
    ],
  },
  zh: {
    metaTitle: "免费 PERM 案件状态邮件提醒",
    metaDescription: "劳工部更改您的 PERM 案件或现行工资申请、处理到您的递交月份，或签证公告移动您的排期时，立即发邮件给您。免费，无需账户。",
    h1: "PERM 案件有变化时，邮件通知您",
    intro: "免费提醒：您的案件、递交月份、现行工资申请、签证公告和任何雇主，还有每周摘要。无需账户，点一下即可取消。",
    already: "已经订阅了？",
    alreadyLink: "查看并修改您的邮箱收到的全部邮件",
    kinds: {
      case: { title: "您的案件", note: "劳工部更改其状态" },
      month: { title: "您的递交月份", note: "劳工部处理到该月" },
      wage: { title: "您的工资申请", note: "劳工部处理到其月份" },
      bulletin: { title: "签证公告", note: "您所在类别的排期移动" },
      employer: { title: "某个雇主", note: "劳工部成批处理其案件" },
      digest: { title: "每周摘要", note: "每周二一封邮件" },
    },
    navLabel: "本页的提醒",
    caseLede: "输入案件编号。在下一页的查询结果下方填写邮箱。",
    caseLabel: "您的案件编号",
    caseButton: "下一步",
    caseNote: "同一个输入框也可以查询现行工资申请和 H-1B LCA 编号，以及 H-2A、H-2B 和 CW-1 编号。在案件页面上，您也可以选择浏览器通知，完全不用邮件。",
    steps: [
      { title: "输入案件编号", body: "案件页面显示劳工部的记录，结果下方有提醒表单。" },
      { title: "填写邮箱并确认一次", body: "在确认邮件中点一下即可开启提醒。" },
      { title: "一有变化立即知道", body: "劳工部更改您的案件状态后，几分钟内就会发出邮件。" },
    ],
    stepsLabel: "案件提醒如何运作",
    employerLede: "劳工部成批暂停、放行或裁定某个雇主的案件时通知您。",
    employerBefore: "每个雇主的页面都有关注选项。",
    employerLink: "查找雇主（英文）",
    employerAfter: "，然后在其页面上关注。",
    digestLede: "每周二：劳工部的排队进度、签证公告的变动、USCIS 的处理时间以及即将出台的规定。邮件为英文。",
    faqHeading: "常见问题",
    faqs: [
      { q: "真的免费吗？", a: "是的。这里的每种提醒都免费，也不需要账户：只需要一个邮箱地址。" },
      {
        q: "我的 PERM 案件有变化，多快能知道？",
        a: "工作日几分钟内。工作日美国东部时间早 7 点到晚 9 点，每 5 分钟对照一次劳工部的记录，其他时间每半小时一次，状态一变就立即发邮件。劳工部会直接通知雇主的律师，所以律师可能仍会先知道。",
      },
      {
        q: "会不会塞满我的收件箱？",
        a: "不会。您自己案件的状态变化会立即发送。您关注的其他内容，例如递交月份、签证公告或雇主，每天最多合并成一封邮件。",
      },
      {
        q: "劳工部裁定我的案件之后会怎样？",
        a: "关注会再持续一年，以防上诉或改判，之后自动停止。认证按自身期限到期不会发邮件。",
      },
      { q: "可以只订阅每周摘要吗？", a: "可以。在本页最后单独订阅。每周二发送，内容为英文，您也可以把它加到任何提醒里。" },
      { q: "怎样查看我订阅的全部内容？", a: "邮件偏好页面会给您的邮箱发送一个链接，列出该邮箱收到的每种提醒和邮件，并可逐项关闭。" },
      { q: "怎样停止接收邮件？", a: "每封邮件都有一键退订的链接，还有一个链接通往列出您邮箱所有关注内容的页面，可以逐项关闭。" },
    ],
  },
  "pt-br": {
    metaTitle: "Alertas grátis do status do seu caso PERM por e-mail",
    metaDescription:
      "Receba um e-mail quando o DOL mudar seu caso PERM ou pedido de salário, chegar ao seu mês ou o boletim de vistos mover sua data. Grátis, sem conta.",
    h1: "Receba um e-mail quando seu caso PERM mudar",
    intro:
      "Alertas grátis para o seu caso, seu mês de protocolo, seu pedido de salário prevalecente, o boletim de vistos e qualquer empregador, e um resumo semanal. Sem conta, e um clique para parar.",
    already: "Já se inscreveu?",
    alreadyLink: "Veja e mude tudo o que seu endereço recebe",
    kinds: {
      case: { title: "Seu caso", note: "o DOL muda o status" },
      month: { title: "Seu mês de protocolo", note: "o DOL chega a ele" },
      wage: { title: "Seu pedido de salário", note: "o DOL chega ao mês dele" },
      bulletin: { title: "O boletim de vistos", note: "a data da sua categoria muda" },
      employer: { title: "Um empregador", note: "o DOL move os casos dele em grupo" },
      digest: { title: "O resumo semanal", note: "um e-mail às terças" },
    },
    navLabel: "Alertas nesta página",
    caseLede: "Digite o número. Na próxima página, coloque seu e-mail abaixo da resposta.",
    caseLabel: "Número do seu caso",
    caseButton: "Próximo",
    caseNote:
      "A mesma caixa aceita números de pedidos de salário prevalecente e de LCA H-1B, e também de H-2A, H-2B e CW-1. Na página do caso, você também pode receber uma notificação do navegador, sem e-mail.",
    steps: [
      { title: "Digite o número do caso", body: "A página do caso mostra o registro do DOL, com um formulário de alerta abaixo da resposta." },
      { title: "Coloque seu e-mail e confirme uma vez", body: "Um clique no e-mail de confirmação ativa o alerta." },
      { title: "Saiba assim que mudar", body: "Quando o DOL muda o status do seu caso, o e-mail sai em minutos." },
    ],
    stepsLabel: "Como funciona um alerta de caso",
    employerLede: "Saiba quando o DOL suspende, libera ou decide os casos de um empregador em grupo.",
    employerBefore: "A página de cada empregador tem uma opção para segui-lo.",
    employerLink: "Encontre o empregador (em inglês)",
    employerAfter: " e siga-o pela página dele.",
    digestLede:
      "Toda terça: onde está a fila do DOL, o que o boletim de vistos mudou, os prazos do USCIS e as regras a caminho. Em inglês.",
    faqHeading: "Perguntas frequentes",
    faqs: [
      { q: "É grátis mesmo?", a: "Sim. Todos os alertas desta página são grátis e não precisam de conta: só pedem um endereço de e-mail." },
      {
        q: "Em quanto tempo vou saber se meu caso PERM mudar?",
        a: "Em minutos, em dia útil. Um caso acompanhado é comparado com o registro do DOL a cada 5 minutos, das 7h às 21h no horário do Leste, em dias úteis, e a cada meia hora no resto do tempo, e uma mudança de status é avisada na hora. O DOL escreve diretamente ao advogado do empregador, então o advogado pode saber antes.",
      },
      {
        q: "Vocês vão encher minha caixa de entrada?",
        a: "Não. Uma mudança de status no seu próprio caso sai na hora. Todo o resto que você acompanha, um mês de protocolo, o boletim de vistos ou um empregador, vem junto em no máximo um e-mail por dia.",
      },
      {
        q: "O que acontece depois que o DOL decide meu caso?",
        a: "O acompanhamento continua por um ano, caso haja recurso ou reversão, e depois para sozinho. Uma certificação que vence pelo próprio prazo não é avisada.",
      },
      {
        q: "Posso receber só o resumo semanal?",
        a: "Pode. Inscreva-se só nele no fim desta página. Ele chega às terças, em inglês, e você também pode juntá-lo a qualquer alerta.",
      },
      {
        q: "Como vejo tudo em que me inscrevi?",
        a: "A página de preferências de e-mail envia ao seu endereço um link que lista cada alerta e e-mail que ele recebe, e desliga qualquer um.",
      },
      {
        q: "Como paro de receber os e-mails?",
        a: "Todo e-mail tem um link para parar com um clique, e outro para uma página com tudo o que seu endereço acompanha, onde cada item pode ser desligado.",
      },
    ],
  },
  ko: {
    metaTitle: "PERM 케이스 상태 무료 이메일 알림",
    metaDescription:
      "노동부가 PERM 케이스나 적정 임금 신청을 바꾸거나, 접수 월에 도달하거나, 비자 공보가 날짜를 옮기면 바로 이메일로 알려 드립니다. 무료, 계정 불필요.",
    h1: "PERM 케이스가 바뀌면 이메일로 알려 드립니다",
    intro: "케이스, 접수 월, 적정 임금 신청, 비자 공보, 원하는 고용주에 대한 무료 알림과 주간 요약. 계정이 필요 없고, 클릭 한 번으로 끌 수 있습니다.",
    already: "이미 신청하셨나요?",
    alreadyLink: "내 주소로 오는 모든 것을 보고 바꾸기",
    kinds: {
      case: { title: "내 케이스", note: "노동부가 상태를 바꾸면" },
      month: { title: "내 접수 월", note: "노동부가 도달하면" },
      wage: { title: "내 임금 신청", note: "노동부가 그 달에 도달하면" },
      bulletin: { title: "비자 공보", note: "내 카테고리 날짜가 움직이면" },
      employer: { title: "고용주", note: "노동부가 케이스를 묶어 처리하면" },
      digest: { title: "주간 요약", note: "매주 화요일 이메일 한 통" },
    },
    navLabel: "이 페이지의 알림",
    caseLede: "번호를 입력하세요. 다음 페이지의 조회 결과 아래에 이메일을 넣으면 됩니다.",
    caseLabel: "케이스 번호",
    caseButton: "다음",
    caseNote:
      "같은 입력란에서 적정 임금 신청과 H-1B LCA 번호, H-2A·H-2B·CW-1 번호도 조회됩니다. 케이스 페이지에서는 이메일 없이 브라우저 알림을 받을 수도 있습니다.",
    steps: [
      { title: "케이스 번호 입력", body: "케이스 페이지에 노동부 기록이 나오고, 결과 아래에 알림 양식이 있습니다." },
      { title: "이메일을 넣고 한 번 확인", body: "확인 이메일에서 한 번 클릭하면 알림이 켜집니다." },
      { title: "바뀌는 즉시 알림", body: "노동부가 케이스 상태를 바꾸면 몇 분 안에 이메일이 갑니다." },
    ],
    stepsLabel: "케이스 알림이 작동하는 방식",
    employerLede: "노동부가 한 고용주의 케이스를 묶어 보류, 해제 또는 결정하면 알려 드립니다.",
    employerBefore: "각 고용주 페이지에 팔로우 상자가 있습니다.",
    employerLink: "고용주 찾기(영어)",
    employerAfter: " 후 그 페이지에서 팔로우하세요.",
    digestLede: "매주 화요일: 노동부 대기열, 비자 공보 변동, USCIS 처리 기간, 준비 중인 규정. 영어로 발송됩니다.",
    faqHeading: "자주 묻는 질문",
    faqs: [
      { q: "정말 무료인가요?", a: "네. 이 페이지의 모든 알림은 무료이고 계정이 필요 없습니다. 이메일 주소만 있으면 됩니다." },
      {
        q: "PERM 케이스가 바뀌면 얼마나 빨리 알 수 있나요?",
        a: "평일에는 몇 분 안에 압니다. 지켜보는 케이스는 평일 미 동부 시간 오전 7시부터 오후 9시까지 5분마다, 그 밖에는 30분마다 노동부 기록과 비교하며, 상태가 바뀌면 바로 이메일을 보냅니다. 노동부가 고용주의 변호사에게 직접 알리므로 변호사가 먼저 알 수도 있습니다.",
      },
      {
        q: "이메일이 너무 많이 오지 않나요?",
        a: "아닙니다. 본인 케이스의 상태 변경은 바로 보내고, 그 밖에 지켜보는 접수 월, 비자 공보, 고용주 소식은 하루 최대 한 통으로 모아 보냅니다.",
      },
      {
        q: "노동부가 케이스를 결정한 뒤에는 어떻게 되나요?",
        a: "항소나 번복에 대비해 1년 동안 계속 지켜본 뒤 저절로 멈춥니다. 인증이 자체 기한으로 만료되는 것은 알리지 않습니다.",
      },
      {
        q: "주간 요약만 받을 수 있나요?",
        a: "네. 이 페이지 맨 아래에서 따로 신청하세요. 매주 화요일 영어로 오며, 어떤 알림에든 함께 추가할 수도 있습니다.",
      },
      {
        q: "신청한 것을 한꺼번에 보려면?",
        a: "이메일 설정 페이지에서 주소로 링크를 보내 드리며, 그 주소가 받는 모든 알림과 이메일이 나오고 무엇이든 끌 수 있습니다.",
      },
      {
        q: "이메일을 그만 받으려면?",
        a: "모든 이메일에 클릭 한 번으로 끄는 링크와, 주소가 지켜보는 모든 것을 모아 둔 페이지 링크가 있어 하나씩 끌 수 있습니다.",
      },
    ],
  },
  vi: {
    metaTitle: "Thông báo miễn phí về tình trạng hồ sơ PERM qua email",
    metaDescription:
      "Nhận email ngay khi DOL thay đổi hồ sơ PERM hoặc đơn xin mức lương, xét đến tháng của bạn, hay bản tin thị thực dời ngày. Miễn phí, không cần tài khoản.",
    h1: "Nhận email khi hồ sơ PERM của bạn thay đổi",
    intro:
      "Thông báo miễn phí cho hồ sơ, tháng nộp, đơn xin mức lương hiện hành, bản tin thị thực và bất kỳ chủ lao động nào, cùng bản tóm tắt hằng tuần. Không cần tài khoản, một cú nhấp là tắt.",
    already: "Đã đăng ký rồi?",
    alreadyLink: "Xem và thay đổi mọi thứ địa chỉ của bạn nhận được",
    kinds: {
      case: { title: "Hồ sơ của bạn", note: "DOL đổi trạng thái" },
      month: { title: "Tháng nộp của bạn", note: "DOL xét đến tháng đó" },
      wage: { title: "Đơn xin mức lương", note: "DOL xét đến tháng của đơn" },
      bulletin: { title: "Bản tin thị thực", note: "ngày khóa sổ diện của bạn thay đổi" },
      employer: { title: "Một chủ lao động", note: "DOL xử lý hồ sơ của họ theo nhóm" },
      digest: { title: "Bản tóm tắt hằng tuần", note: "một email vào thứ Ba" },
    },
    navLabel: "Các thông báo trên trang này",
    caseLede: "Nhập số hồ sơ. Ở trang sau, thêm email bên dưới kết quả.",
    caseLabel: "Số hồ sơ của bạn",
    caseButton: "Tiếp",
    caseNote:
      "Cùng ô này nhận cả số đơn xin mức lương hiện hành và LCA H-1B, lẫn số H-2A, H-2B và CW-1. Trên trang hồ sơ, bạn cũng có thể nhận thông báo trên trình duyệt, không cần email.",
    steps: [
      { title: "Nhập số hồ sơ", body: "Trang hồ sơ hiển thị bản ghi của DOL, có mẫu đăng ký thông báo bên dưới kết quả." },
      { title: "Thêm email và xác nhận một lần", body: "Một cú nhấp trong email xác nhận là bật thông báo." },
      { title: "Biết ngay khi có thay đổi", body: "Khi DOL đổi trạng thái hồ sơ, email được gửi trong vài phút." },
    ],
    stepsLabel: "Cách thông báo hồ sơ hoạt động",
    employerLede: "Biết khi DOL tạm giữ, cho chạy tiếp hoặc quyết định hồ sơ của một chủ lao động theo nhóm.",
    employerBefore: "Trang của mỗi chủ lao động có ô theo dõi.",
    employerLink: "Tìm chủ lao động (tiếng Anh)",
    employerAfter: ", rồi theo dõi từ trang của họ.",
    digestLede:
      "Mỗi thứ Ba: hàng chờ của DOL đến đâu, bản tin thị thực thay đổi gì, thời gian xử lý của USCIS và các quy định sắp ban hành. Bằng tiếng Anh.",
    faqHeading: "Câu hỏi thường gặp",
    faqs: [
      { q: "Có thật sự miễn phí không?", a: "Có. Mọi thông báo ở đây đều miễn phí và không cần tài khoản: chỉ cần một địa chỉ email." },
      {
        q: "Hồ sơ PERM thay đổi thì bao lâu tôi biết?",
        a: "Trong vài phút vào ngày làm việc. Hồ sơ được theo dõi sẽ được so với bản ghi của DOL mỗi 5 phút từ 7 giờ sáng đến 9 giờ tối giờ miền Đông vào ngày làm việc, và mỗi nửa giờ vào lúc khác, và thay đổi trạng thái được báo ngay. DOL tự gửi thư cho luật sư của chủ lao động, nên luật sư vẫn có thể biết trước.",
      },
      {
        q: "Hộp thư của tôi có bị đầy không?",
        a: "Không. Thay đổi trạng thái của chính hồ sơ bạn được gửi ngay. Những thứ khác bạn theo dõi, như tháng nộp, bản tin thị thực hay chủ lao động, được gộp lại thành nhiều nhất một email mỗi ngày.",
      },
      {
        q: "Sau khi DOL quyết định hồ sơ thì sao?",
        a: "Việc theo dõi tiếp tục một năm, phòng khi có kháng cáo hoặc đảo ngược, rồi tự dừng. Chứng nhận hết hạn theo thời hạn riêng thì không báo.",
      },
      {
        q: "Tôi có thể chỉ nhận bản tóm tắt hằng tuần không?",
        a: "Có. Đăng ký riêng ở cuối trang này. Bản tóm tắt đến vào thứ Ba, bằng tiếng Anh, và bạn cũng có thể thêm nó vào bất kỳ thông báo nào.",
      },
      {
        q: "Làm sao xem mọi thứ tôi đã đăng ký?",
        a: "Trang tùy chọn email gửi đến địa chỉ của bạn một đường dẫn liệt kê mọi thông báo và email mà địa chỉ đó nhận, và tắt được bất kỳ mục nào.",
      },
      {
        q: "Làm sao ngừng nhận email?",
        a: "Mỗi email đều có đường dẫn ngừng nhận bằng một cú nhấp, và đường dẫn đến trang liệt kê mọi thứ địa chỉ của bạn đang theo dõi, nơi có thể tắt từng mục.",
      },
    ],
  },
} satisfies Messages<AlertsPageText>;
