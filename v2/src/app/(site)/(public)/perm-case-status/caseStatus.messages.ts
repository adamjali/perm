import type { FlagProgram } from "@/lib/flagCaseNumber";
import type { Messages } from "@/lib/i18n/lang";
import { DAYS_PER_MONTH } from "@convex/lib/time";

/**
 * The case status page's own words, in English and the five translations (plan: .planning/i18n-data-pages.md).
 *
 * What stays as printed in every language: DOL's status words, form names (ETA-9089), program names (PERM,
 * H-1B, LCA), case numbers and agency abbreviations (DOL, USCIS), each glossed where it first appears. The
 * terms follow each language's guide (src/lib/i18n/guide/*.tsx).
 */
/** A wait to the nearest half month, or in days when it's under a month (lib/board.ts's aboutMonths rule). */
export type WaitFigure = { months: number } | { days: number };

export function waitFigure(days: number): WaitFigure {
  const halves = Math.round(days / (DAYS_PER_MONTH / 2));
  return halves < 2 ? { days: Math.max(1, Math.round(days)) } : { months: halves / 2 };
}

/** The "how long" figures, each already formatted in the page's language; null when DOL's record lacks it. */
export interface HowLongWords {
  day: string | null;
  wait: string | null;
  frontier: string | null;
  avgDays: string | null;
  decidedIn: string | null;
  asOf: string | null;
}

/** Joins the parts a language built, or falls back to where DOL's own figures are. */
function sentences(parts: (string | null)[], fallback: string): string {
  const kept = parts.filter((x): x is string => !!x);
  return kept.length ? kept.join(" ") : fallback;
}

export interface CaseStatusText {
  /** The page's <title> and its share card. */
  metaTitle: string;
  metaDescription: string;
  /** The heading names the program the typed number belongs to. */
  heading: Record<FlagProgram, string>;
  intro: string;
  checkAnother: string;
  caseNumber: string;
  faqTitle: string;
  faqs: readonly { q: string; a: string }[];
  /** A typed value that isn't a case number: nothing was looked up. */
  malformedLead: string;
  malformedBody: string;
  receiptLead: string;
  receiptBody: string;
  receiptButton: string;
  provenanceGist: string;
  provenanceBody: string;
  checkYourself: string;
  readingWait: { label: string; note: string };
  readingQueue: { label: string; note: string };
  readingTitle: string;
  /** A wait in the language's words: months to the nearest half, or days under a month. */
  waitWords: (w: WaitFigure, fmt: (n: number) => string) => string;
  /**
   * "How long does PERM take right now", from today's readings: what DOL's newest decided cases had waited,
   * then DOL's own month and average, dated. A part with no figure is left out. English answers with
   * `howLongSentence` (lib/dolNow.ts), the processing-times page's own sentence.
   */
  howLong: (f: HowLongWords) => string;
  /** Translated pages only: what the reader is looking at, and where the authority is. */
  machine: string;
  readInEnglish: string;
}

export const CASE_STATUS = {
  en: {
    metaTitle: "PERM Case Status: Check and Track a Case",
    metaDescription:
      "Look up a PERM case number: its status in plain English, how many undecided cases were filed before it, and the employer's own record with DOL.",
    heading: {
      perm: "Check and track your PERM case status",
      pwd: "Check a prevailing wage request",
      lca: "Check an LCA",
      seasonal: "Check an H-2A, H-2B or CW-1 filing",
    },
    intro:
      "Its status in plain English, where it sits in DOL's queue, an estimated decision date, and a free email the moment it changes. Wage request, LCA, H-2A, H-2B and CW-1 numbers work too. No account needed.",
    checkAnother: "Check another case",
    caseNumber: "Case number",
    faqTitle: "Questions about this page",
    faqs: [
      {
        q: "How do I track my PERM case?",
        a: "Enter its case number above. The page shows DOL's status for it in plain English, how many cases filed before it are still waiting, and when DOL is likely to decide it. To hear the moment it changes, add your email under the answer. It's free and needs no account.",
      },
      {
        q: "Can I get an email when my PERM case status changes?",
        a: "Yes, free and with no account. A watched case is checked against DOL's record every 5 minutes on weekdays from 7 AM to 9 PM Eastern, and every half hour otherwise, and a status change is emailed at once. The watch carries on for a year after DOL decides, in case of an appeal or a reversal, and every email has a one-click way to stop. Wage requests and H-1B LCAs work the same way.",
      },
      {
        q: "How long does PERM take right now?",
        a: "{{howLong}} Your own case's estimate, from its filing day and the cases still waiting ahead of it, shows once you enter its number.",
      },
      {
        q: "Where do I find my PERM case number?",
        a: "On the ETA-9089 filing receipt, and on any status notice DOL sent the employer. Current ones look like G-100-26125-868956; cases filed in 2022 and 2023 use a shorter form like A-23043-00641, and both work here. The employer's attorney has it if you don't.",
      },
      {
        q: "Is this DOL's official status?",
        a: "It's DOL's own record, read from its case-status search: every pending case several times a day, every case at least once a day, and a case someone has an alert on every 5 minutes on weekdays. DOL publishes no documented API for it, so this is the same endpoint its search page uses. Between checks, a newly decided case shows at DOL first, and DOL is the authority for any single case.",
      },
      {
        q: "Is the estimated decision date a prediction for my case?",
        a: "It's an estimate, labeled as one. It counts the cases filed before yours that are still waiting and divides by how many DOL has been deciding a day, and its range comes from how far recent estimates landed from the real decisions. It's checkable arithmetic over DOL's own record, and it isn't a promise about any single case.",
      },
      {
        q: "Why won't you tell me my odds of being certified?",
        a: "A single odds figure would read as precision the data can't support. The measured denial factors aren't independent, so blending them into one score hides which one is doing the work. The denial-rate pages publish the measured rates separately and refuse the blend on purpose. What's real, and shown, is the employer's published record across its own decided cases.",
      },
      {
        q: "My case isn't here. Is something wrong?",
        a: "Almost certainly not. If we don't already hold your number, we ask DOL's case system for it and record what comes back, so a recent filing usually turns up. A wrong digit still makes a well-formed number, so check that first. DOL's published files reach back to fiscal year 2016; a case older than that, and no longer in DOL's live search, may not be found.",
      },
      {
        q: "What does my case number actually mean?",
        a: "The current format encodes its own filing date. In G-100-26125-868956, the 26 is the year and the 125 is the day of that year, so it decodes to May 5, 2026. Measured against 20,000 cases in DOL's records, that decoded date matches exactly 89% of the time and is a day or two off otherwise. The older three-part format, like A-23043-00641, doesn't: the same reading lands 13% of the time, so the lookup won't decode one rather than guess a filing month.",
      },
      {
        q: "Do you store the case number I type in?",
        a: "No. It goes into the page's address so you can bookmark or share the result, and it's stripped out of analytics before anything is sent. Nothing is written down and nothing goes to a third party.",
      },
    ],
    malformedLead: "That isn't the shape of a case number,",
    malformedBody: "so nothing was looked up. PERM numbers look like G-100-26125-868956 (A-23043-00641 for 2022 and 2023) and are on the ETA-9089 receipt. Wage requests start with P, H-1B LCAs with I, H-2A and H-2B cases with H (an H-2A job order with JO-A), and CW-1 with C.",
    receiptLead: "Holding a USCIS receipt number?",
    receiptBody: "Three letters and ten digits, like EAC2190123456, is USCIS's record of the I-140 or I-485, not DOL's record of the PERM. It has its own page.",
    receiptButton: "Check a USCIS receipt instead",
    provenanceGist: "Read from DOL's own case-status search, every case daily. DOL is the authority.",
    provenanceBody: "These statuses are read from DOL directly. The FLAG case-status search answers a batch lookup, and we run it against every case once a day, against every undecided case at least twice a day (three times on weekdays), and against cases with an alert on them every 5 minutes on weekdays (every half hour at night and at weekends). DOL publishes no documented API for this, so it is the same endpoint their own search page uses rather than a supported one. The date shown on each case is when our check saw it, and it is a snapshot rather than a live feed. DOL is the authority for any case and this page is never a substitute for the determination letter.",
    checkYourself: "Check it yourself at flag.dol.gov",
    readingWait: { label: "How long the wait runs", note: "The lookup counts what's in front of a case. The calculator gives the whole range, from cases DOL has decided." },
    readingQueue: { label: "The whole queue", note: "Every filing month DOL still has undecided cases in, and where the work front sits." },
    readingTitle: "The rules behind these numbers",
    waitWords: () => "",
    howLong: () => "",
    machine: "",
    readInEnglish: "",
  },
  es: {
    metaTitle: "Estado de un caso PERM: consulte y siga su caso",
    metaDescription:
      "Consulte un número de caso PERM: su estado explicado, cuántos casos sin decidir se presentaron antes y el historial del empleador con el DOL.",
    heading: {
      perm: "Consulte y siga el estado de su caso PERM",
      pwd: "Consulte una solicitud de salario prevaleciente",
      lca: "Consulte una LCA",
      seasonal: "Consulte una solicitud H-2A, H-2B o CW-1",
    },
    intro:
      "Su estado explicado, su lugar en la fila del Departamento de Trabajo (DOL), una fecha estimada de decisión y un correo gratis en cuanto cambie. También sirven los números de salario prevaleciente, LCA, H-2A, H-2B y CW-1. No necesita cuenta.",
    checkAnother: "Consultar otro caso",
    caseNumber: "Número de caso",
    faqTitle: "Preguntas sobre esta página",
    faqs: [
      {
        q: "¿Cómo sigo mi caso PERM?",
        a: "Escriba su número de caso arriba. La página muestra su estado según el DOL, explicado, cuántos casos presentados antes siguen esperando y cuándo es probable que el DOL lo decida. Para enterarse en cuanto cambie, añada su correo debajo de la respuesta. Es gratis y no necesita cuenta.",
      },
      {
        q: "¿Puedo recibir un correo cuando cambie el estado de mi caso PERM?",
        a: "Sí, gratis y sin cuenta. Un caso vigilado se compara con el registro del DOL cada 5 minutos en días hábiles, de 7 a. m. a 9 p. m. hora del Este, y cada media hora el resto del tiempo, y un cambio de estado se envía por correo de inmediato. La vigilancia sigue un año después de que el DOL decida, por si hay una apelación o una revocación, y cada correo tiene un enlace para dejar de recibirlos con un clic. Las solicitudes de salario prevaleciente y las LCA de H-1B funcionan igual.",
      },
      {
        q: "¿Cuánto tarda un PERM ahora mismo?",
        a: "{{howLong}} La estimación de su propio caso, según su día de presentación y los casos que siguen esperando delante, aparece cuando escribe su número.",
      },
      {
        q: "¿Dónde encuentro mi número de caso PERM?",
        a: "En el recibo de presentación del ETA-9089 y en cualquier aviso de estado que el DOL haya enviado al empleador. Los actuales se ven así: G-100-26125-868956. Los casos presentados en 2022 y 2023 usan una forma más corta, como A-23043-00641, y ambas funcionan aquí. Si usted no lo tiene, el abogado del empleador sí.",
      },
      {
        q: "¿Es el estado oficial del DOL?",
        a: "Es el registro del propio DOL, leído de su búsqueda de estado de casos: cada caso pendiente varias veces al día, todos los casos al menos una vez al día, y cada 5 minutos en días hábiles un caso que alguien vigila con una alerta. El DOL no publica una API documentada para esto, así que es la misma dirección que usa su página de búsqueda. Entre una revisión y otra, un caso recién decidido aparece primero en el DOL, y el DOL es la autoridad para cualquier caso.",
      },
      {
        q: "¿La fecha estimada de decisión es una predicción para mi caso?",
        a: "Es una estimación, marcada como tal. Cuenta los casos presentados antes que el suyo que siguen esperando y los divide entre cuántos ha decidido el DOL al día, y su rango sale de qué tan lejos cayeron las estimaciones recientes de las decisiones reales. Es aritmética verificable sobre el propio registro del DOL, no una promesa sobre ningún caso en particular.",
      },
      {
        q: "¿Por qué no me dicen qué probabilidad tengo de que me certifiquen?",
        a: "Una sola cifra de probabilidad daría una precisión que los datos no tienen. Los factores de negación medidos no son independientes entre sí, así que combinarlos en un solo puntaje esconde cuál de ellos pesa. Las páginas de tasas de negación publican cada tasa por separado y evitan la mezcla a propósito. Lo que sí es real, y se muestra, es el historial publicado del empleador en sus propios casos decididos.",
      },
      {
        q: "Mi caso no aparece. ¿Hay algún problema?",
        a: "Casi seguro que no. Si todavía no tenemos su número, se lo preguntamos al sistema de casos del DOL y guardamos la respuesta, así que un caso reciente suele aparecer. Un dígito equivocado igual forma un número válido, así que revise eso primero. Los archivos publicados del DOL llegan hasta el año fiscal 2016; un caso más antiguo, que ya no esté en la búsqueda en vivo del DOL, puede no aparecer.",
      },
      {
        q: "¿Qué significa mi número de caso?",
        a: "El formato actual lleva su propia fecha de presentación. En G-100-26125-868956, el 26 es el año y el 125 es el día de ese año, así que corresponde al 5 de mayo de 2026. Comparada con 20.000 casos de los registros del DOL, esa fecha coincide exactamente el 89 % de las veces y, si no, difiere en uno o dos días. El formato antiguo de tres partes, como A-23043-00641, no funciona así: la misma lectura acierta el 13 % de las veces, por eso esta página no lo descifra en vez de adivinar un mes de presentación.",
      },
      {
        q: "¿Guardan el número de caso que escribo?",
        a: "No. Queda en la dirección de la página para que pueda guardar o compartir el resultado, y se quita de las estadísticas antes de enviar nada. No se anota en ningún lado ni se entrega a terceros.",
      },
    ],
    malformedLead: "Eso no tiene la forma de un número de caso,",
    malformedBody: "así que no se consultó nada. Los números PERM se ven así: G-100-26125-868956 (A-23043-00641 para 2022 y 2023) y están en el recibo del ETA-9089. Las solicitudes de salario empiezan con P, las LCA de H-1B con I, los casos H-2A y H-2B con H (una orden de trabajo H-2A con JO-A) y los CW-1 con C.",
    receiptLead: "¿Tiene un número de recibo de USCIS?",
    receiptBody: "Tres letras y diez dígitos, como EAC2190123456, es el registro de USCIS de la I-140 o la I-485, no el registro del DOL sobre el PERM. Tiene su propia página.",
    receiptButton: "Consultar un recibo de USCIS (en inglés)",
    provenanceGist: "Se lee de la búsqueda de estado de casos del propio DOL, todos los casos a diario. El DOL es la autoridad.",
    provenanceBody: "Estos estados se leen directamente del DOL. La búsqueda de estado de casos FLAG responde consultas por lotes, y la hacemos para todos los casos una vez al día, para cada caso sin decidir al menos dos veces al día (tres en días hábiles) y para los casos con alerta cada 5 minutos en días hábiles (cada media hora de noche y los fines de semana). El DOL no publica una API documentada para esto, así que usamos la misma dirección que usa su propia página de búsqueda. La fecha que aparece en cada caso es cuándo lo vio nuestra revisión: es una foto, no una transmisión en vivo. El DOL es la autoridad sobre cada caso, y esta página nunca reemplaza la carta de decisión.",
    checkYourself: "Compruébelo usted mismo en flag.dol.gov",
    readingWait: { label: "Cuánto dura la espera (en inglés)", note: "La consulta cuenta lo que hay delante de un caso. La calculadora da el rango completo, a partir de casos que el DOL ya decidió." },
    readingQueue: { label: "Toda la fila (en inglés)", note: "Cada mes de presentación en el que el DOL aún tiene casos sin decidir, y dónde va el trabajo." },
    readingTitle: "Las reglas detrás de estas cifras",
    waitWords: (w, fmt) =>
      "days" in w ? `unos ${fmt(w.days)} ${w.days === 1 ? "día" : "días"}` : w.months === 1 ? "un mes" : `unos ${fmt(w.months)} meses`,
    howLong: (f) => {
      const dol = [
        f.frontier ? `el análisis del DOL está trabajando casos presentados en ${f.frontier}` : null,
        f.avgDays
          ? `su promedio publicado desde la presentación hasta una decisión es de ${f.avgDays} días${f.decidedIn ? `, medido sobre los casos que decidió en ${f.decidedIn}` : ""}`
          : null,
      ].filter(Boolean).join(", y ");
      return sentences(
        [
          f.day && f.wait ? `Los casos PERM que el DOL decidió el ${f.day} llevaban ${f.wait} esperando desde su presentación.` : null,
          dol ? (f.asOf ? `Al ${f.asOf}, ${dol}.` : `${dol.charAt(0).toUpperCase()}${dol.slice(1)}.`) : null,
        ],
        "No se pudieron leer las cifras del DOL en este momento; la propia página del DOL, flag.dol.gov/processingtimes, las tiene.",
      );
    },
    machine:
      "Esta página fue traducida por una máquina y ningún hablante nativo la ha revisado. Los términos del DOL quedan en inglés, como los publica el DOL. La versión en inglés es la que vale.",
    readInEnglish: "Ver en inglés",
  },
  zh: {
    metaTitle: "PERM 案件状态查询：查询并追踪案件",
    metaDescription: "输入 PERM 案件编号，查看状态说明、在它之前递交且尚未判定的案件数量，以及雇主在劳工部的记录。",
    heading: {
      perm: "查询并追踪您的 PERM 案件状态",
      pwd: "查询现行工资认定申请",
      lca: "查询劳工情况申请（LCA）",
      seasonal: "查询 H-2A、H-2B 或 CW-1 申请",
    },
    intro:
      "用通俗的话说明案件状态、它在劳工部（DOL）队列中的位置、预计的判定日期，状态一变化就免费发邮件通知。现行工资认定、LCA、H-2A、H-2B 和 CW-1 编号同样适用。无需注册。",
    checkAnother: "查询其他案件",
    caseNumber: "案件编号",
    faqTitle: "关于本页的常见问题",
    faqs: [
      {
        q: "如何追踪我的 PERM 案件？",
        a: "在上方输入案件编号。页面会用通俗的话显示劳工部（DOL）记录的案件状态、比它早递交且仍在等待的案件有多少，以及劳工部可能何时作出判定。想在状态变化时第一时间知道，请在答案下方填写您的邮箱。免费，无需注册。",
      },
      {
        q: "我的 PERM 案件状态变化时能收到邮件吗？",
        a: "可以，免费且无需注册。被关注的案件在工作日美国东部时间早上 7 点到晚上 9 点每 5 分钟与劳工部记录核对一次，其余时间每半小时一次，状态一有变化就立即发邮件。劳工部判定后还会继续关注一年，以防上诉或改判，每封邮件都可以一键退订。现行工资认定申请和 H-1B LCA 也同样适用。",
      },
      {
        q: "现在 PERM 需要多长时间？",
        a: "{{howLong}} 输入您的案件编号后，会显示根据递交日期和排在前面仍在等待的案件得出的个人估算。",
      },
      {
        q: "在哪里找到我的 PERM 案件编号？",
        a: "编号印在 ETA-9089 递交回执上，劳工部寄给雇主的任何状态通知上也有。现行编号的样子是 G-100-26125-868956；2022 年和 2023 年递交的案件使用较短的格式，例如 A-23043-00641，两种格式在这里都能查询。如果您手上没有编号，雇主的律师会有。",
      },
      {
        q: "这是劳工部的官方状态吗？",
        a: "这是劳工部自己的记录，读取自其案件状态查询：每个待决案件每天查询多次，所有案件每天至少一次，有人设了提醒的案件在工作日每 5 分钟一次。劳工部没有为此公布正式的 API，所以这里使用的是其查询页面本身所用的同一个接口。两次查询之间，新判定的案件会先在劳工部显示；任何单个案件都以劳工部为准。",
      },
      {
        q: "预计判定日期是对我案件的预测吗？",
        a: "这是估算，并标明为估算。它统计比您早递交且仍在等待的案件数，再除以劳工部近来每天判定的数量；区间来自近期估算与实际判定之间的偏差。这是基于劳工部自身记录、可以核对的计算，并不是对任何单个案件的承诺。",
      },
      {
        q: "为什么不告诉我获批的概率？",
        a: "单一的概率数字会显得比数据实际支持的更精确。已测得的拒批因素彼此并不独立，把它们合成一个分数会掩盖真正起作用的是哪一个。拒批率页面会分别公布每一项测得的比率，并刻意不做合成。真实且可以展示的，是雇主在自己已判定案件中的公开记录。",
      },
      {
        q: "我的案件查不到，是出了什么问题吗？",
        a: "几乎可以肯定没有问题。如果我们还没有您的编号，会向劳工部的案件系统查询并记录结果，所以新递交的案件通常都能找到。输错一位数字仍会构成格式正确的编号，请先核对这一点。劳工部公布的文件最早到 2016 财年；比这更早、且已不在劳工部实时查询中的案件可能查不到。",
      },
      {
        q: "我的案件编号代表什么？",
        a: "现行格式自带递交日期。在 G-100-26125-868956 中，26 是年份，125 是当年的第几天，因此对应 2026 年 5 月 5 日。与劳工部记录中的 20,000 个案件比对，这个日期有 89% 的情况完全一致，其余情况相差一两天。较早的三段式格式（例如 A-23043-00641）则不行：同样的读法只有 13% 正确，因此本页不解读这种编号，而不去猜测递交月份。",
      },
      {
        q: "你们会保存我输入的案件编号吗？",
        a: "不会。编号只出现在网页地址中，方便您收藏或分享结果；在发送任何统计数据之前都会先删除编号。我们不做记录，也不交给任何第三方。",
      },
    ],
    malformedLead: "这不是案件编号的格式，",
    malformedBody: "因此没有进行查询。PERM 编号的样子是 G-100-26125-868956（2022 年和 2023 年的是 A-23043-00641 这种），印在 ETA-9089 回执上。现行工资认定申请以 P 开头，H-1B 的 LCA 以 I 开头，H-2A 和 H-2B 案件以 H 开头（H-2A 职位订单以 JO-A 开头），CW-1 以 C 开头。",
    receiptLead: "您手上的是移民局（USCIS）收据编号吗？",
    receiptBody: "三个字母加十位数字（例如 EAC2190123456）是移民局关于 I-140 或 I-485 的记录，而不是劳工部关于 PERM 的记录。它有自己的查询页面。",
    receiptButton: "改查移民局收据（英文页面）",
    provenanceGist: "数据来自劳工部自己的案件状态查询，每个案件每天查询。以劳工部为准。",
    provenanceBody: "这些状态直接读取自劳工部。FLAG 案件状态查询支持批量查询：我们每天对所有案件查询一次，对每个未判定案件每天至少查询两次（工作日三次），对有人订阅提醒的案件工作日每 5 分钟查询一次（夜间和周末每半小时一次）。劳工部没有公开文档化的接口，因此我们使用的是其查询页面本身所用的地址。每个案件显示的日期是我们查询时看到的日期，是一个快照而不是实时数据。任何案件都以劳工部为准，本页永远不能代替判定信。",
    checkYourself: "在 flag.dol.gov 自行核对",
    readingWait: { label: "等待需要多久（英文页面）", note: "查询页统计排在一个案件前面的情况。计算器根据劳工部已判定的案件给出完整区间。" },
    readingQueue: { label: "整个队列（英文页面）", note: "劳工部仍有未判定案件的每个递交月份，以及审理进度所在的位置。" },
    readingTitle: "这些数字背后的规则",
    waitWords: (w, fmt) => ("days" in w ? `约 ${fmt(w.days)} 天` : `约 ${fmt(w.months)} 个月`),
    howLong: (f) => {
      const dol = [
        f.frontier ? `劳工部的分析审查正在处理 ${f.frontier}递交的案件` : null,
        f.avgDays ? `其公布的从递交到判定的平均时间为 ${f.avgDays} 天${f.decidedIn ? `（依据其在 ${f.decidedIn}判定的案件）` : ""}` : null,
      ].filter(Boolean).join("，");
      return sentences(
        [
          f.day && f.wait ? `劳工部在 ${f.day}判定的 PERM 案件，从递交起已等待${f.wait}。` : null,
          dol ? (f.asOf ? `截至 ${f.asOf}，${dol}。` : `${dol}。`) : null,
        ],
        "目前无法读取劳工部的数据；劳工部自己的页面 flag.dol.gov/processingtimes 上有这些数字。",
      );
    },
    machine: "本页由机器翻译，尚未经过母语人士审阅。劳工部的用语保留英文原文。以英文版本为准。",
    readInEnglish: "查看英文版",
  },
  "pt-br": {
    metaTitle: "Status de caso PERM: consulte e acompanhe",
    metaDescription:
      "Consulte um número de caso PERM: o status explicado, quantos casos sem decisão foram protocolados antes dele e o histórico do empregador no DOL.",
    heading: {
      perm: "Consulte e acompanhe o status do seu caso PERM",
      pwd: "Consulte um pedido de salário prevalecente",
      lca: "Consulte uma LCA",
      seasonal: "Consulte um pedido H-2A, H-2B ou CW-1",
    },
    intro:
      "O status explicado, a posição na fila do Departamento do Trabalho (DOL), uma data estimada de decisão e um e-mail grátis assim que mudar. Números de salário prevalecente, LCA, H-2A, H-2B e CW-1 também funcionam. Não precisa de conta.",
    checkAnother: "Consultar outro caso",
    caseNumber: "Número do caso",
    faqTitle: "Perguntas sobre esta página",
    faqs: [
      {
        q: "Como acompanho meu caso PERM?",
        a: "Digite o número do caso acima. A página mostra o status do DOL explicado, quantos casos protocolados antes dele ainda esperam e quando o DOL deve decidi-lo. Para saber assim que mudar, adicione seu e-mail abaixo da resposta. É grátis e não precisa de conta.",
      },
      {
        q: "Posso receber um e-mail quando o status do meu caso PERM mudar?",
        a: "Sim, grátis e sem conta. Um caso acompanhado é conferido com o registro do DOL a cada 5 minutos nos dias úteis, das 7h às 21h no horário do Leste dos EUA, e a cada meia hora no resto do tempo, e uma mudança de status é enviada por e-mail na hora. O acompanhamento continua por um ano depois da decisão do DOL, para o caso de recurso ou reversão, e todo e-mail tem um link para parar com um clique. Pedidos de salário prevalecente e LCAs de H-1B funcionam do mesmo jeito.",
      },
      {
        q: "Quanto tempo o PERM está levando agora?",
        a: "{{howLong}} A estimativa do seu próprio caso, pelo dia do protocolo e pelos casos que ainda esperam à frente dele, aparece quando você digita o número.",
      },
      {
        q: "Onde encontro meu número de caso PERM?",
        a: "No recibo de protocolo do ETA-9089 e em qualquer aviso de status que o DOL tenha enviado ao empregador. Os atuais são assim: G-100-26125-868956. Casos protocolados em 2022 e 2023 usam um formato mais curto, como A-23043-00641, e os dois funcionam aqui. Se você não tiver, o advogado do empregador tem.",
      },
      {
        q: "É o status oficial do DOL?",
        a: "É o próprio registro do DOL, lido da sua busca de status de casos: cada caso pendente várias vezes ao dia, todos os casos pelo menos uma vez ao dia, e a cada 5 minutos nos dias úteis um caso que alguém acompanha com um alerta. O DOL não publica uma API documentada para isso, então é o mesmo endereço que a página de busca dele usa. Entre uma conferência e outra, um caso recém-decidido aparece primeiro no DOL, e o DOL é a autoridade para qualquer caso.",
      },
      {
        q: "A data estimada de decisão é uma previsão para o meu caso?",
        a: "É uma estimativa, marcada como tal. Ela conta os casos protocolados antes do seu que ainda esperam e divide pelo número que o DOL tem decidido por dia, e a faixa vem de quão longe as estimativas recentes ficaram das decisões reais. É uma conta verificável sobre o próprio registro do DOL, não uma promessa sobre nenhum caso.",
      },
      {
        q: "Por que vocês não dizem minhas chances de certificação?",
        a: "Um único número de chance passaria uma precisão que os dados não têm. Os fatores de negação medidos não são independentes entre si, então juntá-los em uma nota esconde qual deles pesa de verdade. As páginas de taxas de negação publicam cada taxa separadamente e evitam essa mistura de propósito. O que é real, e aparece aqui, é o histórico publicado do empregador nos próprios casos decididos.",
      },
      {
        q: "Meu caso não aparece. Há algo errado?",
        a: "Quase certamente não. Se ainda não temos o seu número, perguntamos ao sistema de casos do DOL e guardamos a resposta, então um protocolo recente costuma aparecer. Um dígito errado ainda forma um número válido, então confira isso primeiro. Os arquivos publicados do DOL vão até o ano fiscal de 2016; um caso mais antigo, que já não esteja na busca ao vivo do DOL, pode não ser encontrado.",
      },
      {
        q: "O que significa meu número de caso?",
        a: "O formato atual traz a própria data de protocolo. Em G-100-26125-868956, o 26 é o ano e o 125 é o dia daquele ano, então corresponde a 5 de maio de 2026. Comparada com 20.000 casos dos registros do DOL, essa data bate exatamente em 89% das vezes e, nas outras, erra por um ou dois dias. O formato antigo de três partes, como A-23043-00641, não funciona assim: a mesma leitura acerta em 13% das vezes, por isso esta página não o decifra em vez de chutar um mês de protocolo.",
      },
      {
        q: "Vocês guardam o número de caso que eu digito?",
        a: "Não. Ele fica no endereço da página para você salvar ou compartilhar o resultado, e é removido das estatísticas antes de qualquer envio. Nada é anotado e nada vai para terceiros.",
      },
    ],
    malformedLead: "Isso não tem o formato de um número de caso,",
    malformedBody: "então nada foi consultado. Os números PERM são assim: G-100-26125-868956 (A-23043-00641 para 2022 e 2023) e estão no recibo do ETA-9089. Pedidos de salário começam com P, LCAs de H-1B com I, casos H-2A e H-2B com H (uma ordem de trabalho H-2A com JO-A) e CW-1 com C.",
    receiptLead: "Tem um número de recibo do USCIS?",
    receiptBody: "Três letras e dez dígitos, como EAC2190123456, é o registro do USCIS da I-140 ou da I-485, não o registro do DOL sobre o PERM. Ele tem página própria.",
    receiptButton: "Consultar um recibo do USCIS (em inglês)",
    provenanceGist: "Lido da busca de status de casos do próprio DOL, todos os casos diariamente. O DOL é a autoridade.",
    provenanceBody: "Estes status são lidos diretamente do DOL. A busca de status de casos FLAG responde consultas em lote, e a fazemos para todos os casos uma vez por dia, para cada caso sem decisão pelo menos duas vezes por dia (três em dias úteis) e para casos com alerta a cada 5 minutos em dias úteis (a cada meia hora à noite e nos fins de semana). O DOL não publica uma API documentada para isso, então usamos o mesmo endereço que a página de busca dele usa. A data mostrada em cada caso é quando nossa consulta o viu: é uma foto, não uma transmissão ao vivo. O DOL é a autoridade sobre cada caso, e esta página nunca substitui a carta de decisão.",
    checkYourself: "Confira você mesmo em flag.dol.gov",
    readingWait: { label: "Quanto tempo dura a espera (em inglês)", note: "A consulta conta o que está à frente de um caso. A calculadora dá a faixa completa, a partir dos casos que o DOL já decidiu." },
    readingQueue: { label: "A fila inteira (em inglês)", note: "Cada mês de protocolo em que o DOL ainda tem casos sem decisão, e onde está o trabalho." },
    readingTitle: "As regras por trás destes números",
    waitWords: (w, fmt) =>
      "days" in w ? `cerca de ${fmt(w.days)} ${w.days === 1 ? "dia" : "dias"}` : w.months === 1 ? "cerca de um mês" : `cerca de ${fmt(w.months)} meses`,
    howLong: (f) => {
      const dol = [
        f.frontier ? `a análise do DOL está trabalhando casos protocolados em ${f.frontier}` : null,
        f.avgDays
          ? `a média publicada do protocolo até a decisão é de ${f.avgDays} dias${f.decidedIn ? `, medida nos casos que ele decidiu em ${f.decidedIn}` : ""}`
          : null,
      ].filter(Boolean).join(", e ");
      return sentences(
        [
          f.day && f.wait ? `Os casos PERM que o DOL decidiu em ${f.day} esperaram ${f.wait} desde o protocolo.` : null,
          dol ? (f.asOf ? `Em ${f.asOf}, ${dol}.` : `${dol.charAt(0).toUpperCase()}${dol.slice(1)}.`) : null,
        ],
        "Não foi possível ler os números do DOL agora; a própria página do DOL, flag.dol.gov/processingtimes, tem esses dados.",
      );
    },
    machine:
      "Esta página foi traduzida por máquina e não foi revisada por um falante nativo. Os termos do DOL ficam em inglês, como o DOL os publica. A versão em inglês é a que vale.",
    readInEnglish: "Ver em inglês",
  },
  ko: {
    metaTitle: "PERM 케이스 상태: 케이스 조회와 추적",
    metaDescription:
      "PERM 케이스 번호를 입력하면 상태 설명, 그보다 먼저 접수되어 아직 결정되지 않은 케이스 수, 노동부에서의 고용주 기록을 보여 줍니다.",
    heading: {
      perm: "PERM 케이스 상태 조회 및 추적",
      pwd: "적정임금(PWD) 신청 조회",
      lca: "노동조건신청(LCA) 조회",
      seasonal: "H-2A, H-2B 또는 CW-1 신청 조회",
    },
    intro:
      "상태를 쉬운 말로 설명하고, 노동부(DOL) 대기열에서의 위치와 예상 결정일을 보여 주며, 상태가 바뀌는 즉시 무료로 이메일을 보냅니다. 적정임금, LCA, H-2A, H-2B, CW-1 번호도 조회됩니다. 계정이 필요 없습니다.",
    checkAnother: "다른 케이스 조회",
    caseNumber: "케이스 번호",
    faqTitle: "이 페이지에 대한 질문",
    faqs: [
      {
        q: "PERM 케이스는 어떻게 추적하나요?",
        a: "위에 케이스 번호를 입력하세요. 노동부(DOL) 기록의 상태를 쉬운 말로, 먼저 접수되어 아직 기다리는 케이스가 몇 건인지, 노동부가 언제 결정할 가능성이 높은지 보여 줍니다. 바뀌는 즉시 알고 싶다면 답변 아래에 이메일을 추가하세요. 무료이며 계정이 필요 없습니다.",
      },
      {
        q: "PERM 케이스 상태가 바뀌면 이메일을 받을 수 있나요?",
        a: "네, 무료이며 계정이 필요 없습니다. 지켜보는 케이스는 평일 미국 동부 시간 오전 7시부터 오후 9시까지 5분마다, 그 밖의 시간에는 30분마다 노동부 기록과 대조하며, 상태가 바뀌면 바로 이메일을 보냅니다. 노동부가 결정한 뒤에도 이의 신청이나 번복에 대비해 1년 동안 계속 지켜보며, 모든 이메일에는 한 번의 클릭으로 수신을 멈추는 링크가 있습니다. 적정임금 요청과 H-1B LCA도 똑같이 작동합니다.",
      },
      {
        q: "지금 PERM은 얼마나 걸리나요?",
        a: "{{howLong}} 케이스 번호를 입력하면 접수일과 앞에서 아직 기다리는 케이스를 바탕으로 한 개별 추정치가 표시됩니다.",
      },
      {
        q: "PERM 케이스 번호는 어디에서 찾나요?",
        a: "ETA-9089 접수증과 노동부가 고용주에게 보낸 상태 통지서에 있습니다. 현재 번호는 G-100-26125-868956과 같은 모양이고, 2022년과 2023년에 접수된 케이스는 A-23043-00641처럼 더 짧은 형식을 씁니다. 두 형식 모두 여기에서 조회됩니다. 번호가 없다면 고용주의 변호사가 갖고 있습니다.",
      },
      {
        q: "이것이 노동부의 공식 상태인가요?",
        a: "노동부 자체 기록이며, 케이스 상태 조회에서 읽어 옵니다. 대기 중인 케이스는 하루 여러 번, 모든 케이스는 하루 최소 한 번, 누군가 알림을 설정한 케이스는 평일 5분마다 확인합니다. 노동부는 이를 위한 공식 API를 공개하지 않으므로 노동부 조회 페이지가 쓰는 것과 같은 주소를 사용합니다. 확인과 확인 사이에 새로 결정된 케이스는 노동부에 먼저 나타나며, 개별 케이스는 노동부가 최종 기준입니다.",
      },
      {
        q: "예상 결정일은 제 케이스에 대한 예측인가요?",
        a: "추정치이며, 추정치라고 표시합니다. 먼저 접수되어 아직 기다리는 케이스 수를 노동부가 최근 하루에 결정하는 수로 나누고, 범위는 최근 추정치가 실제 결정과 얼마나 차이 났는지에서 나옵니다. 노동부 자체 기록으로 확인할 수 있는 계산이며, 개별 케이스에 대한 약속이 아닙니다.",
      },
      {
        q: "승인 확률은 왜 알려 주지 않나요?",
        a: "확률 숫자 하나는 데이터가 뒷받침하지 못하는 정밀함처럼 보입니다. 측정된 거절 요인들은 서로 독립적이지 않아서, 하나의 점수로 합치면 어떤 요인이 실제로 작용하는지 가려집니다. 거절률 페이지는 측정된 비율을 각각 따로 공개하고 일부러 합치지 않습니다. 실제로 보여 드릴 수 있는 것은 고용주가 결정받은 자기 케이스들의 공개 기록입니다.",
      },
      {
        q: "제 케이스가 없습니다. 문제가 있나요?",
        a: "거의 확실히 문제없습니다. 아직 번호가 없으면 노동부 케이스 시스템에 물어보고 결과를 기록하므로, 최근 접수된 케이스도 대개 나타납니다. 숫자 하나가 틀려도 형식상 맞는 번호가 되니 먼저 확인해 보세요. 노동부가 공개한 파일은 2016 회계연도까지 거슬러 올라가며, 그보다 오래되어 노동부 실시간 조회에도 없는 케이스는 찾지 못할 수 있습니다.",
      },
      {
        q: "케이스 번호는 무엇을 뜻하나요?",
        a: "현재 형식에는 접수일이 들어 있습니다. G-100-26125-868956에서 26은 연도이고 125는 그해의 몇 번째 날인지를 뜻하므로 2026년 5월 5일이 됩니다. 노동부 기록의 20,000건과 비교하면 이 날짜는 89%가 정확히 일치하고, 나머지는 하루나 이틀 차이가 납니다. A-23043-00641 같은 예전의 세 부분 형식은 그렇지 않아서 같은 방식으로 읽으면 13%만 맞기 때문에, 이 페이지는 접수 월을 추측하지 않고 해석하지 않습니다.",
      },
      {
        q: "입력한 케이스 번호를 저장하나요?",
        a: "아니요. 결과를 즐겨찾기하거나 공유할 수 있도록 페이지 주소에만 들어가며, 통계를 보내기 전에 지워집니다. 어디에도 기록하지 않고 제3자에게 넘기지 않습니다.",
      },
    ],
    malformedLead: "케이스 번호 형식이 아니어서",
    malformedBody: "조회하지 않았습니다. PERM 번호는 G-100-26125-868956과 같은 모양이며(2022년과 2023년 케이스는 A-23043-00641 형식), ETA-9089 접수증에 있습니다. 적정임금 신청은 P로, H-1B LCA는 I로, H-2A와 H-2B 케이스는 H로(H-2A 구인 주문은 JO-A로), CW-1은 C로 시작합니다.",
    receiptLead: "USCIS 접수 번호를 갖고 계신가요?",
    receiptBody: "EAC2190123456처럼 영문 세 글자와 숫자 열 자리로 된 번호는 노동부의 PERM 기록이 아니라 USCIS의 I-140 또는 I-485 기록입니다. 별도의 조회 페이지가 있습니다.",
    receiptButton: "USCIS 접수 번호 조회(영어 페이지)",
    provenanceGist: "노동부 자체의 케이스 상태 조회에서 모든 케이스를 매일 읽어 옵니다. 노동부가 기준입니다.",
    provenanceBody: "이 상태는 노동부에서 직접 읽어 옵니다. FLAG 케이스 상태 조회는 여러 건을 한 번에 조회할 수 있어, 모든 케이스는 하루 한 번, 결정되지 않은 케이스는 하루 최소 두 번(평일 세 번), 알림이 설정된 케이스는 평일 5분마다(야간과 주말에는 30분마다) 조회합니다. 노동부는 이에 대한 공식 API 문서를 공개하지 않으므로, 노동부 조회 페이지가 쓰는 것과 같은 주소를 사용합니다. 각 케이스에 표시된 날짜는 저희 조회가 그 상태를 본 날이며, 실시간 정보가 아니라 그 시점의 기록입니다. 모든 케이스는 노동부가 기준이며, 이 페이지는 결정 통지서를 대신하지 않습니다.",
    checkYourself: "flag.dol.gov에서 직접 확인하기",
    readingWait: { label: "대기 기간(영어 페이지)", note: "조회는 케이스 앞에 있는 것을 셉니다. 계산기는 노동부가 결정한 케이스를 바탕으로 전체 범위를 보여 줍니다." },
    readingQueue: { label: "전체 대기열(영어 페이지)", note: "노동부에 아직 결정되지 않은 케이스가 남아 있는 접수 월과 심사가 진행 중인 위치." },
    readingTitle: "이 숫자들의 기준",
    waitWords: (w, fmt) => ("days" in w ? `약 ${fmt(w.days)}일` : `약 ${fmt(w.months)}개월`),
    howLong: (f) => {
      const dol = [
        f.frontier ? `노동부 분석 심사는 ${f.frontier}에 접수된 케이스를 처리하고 있으며` : null,
        f.avgDays ? `공개된 접수부터 결정까지의 평균은 ${f.avgDays}일입니다${f.decidedIn ? `(${f.decidedIn}에 결정한 케이스 기준)` : ""}` : null,
      ].filter(Boolean).join(", ");
      const tail = dol.endsWith("있으며") ? `${dol.slice(0, -3)}있습니다` : dol;
      return sentences(
        [
          f.day && f.wait ? `노동부가 ${f.day}에 결정한 PERM 케이스는 접수부터 ${f.wait}을 기다렸습니다.` : null,
          tail ? (f.asOf ? `${f.asOf} 기준, ${tail}.` : `${tail}.`) : null,
        ],
        "지금은 노동부 수치를 읽을 수 없습니다. 노동부 페이지 flag.dol.gov/processingtimes에서 확인할 수 있습니다.",
      );
    },
    machine:
      "이 페이지는 기계 번역되었으며 원어민의 검토를 거치지 않았습니다. 노동부의 용어는 노동부가 쓰는 대로 영어로 둡니다. 영어 페이지가 기준입니다.",
    readInEnglish: "영어로 보기",
  },
  vi: {
    metaTitle: "Tình trạng hồ sơ PERM: tra cứu và theo dõi",
    metaDescription:
      "Tra cứu số hồ sơ PERM: tình trạng được giải thích, số hồ sơ chưa có quyết định nộp trước nó và hồ sơ của chủ lao động tại Bộ Lao động.",
    heading: {
      perm: "Tra cứu và theo dõi tình trạng hồ sơ PERM",
      pwd: "Tra cứu đơn xác định mức lương hiện hành",
      lca: "Tra cứu LCA",
      seasonal: "Tra cứu hồ sơ H-2A, H-2B hoặc CW-1",
    },
    intro:
      "Tình trạng được giải thích dễ hiểu, vị trí trong hàng chờ của Bộ Lao động (DOL), ngày quyết định ước tính, và email miễn phí ngay khi có thay đổi. Số hồ sơ lương hiện hành, LCA, H-2A, H-2B và CW-1 cũng tra được. Không cần tài khoản.",
    checkAnother: "Tra cứu hồ sơ khác",
    caseNumber: "Số hồ sơ",
    faqTitle: "Câu hỏi về trang này",
    faqs: [
      {
        q: "Làm sao để theo dõi hồ sơ PERM của tôi?",
        a: "Nhập số hồ sơ ở trên. Trang sẽ cho biết tình trạng theo hồ sơ của Bộ Lao động (DOL) bằng lời dễ hiểu, có bao nhiêu hồ sơ nộp trước vẫn đang chờ, và khi nào DOL có khả năng quyết định. Để biết ngay khi có thay đổi, hãy thêm email bên dưới câu trả lời. Miễn phí và không cần tài khoản.",
      },
      {
        q: "Tôi có thể nhận email khi tình trạng hồ sơ PERM thay đổi không?",
        a: "Có, miễn phí và không cần tài khoản. Hồ sơ được theo dõi sẽ được đối chiếu với hồ sơ của DOL mỗi 5 phút vào ngày làm việc, từ 7 giờ sáng đến 9 giờ tối giờ miền Đông Hoa Kỳ, và mỗi nửa giờ vào thời gian còn lại, và mọi thay đổi tình trạng được gửi email ngay. Việc theo dõi tiếp tục một năm sau khi DOL quyết định, phòng khi có kháng nghị hoặc đảo ngược, và mỗi email đều có liên kết dừng nhận chỉ bằng một cú nhấp. Yêu cầu lương hiện hành và LCA H-1B cũng hoạt động như vậy.",
      },
      {
        q: "Hiện nay PERM mất bao lâu?",
        a: "{{howLong}} Ước tính cho chính hồ sơ của bạn, dựa trên ngày nộp và các hồ sơ vẫn đang chờ phía trước, sẽ hiện ra khi bạn nhập số hồ sơ.",
      },
      {
        q: "Tôi tìm số hồ sơ PERM ở đâu?",
        a: "Trên biên nhận nộp ETA-9089 và trên bất kỳ thông báo tình trạng nào DOL gửi cho chủ lao động. Số hiện nay có dạng G-100-26125-868956; hồ sơ nộp năm 2022 và 2023 dùng dạng ngắn hơn như A-23043-00641, và cả hai đều tra được ở đây. Nếu bạn không có, luật sư của chủ lao động sẽ có.",
      },
      {
        q: "Đây có phải là tình trạng chính thức của DOL không?",
        a: "Đây là hồ sơ của chính DOL, đọc từ công cụ tra cứu tình trạng hồ sơ của họ: mỗi hồ sơ đang chờ được kiểm tra nhiều lần mỗi ngày, mọi hồ sơ ít nhất một lần mỗi ngày, và hồ sơ có người đặt thông báo được kiểm tra mỗi 5 phút vào ngày làm việc. DOL không công bố API chính thức cho việc này, nên đây là cùng địa chỉ mà trang tra cứu của họ sử dụng. Giữa hai lần kiểm tra, hồ sơ vừa được quyết định sẽ hiện trên DOL trước, và DOL là cơ quan có thẩm quyền với từng hồ sơ.",
      },
      {
        q: "Ngày quyết định ước tính có phải là dự đoán cho hồ sơ của tôi không?",
        a: "Đó là ước tính, và được ghi rõ là ước tính. Nó đếm các hồ sơ nộp trước hồ sơ của bạn vẫn đang chờ rồi chia cho số hồ sơ DOL quyết định mỗi ngày gần đây, còn khoảng thời gian dựa trên mức chênh lệch giữa các ước tính gần đây và quyết định thực tế. Đây là phép tính có thể kiểm chứng trên chính hồ sơ của DOL, không phải lời hứa cho bất kỳ hồ sơ nào.",
      },
      {
        q: "Tại sao trang không cho tôi biết khả năng được chấp thuận?",
        a: "Một con số khả năng duy nhất sẽ trông chính xác hơn mức dữ liệu cho phép. Các yếu tố từ chối đã đo không độc lập với nhau, nên gộp chúng thành một điểm sẽ che đi yếu tố nào thật sự có tác động. Các trang tỷ lệ từ chối công bố riêng từng tỷ lệ đã đo và cố ý không gộp lại. Điều có thật, và được hiển thị, là hồ sơ công bố của chủ lao động trên các hồ sơ đã được quyết định của chính họ.",
      },
      {
        q: "Hồ sơ của tôi không có ở đây. Có vấn đề gì không?",
        a: "Gần như chắc chắn là không. Nếu chúng tôi chưa có số của bạn, chúng tôi sẽ hỏi hệ thống hồ sơ của DOL và lưu kết quả, nên hồ sơ mới nộp thường sẽ xuất hiện. Một chữ số sai vẫn tạo ra một số đúng định dạng, nên hãy kiểm tra điều đó trước. Các tệp DOL công bố có từ năm tài chính 2016; hồ sơ cũ hơn và không còn trong công cụ tra cứu trực tuyến của DOL có thể không tìm thấy.",
      },
      {
        q: "Số hồ sơ của tôi có ý nghĩa gì?",
        a: "Dạng số hiện nay chứa ngày nộp. Trong G-100-26125-868956, 26 là năm và 125 là ngày thứ bao nhiêu trong năm, nên tương ứng với ngày 5 tháng 5 năm 2026. So với 20.000 hồ sơ trong dữ liệu của DOL, ngày suy ra này khớp chính xác 89% số lần, còn lại lệch một hai ngày. Dạng cũ ba phần như A-23043-00641 thì không: đọc cùng cách chỉ đúng 13%, nên trang này không giải mã dạng đó thay vì đoán tháng nộp.",
      },
      {
        q: "Các bạn có lưu số hồ sơ tôi nhập không?",
        a: "Không. Số chỉ nằm trong địa chỉ trang để bạn lưu hoặc chia sẻ kết quả, và được xóa khỏi số liệu thống kê trước khi gửi bất cứ thứ gì. Không ghi lại ở đâu và không chuyển cho bên thứ ba.",
      },
    ],
    malformedLead: "Đây không phải dạng số hồ sơ,",
    malformedBody: "nên chưa tra cứu gì. Số PERM có dạng G-100-26125-868956 (A-23043-00641 với năm 2022 và 2023) và có trên biên nhận ETA-9089. Đơn lương hiện hành bắt đầu bằng P, LCA của H-1B bằng I, hồ sơ H-2A và H-2B bằng H (đơn đặt hàng việc làm H-2A bằng JO-A), và CW-1 bằng C.",
    receiptLead: "Bạn đang có số biên nhận USCIS?",
    receiptBody: "Ba chữ cái và mười chữ số, như EAC2190123456, là hồ sơ của USCIS về I-140 hoặc I-485, không phải hồ sơ PERM của DOL. Số này có trang tra cứu riêng.",
    receiptButton: "Tra cứu biên nhận USCIS (trang tiếng Anh)",
    provenanceGist: "Lấy từ trang tra cứu tình trạng hồ sơ của chính DOL, mọi hồ sơ mỗi ngày. DOL là nơi có thẩm quyền.",
    provenanceBody: "Các tình trạng này được đọc trực tiếp từ DOL. Trang tra cứu tình trạng hồ sơ FLAG trả lời tra cứu theo lô: chúng tôi tra mọi hồ sơ mỗi ngày một lần, mọi hồ sơ chưa có quyết định ít nhất hai lần mỗi ngày (ba lần vào ngày làm việc), và hồ sơ có người đăng ký thông báo cứ 5 phút một lần vào ngày làm việc (nửa giờ một lần vào ban đêm và cuối tuần). DOL không công bố API có tài liệu cho việc này, nên chúng tôi dùng đúng địa chỉ mà trang tra cứu của họ dùng. Ngày hiện trên mỗi hồ sơ là lúc chúng tôi thấy tình trạng đó: đó là ảnh chụp tại một thời điểm, không phải dữ liệu trực tiếp. DOL là nơi có thẩm quyền với mọi hồ sơ, và trang này không thay thế thư quyết định.",
    checkYourself: "Tự kiểm tra tại flag.dol.gov",
    readingWait: { label: "Thời gian chờ bao lâu (trang tiếng Anh)", note: "Công cụ tra cứu đếm những gì ở phía trước một hồ sơ. Máy tính cho biết toàn bộ khoảng thời gian, dựa trên các hồ sơ DOL đã quyết định." },
    readingQueue: { label: "Toàn bộ hàng chờ (trang tiếng Anh)", note: "Mọi tháng nộp mà DOL vẫn còn hồ sơ chưa quyết định, và nơi công việc đang đến." },
    readingTitle: "Quy tắc đằng sau các con số này",
    waitWords: (w, fmt) => ("days" in w ? `khoảng ${fmt(w.days)} ngày` : `khoảng ${fmt(w.months)} tháng`),
    howLong: (f) => {
      const dol = [
        f.frontier ? `bộ phận xét duyệt của DOL đang xử lý các hồ sơ nộp vào ${f.frontier}` : null,
        f.avgDays
          ? `thời gian trung bình công bố từ lúc nộp đến khi quyết định là ${f.avgDays} ngày${f.decidedIn ? `, tính trên các hồ sơ được quyết định vào ${f.decidedIn}` : ""}`
          : null,
      ].filter(Boolean).join(", và ");
      return sentences(
        [
          f.day && f.wait ? `Các hồ sơ PERM được DOL quyết định ngày ${f.day} đã chờ ${f.wait} kể từ khi nộp.` : null,
          dol ? (f.asOf ? `Tính đến ${f.asOf}, ${dol}.` : `${dol.charAt(0).toUpperCase()}${dol.slice(1)}.`) : null,
        ],
        "Hiện chưa đọc được số liệu của DOL; trang của chính DOL, flag.dol.gov/processingtimes, có các số liệu này.",
      );
    },
    machine:
      "Trang này được dịch bằng máy và chưa được người bản ngữ xem lại. Các thuật ngữ của DOL được giữ bằng tiếng Anh như DOL công bố. Bản tiếng Anh là bản có giá trị.",
    readInEnglish: "Xem bằng tiếng Anh",
  },
} satisfies Messages<CaseStatusText>;
