/**
 * The words on the pages an emailed link opens: confirm an alert, unsubscribe, a dead link. Five languages, the
 * reader's carried on the link as `?lang=` and read by the HTTP routes (convex/http.ts). English is exactly
 * today's wording. DOL's status words, case numbers and month labels are passed in as printed; the pages escape
 * every value from the database.
 *
 * Onward "what to watch next" offers are shown on the English pages only: they're a secondary nicety, and an
 * English offer under a translated heading would read worse than none.
 *
 * @module convex/lib/mailPageText
 */

import type { MailLang, MailMessages } from "../../src/lib/i18n/mailLang";

export interface MailPageText {
  confirmLabel: string;
  unsubscribeLabel: string;
  prefsButton: string;
  badLink: { title: string; reason: string; next: string };
  /** Reasons a specific confirm/unsubscribe link failed. */
  linkNoLongerValid: string;
  linkExpired: string;
  /** The GET button pages: a title, a sentence, and the confirm button. */
  caseConfirmGet: { title: string; body: string };
  queueConfirmGet: { title: string; body: string };
  bulletinConfirmGet: { title: string; body: string };
  employerConfirmGet: (employer: string) => { title: string; body: string };
  digestConfirmGet: { title: string; body: string };
  /** The POST result pages. `list` is a case or series label passed in, already printed. */
  caseConfirmed: (list: string) => { title: string; body: string };
  caseAlready: (list: string) => { title: string; body: string };
  queueConfirmed: (month: string) => { title: string; body: string };
  queueAlreadyReached: (month: string) => { title: string; body: string };
  bulletinConfirmed: (series: string) => { title: string; body: string };
  employerConfirmed: (employer: string) => { title: string; body: string };
  digestConfirmed: { title: string; body: string };
  /** The unsubscribe GET (a stop button) and POST (done) for each family. */
  caseUnsubGet: { title: string; body: string };
  caseUnsubDone: { title: string; body: string };
  queueUnsubGet: { title: string; body: string };
  queueUnsubDone: { title: string; body: string };
  bulletinUnsubGet: { title: string; body: string };
  bulletinUnsubDone: { title: string; body: string };
  employerUnsubGet: { title: string; body: string };
  employerUnsubDone: { title: string; body: string };
  /** The preference-center one-click-off result. */
  prefsOffDone: { title: string; body: string };
}

export const MAIL_PAGE_TEXT: MailMessages<MailPageText> = {
  en: {
    confirmLabel: "Confirm",
    unsubscribeLabel: "Unsubscribe",
    prefsButton: "Email preferences",
    badLink: {
      title: "This link doesn't work",
      reason: "This link is incomplete or out of date.",
      next: "Ask for a fresh link to your email preferences, or set up the alert again from the site.",
    },
    linkNoLongerValid: "This confirmation link is no longer valid.",
    linkExpired: "This link has expired or was changed.",
    caseConfirmGet: {
      title: "Confirm your case alerts",
      body: "We'll email you when the Department of Labor's status for your case changes, and for a year after it's decided, in case it's appealed or reopened.",
    },
    queueConfirmGet: {
      title: "Confirm your queue alert",
      body: "We'll email you once, on the day the Department of Labor reaches your filing month.",
    },
    bulletinConfirmGet: {
      title: "Confirm your visa bulletin alert",
      body: "We'll email you when the State Department's final-action cutoff for your series moves in a new visa bulletin.",
    },
    employerConfirmGet: (e) => ({
      title: "Confirm your employer alert",
      body: `We'll email you when the Department of Labor moves ${e}'s cases as a group, and never more than once a day.`,
    }),
    digestConfirmGet: {
      title: "Confirm the weekly digest",
      body: "Every Tuesday: where DOL's queue stands, what the visa bulletin moved, USCIS's processing times and the rules on their way.",
    },
    caseConfirmed: (list) => ({
      title: "You're on the list",
      body: `We'll email you when the Department of Labor's status changes for ${list}, each time it moves, and for a year after it's decided.`,
    }),
    caseAlready: (list) => ({
      title: "You're already on the list",
      body: `Nothing more to do: we'll email you when the Department of Labor's status changes for ${list}.`,
    }),
    queueConfirmed: (month) => ({
      title: "You're on the list",
      body: `We'll email you once, on the day the Department of Labor reaches ${month}.`,
    }),
    queueAlreadyReached: (month) => ({
      title: "You're on the list",
      body: `DOL has already reached ${month}. Your alert is on its way now, and that's the only message you'll get.`,
    }),
    bulletinConfirmed: (series) => ({
      title: "You're on the list",
      body: `We'll email you when a new visa bulletin moves the final-action cutoff for ${series}.`,
    }),
    employerConfirmed: (e) => ({
      title: "You're on the list",
      body: `We'll email you when the Department of Labor moves ${e}'s cases as a group, at most once a day.`,
    }),
    digestConfirmed: {
      title: "You're subscribed",
      body: "The next weekly digest comes to this address on Tuesday.",
    },
    caseUnsubGet: {
      title: "Stop your case alerts?",
      body: "You'll stop receiving status alerts for every case this address is watching.",
    },
    caseUnsubDone: {
      title: "You're unsubscribed",
      body: "You won't receive case-status alerts from us. That covers every case this address was watching.",
    },
    queueUnsubGet: {
      title: "Stop your queue alert?",
      body: "You'll stop receiving the alert for the Department of Labor reaching your filing month.",
    },
    queueUnsubDone: {
      title: "You're unsubscribed",
      body: "You won't receive queue alerts from us.",
    },
    bulletinUnsubGet: {
      title: "Stop your visa bulletin alert?",
      body: "You'll stop receiving the alert for your series moving in a new visa bulletin.",
    },
    bulletinUnsubDone: {
      title: "You're unsubscribed",
      body: "You won't receive visa bulletin alerts from us.",
    },
    employerUnsubGet: {
      title: "Stop your employer alert?",
      body: "You'll stop hearing when the Department of Labor moves this employer's cases as a group.",
    },
    employerUnsubDone: {
      title: "You're unsubscribed",
      body: "You won't receive employer alerts from us for this employer.",
    },
    prefsOffDone: {
      title: "Turned off",
      body: "You won't receive this kind of email from us any more. Everything else this address gets is unchanged.",
    },
  },
  es: {
    confirmLabel: "Confirmar",
    unsubscribeLabel: "Darme de baja",
    prefsButton: "Preferencias de correo",
    badLink: {
      title: "Este enlace no funciona",
      reason: "El enlace está incompleto o vencido.",
      next: "Pida un enlace nuevo a sus preferencias de correo, o configure la alerta otra vez desde el sitio.",
    },
    linkNoLongerValid: "Este enlace de confirmación ya no es válido.",
    linkExpired: "Este enlace venció o fue modificado.",
    caseConfirmGet: {
      title: "Confirme sus alertas de caso",
      body: "Le enviaremos un correo cuando cambie el estado de su caso en el Departamento de Trabajo (DOL), y durante un año después de que se decida, por si hay apelación o reapertura.",
    },
    queueConfirmGet: {
      title: "Confirme su alerta de fila",
      body: "Le enviaremos un correo una vez, el día en que el Departamento de Trabajo (DOL) llegue al mes en que se presentó su caso.",
    },
    bulletinConfirmGet: {
      title: "Confirme su alerta del boletín de visas",
      body: "Le enviaremos un correo cuando la fecha de acción final de su categoría se mueva en un boletín de visas nuevo.",
    },
    employerConfirmGet: (e) => ({
      title: "Confirme su alerta de empleador",
      body: `Le enviaremos un correo cuando el Departamento de Trabajo (DOL) mueva los casos de ${e} en grupo, y nunca más de una vez al día.`,
    }),
    digestConfirmGet: {
      title: "Confirme el resumen semanal",
      body: "Cada martes: en qué mes va la fila del DOL, qué movió el boletín de visas, los tiempos de USCIS y las reglas en camino.",
    },
    caseConfirmed: (list) => ({
      title: "Está en la lista",
      body: `Le escribiremos cuando cambie el estado en el Departamento de Trabajo (DOL) de ${list}, cada vez que se mueva, y durante un año después de que se decida.`,
    }),
    caseAlready: (list) => ({
      title: "Ya está en la lista",
      body: `Nada más que hacer: le escribiremos cuando cambie el estado en el DOL de ${list}.`,
    }),
    queueConfirmed: (month) => ({
      title: "Está en la lista",
      body: `Le escribiremos una vez, el día en que el Departamento de Trabajo (DOL) llegue a ${month}.`,
    }),
    queueAlreadyReached: (month) => ({
      title: "Está en la lista",
      body: `El DOL ya llegó a ${month}. Su alerta va en camino ahora, y ese es el único mensaje que recibirá.`,
    }),
    bulletinConfirmed: (series) => ({
      title: "Está en la lista",
      body: `Le escribiremos cuando un boletín de visas nuevo mueva la fecha de acción final de ${series}.`,
    }),
    employerConfirmed: (e) => ({
      title: "Está en la lista",
      body: `Le escribiremos cuando el Departamento de Trabajo (DOL) mueva los casos de ${e} en grupo, a lo más una vez al día.`,
    }),
    digestConfirmed: {
      title: "Está suscrito",
      body: "El próximo resumen semanal llega a esta dirección el martes.",
    },
    caseUnsubGet: {
      title: "¿Dejar de recibir sus alertas de caso?",
      body: "Dejará de recibir alertas de estado de todos los casos que vigila esta dirección.",
    },
    caseUnsubDone: {
      title: "Se dio de baja",
      body: "No recibirá alertas de estado de casos. Esto cubre todos los casos que vigilaba esta dirección.",
    },
    queueUnsubGet: {
      title: "¿Dejar de recibir su alerta de fila?",
      body: "Dejará de recibir la alerta de cuando el Departamento de Trabajo (DOL) llegue a su mes de presentación.",
    },
    queueUnsubDone: {
      title: "Se dio de baja",
      body: "No recibirá alertas de fila.",
    },
    bulletinUnsubGet: {
      title: "¿Dejar de recibir su alerta del boletín de visas?",
      body: "Dejará de recibir la alerta de cuando su categoría se mueva en un boletín de visas nuevo.",
    },
    bulletinUnsubDone: {
      title: "Se dio de baja",
      body: "No recibirá alertas del boletín de visas.",
    },
    employerUnsubGet: {
      title: "¿Dejar de recibir su alerta de empleador?",
      body: "Dejará de recibir aviso de cuando el Departamento de Trabajo (DOL) mueva los casos de este empleador en grupo.",
    },
    employerUnsubDone: {
      title: "Se dio de baja",
      body: "No recibirá alertas de empleador para este empleador.",
    },
    prefsOffDone: {
      title: "Desactivado",
      body: "Ya no recibirá este tipo de correo de nuestra parte. Todo lo demás que recibe esta dirección sigue igual.",
    },
  },
  zh: {
    confirmLabel: "确认",
    unsubscribeLabel: "退订",
    prefsButton: "邮件偏好",
    badLink: {
      title: "此链接无法使用",
      reason: "链接不完整或已过期。",
      next: "请申请一个新的邮件偏好链接，或在网站上重新设置提醒。",
    },
    linkNoLongerValid: "此确认链接已失效。",
    linkExpired: "此链接已过期或被更改。",
    caseConfirmGet: {
      title: "确认您的案件提醒",
      body: "当劳工部（DOL）对您案件的状态发生变化时，我们会发邮件通知您；案件决定后的一年内也会，以防出现上诉或重启。",
    },
    queueConfirmGet: {
      title: "确认您的排队提醒",
      body: "当劳工部（DOL）处理到您案件的递交月份时，我们会发一封邮件通知您。",
    },
    bulletinConfirmGet: {
      title: "确认您的签证公告提醒",
      body: "当新的签证公告改变您类别的最终行动日期时，我们会发邮件通知您。",
    },
    employerConfirmGet: (e) => ({
      title: "确认您的雇主提醒",
      body: `当劳工部（DOL）对 ${e} 的案件进行批量操作时，我们会发邮件通知您，每天最多一次。`,
    }),
    digestConfirmGet: {
      title: "确认每周摘要",
      body: "每周二：劳工部排队进度、签证公告的变动、USCIS 处理时间以及即将出台的规则。",
    },
    caseConfirmed: (list) => ({
      title: "已加入列表",
      body: `当劳工部（DOL）对 ${list} 的状态发生变化时，我们会发邮件通知您，每次变动都通知，并在案件决定后的一年内继续通知。`,
    }),
    caseAlready: (list) => ({
      title: "您已在列表中",
      body: `无需再操作：当劳工部（DOL）对 ${list} 的状态发生变化时，我们会发邮件通知您。`,
    }),
    queueConfirmed: (month) => ({
      title: "已加入列表",
      body: `当劳工部（DOL）处理到 ${month} 时，我们会发一封邮件通知您。`,
    }),
    queueAlreadyReached: (month) => ({
      title: "已为您加入",
      body: `劳工部已经处理到 ${month}。您的提醒正在发送，您只会收到这一封。`,
    }),
    bulletinConfirmed: (series) => ({
      title: "已加入列表",
      body: `当新的签证公告改变 ${series} 的最终行动日期时，我们会发邮件通知您。`,
    }),
    employerConfirmed: (e) => ({
      title: "已加入列表",
      body: `当劳工部（DOL）对 ${e} 的案件进行批量操作时，我们会发邮件通知您，每天最多一次。`,
    }),
    digestConfirmed: {
      title: "已订阅",
      body: "下一期每周摘要将于周二发送到这个邮箱。",
    },
    caseUnsubGet: {
      title: "停止您的案件提醒？",
      body: "您将不再收到这个邮箱所关注的所有案件的状态提醒。",
    },
    caseUnsubDone: {
      title: "已退订",
      body: "您将不再收到我们的案件状态提醒。这涵盖这个邮箱所关注的所有案件。",
    },
    queueUnsubGet: {
      title: "停止您的排队提醒？",
      body: "您将不再收到劳工部（DOL）处理到您递交月份的提醒。",
    },
    queueUnsubDone: {
      title: "已退订",
      body: "您将不再收到排队提醒。",
    },
    bulletinUnsubGet: {
      title: "停止您的签证公告提醒？",
      body: "您将不再收到您类别在新签证公告中变动的提醒。",
    },
    bulletinUnsubDone: {
      title: "已退订",
      body: "您将不再收到签证公告提醒。",
    },
    employerUnsubGet: {
      title: "停止您的雇主提醒？",
      body: "您将不再收到劳工部（DOL）对该雇主案件进行批量操作的提醒。",
    },
    employerUnsubDone: {
      title: "已退订",
      body: "您将不再收到该雇主的提醒。",
    },
    prefsOffDone: {
      title: "已关闭",
      body: "您将不再收到我们的这类邮件。这个邮箱收到的其他内容不变。",
    },
  },
  "pt-br": {
    confirmLabel: "Confirmar",
    unsubscribeLabel: "Cancelar inscrição",
    prefsButton: "Preferências de e-mail",
    badLink: {
      title: "Este link não funciona",
      reason: "O link está incompleto ou expirado.",
      next: "Peça um link novo para suas preferências de e-mail, ou configure o alerta de novo pelo site.",
    },
    linkNoLongerValid: "Este link de confirmação não é mais válido.",
    linkExpired: "Este link venceu ou foi alterado.",
    caseConfirmGet: {
      title: "Confirme seus alertas de caso",
      body: "Enviaremos um e-mail quando o status do seu caso no Departamento do Trabalho (DOL) mudar, e por um ano depois de decidido, caso haja recurso ou reabertura.",
    },
    queueConfirmGet: {
      title: "Confirme seu alerta de fila",
      body: "Enviaremos um e-mail uma vez, no dia em que o Departamento do Trabalho (DOL) chegar ao mês em que seu caso foi protocolado.",
    },
    bulletinConfirmGet: {
      title: "Confirme seu alerta do boletim de vistos",
      body: "Enviaremos um e-mail quando a data de ação final da sua categoria mudar em um boletim de vistos novo.",
    },
    employerConfirmGet: (e) => ({
      title: "Confirme seu alerta de empregador",
      body: `Enviaremos um e-mail quando o Departamento do Trabalho (DOL) movimentar os casos de ${e} em grupo, e nunca mais de uma vez por dia.`,
    }),
    digestConfirmGet: {
      title: "Confirme o resumo semanal",
      body: "Toda terça: em que mês está a fila do DOL, o que o boletim de vistos moveu, os tempos do USCIS e as regras a caminho.",
    },
    caseConfirmed: (list) => ({
      title: "Você está na lista",
      body: `Vamos avisar quando o status no Departamento do Trabalho (DOL) de ${list} mudar, a cada movimento, e por um ano depois de decidido.`,
    }),
    caseAlready: (list) => ({
      title: "Você já está na lista",
      body: `Nada mais a fazer: vamos avisar quando o status no DOL de ${list} mudar.`,
    }),
    queueConfirmed: (month) => ({
      title: "Você está na lista",
      body: `Vamos avisar uma vez, no dia em que o Departamento do Trabalho (DOL) chegar a ${month}.`,
    }),
    queueAlreadyReached: (month) => ({
      title: "Você está na lista",
      body: `O DOL já chegou a ${month}. Seu alerta está a caminho agora, e essa é a única mensagem que você receberá.`,
    }),
    bulletinConfirmed: (series) => ({
      title: "Você está na lista",
      body: `Vamos avisar quando um boletim de vistos novo mover a data de ação final de ${series}.`,
    }),
    employerConfirmed: (e) => ({
      title: "Você está na lista",
      body: `Vamos avisar quando o Departamento do Trabalho (DOL) movimentar os casos de ${e} em grupo, no máximo uma vez por dia.`,
    }),
    digestConfirmed: {
      title: "Inscrição feita",
      body: "O próximo resumo semanal chega a este endereço na terça.",
    },
    caseUnsubGet: {
      title: "Parar seus alertas de caso?",
      body: "Você vai parar de receber alertas de status de todos os casos que este endereço acompanha.",
    },
    caseUnsubDone: {
      title: "Inscrição cancelada",
      body: "Você não vai receber alertas de status de casos. Isso cobre todos os casos que este endereço acompanhava.",
    },
    queueUnsubGet: {
      title: "Parar seu alerta de fila?",
      body: "Você vai parar de receber o alerta de quando o Departamento do Trabalho (DOL) chegar ao seu mês de protocolo.",
    },
    queueUnsubDone: {
      title: "Inscrição cancelada",
      body: "Você não vai receber alertas de fila.",
    },
    bulletinUnsubGet: {
      title: "Parar seu alerta do boletim de vistos?",
      body: "Você vai parar de receber o alerta de quando sua categoria mudar em um boletim de vistos novo.",
    },
    bulletinUnsubDone: {
      title: "Inscrição cancelada",
      body: "Você não vai receber alertas do boletim de vistos.",
    },
    employerUnsubGet: {
      title: "Parar seu alerta de empregador?",
      body: "Você vai parar de saber quando o Departamento do Trabalho (DOL) movimentar os casos deste empregador em grupo.",
    },
    employerUnsubDone: {
      title: "Inscrição cancelada",
      body: "Você não vai receber alertas deste empregador.",
    },
    prefsOffDone: {
      title: "Desativado",
      body: "Você não vai mais receber este tipo de e-mail. Tudo o mais que este endereço recebe fica igual.",
    },
  },
  ko: {
    confirmLabel: "확인",
    unsubscribeLabel: "수신 거부",
    prefsButton: "이메일 설정",
    badLink: {
      title: "이 링크는 사용할 수 없습니다",
      reason: "링크가 불완전하거나 만료되었습니다.",
      next: "이메일 설정 링크를 새로 요청하시거나, 사이트에서 알림을 다시 설정해 주세요.",
    },
    linkNoLongerValid: "이 확인 링크는 더 이상 유효하지 않습니다.",
    linkExpired: "이 링크는 만료되었거나 변경되었습니다.",
    caseConfirmGet: {
      title: "케이스 알림을 확인해 주세요",
      body: "노동부(DOL)의 케이스 상태가 바뀔 때, 그리고 결정 후 1년 동안 항소나 재개가 있을 경우에 이메일로 알려 드립니다.",
    },
    queueConfirmGet: {
      title: "대기열 알림을 확인해 주세요",
      body: "노동부(DOL)가 케이스 접수 월에 도달하는 날 이메일 한 통을 보내 드립니다.",
    },
    bulletinConfirmGet: {
      title: "비자 공보 알림을 확인해 주세요",
      body: "새 비자 공보에서 카테고리의 최종 조치 날짜가 바뀌면 이메일로 알려 드립니다.",
    },
    employerConfirmGet: (e) => ({
      title: "고용주 알림을 확인해 주세요",
      body: `노동부(DOL)가 ${e}의 케이스를 일괄 처리할 때 이메일로 알려 드리며, 하루에 한 번을 넘지 않습니다.`,
    }),
    digestConfirmGet: {
      title: "주간 요약을 확인해 주세요",
      body: "매주 화요일: DOL 대기열 진행 상황, 비자 공보 변동, USCIS 처리 시간, 그리고 진행 중인 규칙.",
    },
    caseConfirmed: (list) => ({
      title: "목록에 추가되었습니다",
      body: `${list}의 노동부(DOL) 상태가 바뀔 때마다, 그리고 결정 후 1년 동안 이메일로 알려 드립니다.`,
    }),
    caseAlready: (list) => ({
      title: "이미 목록에 있습니다",
      body: `더 하실 일은 없습니다. ${list}의 노동부(DOL) 상태가 바뀌면 이메일로 알려 드립니다.`,
    }),
    queueConfirmed: (month) => ({
      title: "목록에 추가되었습니다",
      body: `노동부(DOL)가 ${month}에 도달하는 날 이메일 한 통을 보내 드립니다.`,
    }),
    queueAlreadyReached: (month) => ({
      title: "등록되었습니다",
      body: `노동부는 이미 ${month}에 도달했습니다. 알림이 지금 발송 중이며, 받으실 메일은 그 한 통뿐입니다.`,
    }),
    bulletinConfirmed: (series) => ({
      title: "목록에 추가되었습니다",
      body: `새 비자 공보가 ${series}의 최종 조치 날짜를 바꾸면 이메일로 알려 드립니다.`,
    }),
    employerConfirmed: (e) => ({
      title: "목록에 추가되었습니다",
      body: `노동부(DOL)가 ${e}의 케이스를 일괄 처리할 때 하루에 최대 한 번 이메일로 알려 드립니다.`,
    }),
    digestConfirmed: {
      title: "구독되었습니다",
      body: "다음 주간 요약이 화요일에 이 주소로 도착합니다.",
    },
    caseUnsubGet: {
      title: "케이스 알림을 중지할까요?",
      body: "이 주소가 지켜보는 모든 케이스의 상태 알림을 더 이상 받지 않게 됩니다.",
    },
    caseUnsubDone: {
      title: "수신이 해제되었습니다",
      body: "케이스 상태 알림을 더 이상 받지 않습니다. 이 주소가 지켜보던 모든 케이스가 해당됩니다.",
    },
    queueUnsubGet: {
      title: "대기열 알림을 중지할까요?",
      body: "노동부(DOL)가 접수 월에 도달하는 알림을 더 이상 받지 않게 됩니다.",
    },
    queueUnsubDone: {
      title: "수신이 해제되었습니다",
      body: "대기열 알림을 더 이상 받지 않습니다.",
    },
    bulletinUnsubGet: {
      title: "비자 공보 알림을 중지할까요?",
      body: "새 비자 공보에서 카테고리가 바뀌는 알림을 더 이상 받지 않게 됩니다.",
    },
    bulletinUnsubDone: {
      title: "수신이 해제되었습니다",
      body: "비자 공보 알림을 더 이상 받지 않습니다.",
    },
    employerUnsubGet: {
      title: "고용주 알림을 중지할까요?",
      body: "노동부(DOL)가 이 고용주의 케이스를 일괄 처리할 때 받던 알림을 더 이상 받지 않게 됩니다.",
    },
    employerUnsubDone: {
      title: "수신이 해제되었습니다",
      body: "이 고용주에 대한 알림을 더 이상 받지 않습니다.",
    },
    prefsOffDone: {
      title: "꺼졌습니다",
      body: "이제 이 종류의 이메일을 더 이상 받지 않습니다. 이 주소가 받는 다른 모든 것은 그대로입니다.",
    },
  },
  vi: {
    confirmLabel: "Xác nhận",
    unsubscribeLabel: "Hủy nhận",
    prefsButton: "Tùy chọn email",
    badLink: {
      title: "Liên kết này không dùng được",
      reason: "Liên kết không đầy đủ hoặc đã hết hạn.",
      next: "Hãy yêu cầu một liên kết mới đến tùy chọn email của bạn, hoặc thiết lập lại thông báo trên trang web.",
    },
    linkNoLongerValid: "Liên kết xác nhận này không còn hiệu lực.",
    linkExpired: "Liên kết này đã hết hạn hoặc bị thay đổi.",
    caseConfirmGet: {
      title: "Xác nhận thông báo hồ sơ của bạn",
      body: "Chúng tôi sẽ gửi email khi trạng thái hồ sơ của bạn ở Bộ Lao động (DOL) thay đổi, và trong một năm sau khi có quyết định, phòng khi có kháng cáo hoặc mở lại.",
    },
    queueConfirmGet: {
      title: "Xác nhận thông báo hàng chờ của bạn",
      body: "Chúng tôi sẽ gửi một email, vào ngày Bộ Lao động (DOL) xét đến tháng hồ sơ của bạn được nộp.",
    },
    bulletinConfirmGet: {
      title: "Xác nhận thông báo bản tin thị thực của bạn",
      body: "Chúng tôi sẽ gửi email khi ngày hành động cuối cùng cho diện của bạn thay đổi trong một bản tin thị thực mới.",
    },
    employerConfirmGet: (e) => ({
      title: "Xác nhận thông báo nhà tuyển dụng của bạn",
      body: `Chúng tôi sẽ gửi email khi Bộ Lao động (DOL) xử lý hàng loạt hồ sơ của ${e}, và không quá một lần mỗi ngày.`,
    }),
    digestConfirmGet: {
      title: "Xác nhận bản tóm tắt hằng tuần",
      body: "Mỗi thứ Ba: hàng chờ của DOL đang ở tháng nào, bản tin thị thực đã thay đổi gì, thời gian xử lý của USCIS và các quy định sắp tới.",
    },
    caseConfirmed: (list) => ({
      title: "Bạn đã có trong danh sách",
      body: `Chúng tôi sẽ gửi email khi trạng thái ở Bộ Lao động (DOL) của ${list} thay đổi, mỗi lần nó thay đổi, và trong một năm sau khi có quyết định.`,
    }),
    caseAlready: (list) => ({
      title: "Bạn đã có trong danh sách rồi",
      body: `Không cần làm gì thêm: chúng tôi sẽ gửi email khi trạng thái ở DOL của ${list} thay đổi.`,
    }),
    queueConfirmed: (month) => ({
      title: "Bạn đã có trong danh sách",
      body: `Chúng tôi sẽ gửi một email, vào ngày Bộ Lao động (DOL) xét đến ${month}.`,
    }),
    queueAlreadyReached: (month) => ({
      title: "Bạn đã có trong danh sách",
      body: `DOL đã xét đến ${month}. Thông báo của bạn đang được gửi, và đó là email duy nhất bạn nhận.`,
    }),
    bulletinConfirmed: (series) => ({
      title: "Bạn đã có trong danh sách",
      body: `Chúng tôi sẽ gửi email khi một bản tin thị thực mới thay đổi ngày hành động cuối cùng của ${series}.`,
    }),
    employerConfirmed: (e) => ({
      title: "Bạn đã có trong danh sách",
      body: `Chúng tôi sẽ gửi email khi Bộ Lao động (DOL) xử lý hàng loạt hồ sơ của ${e}, nhiều nhất một lần mỗi ngày.`,
    }),
    digestConfirmed: {
      title: "Đã đăng ký",
      body: "Bản tóm tắt hằng tuần tiếp theo sẽ đến địa chỉ này vào thứ Ba.",
    },
    caseUnsubGet: {
      title: "Dừng thông báo hồ sơ của bạn?",
      body: "Bạn sẽ ngừng nhận thông báo trạng thái cho mọi hồ sơ mà địa chỉ này đang theo dõi.",
    },
    caseUnsubDone: {
      title: "Đã hủy nhận",
      body: "Bạn sẽ không nhận thông báo trạng thái hồ sơ từ chúng tôi. Điều này bao gồm mọi hồ sơ mà địa chỉ này đang theo dõi.",
    },
    queueUnsubGet: {
      title: "Dừng thông báo hàng chờ của bạn?",
      body: "Bạn sẽ ngừng nhận thông báo về việc Bộ Lao động (DOL) xét đến tháng nộp của bạn.",
    },
    queueUnsubDone: {
      title: "Đã hủy nhận",
      body: "Bạn sẽ không nhận thông báo hàng chờ.",
    },
    bulletinUnsubGet: {
      title: "Dừng thông báo bản tin thị thực của bạn?",
      body: "Bạn sẽ ngừng nhận thông báo về việc diện của bạn thay đổi trong một bản tin thị thực mới.",
    },
    bulletinUnsubDone: {
      title: "Đã hủy nhận",
      body: "Bạn sẽ không nhận thông báo bản tin thị thực.",
    },
    employerUnsubGet: {
      title: "Dừng thông báo nhà tuyển dụng của bạn?",
      body: "Bạn sẽ ngừng được báo khi Bộ Lao động (DOL) xử lý hàng loạt hồ sơ của nhà tuyển dụng này.",
    },
    employerUnsubDone: {
      title: "Đã hủy nhận",
      body: "Bạn sẽ không nhận thông báo cho nhà tuyển dụng này.",
    },
    prefsOffDone: {
      title: "Đã tắt",
      body: "Bạn sẽ không còn nhận loại email này từ chúng tôi. Mọi thứ khác mà địa chỉ này nhận vẫn giữ nguyên.",
    },
  },
};

export function mailPageText(lang: MailLang): MailPageText {
  return MAIL_PAGE_TEXT[lang];
}
