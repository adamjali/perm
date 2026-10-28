import {
  CATEGORIES,
  COUNTRIES,
  DATE_FIELDS,
  I140_CENTERS,
  RFE_OUTCOMES,
  RFE_REASONS,
  ROUTES,
  type CategoryId,
  type CountryId,
  type DateFieldId,
  type I140CenterId,
  type RfeOutcomeId,
  type RfeReasonId,
  type RouteId,
  type TimelineChoiceField,
  type ValidationResult,
} from "@/lib/communityTimeline";
import type { Messages } from "@/lib/i18n/lang";

/**
 * The "After PERM" block's words: the form, its option lists and its replies.
 *
 * English option labels are read from `convex/lib/communityTimeline.ts`, the one list the form and the server
 * share, so the English page can't drift from it. The other languages key the same ids, so a new option missing
 * a translation is a type error. Form names (I-140, I-485, I-693, EAD, EB-2, EB-3) stay as printed; the EAD and
 * advance parole are glossed the way each language's guide glosses them.
 *
 * The server's replies arrive in English. A save, an update and a removal are worded here by what happened; a
 * refusal the server words is translated when it is one of the fixed ones, and shown as sent otherwise.
 */

type Refusal = Extract<ValidationResult, { ok: false }>;

export interface MilestonesText {
  title: string;
  lede: string;
  /** Before the reported stops, with its own trailing space where the language uses one. */
  reported: string;
  listSep: string;
  /** How many reported a stop, with its leading space: " (2)". */
  count: (n: number) => string;
  end: string;
  nobody: string;
  openMine: string;
  openAdd: string;
  /** DOL's own half of the timeline. `{filed}` and `{certified}` are where the dates go. */
  record: string;
  recordNoFiled: string;
  aboutCase: string;
  category: string;
  country: string;
  route: string;
  center: string;
  notSaying: string;
  notSure: string;
  premium: string;
  datesLegend: string;
  rfeSummary: string;
  rfeForm: string;
  noRfe: string;
  rfeReason: string;
  rfeIssued: string;
  rfeResponded: string;
  rfeOutcome: string;
  publicLead: string;
  /** After the bold lead, with its own leading space where the language uses one. */
  publicRest: string;
  mediansBefore: string;
  mediansLink: string;
  mediansAfter: string;
  saveChanges: string;
  save: string;
  remove: string;
  failed: string;
  failedConnection: string;
  failedShort: string;
  /**
   * A finished save or removal, worded by what happened, for a reply that carried no words. Null in English,
   * which says the server's own words or nothing new.
   */
  done: { recorded: string; updated: string; removed: string } | null;
  /** A reply the server sent, in this language when it is one of the fixed ones. */
  server: (message: string) => string;
  /** The form's own check, said in this language. */
  problem: (r: Refusal) => string;
  categories: Readonly<Record<CategoryId, string>>;
  countries: Readonly<Record<CountryId, string>>;
  routes: Readonly<Record<RouteId, string>>;
  centers: Readonly<Record<I140CenterId, string>>;
  /** Each date box's label. */
  dates: Readonly<Record<DateFieldId, string>>;
  /** The short name of each date, as the reported-stops line prints it. */
  stops: Readonly<Record<DateFieldId, string>>;
  rfeReasons: Readonly<Record<RfeReasonId, string>>;
  rfeOutcomes: Readonly<Record<RfeOutcomeId, string>>;
}

const labels = <T extends { id: string; label: string }>(list: readonly T[]) =>
  Object.fromEntries(list.map((x) => [x.id, x.label])) as Record<T["id"], string>;

/** The fixed replies the timeline routes send (convex/communityTimelines.ts), in English, as keys. */
const DONE = {
  recorded: "Your timeline is recorded.",
  updated: "Your timeline was updated.",
  removed: "Your timeline was removed.",
} as const;
const S = {
  permOnly: "Timelines are recorded against PERM case numbers only.",
  malformed: "Malformed request.",
  hourly: "That's enough saves for one hour. Try again later.",
  paused: "New timelines are paused for today. Try again tomorrow.",
  noTimeline: "There's no timeline from this browser on this case.",
} as const;
const PER_CONNECTION = /^This case already has (\d+) timelines from this connection/;

function fromServer(
  done: Readonly<Record<keyof typeof DONE, string>>,
  words: Readonly<Record<keyof typeof S, string>>,
  perConnection: (n: string) => string,
) {
  const byEnglish = new Map<string, string>([
    ...Object.entries(DONE).map(([k, en]) => [en, done[k as keyof typeof DONE]] as [string, string]),
    ...Object.entries(S).map(([k, en]) => [en, words[k as keyof typeof S]] as [string, string]),
  ]);
  return (message: string): string => {
    const known = byEnglish.get(message);
    if (known) return known;
    const m = PER_CONNECTION.exec(message);
    return m ? perConnection(m[1]!) : message;
  };
}

/** One language's wording of the form's own checks. */
function problems(
  w: {
    choice: (name: string) => string;
    names: Readonly<Record<TimelineChoiceField, string>>;
    date: string;
    noDates: string;
    i140Order: string;
    greenCardOrder: string;
    rfeOrder: string;
    rfeForm: string;
    adjustmentOnly: (label: string) => string;
  },
  dates: Readonly<Record<DateFieldId, string>>,
) {
  return (r: Refusal): string => {
    switch (r.code) {
      case "choice":
        return w.choice(w.names[r.field]);
      case "date":
        return w.date;
      case "no-dates":
        return w.noDates;
      case "i140-order":
        return w.i140Order;
      case "green-card-order":
        return w.greenCardOrder;
      case "rfe-order":
        return w.rfeOrder;
      case "rfe-form":
        return w.rfeForm;
      case "adjustment-only":
        return w.adjustmentOnly(dates[r.field]);
    }
  };
}

const EN_STOPS = Object.fromEntries(DATE_FIELDS.map((f) => [f.id, f.short])) as Record<DateFieldId, string>;

const ES_DATES = {
  i140FiledOn: "I-140 presentada",
  i140ApprovedOn: "I-140 aprobada",
  i485FiledOn: "I-485 presentada",
  eadOn: "Permiso de trabajo (EAD) aprobado",
  apOn: "Permiso de viaje (advance parole) aprobado",
  interviewOn: "Entrevista",
  greenCardOn: "Green card aprobada, o visa de inmigrante emitida",
} satisfies Record<DateFieldId, string>;

const ZH_DATES = {
  i140FiledOn: "I-140 已递交",
  i140ApprovedOn: "I-140 已批准",
  i485FiledOn: "I-485 已递交",
  eadOn: "工卡（EAD）已批准",
  apOn: "回美证（advance parole）已批准",
  interviewOn: "面谈",
  greenCardOn: "绿卡已批准，或已签发移民签证",
} satisfies Record<DateFieldId, string>;

const PT_DATES = {
  i140FiledOn: "I-140 protocolada",
  i140ApprovedOn: "I-140 aprovada",
  i485FiledOn: "I-485 protocolada",
  eadOn: "Autorização de trabalho (EAD) aprovada",
  apOn: "Autorização de viagem (advance parole) aprovada",
  interviewOn: "Entrevista",
  greenCardOn: "Green card aprovado, ou visto de imigrante emitido",
} satisfies Record<DateFieldId, string>;

const KO_DATES = {
  i140FiledOn: "I-140 접수",
  i140ApprovedOn: "I-140 승인",
  i485FiledOn: "I-485 접수",
  eadOn: "워크퍼밋(EAD) 승인",
  apOn: "사전여행허가서(advance parole) 승인",
  interviewOn: "인터뷰",
  greenCardOn: "영주권 승인 또는 이민 비자 발급",
} satisfies Record<DateFieldId, string>;

const VI_DATES = {
  i140FiledOn: "Nộp I-140",
  i140ApprovedOn: "I-140 được duyệt",
  i485FiledOn: "Nộp I-485",
  eadOn: "Giấy phép lao động (EAD) được duyệt",
  apOn: "Giấy phép đi lại (advance parole) được duyệt",
  interviewOn: "Phỏng vấn",
  greenCardOn: "Thẻ xanh được duyệt, hoặc visa định cư được cấp",
} satisfies Record<DateFieldId, string>;

const ES_DONE = {
  recorded: "Su cronología quedó registrada.",
  updated: "Su cronología se actualizó.",
  removed: "Su cronología se eliminó.",
};

const ZH_DONE = {
  recorded: "您的时间线已记录。",
  updated: "您的时间线已更新。",
  removed: "您的时间线已删除。",
};

const PT_DONE = {
  recorded: "Sua linha do tempo foi registrada.",
  updated: "Sua linha do tempo foi atualizada.",
  removed: "Sua linha do tempo foi removida.",
};

const KO_DONE = {
  recorded: "타임라인이 기록되었습니다.",
  updated: "타임라인이 업데이트되었습니다.",
  removed: "타임라인이 삭제되었습니다.",
};

const VI_DONE = {
  recorded: "Mốc thời gian của bạn đã được ghi lại.",
  updated: "Mốc thời gian của bạn đã được cập nhật.",
  removed: "Mốc thời gian của bạn đã được xóa.",
};

export const MILESTONES = {
  en: {
    title: "After PERM",
    lede: "USCIS doesn't publish the I-140 or the I-485 case by case, so this part comes from the people waiting. Their dates are self-reported; the PERM dates come from DOL's own record.",
    reported: "Reported for this case: ",
    listSep: ", ",
    count: (n) => ` (${n})`,
    end: ".",
    nobody: "Nobody has added dates for this case yet.",
    openMine: "Your timeline for this case",
    openAdd: "Add your dates",
    record: "DOL's record for this case: filed {filed}, certified {certified}.",
    recordNoFiled: "DOL's record for this case: filed on a date DOL doesn't show, certified {certified}.",
    aboutCase: "About the case",
    category: "Category",
    country: "Country of chargeability",
    route: "After the I-140",
    center: "Where the I-140 was decided",
    notSaying: "Not saying",
    notSure: "Not sure",
    premium: "The I-140 was filed with premium processing",
    datesLegend: "Dates, only the ones that have happened",
    rfeSummary: "Got a request for evidence (RFE)?",
    rfeForm: "On which form",
    noRfe: "No RFE",
    rfeReason: "What it asked about",
    rfeIssued: "RFE dated",
    rfeResponded: "Response sent",
    rfeOutcome: "What happened",
    publicLead: "Show my timeline on the public board.",
    publicRest:
      " The case number and employer never show there; it lists the filing month and how many days each step took.",
    mediansBefore: "Either way, your dates count toward the anonymous medians on the ",
    mediansLink: "green card timelines",
    mediansAfter: " page. This browser keeps a key for this case so you can edit or remove it later.",
    saveChanges: "Save changes",
    save: "Save my timeline",
    remove: "Remove my timeline",
    failed: "That didn't go through. Try again in a moment.",
    failedConnection: "That didn't go through, which usually means the connection dropped.",
    failedShort: "That didn't go through.",
    done: null,
    server: (message) => message,
    problem: (r) => r.message,
    categories: labels(CATEGORIES),
    countries: labels(COUNTRIES),
    routes: labels(ROUTES),
    centers: labels(I140_CENTERS),
    dates: labels(DATE_FIELDS),
    stops: EN_STOPS,
    rfeReasons: labels(RFE_REASONS),
    rfeOutcomes: labels(RFE_OUTCOMES),
  },
  es: {
    title: "Después del PERM",
    lede: "USCIS no publica la I-140 ni la I-485 caso por caso. Por eso esta parte viene de las personas que esperan. Ellas informan sus propias fechas; las del PERM vienen del registro del propio DOL.",
    reported: "Fechas informadas para este caso: ",
    listSep: ", ",
    count: (n) => ` (${n})`,
    end: ".",
    nobody: "Nadie ha agregado fechas para este caso todavía.",
    openMine: "Su cronología para este caso",
    openAdd: "Agregue sus fechas",
    record: "Registro del DOL para este caso: presentado el {filed}, certificado el {certified}.",
    recordNoFiled:
      "Registro del DOL para este caso: presentado en una fecha que el DOL no muestra, certificado el {certified}.",
    aboutCase: "Sobre el caso",
    category: "Categoría",
    country: "País de cargabilidad",
    route: "Después de la I-140",
    center: "Dónde se decidió la I-140",
    notSaying: "Prefiero no decirlo",
    notSure: "No lo sé",
    premium: "La I-140 se presentó con procesamiento prémium (premium processing)",
    datesLegend: "Fechas: solo las que ya ocurrieron",
    rfeSummary: "¿Recibió una solicitud de evidencia (RFE)?",
    rfeForm: "En qué formulario",
    noRfe: "Sin RFE",
    rfeReason: "Sobre qué preguntaba",
    rfeIssued: "Fecha de la RFE",
    rfeResponded: "Respuesta enviada",
    rfeOutcome: "Qué pasó",
    publicLead: "Mostrar mi cronología en el tablero público.",
    publicRest:
      " El número de caso y el empleador nunca aparecen ahí. El tablero muestra el mes de presentación y cuántos días tomó cada paso.",
    mediansBefore: "De cualquier forma, sus fechas cuentan para las medianas anónimas de la página ",
    mediansLink: "cronologías de green card (en inglés)",
    mediansAfter:
      ". Este navegador guarda una clave para este caso, para que pueda editar o eliminar su cronología más tarde.",
    saveChanges: "Guardar cambios",
    save: "Guardar mi cronología",
    remove: "Eliminar mi cronología",
    failed: "No se pudo enviar. Inténtelo de nuevo en un momento.",
    failedConnection: "No se pudo enviar. Normalmente significa que se cortó la conexión.",
    failedShort: "No se pudo enviar.",
    done: ES_DONE,
    server: fromServer(
      ES_DONE,
      {
        permOnly: "Las cronologías se registran solo con números de caso PERM.",
        malformed: "La solicitud no tiene el formato correcto.",
        hourly: "Ya hizo suficientes guardados por una hora. Inténtelo más tarde.",
        paused: "Las cronologías nuevas están en pausa por hoy. Inténtelo mañana.",
        noTimeline: "No hay una cronología de este navegador para este caso.",
      },
      (n) =>
        `Este caso ya tiene ${n} cronologías desde esta conexión. Es el máximo que una conexión puede agregar para un caso.`,
    ),
    problem: problems(
      {
        choice: (name) => `Ese valor de ${name} no es uno de los que registra este formulario.`,
        names: {
          category: "categoría",
          country: "país",
          route: "trámite",
          i140Center: "oficina de la I-140",
          rfeForm: "formulario de la RFE",
          rfeReason: "motivo de la RFE",
          rfeOutcome: "resultado de la RFE",
        },
        date: "Escriba cada fecha como AAAA-MM-DD, desde 2005 y nunca en el futuro.",
        noDates: "Agregue al menos una fecha posterior al PERM para registrar una cronología.",
        i140Order: "La aprobación de la I-140 tiene una fecha anterior a su presentación.",
        greenCardOrder: "La green card tiene una fecha anterior a la presentación de la I-485.",
        rfeOrder: "La respuesta a la RFE tiene una fecha anterior a la RFE.",
        rfeForm: "Indique en qué formulario fue la RFE.",
        adjustmentOnly: (label) =>
          `«${label}» corresponde a un ajuste de estatus en EE. UU., no a un trámite consular.`,
      },
      ES_DATES,
    ),
    categories: { eb2: "EB-2", eb3: "EB-3 profesional o calificado", "eb3-other": "EB-3 Otros Trabajadores" },
    countries: {
      row: "Resto del mundo",
      india: "India",
      china: "China (nacidos en China continental)",
      mexico: "México",
      philippines: "Filipinas",
    },
    routes: { adjustment: "Ajuste de estatus en EE. UU. (I-485)", consular: "Trámite consular en el extranjero" },
    centers: { nebraska: "Nebraska Service Center", texas: "Texas Service Center", other: "Otra oficina" },
    dates: ES_DATES,
    stops: {
      i140FiledOn: "I-140 presentada",
      i140ApprovedOn: "I-140 aprobada",
      i485FiledOn: "I-485 presentada",
      eadOn: "EAD",
      apOn: "Advance parole",
      interviewOn: "Entrevista",
      greenCardOn: "Green card",
    },
    rfeReasons: {
      "ability-to-pay": "La capacidad del empleador para pagar el salario",
      experience: "Cartas de experiencia o calificaciones",
      education: "Un título o su evaluación",
      "job-offer": "La oferta de trabajo o la relación con el empleador",
      "perm-docs": "Documentos del PERM que faltan o no coinciden",
      medical: "El examen médico (I-693)",
      "supplement-j": "El Suplemento J o la confirmación del empleo",
      status: "Historial de estatus migratorio",
      "civil-docs": "Acta de nacimiento u otros documentos civiles",
      other: "Otra cosa",
    },
    rfeOutcomes: { pending: "Todavía esperando", approved: "Aprobada después de la respuesta", denied: "Negada" },
  },
  zh: {
    title: "PERM 之后",
    lede: "移民局（USCIS）不按案件公布 I-140 和 I-485 的进度，所以这部分来自正在等待的人。这些日期由本人填报；PERM 的日期来自劳工部自己的记录。",
    reported: "本案已填报：",
    listSep: "、",
    count: (n) => `（${n}）`,
    end: "。",
    nobody: "还没有人为本案填写日期。",
    openMine: "您为本案填写的时间线",
    openAdd: "填写您的日期",
    record: "劳工部对本案的记录：{filed}递交，{certified}获批。",
    recordNoFiled: "劳工部对本案的记录：劳工部未显示递交日期，{certified}获批。",
    aboutCase: "案件信息",
    category: "类别",
    country: "排期国家（chargeability）",
    route: "I-140 之后",
    center: "I-140 在哪里审批",
    notSaying: "不愿透露",
    notSure: "不确定",
    premium: "I-140 递交时使用了加急处理（premium processing）",
    datesLegend: "日期：只填已经发生的",
    rfeSummary: "收到过补充证据要求（RFE）吗？",
    rfeForm: "针对哪份表格",
    noRfe: "没有 RFE",
    rfeReason: "要求补充的内容",
    rfeIssued: "RFE 日期",
    rfeResponded: "回复寄出",
    rfeOutcome: "结果",
    publicLead: "在公开时间线板上显示我的时间线。",
    publicRest: "案件编号和雇主永远不会显示在那里，只列出递交月份和每一步用了多少天。",
    mediansBefore: "无论是否公开，您的日期都会计入",
    mediansLink: "绿卡时间线（英文页面）",
    mediansAfter: "页面上的匿名中位数。本浏览器会为这个案件保存一个密钥，方便您以后修改或删除时间线。",
    saveChanges: "保存修改",
    save: "保存我的时间线",
    remove: "删除我的时间线",
    failed: "没有提交成功。请稍后再试。",
    failedConnection: "没有提交成功，通常是网络连接中断了。",
    failedShort: "没有提交成功。",
    done: ZH_DONE,
    server: fromServer(
      ZH_DONE,
      {
        permOnly: "时间线只能按 PERM 案件编号记录。",
        malformed: "请求格式有误。",
        hourly: "一小时内的保存次数已达上限。请稍后再试。",
        paused: "今天暂停接收新的时间线。请明天再试。",
        noTimeline: "本浏览器没有为这个案件保存过时间线。",
      },
      (n) => `这个案件已有 ${n} 条来自同一网络连接的时间线，这是一个连接能为一个案件添加的上限。`,
    ),
    problem: problems(
      {
        choice: (name) => `所选的${name}不在本表格的选项中。`,
        names: {
          category: "类别",
          country: "国家",
          route: "办理途径",
          i140Center: "I-140 审批机构",
          rfeForm: "RFE 表格",
          rfeReason: "RFE 原因",
          rfeOutcome: "RFE 结果",
        },
        date: "每个日期请按 YYYY-MM-DD 格式填写，从 2005 年起，且不能晚于今天。",
        noDates: "请至少填写一个 PERM 之后的日期，才能记录时间线。",
        i140Order: "I-140 的批准日期早于递交日期。",
        greenCardOrder: "绿卡日期早于 I-485 递交日期。",
        rfeOrder: "RFE 回复日期早于 RFE 日期。",
        rfeForm: "请选择 RFE 针对的表格。",
        adjustmentOnly: (label) => `“${label}”只适用于在美国境内身份调整，不适用于领事处理。`,
      },
      ZH_DATES,
    ),
    categories: { eb2: "EB-2", eb3: "EB-3 专业人士或技术工人", "eb3-other": "EB-3 其他工人" },
    countries: {
      row: "其他国家",
      india: "印度",
      china: "中国（中国大陆出生）",
      mexico: "墨西哥",
      philippines: "菲律宾",
    },
    routes: { adjustment: "在美国境内身份调整（I-485）", consular: "在国外领事处理" },
    centers: {
      nebraska: "Nebraska Service Center（内布拉斯加服务中心）",
      texas: "Texas Service Center（德州服务中心）",
      other: "其他机构",
    },
    dates: ZH_DATES,
    stops: {
      i140FiledOn: "I-140 已递交",
      i140ApprovedOn: "I-140 已批准",
      i485FiledOn: "I-485 已递交",
      eadOn: "工卡（EAD）",
      apOn: "回美证（advance parole）",
      interviewOn: "面谈",
      greenCardOn: "绿卡",
    },
    rfeReasons: {
      "ability-to-pay": "雇主支付工资的能力",
      experience: "工作经验证明或资历",
      education: "学位或学历认证",
      "job-offer": "工作邀约或与雇主的关系",
      "perm-docs": "PERM 文件缺失或不一致",
      medical: "体检（I-693）",
      "supplement-j": "Supplement J 或工作确认",
      status: "移民身份记录",
      "civil-docs": "出生证明或其他民事文件",
      other: "其他",
    },
    rfeOutcomes: { pending: "仍在等待", approved: "回复后获批", denied: "被拒" },
  },
  "pt-br": {
    title: "Depois do PERM",
    lede: "O USCIS não publica a I-140 nem a I-485 caso a caso. Por isso esta parte vem das pessoas que estão esperando. Elas mesmas informam as datas; as do PERM vêm do registro do próprio DOL.",
    reported: "Datas informadas para este caso: ",
    listSep: ", ",
    count: (n) => ` (${n})`,
    end: ".",
    nobody: "Ninguém adicionou datas para este caso ainda.",
    openMine: "Sua linha do tempo para este caso",
    openAdd: "Adicione suas datas",
    record: "Registro do DOL para este caso: protocolado em {filed}, certificado em {certified}.",
    recordNoFiled:
      "Registro do DOL para este caso: protocolado em uma data que o DOL não mostra, certificado em {certified}.",
    aboutCase: "Sobre o caso",
    category: "Categoria",
    country: "País de chargeability",
    route: "Depois da I-140",
    center: "Onde a I-140 foi decidida",
    notSaying: "Prefiro não dizer",
    notSure: "Não sei",
    premium: "A I-140 foi protocolada com processamento premium (premium processing)",
    datesLegend: "Datas: só as que já aconteceram",
    rfeSummary: "Recebeu um pedido de evidências (RFE)?",
    rfeForm: "Em qual formulário",
    noRfe: "Sem RFE",
    rfeReason: "Sobre o que perguntou",
    rfeIssued: "Data do RFE",
    rfeResponded: "Resposta enviada",
    rfeOutcome: "O que aconteceu",
    publicLead: "Mostrar minha linha do tempo no quadro público.",
    publicRest:
      " O número do caso e o empregador nunca aparecem lá. O quadro mostra o mês de protocolo e quantos dias cada etapa levou.",
    mediansBefore: "De qualquer forma, suas datas entram nas medianas anônimas da página ",
    mediansLink: "linhas do tempo do green card (em inglês)",
    mediansAfter:
      ". Este navegador guarda uma chave para este caso, para você editar ou remover sua linha do tempo depois.",
    saveChanges: "Salvar alterações",
    save: "Salvar minha linha do tempo",
    remove: "Remover minha linha do tempo",
    failed: "Não deu certo. Tente de novo em instantes.",
    failedConnection: "Não deu certo, o que geralmente significa que a conexão caiu.",
    failedShort: "Não deu certo.",
    done: PT_DONE,
    server: fromServer(
      PT_DONE,
      {
        permOnly: "As linhas do tempo são registradas só com números de caso PERM.",
        malformed: "O pedido não está no formato certo.",
        hourly: "Você já salvou o suficiente por uma hora. Tente mais tarde.",
        paused: "Novas linhas do tempo estão pausadas hoje. Tente amanhã.",
        noTimeline: "Não há linha do tempo deste navegador para este caso.",
      },
      (n) =>
        `Este caso já tem ${n} linhas do tempo desta conexão. É o máximo que uma conexão pode adicionar a um caso.`,
    ),
    problem: problems(
      {
        choice: (name) => `Esse valor de ${name} não é um dos que este formulário registra.`,
        names: {
          category: "categoria",
          country: "país",
          route: "trâmite",
          i140Center: "escritório da I-140",
          rfeForm: "formulário do RFE",
          rfeReason: "motivo do RFE",
          rfeOutcome: "resultado do RFE",
        },
        date: "Digite cada data como AAAA-MM-DD, a partir de 2005 e nunca no futuro.",
        noDates: "Adicione pelo menos uma data depois do PERM para registrar uma linha do tempo.",
        i140Order: "A aprovação da I-140 tem data anterior ao protocolo.",
        greenCardOrder: "O green card tem data anterior ao protocolo da I-485.",
        rfeOrder: "A resposta ao RFE tem data anterior ao RFE.",
        rfeForm: "Diga em qual formulário foi o RFE.",
        adjustmentOnly: (label) => `"${label}" vale para um ajuste de status nos EUA, não para o processo consular.`,
      },
      PT_DATES,
    ),
    categories: { eb2: "EB-2", eb3: "EB-3 profissional ou qualificado", "eb3-other": "EB-3 outros trabalhadores" },
    countries: {
      row: "Resto do mundo",
      india: "Índia",
      china: "China (nascidos na China continental)",
      mexico: "México",
      philippines: "Filipinas",
    },
    routes: { adjustment: "Ajuste de status nos EUA (I-485)", consular: "Processo consular no exterior" },
    centers: { nebraska: "Nebraska Service Center", texas: "Texas Service Center", other: "Outro escritório" },
    dates: PT_DATES,
    stops: {
      i140FiledOn: "I-140 protocolada",
      i140ApprovedOn: "I-140 aprovada",
      i485FiledOn: "I-485 protocolada",
      eadOn: "EAD",
      apOn: "Advance parole",
      interviewOn: "Entrevista",
      greenCardOn: "Green card",
    },
    rfeReasons: {
      "ability-to-pay": "A capacidade do empregador de pagar o salário",
      experience: "Cartas de experiência ou qualificações",
      education: "Um diploma ou sua avaliação",
      "job-offer": "A oferta de emprego ou a relação com o empregador",
      "perm-docs": "Documentos do PERM faltando ou inconsistentes",
      medical: "O exame médico (I-693)",
      "supplement-j": "Suplemento J ou confirmação do emprego",
      status: "Histórico de status imigratório",
      "civil-docs": "Certidão de nascimento ou outros documentos civis",
      other: "Outra coisa",
    },
    rfeOutcomes: { pending: "Ainda esperando", approved: "Aprovado depois da resposta", denied: "Negado" },
  },
  ko: {
    title: "PERM 이후",
    lede: "USCIS는 I-140과 I-485를 케이스별로 공개하지 않습니다. 그래서 이 부분은 기다리는 분들이 직접 알려 준 내용입니다. 그 날짜는 본인이 입력한 것이고, PERM 날짜는 노동부 자체 기록에서 가져옵니다.",
    reported: "이 케이스에 보고된 단계: ",
    listSep: ", ",
    count: (n) => ` (${n})`,
    end: ".",
    nobody: "아직 이 케이스에 날짜를 추가한 사람이 없습니다.",
    openMine: "이 케이스에 대한 내 타임라인",
    openAdd: "내 날짜 추가하기",
    record: "이 케이스에 대한 노동부 기록: {filed} 접수, {certified} 승인.",
    recordNoFiled: "이 케이스에 대한 노동부 기록: 접수일은 노동부가 보여 주지 않음, {certified} 승인.",
    aboutCase: "케이스 정보",
    category: "카테고리",
    country: "적용 국가(chargeability)",
    route: "I-140 이후",
    center: "I-140을 심사한 곳",
    notSaying: "밝히지 않음",
    notSure: "잘 모름",
    premium: "I-140을 급행 처리(premium processing)로 접수했습니다",
    datesLegend: "날짜: 이미 있었던 것만",
    rfeSummary: "추가 증거 요청(RFE)을 받으셨나요?",
    rfeForm: "어떤 양식에 대해",
    noRfe: "RFE 없음",
    rfeReason: "요청한 내용",
    rfeIssued: "RFE 날짜",
    rfeResponded: "답변 보낸 날",
    rfeOutcome: "결과",
    publicLead: "공개 게시판에 내 타임라인 표시하기.",
    publicRest: " 케이스 번호와 고용주는 그곳에 절대 나오지 않습니다. 접수 월과 각 단계에 걸린 날수만 보여 줍니다.",
    mediansBefore: "공개 여부와 관계없이, 입력한 날짜는 ",
    mediansLink: "영주권 타임라인(영어 페이지)",
    mediansAfter:
      " 페이지의 익명 중앙값에 반영됩니다. 이 브라우저가 이 케이스의 키를 보관하므로 나중에 타임라인을 수정하거나 삭제할 수 있습니다.",
    saveChanges: "변경 사항 저장",
    save: "내 타임라인 저장",
    remove: "내 타임라인 삭제",
    failed: "전송되지 않았습니다. 잠시 후 다시 시도해 주세요.",
    failedConnection: "전송되지 않았습니다. 보통 연결이 끊겼다는 뜻입니다.",
    failedShort: "전송되지 않았습니다.",
    done: KO_DONE,
    server: fromServer(
      KO_DONE,
      {
        permOnly: "타임라인은 PERM 케이스 번호로만 기록됩니다.",
        malformed: "잘못된 요청입니다.",
        hourly: "한 시간 동안 저장할 수 있는 횟수를 넘었습니다. 나중에 다시 시도해 주세요.",
        paused: "오늘은 새 타임라인을 받지 않습니다. 내일 다시 시도해 주세요.",
        noTimeline: "이 브라우저에서 이 케이스에 저장한 타임라인이 없습니다.",
      },
      (n) =>
        `이 케이스에는 이미 이 연결에서 추가한 타임라인이 ${n}개 있습니다. 한 연결이 한 케이스에 추가할 수 있는 최대치입니다.`,
    ),
    problem: problems(
      {
        choice: (name) => `선택한 ${name} 값은 이 양식에서 받지 않는 값입니다.`,
        names: {
          category: "카테고리",
          country: "국가",
          route: "진행 경로",
          i140Center: "I-140 심사 기관",
          rfeForm: "RFE 양식",
          rfeReason: "RFE 사유",
          rfeOutcome: "RFE 결과",
        },
        date: "날짜는 YYYY-MM-DD 형식으로, 2005년 이후이고 미래가 아닌 날짜로 입력해 주세요.",
        noDates: "타임라인을 기록하려면 PERM 이후 날짜를 하나 이상 추가해 주세요.",
        i140Order: "I-140 승인일이 접수일보다 앞서 있습니다.",
        greenCardOrder: "영주권 날짜가 I-485 접수일보다 앞서 있습니다.",
        rfeOrder: "RFE 답변일이 RFE 날짜보다 앞서 있습니다.",
        rfeForm: "RFE가 어떤 양식에 대한 것이었는지 선택해 주세요.",
        adjustmentOnly: (label) => `'${label}' 항목은 미국 내 신분 조정에만 해당하며 영사 처리에는 해당하지 않습니다.`,
      },
      KO_DATES,
    ),
    categories: { eb2: "EB-2", eb3: "EB-3 전문직 또는 숙련직", "eb3-other": "EB-3 기타 근로자" },
    countries: {
      row: "기타 국가",
      india: "인도",
      china: "중국(본토 출생)",
      mexico: "멕시코",
      philippines: "필리핀",
    },
    routes: { adjustment: "미국 내 신분 조정(I-485)", consular: "해외 영사 처리" },
    centers: { nebraska: "Nebraska Service Center", texas: "Texas Service Center", other: "다른 기관" },
    dates: KO_DATES,
    stops: {
      i140FiledOn: "I-140 접수",
      i140ApprovedOn: "I-140 승인",
      i485FiledOn: "I-485 접수",
      eadOn: "워크퍼밋(EAD)",
      apOn: "사전여행허가서",
      interviewOn: "인터뷰",
      greenCardOn: "영주권",
    },
    rfeReasons: {
      "ability-to-pay": "고용주의 임금 지급 능력",
      experience: "경력 증명서 또는 자격",
      education: "학위 또는 학력 평가",
      "job-offer": "고용 제안 또는 고용주와의 관계",
      "perm-docs": "PERM 서류 누락 또는 불일치",
      medical: "신체검사(I-693)",
      "supplement-j": "Supplement J 또는 직무 확인",
      status: "이민 신분 이력",
      "civil-docs": "출생증명서 또는 기타 신분 서류",
      other: "기타",
    },
    rfeOutcomes: { pending: "아직 기다리는 중", approved: "답변 후 승인", denied: "거부" },
  },
  vi: {
    title: "Sau PERM",
    lede: "USCIS không công bố I-140 hay I-485 theo từng hồ sơ. Vì vậy phần này đến từ chính những người đang chờ. Ngày của họ là tự khai; ngày PERM lấy từ hồ sơ của chính DOL.",
    reported: "Các bước đã được báo cho hồ sơ này: ",
    listSep: ", ",
    count: (n) => ` (${n})`,
    end: ".",
    nobody: "Chưa có ai thêm ngày cho hồ sơ này.",
    openMine: "Mốc thời gian của bạn cho hồ sơ này",
    openAdd: "Thêm các ngày của bạn",
    record: "Dữ liệu của DOL về hồ sơ này: nộp ngày {filed}, được chứng nhận ngày {certified}.",
    recordNoFiled:
      "Dữ liệu của DOL về hồ sơ này: nộp vào một ngày DOL không hiển thị, được chứng nhận ngày {certified}.",
    aboutCase: "Về hồ sơ",
    category: "Diện",
    country: "Quốc gia tính hạn ngạch (chargeability)",
    route: "Sau I-140",
    center: "Nơi xét duyệt I-140",
    notSaying: "Không muốn nói",
    notSure: "Không chắc",
    premium: "I-140 được nộp kèm xử lý nhanh (premium processing)",
    datesLegend: "Các ngày, chỉ những ngày đã xảy ra",
    rfeSummary: "Bạn có nhận yêu cầu bổ sung bằng chứng (RFE) không?",
    rfeForm: "Cho mẫu đơn nào",
    noRfe: "Không có RFE",
    rfeReason: "Yêu cầu về vấn đề gì",
    rfeIssued: "Ngày của RFE",
    rfeResponded: "Ngày gửi trả lời",
    rfeOutcome: "Kết quả",
    publicLead: "Hiển thị mốc thời gian của tôi trên bảng công khai.",
    publicRest:
      " Số hồ sơ và chủ lao động không bao giờ hiện ở đó. Bảng chỉ ghi tháng nộp và số ngày mỗi bước đã mất.",
    mediansBefore: "Dù chọn thế nào, các ngày của bạn vẫn được tính vào trung vị ẩn danh trên trang ",
    mediansLink: "mốc thời gian thẻ xanh (trang tiếng Anh)",
    mediansAfter:
      ". Trình duyệt này giữ một khóa cho hồ sơ này để bạn có thể sửa hoặc xóa mốc thời gian sau.",
    saveChanges: "Lưu thay đổi",
    save: "Lưu mốc thời gian của tôi",
    remove: "Xóa mốc thời gian của tôi",
    failed: "Chưa gửi được. Vui lòng thử lại sau ít phút.",
    failedConnection: "Chưa gửi được, thường là do mất kết nối.",
    failedShort: "Chưa gửi được.",
    done: VI_DONE,
    server: fromServer(
      VI_DONE,
      {
        permOnly: "Mốc thời gian chỉ được ghi theo số hồ sơ PERM.",
        malformed: "Yêu cầu không đúng định dạng.",
        hourly: "Bạn đã lưu đủ số lần cho một giờ. Vui lòng thử lại sau.",
        paused: "Hôm nay tạm ngưng nhận mốc thời gian mới. Vui lòng thử lại vào ngày mai.",
        noTimeline: "Trình duyệt này chưa có mốc thời gian nào cho hồ sơ này.",
      },
      (n) =>
        `Hồ sơ này đã có ${n} mốc thời gian từ kết nối này. Đó là mức tối đa một kết nối có thể thêm cho một hồ sơ.`,
    ),
    problem: problems(
      {
        choice: (name) => `Giá trị ${name} đã chọn không nằm trong các lựa chọn của mẫu này.`,
        names: {
          category: "diện",
          country: "quốc gia",
          route: "hướng xử lý",
          i140Center: "cơ quan xét I-140",
          rfeForm: "mẫu đơn của RFE",
          rfeReason: "lý do RFE",
          rfeOutcome: "kết quả RFE",
        },
        date: "Nhập mỗi ngày theo dạng YYYY-MM-DD, từ năm 2005 trở đi và không phải ngày trong tương lai.",
        noDates: "Thêm ít nhất một ngày sau PERM để ghi lại mốc thời gian.",
        i140Order: "Ngày duyệt I-140 sớm hơn ngày nộp.",
        greenCardOrder: "Ngày thẻ xanh sớm hơn ngày nộp I-485.",
        rfeOrder: "Ngày trả lời RFE sớm hơn ngày của RFE.",
        rfeForm: "Hãy chọn mẫu đơn mà RFE yêu cầu.",
        adjustmentOnly: (label) =>
          `"${label}" chỉ áp dụng cho điều chỉnh tình trạng tại Mỹ, không áp dụng cho thủ tục lãnh sự.`,
      },
      VI_DATES,
    ),
    categories: {
      eb2: "EB-2",
      eb3: "EB-3 chuyên gia hoặc lao động có tay nghề",
      "eb3-other": "EB-3 lao động khác",
    },
    countries: {
      row: "Các nước còn lại",
      india: "Ấn Độ",
      china: "Trung Quốc (sinh tại Trung Quốc đại lục)",
      mexico: "Mexico",
      philippines: "Philippines",
    },
    routes: { adjustment: "Điều chỉnh tình trạng tại Mỹ (I-485)", consular: "Thủ tục lãnh sự ở nước ngoài" },
    centers: { nebraska: "Nebraska Service Center", texas: "Texas Service Center", other: "Văn phòng khác" },
    dates: VI_DATES,
    stops: {
      i140FiledOn: "Nộp I-140",
      i140ApprovedOn: "I-140 được duyệt",
      i485FiledOn: "Nộp I-485",
      eadOn: "EAD",
      apOn: "Advance parole",
      interviewOn: "Phỏng vấn",
      greenCardOn: "Thẻ xanh",
    },
    rfeReasons: {
      "ability-to-pay": "Khả năng trả lương của chủ lao động",
      experience: "Thư kinh nghiệm hoặc trình độ",
      education: "Bằng cấp hoặc kết quả đánh giá bằng",
      "job-offer": "Lời mời làm việc hoặc quan hệ với chủ lao động",
      "perm-docs": "Giấy tờ PERM bị thiếu hoặc không khớp",
      medical: "Khám sức khỏe (I-693)",
      "supplement-j": "Supplement J hoặc xác nhận công việc",
      status: "Lịch sử tình trạng di trú",
      "civil-docs": "Giấy khai sinh hoặc giấy tờ hộ tịch khác",
      other: "Lý do khác",
    },
    rfeOutcomes: { pending: "Vẫn đang chờ", approved: "Được duyệt sau khi trả lời", denied: "Bị từ chối" },
  },
} satisfies Messages<MilestonesText>;
