import type { Bolded } from "@/components/i18n/Bold";
import type { Messages } from "@/lib/i18n/lang";

/**
 * The found case's own words, in English and the five translations (plan: .planning/i18n-data-pages.md).
 *
 * What stays as printed in every language: DOL's status words (prettyStatus, or capitals where the English
 * lower-cases them into a sentence), form names, case numbers, employer and job names, CFR citations. A link
 * to a page that exists only in English says so in its label. Numbers and dates arrive already formatted for
 * the reader's language.
 */

/** A sentence around one link: the words before it, the link's words, and the words after. */
export type Linked = readonly [before: string, link: string, after: string];

/** How a decided case compares with the middle of its filing month. */
export type MedianCompare = { kind: "longer" | "quicker"; diff: string } | { kind: "same" } | { kind: "none" };

export interface CaseStatusResultText {
  /** Between two sentences of the answer: a space, or nothing in Chinese. */
  sep: string;

  staleTitle: (days: number) => string;
  /** Around the flag.dol.gov link, after the bold title. */
  staleBody: (date: string) => readonly [before: string, after: string];
  reopenedTitle: string;
  /** Around the 20 CFR 656.24(g) link. `decided` and `live` are DOL's words. */
  reopenedBody: (decided: string, date: string | null, live: string) => readonly [before: string, after: string];
  disagreeTitle: string;
  disagreeBody: (decided: string, live: string) => string;
  censusTitle: string;
  censusBody: string;

  /** The verdict chip when the status isn't decoded. */
  verdictDecided: string;
  verdictPending: string;
  aheadLabel: (n: string) => string;
  sourceShown: (date: string) => string;
  sourceQueue: (date: string) => string;
  estimatedDecision: string;
  around: (date: string) => string;
  howWorkedOut: string;
  noDateYet: string;
  hereIsWhy: string;
  /** Around the bold status word. */
  statusIs: readonly [before: string, after: string];
  inRecords: string;
  filed: (date: string, daysAgo: string | null) => string;
  decidedOn: (date: string, daysAfter: string | null) => string;
  /** The bold run is the count of cases filed before this one. */
  working: (published: string | null, front: string, frontDiffers: boolean, ahead: string) => Bolded;
  pastFront: string;

  planNext: { label: string; note: string };
  deniedNext: { label: string; note: string };

  recordTitle: string;
  recordLede: string;
  row: { status: string; caseNumber: string; filed: string; employer: string; jobTitle: string; checked: string };
  notRecorded: string;
  filedRow: (date: string, daysAgo: string | null) => string;
  checkedRow: (date: string, ageDays: number, n: string) => string;
  numberSays: string;

  positionIntro: string;
  earlierMonths: { label: string; note: string };
  sameMonth: { label: string; note: string };
  behindFront: string;
  monthsBehind: (n: number, formatted: string) => string;
  monthsAhead: (formatted: string) => string;
  frontNote: (front: string, pastFront: boolean) => string;
  wallTitle: string;
  wallSubject: string;
  wallCaption: string;
  wallSource: (asOf: string | null) => string;
  cohortLine: (total: string, month: string, decided: string, pct: string) => Bolded;
  /** Starts with its own space where the language puts one between sentences. */
  cohortUntouched: string;

  decisionTitle: string;
  decisionLede: string;
  outcome: string;
  daysTaken: { label: string; note: string };
  offeredWage: string;
  asFiled: string;
  worksiteState: string;
  /** The bold run is the median. */
  duration: (n: string, month: string, median: string, p25: string, p75: string, days: string, cmp: MedianCompare) => Bolded;

  wageTitle: string;
  wageScope: (job: string, state: string) => string;
  wageBand: (p25: string | null, p75: string | null) => string;
  wageSource: (n: string) => string;
  wageChart: (scope: string) => string;
  wageTip: {
    thisCase: (v: string) => string;
    p5: (v: string) => string;
    p25: (v: string) => string;
    median: (v: string) => string;
    p75: (v: string) => string;
    p95: (v: string) => string;
    certified: (n: string) => string;
  };
  medianMark: (v: string) => string;

  means: (label: string) => string;
  clock: string;
  whoActs: string;
  nowIn: (n: string) => Bolded;
  noDefinition: string;
  everyStatus: string;
  undecoded: string;

  queueFoldTitle: string;
  queueFoldHint: string;
  restTitle: (month: string) => string;
  restHint: string;
  /** The bold run is the count in analyst review. */
  inOrder: (ordinary: string, pending: string) => Bolded;
  stageChart: (month: string) => string;
  stageTipHeading: (month: string) => string;
  everyStatusIn: (month: string) => string;
  censusCaption: (month: string) => string;
  fullSplit: (month: string) => string;

  neighboursTitle: string;
  neighboursHint: string;
  neighboursIntro: (month: string) => string;
  everyMonth: string;

  employerTitle: string;
  employerHint: (name: string) => string;
  employerIntro: string;
  fig: { decided: string; certified: string; denied: string; medianDays: string; rate: string };
  cleanRecord: (n: string) => string;
  thinRecord: (n: string) => string;
  rateRecord: (rate: string, n: string) => string;
  /** Ends the paragraph: the link's words, then its last mark. */
  everythingAbout: (name: string) => string;
  end: string;

  wontSayTitle: string;
  wontSay: {
    date: { lead: string; body: Linked };
    odds: { lead: string; body: Linked };
    next: { lead: string; body: Linked };
    worker: { lead: string; body: string };
  };
}

export const CASE_STATUS_RESULT = {
  en: {
    sep: " ",
    staleTitle: (days) => `DOL showed this status ${days} days ago`,
    staleBody: (date) => [`, on ${date}, and it hasn't been checked since. A recent change shows first on `, ", DOL's own status page."],
    reopenedTitle: "DOL's file records a decision on this case, and it's back in processing.",
    reopenedBody: (decided, date, live) => [
      ` DOL's quarterly file shows it ${decided}${date ? ` on ${date}` : ""}; DOL's live status is now ${live}, which is current. That's normal: a denial can be appealed within 30 days under `,
      ".",
    ],
    disagreeTitle: "The two federal sources disagree about this case.",
    disagreeBody: (decided, live) =>
      ` DOL's quarterly disclosure file records it as ${decided}; the live status page shows ${live}. About one case in five thousand does this, usually after moving once the file closed. Both are shown below.`,
    censusTitle: "Some sections are missing today.",
    censusBody:
      " The daily count of every pending case, which places this one in its filing month, couldn't be read or is more than eight days old. The status above is current; the rest comes back when the count is rewritten, usually the next morning.",

    verdictDecided: "Decided",
    verdictPending: "Pending",
    aheadLabel: (n) => `${n} cases ahead`,
    sourceShown: (date) => `DOL showed this status on ${date}`,
    sourceQueue: (date) => `DOL's queue position as of ${date}`,
    estimatedDecision: "Estimated decision",
    around: (date) => `Around ${date}`,
    howWorkedOut: "How this is worked out",
    noDateYet: "No date can honestly be put on this case yet.",
    hereIsWhy: "Here's why",
    statusIs: ["DOL's status for this case is ", "."],
    inRecords: "This case is in DOL's records.",
    filed: (date, ago) => `It was filed ${date}${ago ? `, ${ago} days ago` : ""}.`,
    decidedOn: (date, after) => `DOL decided it ${date}${after ? `, ${after} days after filing` : ""}.`,
    working: (published, front, differs, ahead) => [
      `${
        published
          ? `DOL says it's working ${published}${differs ? ` (the oldest month still open is ${front})` : ""}`
          : `The oldest month still open is ${front}`
      }, and `,
      ahead,
      " cases in DOL's normal queue were filed before this one.",
    ],
    pastFront: "DOL has already moved past this filing month, so filing order isn't what it's waiting on.",

    planNext: { label: "Plan the rest of the green card", note: "The I-140, the bulletin and the I-485, dated from this case." },
    deniedNext: { label: "What happens after a denial", note: "Reconsideration, appeal and refiling, and their deadlines." },

    recordTitle: "The record",
    recordLede: "As DOL holds it, with nothing worked out.",
    row: {
      status: "Status",
      caseNumber: "Case number",
      filed: "Filed",
      employer: "Employer",
      jobTitle: "Job title",
      checked: "Checked against DOL",
    },
    notRecorded: "Not recorded",
    filedRow: (date, ago) => `${date}${ago ? ` (${ago} days ago)` : ""}`,
    checkedRow: (date, age, n) => `${date} (${age === 0 ? "today" : `${n} days ago`})`,
    numberSays: "What the case number says",

    positionIntro: "Counts from DOL's live status of every pending case, by filing month.",
    earlierMonths: { label: "Filed in earlier months", note: "still waiting in DOL's normal queue" },
    sameMonth: { label: "Filed the same month", note: "still waiting, this case among them" },
    behindFront: "Behind the work front",
    monthsBehind: (n, f) => `${f} ${n === 1 ? "month" : "months"}`,
    monthsAhead: (f) => `${f} ahead`,
    frontNote: (front, past) =>
      past ? `oldest month still open: ${front}, newer than this case` : `oldest month still open: ${front}`,
    wallTitle: "The wall in front of this case",
    wallSubject: "Undecided cases by filing month",
    wallCaption:
      "The wait is not spread evenly. Two months carry most of it, which is why the queue can look stalled for a while and then move several months at once.",
    wallSource: (asOf) =>
      asOf
        ? `Per-case statuses from DOL's own case status system, checked daily · DOL queue position as of ${asOf}`
        : "Per-case statuses from DOL's own case status system, checked daily",
    cohortLine: (total, month, decided, pct) => [
      `${total} cases were filed in ${month}. `,
      `${decided} of them have been decided`,
      ` so far, which is ${pct} of the month.`,
    ],
    cohortUntouched:
      " That is early enough that the decided cases are almost entirely withdrawals rather than cases that ran their course, so no duration is quoted for this month.",

    decisionTitle: "What DOL recorded when it decided",
    decisionLede: "From the quarterly disclosure file, which carries fields the live status page doesn't.",
    outcome: "Outcome",
    daysTaken: { label: "Days taken", note: "from receipt to determination" },
    offeredWage: "Offered wage",
    asFiled: "as filed",
    worksiteState: "Worksite state",
    duration: (n, month, median, p25, p75, days, cmp) => [
      `Across ${n} decided cases filed in ${month}, the middle one took `,
      `${median} days`,
      `, and half of them landed between ${p25} and ${p75}. This one took ${days}${
        cmp.kind === "longer"
          ? `, which is ${cmp.diff} days longer than the middle of its month.`
          : cmp.kind === "quicker"
            ? `, which is ${cmp.diff} days quicker than the middle of its month.`
            : cmp.kind === "same"
              ? ", exactly the middle of its month."
              : "."
      }`,
    ],

    wageTitle: "Where this wage sits",
    wageScope: (job, state) => `${job} in ${state}`,
    wageBand: (p25, p75) =>
      `The shaded band is the middle half${p25 !== null && p75 !== null ? `, ${p25} to ${p75}` : ""}. Certified cases only: a denied application's offered wage was never agreed to by anybody, so putting it in the ladder would price the job at a figure no employer had to pay.`,
    wageSource: (n) => `DOL quarterly disclosure files · ${n} certified cases`,
    wageChart: (scope) => `Where this wage sits among certified ${scope} wages`,
    wageTip: {
      thisCase: (v) => `This case: ${v}`,
      p5: (v) => `5th percentile: ${v}`,
      p25: (v) => `25th percentile: ${v}`,
      median: (v) => `Median: ${v}`,
      p75: (v) => `75th percentile: ${v}`,
      p95: (v) => `95th percentile: ${v}`,
      certified: (n) => `${n} certified cases`,
    },
    medianMark: (v) => `${v} median`,

    means: (label) => `What “${label}” means`,
    clock: "The clock:",
    whoActs: "Who acts:",
    nowIn: (n) => [
      "",
      `${n} cases`,
      " are in this status right now, across every filing month: how common it is, not how likely this case is to leave it. Status changes have only been recorded since August 2026, too short a record to price those odds.",
    ],
    noDefinition: "No published definition",
    everyStatus: "Every status, side by side",
    undecoded:
      "Not written up here yet, and DOL publishes no glossary, so this page won't guess. The notice DOL sent the employer explains it; their attorney has it.",

    queueFoldTitle: "Where it sits in the queue",
    queueFoldHint: "Undecided cases by filing month, and DOL's work front",
    restTitle: (month) => `Where the rest of ${month} is`,
    restHint: "Analyst review, holds, RFIs and appeals",
    inOrder: (ordinary, pending) => [
      "",
      ordinary,
      ` of the ${pending} still open are in analyst review, which moves in filing order. A hold, an RFI, an audit or an appeal takes a case out of that order.`,
    ],
    stageChart: (month) => `Pending cases filed in ${month}, by stage`,
    stageTipHeading: (month) => `Filed in ${month}`,
    everyStatusIn: (month) => `Every DOL status in ${month}`,
    censusCaption: (month) => `Every DOL status a pending case filed in ${month} is currently in, grouped by queue`,
    fullSplit: (month) => `The full split for ${month}`,

    neighboursTitle: "This filing month against its neighbours",
    neighboursHint: "Two months either side",
    neighboursIntro: (month) => `A month isn't slow or fast on its own. Two either side is enough to see whether ${month} is ordinary.`,
    everyMonth: "Every filing month",

    employerTitle: "This employer's record",
    employerHint: (name) => `Every decided PERM case DOL published for ${name}`,
    employerIntro: "Across FY2024 to FY2026. It describes the employer's filings, not this case.",
    fig: { decided: "decided cases", certified: "certified", denied: "denied", medianDays: "median days", rate: "certified" },
    cleanRecord: (n) =>
      `A clean record over ${n} cases is worth knowing and it is not a rate. At this volume one denial would move the figure by tens of percentage points, so the counts are here and the percentage is not.`,
    thinRecord: (n) =>
      `At ${n} decided cases this is too small a sample to carry a percentage, so the counts are here and the rate is not.`,
    rateRecord: (rate, n) =>
      `${rate} of ${n} decided cases were certified. That describes what DOL did with this sponsor's past filings and carries no claim about this one.`,
    everythingAbout: (name) => `Everything published about ${name}`,
    end: ".",

    wontSayTitle: "What this page won't tell you",
    wontSay: {
      date: {
        lead: "A guaranteed decision date.",
        body: [
          " The estimate is a statistic, not a schedule: audits and appeals take cases out of order. Every model side by side is on the ",
          "processing time calculator",
          ".",
        ],
      },
      odds: {
        lead: "How likely this case is to be certified.",
        body: [
          " One odds figure would claim more than the data can support. The measured rates, factor by factor, are on the ",
          "denial-rate page",
          ".",
        ],
      },
      next: {
        lead: "What happens next for this case.",
        body: [
          " PERM is the first of three stages, and DOL publishes nothing about the next two against a case number. The ",
          "green card timeline",
          " covers the stages after this one.",
        ],
      },
      worker: {
        lead: "Anything about the worker.",
        body: " DOL's files name employers, job titles and case numbers, never the person, and neither does this site.",
      },
    },
  },

  es: {
    sep: " ",
    staleTitle: (days) => `El DOL mostró este estado hace ${days} días`,
    staleBody: (date) => [`, el ${date}, y no se ha vuelto a revisar desde entonces. Un cambio reciente aparece primero en `, ", la página de estados del propio DOL."],
    reopenedTitle: "El archivo del DOL registra una decisión sobre este caso, y el caso volvió a trámite.",
    reopenedBody: (decided, date, live) => [
      ` El archivo trimestral del DOL lo muestra como ${decided}${date ? ` el ${date}` : ""}. El estado en vivo del DOL ahora es ${live}, y ese es el actual. Es normal: una negación se puede apelar dentro de los 30 días según `,
      ".",
    ],
    disagreeTitle: "Las dos fuentes federales no coinciden sobre este caso.",
    disagreeBody: (decided, live) =>
      ` El archivo trimestral de divulgación del DOL lo registra como ${decided}. La página de estado en vivo muestra ${live}. Pasa con alrededor de un caso de cada cinco mil, por lo general porque cambió después de que cerró el archivo. Abajo se muestran los dos.`,
    censusTitle: "Hoy faltan algunas secciones.",
    censusBody:
      " No se pudo leer el conteo diario de todos los casos pendientes, que ubica este caso en su mes de presentación, o tiene más de ocho días. El estado de arriba es el actual. Lo demás vuelve cuando se rehace el conteo, por lo general a la mañana siguiente.",

    verdictDecided: "Decidido",
    verdictPending: "Pendiente",
    aheadLabel: (n) => `${n} casos delante`,
    sourceShown: (date) => `El DOL mostró este estado el ${date}`,
    sourceQueue: (date) => `Posición de la fila del DOL al ${date}`,
    estimatedDecision: "Decisión estimada",
    around: (date) => `Alrededor del ${date}`,
    howWorkedOut: "Cómo se calcula",
    noDateYet: "Todavía no se le puede poner una fecha honesta a este caso.",
    hereIsWhy: "Por qué",
    statusIs: ["El estado del DOL para este caso es ", "."],
    inRecords: "Este caso está en los registros del DOL.",
    filed: (date, ago) => `Se presentó el ${date}${ago ? `, hace ${ago} días` : ""}.`,
    decidedOn: (date, after) => `El DOL lo decidió el ${date}${after ? `, ${after} días después de presentarlo` : ""}.`,
    working: (published, front, differs, ahead) => [
      `${
        published
          ? `El DOL dice que está trabajando en los casos de ${published}${differs ? ` (el mes más antiguo aún abierto es ${front})` : ""}`
          : `El mes más antiguo aún abierto es ${front}`
      }, y `,
      ahead,
      " casos de la fila normal del DOL se presentaron antes que este.",
    ],
    pastFront: "El DOL ya pasó este mes de presentación, así que este caso ya no espera por el orden de presentación.",

    planNext: {
      label: "Planifique el resto de la green card (en inglés)",
      note: "La I-140, el boletín de visas y la I-485, con fechas a partir de este caso.",
    },
    deniedNext: {
      label: "Qué pasa después de una negación (en inglés)",
      note: "Reconsideración, apelación y nueva solicitud, con sus plazos.",
    },

    recordTitle: "El registro",
    recordLede: "Tal como lo tiene el DOL, sin cálculos.",
    row: {
      status: "Estado",
      caseNumber: "Número de caso",
      filed: "Presentado",
      employer: "Empleador",
      jobTitle: "Puesto",
      checked: "Revisado con el DOL",
    },
    notRecorded: "No registrado",
    filedRow: (date, ago) => `${date}${ago ? ` (hace ${ago} días)` : ""}`,
    checkedRow: (date, age, n) => `${date} (${age === 0 ? "hoy" : `hace ${n} días`})`,
    numberSays: "Qué dice el número de caso",

    positionIntro: "Conteos del estado en vivo del DOL de todos los casos pendientes, por mes de presentación.",
    earlierMonths: { label: "Presentados en meses anteriores", note: "aún esperan en la fila normal del DOL" },
    sameMonth: { label: "Presentados el mismo mes", note: "aún esperan, este caso entre ellos" },
    behindFront: "Detrás de donde trabaja el DOL",
    monthsBehind: (n, f) => `${f} ${n === 1 ? "mes" : "meses"}`,
    monthsAhead: (f) => `${f} adelante`,
    frontNote: (front, past) =>
      past
        ? `mes más antiguo aún abierto: ${front}, más reciente que este caso`
        : `mes más antiguo aún abierto: ${front}`,
    wallTitle: "La fila delante de este caso",
    wallSubject: "Casos sin decidir por mes de presentación",
    wallCaption:
      "La espera no se reparte por igual. Dos meses cargan con la mayor parte, y por eso la fila puede parecer detenida un tiempo y luego avanzar varios meses de golpe.",
    wallSource: (asOf) =>
      asOf
        ? `Estados de cada caso del propio sistema de estado de casos del DOL, revisados a diario · posición de la fila del DOL al ${asOf}`
        : "Estados de cada caso del propio sistema de estado de casos del DOL, revisados a diario",
    cohortLine: (total, month, decided, pct) => [
      `En ${month} se presentaron ${total} casos. `,
      `${decided} ya se decidieron`,
      ` hasta ahora, el ${pct} del mes.`,
    ],
    cohortUntouched:
      " Es tan pronto que los casos decididos son casi todos retiros y no casos que terminaron su trámite, así que no se da una duración para este mes.",

    decisionTitle: "Lo que el DOL registró al decidir",
    decisionLede: "Del archivo trimestral de divulgación, que trae datos que la página de estado en vivo no tiene.",
    outcome: "Resultado",
    daysTaken: { label: "Días que tardó", note: "desde la recepción hasta la determinación" },
    offeredWage: "Salario ofrecido",
    asFiled: "según la solicitud",
    worksiteState: "Estado del lugar de trabajo",
    duration: (n, month, median, p25, p75, days, cmp) => [
      `De ${n} casos decididos que se presentaron en ${month}, el del medio tardó `,
      `${median} días`,
      `, y la mitad tardó entre ${p25} y ${p75}. Este tardó ${days}${
        cmp.kind === "longer"
          ? `, ${cmp.diff} días más que el del medio de su mes.`
          : cmp.kind === "quicker"
            ? `, ${cmp.diff} días menos que el del medio de su mes.`
            : cmp.kind === "same"
              ? ", justo lo mismo que el del medio de su mes."
              : "."
      }`,
    ],

    wageTitle: "Dónde queda este salario",
    wageScope: (job, state) => `${job} en ${state}`,
    wageBand: (p25, p75) =>
      `La franja sombreada es la mitad del medio${p25 !== null && p75 !== null ? `, de ${p25} a ${p75}` : ""}. Solo casos certificados: el salario ofrecido en una solicitud negada nunca lo aceptó nadie, así que ponerlo en la escala le daría al puesto un precio que ningún empleador tuvo que pagar.`,
    wageSource: (n) => `Archivos trimestrales de divulgación del DOL · ${n} casos certificados`,
    wageChart: (scope) => `Dónde queda este salario entre los salarios certificados de ${scope}`,
    wageTip: {
      thisCase: (v) => `Este caso: ${v}`,
      p5: (v) => `Percentil 5: ${v}`,
      p25: (v) => `Percentil 25: ${v}`,
      median: (v) => `Mediana: ${v}`,
      p75: (v) => `Percentil 75: ${v}`,
      p95: (v) => `Percentil 95: ${v}`,
      certified: (n) => `${n} casos certificados`,
    },
    medianMark: (v) => `${v} mediana`,

    means: (label) => `Qué significa “${label}”`,
    clock: "El plazo:",
    whoActs: "Quién actúa:",
    nowIn: (n) => [
      "",
      `${n} casos`,
      " tienen este estado ahora mismo, en todos los meses de presentación. Indica qué tan común es, no qué tan probable es que este caso salga de él. Los cambios de estado solo se registran desde agosto de 2026, un registro demasiado corto para calcular esas probabilidades.",
    ],
    noDefinition: "Sin definición publicada",
    everyStatus: "Todos los estados, uno al lado del otro (en inglés)",
    undecoded:
      "Todavía no está explicado aquí, y el DOL no publica un glosario, así que esta página no va a adivinar. El aviso que el DOL le envió al empleador lo explica; su abogado lo tiene.",

    queueFoldTitle: "Dónde está en la fila",
    queueFoldHint: "Casos sin decidir por mes de presentación, y dónde trabaja el DOL",
    restTitle: (month) => `Dónde está el resto de ${month}`,
    restHint: "Revisión por un analista, casos en espera, RFI y apelaciones",
    inOrder: (ordinary, pending) => [
      "",
      ordinary,
      ` de los ${pending} aún abiertos están en revisión por un analista, que avanza en orden de presentación. Un caso en espera, una RFI, una auditoría o una apelación saca al caso de ese orden.`,
    ],
    stageChart: (month) => `Casos pendientes presentados en ${month}, por etapa`,
    stageTipHeading: (month) => `Presentados en ${month}`,
    everyStatusIn: (month) => `Todos los estados del DOL en ${month} (enlaces en inglés)`,
    censusCaption: (month) =>
      `Todos los estados del DOL en que están ahora los casos pendientes presentados en ${month}, agrupados por fila`,
    fullSplit: (month) => `El desglose completo de ${month} (en inglés)`,

    neighboursTitle: "Este mes de presentación frente a sus vecinos",
    neighboursHint: "Dos meses a cada lado",
    neighboursIntro: (month) =>
      `Un mes no es lento ni rápido por sí solo. Con dos meses a cada lado basta para ver si ${month} es normal.`,
    everyMonth: "Todos los meses de presentación (en inglés)",

    employerTitle: "El historial de este empleador",
    employerHint: (name) => `Cada caso PERM decidido que el DOL publicó para ${name}`,
    employerIntro: "Del año fiscal 2024 al 2026. Describe las solicitudes del empleador, no este caso.",
    fig: { decided: "casos decididos", certified: "certificados", denied: "negados", medianDays: "días (mediana)", rate: "certificados" },
    cleanRecord: (n) =>
      `Un historial limpio en ${n} casos vale la pena saberlo, pero no es una tasa. Con tan pocos casos, una sola negación movería la cifra decenas de puntos porcentuales, así que aquí van los conteos y no el porcentaje.`,
    thinRecord: (n) =>
      `Con ${n} casos decididos, la muestra es demasiado pequeña para dar un porcentaje, así que aquí van los conteos y no la tasa.`,
    rateRecord: (rate, n) =>
      `El ${rate} de ${n} casos decididos se certificó. Eso describe lo que el DOL hizo con las solicitudes anteriores de este patrocinador y no dice nada sobre este caso.`,
    everythingAbout: (name) => `Todo lo publicado sobre ${name} (en inglés)`,
    end: ".",

    wontSayTitle: "Lo que esta página no le dirá",
    wontSay: {
      date: {
        lead: "Una fecha de decisión garantizada.",
        body: [
          " La estimación es una estadística, no un calendario: las auditorías y las apelaciones sacan casos del orden. Todos los modelos, uno al lado del otro, están en la ",
          "calculadora de tiempos de procesamiento (en inglés)",
          ".",
        ],
      },
      odds: {
        lead: "Qué tan probable es que este caso se certifique.",
        body: [
          " Una sola cifra de probabilidad diría más de lo que los datos pueden respaldar. Las tasas medidas, factor por factor, están en la ",
          "página de tasas de negación (en inglés)",
          ".",
        ],
      },
      next: {
        lead: "Qué sigue para este caso.",
        body: [
          " El PERM es la primera de tres etapas, y el DOL no publica nada sobre las dos siguientes por número de caso. La ",
          "línea de tiempo de la green card (en inglés)",
          " cubre las etapas que siguen a esta.",
        ],
      },
      worker: {
        lead: "Nada sobre el trabajador.",
        body: " Los archivos del DOL nombran empleadores, puestos y números de caso, nunca a la persona, y este sitio tampoco.",
      },
    },
  },

  zh: {
    sep: "",
    staleTitle: (days) => `劳工部显示这个状态已是 ${days} 天前`,
    staleBody: (date) => [`，即 ${date}，此后没有再核对过。最新的变化会先出现在 `, "，也就是劳工部自己的状态页面。"],
    reopenedTitle: "劳工部的档案记录了这个案件的判定，而案件已重新进入处理。",
    reopenedBody: (decided, date, live) => [
      `劳工部的季度档案显示它的结果是 ${decided}${date ? `（${date}）` : ""}；劳工部现在的实时状态是 ${live}，这是最新的。这很正常：根据 `,
      "，拒绝决定可以在 30 天内上诉。",
    ],
    disagreeTitle: "两个联邦数据来源对这个案件的记录不一致。",
    disagreeBody: (decided, live) =>
      `劳工部的季度公开档案记录为 ${decided}；实时状态页面显示 ${live}。大约每五千个案件中有一个会这样，通常是档案截止后状态又有变化。下面两者都列出。`,
    censusTitle: "今天有部分内容缺失。",
    censusBody:
      "所有待审案件的每日统计（用来确定本案件在其递交月份中的位置）无法读取，或已超过八天。上面的状态是最新的；其余部分会在统计重写后恢复，通常是第二天早上。",

    verdictDecided: "已判定",
    verdictPending: "审理中",
    aheadLabel: (n) => `前面还有 ${n} 件`,
    sourceShown: (date) => `劳工部于 ${date} 显示这个状态`,
    sourceQueue: (date) => `劳工部队列位置，截至 ${date}`,
    estimatedDecision: "预计判定",
    around: (date) => `大约 ${date}`,
    howWorkedOut: "这是怎么算出来的",
    noDateYet: "目前还无法如实给出这个案件的日期。",
    hereIsWhy: "原因如下",
    statusIs: ["劳工部给这个案件的状态是 ", "。"],
    inRecords: "这个案件在劳工部的记录中。",
    filed: (date, ago) => `递交于 ${date}${ago ? `，距今 ${ago} 天` : ""}。`,
    decidedOn: (date, after) => `劳工部于 ${date} 作出判定${after ? `，距递交 ${after} 天` : ""}。`,
    working: (published, front, differs, ahead) => [
      `${
        published
          ? `劳工部称正在审理 ${published}递交的案件${differs ? `（仍未审完的最早月份是 ${front}）` : ""}`
          : `仍未审完的最早月份是 ${front}`
      }，劳工部正常队列中有 `,
      ahead,
      " 件案件比本案件更早递交。",
    ],
    pastFront: "劳工部已经过了这个递交月份，所以本案件等待的已经不是递交顺序。",

    planNext: { label: "规划绿卡的后续步骤（英文页面）", note: "I-140、签证公告和 I-485，从本案件的日期推算。" },
    deniedNext: { label: "被拒之后会怎样（英文页面）", note: "重新考虑、上诉和重新申请，以及各自的期限。" },

    recordTitle: "记录",
    recordLede: "劳工部持有的原始记录，不做任何推算。",
    row: {
      status: "状态",
      caseNumber: "案件编号",
      filed: "递交日期",
      employer: "雇主",
      jobTitle: "职位",
      checked: "与劳工部核对",
    },
    notRecorded: "无记录",
    filedRow: (date, ago) => `${date}${ago ? `（${ago} 天前）` : ""}`,
    checkedRow: (date, age, n) => `${date}（${age === 0 ? "今天" : `${n} 天前`}）`,
    numberSays: "案件编号透露了什么",

    positionIntro: "根据劳工部所有待审案件的实时状态，按递交月份统计。",
    earlierMonths: { label: "更早月份递交", note: "仍在劳工部正常队列中等待" },
    sameMonth: { label: "同月递交", note: "仍在等待，包括本案件" },
    behindFront: "距劳工部审理进度",
    monthsBehind: (_n, f) => `${f} 个月`,
    monthsAhead: (f) => `领先 ${f} 个月`,
    frontNote: (front, past) =>
      past ? `仍未审完的最早月份：${front}，比本案件晚` : `仍未审完的最早月份：${front}`,
    wallTitle: "本案件前面的案件",
    wallSubject: "按递交月份统计的未判定案件",
    wallCaption: "等待并不是均匀分布的。大部分集中在两个月里，所以队列可能停滞一阵，然后一下子前进好几个月。",
    wallSource: (asOf) =>
      asOf
        ? `单个案件状态来自劳工部自己的案件状态系统，每天核对 · 劳工部队列位置，截至 ${asOf}`
        : "单个案件状态来自劳工部自己的案件状态系统，每天核对",
    cohortLine: (total, month, decided, pct) => [`${month}共递交 ${total} 件案件。目前`, `已判定 ${decided} 件`, `，占该月的 ${pct}。`],
    cohortUntouched: "现在还太早，已判定的几乎都是撤回的案件，而不是走完流程的案件，所以不给出这个月的用时。",

    decisionTitle: "劳工部判定时记录的内容",
    decisionLede: "来自季度公开档案，其中有实时状态页面没有的字段。",
    outcome: "结果",
    daysTaken: { label: "用时（天）", note: "从收到到作出决定" },
    offeredWage: "提供的工资",
    asFiled: "按申请所填",
    worksiteState: "工作地点所在州",
    duration: (n, month, median, p25, p75, days, cmp) => [
      `在${month}递交、已判定的 ${n} 件案件中，中间那件用了 `,
      `${median} 天`,
      `，一半落在 ${p25} 到 ${p75} 天之间。本案件用了 ${days} 天${
        cmp.kind === "longer"
          ? `，比该月的中间值多 ${cmp.diff} 天。`
          : cmp.kind === "quicker"
            ? `，比该月的中间值少 ${cmp.diff} 天。`
            : cmp.kind === "same"
              ? "，正好是该月的中间值。"
              : "。"
      }`,
    ],

    wageTitle: "这个工资处在什么位置",
    wageScope: (job, state) => `${job}（${state}）`,
    wageBand: (p25, p75) =>
      `阴影部分是中间的一半${p25 !== null && p75 !== null ? `，${p25} 到 ${p75}` : ""}。只计入获批案件：被拒申请中的工资从未被任何一方接受，把它放进来会给这个职位定一个没有雇主需要支付的价格。`,
    wageSource: (n) => `劳工部季度公开档案 · ${n} 件获批案件`,
    wageChart: (scope) => `这个工资在 ${scope} 获批工资中的位置`,
    wageTip: {
      thisCase: (v) => `本案件：${v}`,
      p5: (v) => `第 5 百分位：${v}`,
      p25: (v) => `第 25 百分位：${v}`,
      median: (v) => `中位数：${v}`,
      p75: (v) => `第 75 百分位：${v}`,
      p95: (v) => `第 95 百分位：${v}`,
      certified: (n) => `${n} 件获批案件`,
    },
    medianMark: (v) => `中位数 ${v}`,

    means: (label) => `“${label}”是什么意思`,
    clock: "期限：",
    whoActs: "由谁处理：",
    nowIn: (n) => [
      "目前所有递交月份中共有 ",
      `${n} 件案件`,
      "处于这个状态：这说明它有多常见，而不是本案件离开这个状态的可能性有多大。状态变化从 2026 年 8 月才开始记录，记录太短，无法估算这种概率。",
    ],
    noDefinition: "没有公开的定义",
    everyStatus: "所有状态对照（英文页面）",
    undecoded: "这里还没有写说明，劳工部也不公布术语表，所以本页不作猜测。劳工部发给雇主的通知里有解释，雇主的律师手上有这份通知。",

    queueFoldTitle: "它在队列中的位置",
    queueFoldHint: "按递交月份统计的未判定案件，以及劳工部的审理进度",
    restTitle: (month) => `${month}其余案件的去向`,
    restHint: "审查员审核、暂缓、RFI 和上诉",
    inOrder: (ordinary, pending) => [
      `在仍未结案的 ${pending} 件中，有 `,
      ordinary,
      " 件处于审查员审核阶段，按递交顺序推进。暂缓、RFI、审计或上诉会让案件脱离这个顺序。",
    ],
    stageChart: (month) => `${month}递交的待审案件，按阶段`,
    stageTipHeading: (month) => `${month}递交`,
    everyStatusIn: (month) => `${month}的所有劳工部状态（链接为英文页面）`,
    censusCaption: (month) => `${month}递交的待审案件目前所处的所有劳工部状态，按队列分组`,
    fullSplit: (month) => `${month}的完整分类（英文页面）`,

    neighboursTitle: "这个递交月份与前后月份对比",
    neighboursHint: "前后各两个月",
    neighboursIntro: (month) => `单看一个月说不出快慢。看前后各两个月，就能知道${month}是否正常。`,
    everyMonth: "所有递交月份（英文页面）",

    employerTitle: "这个雇主的记录",
    employerHint: (name) => `劳工部为 ${name} 公布的所有已判定 PERM 案件`,
    employerIntro: "涵盖 2024 至 2026 财年。描述的是这个雇主的申请，而不是本案件。",
    fig: { decided: "件已判定", certified: "件获批", denied: "件被拒", medianDays: "天（中位数）", rate: "获批" },
    cleanRecord: (n) =>
      `${n} 件案件全部获批，值得知道，但这不是一个比率。案件这么少，一次拒绝就会让数字变动几十个百分点，所以这里只给件数，不给百分比。`,
    thinRecord: (n) => `只有 ${n} 件已判定案件，样本太小，算不出有意义的百分比，所以这里只给件数，不给比率。`,
    rateRecord: (rate, n) =>
      `${n} 件已判定案件中有 ${rate} 获批。这描述的是劳工部对这个雇主以往申请的处理，并不代表本案件的结果。`,
    everythingAbout: (name) => `关于 ${name} 公布的全部信息（英文页面）`,
    end: "。",

    wontSayTitle: "本页不会告诉您的事",
    wontSay: {
      date: {
        lead: "有保证的判定日期。",
        body: [
          "估计是统计结果，不是时间表：审计和上诉会让案件脱离顺序。所有模型的对照在 ",
          "处理时间计算器（英文页面）",
          "。",
        ],
      },
      odds: {
        lead: "本案件获批的可能性。",
        body: ["单一的概率数字会超出数据所能支持的范围。按因素逐项测得的比率在 ", "拒绝率页面（英文页面）", "。"],
      },
      next: {
        lead: "本案件接下来会怎样。",
        body: ["PERM 是三个阶段中的第一个，劳工部不按案件编号公布后两个阶段的任何信息。", "绿卡时间表（英文页面）", "介绍了之后的各个阶段。"],
      },
      worker: {
        lead: "关于外籍员工本人的任何信息。",
        body: "劳工部的档案只列出雇主、职位和案件编号，从不列出员工本人，本站也一样。",
      },
    },
  },

  "pt-br": {
    sep: " ",
    staleTitle: (days) => `O DOL mostrou este status há ${days} dias`,
    staleBody: (date) => [`, em ${date}, e ele não foi conferido de novo desde então. Uma mudança recente aparece primeiro em `, ", a página de status do próprio DOL."],
    reopenedTitle: "O arquivo do DOL registra uma decisão sobre este caso, e ele voltou a tramitar.",
    reopenedBody: (decided, date, live) => [
      ` O arquivo trimestral do DOL mostra o caso como ${decided}${date ? ` em ${date}` : ""}. O status ao vivo do DOL agora é ${live}, que é o atual. É normal: uma negativa pode ser contestada em até 30 dias, nos termos do `,
      ".",
    ],
    disagreeTitle: "As duas fontes federais não concordam sobre este caso.",
    disagreeBody: (decided, live) =>
      ` O arquivo trimestral de divulgação do DOL registra o caso como ${decided}. A página de status ao vivo mostra ${live}. Isso acontece com cerca de um caso em cada cinco mil, em geral porque mudou depois que o arquivo fechou. Os dois aparecem abaixo.`,
    censusTitle: "Algumas seções estão faltando hoje.",
    censusBody:
      " A contagem diária de todos os casos pendentes, que coloca este caso no seu mês de protocolo, não pôde ser lida ou tem mais de oito dias. O status acima é o atual. O resto volta quando a contagem é refeita, em geral na manhã seguinte.",

    verdictDecided: "Decidido",
    verdictPending: "Pendente",
    aheadLabel: (n) => `${n} casos à frente`,
    sourceShown: (date) => `O DOL mostrou este status em ${date}`,
    sourceQueue: (date) => `Posição da fila do DOL em ${date}`,
    estimatedDecision: "Decisão estimada",
    around: (date) => `Por volta de ${date}`,
    howWorkedOut: "Como isso é calculado",
    noDateYet: "Ainda não é possível dar uma data honesta para este caso.",
    hereIsWhy: "Veja por quê",
    statusIs: ["O status do DOL para este caso é ", "."],
    inRecords: "Este caso está nos registros do DOL.",
    filed: (date, ago) => `Foi protocolado em ${date}${ago ? `, há ${ago} dias` : ""}.`,
    decidedOn: (date, after) => `O DOL decidiu o caso em ${date}${after ? `, ${after} dias depois do protocolo` : ""}.`,
    working: (published, front, differs, ahead) => [
      `${
        published
          ? `O DOL diz que está trabalhando nos casos de ${published}${differs ? ` (o mês mais antigo ainda aberto é ${front})` : ""}`
          : `O mês mais antigo ainda aberto é ${front}`
      }, e `,
      ahead,
      " casos da fila normal do DOL foram protocolados antes deste.",
    ],
    pastFront: "O DOL já passou deste mês de protocolo, então este caso não espera mais pela ordem de protocolo.",

    planNext: {
      label: "Planeje o resto do green card (em inglês)",
      note: "A I-140, o boletim de vistos e a I-485, com datas a partir deste caso.",
    },
    deniedNext: {
      label: "O que acontece depois de uma negativa (em inglês)",
      note: "Reconsideração, recurso e novo pedido, com seus prazos.",
    },

    recordTitle: "O registro",
    recordLede: "Como o DOL guarda, sem nenhum cálculo.",
    row: {
      status: "Status",
      caseNumber: "Número do caso",
      filed: "Protocolado",
      employer: "Empregador",
      jobTitle: "Cargo",
      checked: "Conferido com o DOL",
    },
    notRecorded: "Não registrado",
    filedRow: (date, ago) => `${date}${ago ? ` (há ${ago} dias)` : ""}`,
    checkedRow: (date, age, n) => `${date} (${age === 0 ? "hoje" : `há ${n} dias`})`,
    numberSays: "O que o número do caso diz",

    positionIntro: "Contagens do status ao vivo do DOL de todos os casos pendentes, por mês de protocolo.",
    earlierMonths: { label: "Protocolados em meses anteriores", note: "ainda esperando na fila normal do DOL" },
    sameMonth: { label: "Protocolados no mesmo mês", note: "ainda esperando, este caso entre eles" },
    behindFront: "Atrás de onde o DOL trabalha",
    monthsBehind: (n, f) => `${f} ${n === 1 ? "mês" : "meses"}`,
    monthsAhead: (f) => `${f} à frente`,
    frontNote: (front, past) =>
      past ? `mês mais antigo ainda aberto: ${front}, mais recente que este caso` : `mês mais antigo ainda aberto: ${front}`,
    wallTitle: "A fila à frente deste caso",
    wallSubject: "Casos sem decisão por mês de protocolo",
    wallCaption:
      "A espera não se distribui por igual. Dois meses concentram a maior parte, e é por isso que a fila pode parecer parada por um tempo e depois avançar vários meses de uma vez.",
    wallSource: (asOf) =>
      asOf
        ? `Status de cada caso do próprio sistema de status de casos do DOL, conferidos diariamente · posição da fila do DOL em ${asOf}`
        : "Status de cada caso do próprio sistema de status de casos do DOL, conferidos diariamente",
    cohortLine: (total, month, decided, pct) => [
      `Em ${month} foram protocolados ${total} casos. `,
      `${decided} deles já foram decididos`,
      ` até agora, ${pct} do mês.`,
    ],
    cohortUntouched:
      " É tão cedo que os casos decididos são quase todos desistências, e não casos que chegaram ao fim do trâmite, então nenhuma duração é dada para este mês.",

    decisionTitle: "O que o DOL registrou ao decidir",
    decisionLede: "Do arquivo trimestral de divulgação, que traz campos que a página de status ao vivo não tem.",
    outcome: "Resultado",
    daysTaken: { label: "Dias que levou", note: "do recebimento à determinação" },
    offeredWage: "Salário oferecido",
    asFiled: "conforme o pedido",
    worksiteState: "Estado do local de trabalho",
    duration: (n, month, median, p25, p75, days, cmp) => [
      `Entre ${n} casos decididos protocolados em ${month}, o do meio levou `,
      `${median} dias`,
      `, e metade ficou entre ${p25} e ${p75}. Este levou ${days}${
        cmp.kind === "longer"
          ? `, ${cmp.diff} dias a mais que o do meio do mês.`
          : cmp.kind === "quicker"
            ? `, ${cmp.diff} dias a menos que o do meio do mês.`
            : cmp.kind === "same"
              ? ", exatamente o do meio do mês."
              : "."
      }`,
    ],

    wageTitle: "Onde este salário fica",
    wageScope: (job, state) => `${job} em ${state}`,
    wageBand: (p25, p75) =>
      `A faixa sombreada é a metade do meio${p25 !== null && p75 !== null ? `, de ${p25} a ${p75}` : ""}. Só casos certificados: o salário oferecido num pedido negado nunca foi aceito por ninguém, então colocá-lo na escala daria ao cargo um valor que nenhum empregador precisou pagar.`,
    wageSource: (n) => `Arquivos trimestrais de divulgação do DOL · ${n} casos certificados`,
    wageChart: (scope) => `Onde este salário fica entre os salários certificados de ${scope}`,
    wageTip: {
      thisCase: (v) => `Este caso: ${v}`,
      p5: (v) => `Percentil 5: ${v}`,
      p25: (v) => `Percentil 25: ${v}`,
      median: (v) => `Mediana: ${v}`,
      p75: (v) => `Percentil 75: ${v}`,
      p95: (v) => `Percentil 95: ${v}`,
      certified: (n) => `${n} casos certificados`,
    },
    medianMark: (v) => `${v} mediana`,

    means: (label) => `O que significa “${label}”`,
    clock: "O prazo:",
    whoActs: "Quem age:",
    nowIn: (n) => [
      "",
      `${n} casos`,
      " estão neste status agora, em todos os meses de protocolo. Isso mostra o quanto ele é comum, não a chance de este caso sair dele. As mudanças de status só são registradas desde agosto de 2026, um registro curto demais para calcular essas chances.",
    ],
    noDefinition: "Sem definição publicada",
    everyStatus: "Todos os status, lado a lado (em inglês)",
    undecoded:
      "Ainda não está explicado aqui, e o DOL não publica um glossário, então esta página não vai adivinhar. O aviso que o DOL enviou ao empregador explica; o advogado dele tem esse aviso.",

    queueFoldTitle: "Onde ele está na fila",
    queueFoldHint: "Casos sem decisão por mês de protocolo, e onde o DOL trabalha",
    restTitle: (month) => `Onde está o resto de ${month}`,
    restHint: "Revisão por analista, casos em espera, RFI e recursos",
    inOrder: (ordinary, pending) => [
      "",
      ordinary,
      ` dos ${pending} ainda abertos estão em revisão por analista, que anda na ordem de protocolo. Uma espera, um RFI, uma auditoria ou um recurso tira o caso dessa ordem.`,
    ],
    stageChart: (month) => `Casos pendentes protocolados em ${month}, por etapa`,
    stageTipHeading: (month) => `Protocolados em ${month}`,
    everyStatusIn: (month) => `Todos os status do DOL em ${month} (links em inglês)`,
    censusCaption: (month) =>
      `Todos os status do DOL em que estão agora os casos pendentes protocolados em ${month}, agrupados por fila`,
    fullSplit: (month) => `A divisão completa de ${month} (em inglês)`,

    neighboursTitle: "Este mês de protocolo comparado com os vizinhos",
    neighboursHint: "Dois meses de cada lado",
    neighboursIntro: (month) =>
      `Um mês não é lento nem rápido sozinho. Dois de cada lado bastam para ver se ${month} é normal.`,
    everyMonth: "Todos os meses de protocolo (em inglês)",

    employerTitle: "O histórico deste empregador",
    employerHint: (name) => `Cada caso PERM decidido que o DOL publicou para ${name}`,
    employerIntro: "Do ano fiscal de 2024 ao de 2026. Descreve os pedidos do empregador, não este caso.",
    fig: { decided: "casos decididos", certified: "certificados", denied: "negados", medianDays: "dias (mediana)", rate: "certificados" },
    cleanRecord: (n) =>
      `Um histórico limpo em ${n} casos vale a pena conhecer, mas não é uma taxa. Com tão poucos casos, uma única negativa mudaria o número em dezenas de pontos percentuais, então aqui ficam as contagens e não o percentual.`,
    thinRecord: (n) =>
      `Com ${n} casos decididos, a amostra é pequena demais para dar um percentual, então aqui ficam as contagens e não a taxa.`,
    rateRecord: (rate, n) =>
      `${rate} de ${n} casos decididos foram certificados. Isso descreve o que o DOL fez com os pedidos anteriores deste patrocinador e não diz nada sobre este caso.`,
    everythingAbout: (name) => `Tudo o que foi publicado sobre ${name} (em inglês)`,
    end: ".",

    wontSayTitle: "O que esta página não vai dizer",
    wontSay: {
      date: {
        lead: "Uma data de decisão garantida.",
        body: [
          " A estimativa é uma estatística, não um cronograma: auditorias e recursos tiram casos da ordem. Todos os modelos, lado a lado, estão na ",
          "calculadora de tempo de processamento (em inglês)",
          ".",
        ],
      },
      odds: {
        lead: "A chance de este caso ser certificado.",
        body: [
          " Um único número de probabilidade afirmaria mais do que os dados sustentam. As taxas medidas, fator por fator, estão na ",
          "página de taxas de negativa (em inglês)",
          ".",
        ],
      },
      next: {
        lead: "O que vem a seguir para este caso.",
        body: [
          " O PERM é a primeira de três etapas, e o DOL não publica nada sobre as duas seguintes por número de caso. A ",
          "linha do tempo do green card (em inglês)",
          " cobre as etapas depois desta.",
        ],
      },
      worker: {
        lead: "Nada sobre o trabalhador.",
        body: " Os arquivos do DOL citam empregadores, cargos e números de caso, nunca a pessoa, e este site também não.",
      },
    },
  },

  ko: {
    sep: " ",
    staleTitle: (days) => `노동부가 이 상태를 보여 준 것은 ${days}일 전입니다`,
    staleBody: (date) => [`. ${date}에 확인한 뒤로 다시 확인하지 못했습니다. 최근 변경은 노동부 자체 상태 페이지인 `, "에 먼저 나타납니다."],
    reopenedTitle: "노동부 파일에는 이 케이스의 결정이 기록되어 있지만, 케이스는 다시 처리 중입니다.",
    reopenedBody: (decided, date, live) => [
      ` 노동부 분기 파일에는 ${date ? `${date}에 ` : ""}${decided} 상태로 나옵니다. 노동부의 실시간 상태는 현재 ${live}이며, 이것이 최신입니다. 흔히 있는 일입니다. `,
      "에 따라 거부 결정은 30일 안에 이의를 제기할 수 있습니다.",
    ],
    disagreeTitle: "두 연방 자료가 이 케이스에 대해 서로 다릅니다.",
    disagreeBody: (decided, live) =>
      ` 노동부 분기 공개 파일에는 ${decided} 상태로 기록되어 있고, 실시간 상태 페이지에는 ${live} 상태로 나옵니다. 약 5천 건 중 1건꼴로 이런 일이 있으며, 보통 파일이 마감된 뒤 상태가 바뀐 경우입니다. 아래에 둘 다 보여 드립니다.`,
    censusTitle: "오늘은 일부 섹션이 빠져 있습니다.",
    censusBody:
      " 모든 심사 중 케이스의 일일 집계(이 케이스를 접수 월 안에 배치하는 자료)를 읽지 못했거나 8일이 넘었습니다. 위의 상태는 최신입니다. 나머지는 집계가 다시 작성되면 돌아오며, 보통 다음 날 아침입니다.",

    verdictDecided: "결정됨",
    verdictPending: "심사 중",
    aheadLabel: (n) => `앞에 ${n}건`,
    sourceShown: (date) => `노동부가 ${date}에 보여 준 상태`,
    sourceQueue: (date) => `${date} 기준 노동부 대기열 위치`,
    estimatedDecision: "예상 결정일",
    around: (date) => `${date}쯤`,
    howWorkedOut: "계산 방법",
    noDateYet: "아직 이 케이스에 정직하게 날짜를 붙일 수 없습니다.",
    hereIsWhy: "이유 보기",
    statusIs: ["이 케이스에 대한 노동부의 상태는 ", "입니다."],
    inRecords: "이 케이스는 노동부 기록에 있습니다.",
    filed: (date, ago) => `${date}에 접수되었습니다${ago ? `(${ago}일 전)` : ""}.`,
    decidedOn: (date, after) => `노동부는 ${date}에 결정했습니다${after ? `(접수 후 ${after}일)` : ""}.`,
    working: (published, front, differs, ahead) => [
      `${
        published
          ? `노동부는 ${published} 접수분을 심사 중이라고 밝힙니다${differs ? `(아직 끝나지 않은 가장 오래된 달은 ${front})` : ""}`
          : `아직 끝나지 않은 가장 오래된 달은 ${front}입니다`
      }. 노동부 일반 대기열에서 이 케이스보다 먼저 접수된 케이스는 `,
      `${ahead}건`,
      "입니다.",
    ],
    pastFront: "노동부는 이미 이 접수 월을 지났습니다. 따라서 이 케이스가 기다리는 것은 접수 순서가 아닙니다.",

    planNext: { label: "영주권의 나머지 단계 계획하기(영어 페이지)", note: "I-140, 비자 공보, I-485를 이 케이스의 날짜부터 계산합니다." },
    deniedNext: { label: "거부된 뒤에는 어떻게 되나(영어 페이지)", note: "재심, 항소, 재신청과 각각의 기한." },

    recordTitle: "기록",
    recordLede: "노동부가 가진 그대로이며, 아무것도 계산하지 않았습니다.",
    row: {
      status: "상태",
      caseNumber: "케이스 번호",
      filed: "접수일",
      employer: "고용주",
      jobTitle: "직책",
      checked: "노동부와 대조한 날",
    },
    notRecorded: "기록 없음",
    filedRow: (date, ago) => `${date}${ago ? ` (${ago}일 전)` : ""}`,
    checkedRow: (date, age, n) => `${date} (${age === 0 ? "오늘" : `${n}일 전`})`,
    numberSays: "케이스 번호가 알려 주는 것",

    positionIntro: "모든 심사 중 케이스의 노동부 실시간 상태를 접수 월별로 센 수치입니다.",
    earlierMonths: { label: "이전 달에 접수", note: "아직 노동부 일반 대기열에서 대기 중" },
    sameMonth: { label: "같은 달에 접수", note: "아직 대기 중, 이 케이스 포함" },
    behindFront: "노동부 심사 위치와의 거리",
    monthsBehind: (_n, f) => `${f}개월`,
    monthsAhead: (f) => `${f}개월 앞`,
    frontNote: (front, past) =>
      past ? `아직 끝나지 않은 가장 오래된 달: ${front}, 이 케이스보다 늦음` : `아직 끝나지 않은 가장 오래된 달: ${front}`,
    wallTitle: "이 케이스 앞에 있는 케이스",
    wallSubject: "접수 월별 결정되지 않은 케이스",
    wallCaption:
      "대기는 고르게 퍼져 있지 않습니다. 두 달이 대부분을 차지하므로, 대기열이 한동안 멈춘 듯하다가 한 번에 여러 달 앞으로 나갈 수 있습니다.",
    wallSource: (asOf) =>
      asOf
        ? `케이스별 상태는 노동부 자체 케이스 상태 시스템에서 매일 확인 · ${asOf} 기준 노동부 대기열 위치`
        : "케이스별 상태는 노동부 자체 케이스 상태 시스템에서 매일 확인",
    cohortLine: (total, month, decided, pct) => [
      `${month}에 접수된 케이스는 ${total}건입니다. 지금까지 `,
      `그중 ${decided}건이 결정되었으며`,
      `, 이는 그 달의 ${pct}입니다.`,
    ],
    cohortUntouched:
      " 아직 이른 시점이라 결정된 케이스는 끝까지 진행된 케이스가 아니라 거의 모두 철회된 케이스입니다. 그래서 이 달의 소요 기간은 제시하지 않습니다.",

    decisionTitle: "노동부가 결정할 때 기록한 내용",
    decisionLede: "실시간 상태 페이지에 없는 항목이 담긴 분기 공개 파일에서 가져왔습니다.",
    outcome: "결과",
    daysTaken: { label: "걸린 날수", note: "접수부터 결정까지" },
    offeredWage: "제시 임금",
    asFiled: "신청서 기준",
    worksiteState: "근무지 주",
    duration: (n, month, median, p25, p75, days, cmp) => [
      `${month}에 접수되어 결정된 ${n}건 중 가운데 케이스는 `,
      `${median}일`,
      `이 걸렸고, 절반은 ${p25}일에서 ${p75}일 사이였습니다. 이 케이스는 ${days}일이 걸렸습니다${
        cmp.kind === "longer"
          ? `. 그 달의 가운데보다 ${cmp.diff}일 더 걸렸습니다.`
          : cmp.kind === "quicker"
            ? `. 그 달의 가운데보다 ${cmp.diff}일 빨랐습니다.`
            : cmp.kind === "same"
              ? ". 그 달의 가운데와 정확히 같습니다."
              : "."
      }`,
    ],

    wageTitle: "이 임금의 위치",
    wageScope: (job, state) => `${state}의 ${job}`,
    wageBand: (p25, p75) =>
      `음영 구간은 가운데 절반입니다${p25 !== null && p75 !== null ? `(${p25}~${p75})` : ""}. 승인된 케이스만 포함합니다. 거부된 신청의 제시 임금은 아무도 동의한 적이 없으므로, 이를 포함하면 어떤 고용주도 지불할 필요가 없었던 금액으로 직무를 평가하게 됩니다.`,
    wageSource: (n) => `노동부 분기 공개 파일 · 승인된 케이스 ${n}건`,
    wageChart: (scope) => `${scope}의 승인 임금 중 이 임금의 위치`,
    wageTip: {
      thisCase: (v) => `이 케이스: ${v}`,
      p5: (v) => `5번째 백분위: ${v}`,
      p25: (v) => `25번째 백분위: ${v}`,
      median: (v) => `중앙값: ${v}`,
      p75: (v) => `75번째 백분위: ${v}`,
      p95: (v) => `95번째 백분위: ${v}`,
      certified: (n) => `승인된 케이스 ${n}건`,
    },
    medianMark: (v) => `중앙값 ${v}`,

    means: (label) => `“${label}”의 의미`,
    clock: "기한:",
    whoActs: "처리할 쪽:",
    nowIn: (n) => [
      "지금 모든 접수 월을 통틀어 ",
      `${n}건`,
      "이 이 상태에 있습니다. 이는 얼마나 흔한지를 보여 줄 뿐, 이 케이스가 이 상태를 벗어날 가능성을 뜻하지 않습니다. 상태 변화는 2026년 8월부터만 기록되어, 그런 확률을 계산하기에는 기록이 너무 짧습니다.",
    ],
    noDefinition: "공개된 정의 없음",
    everyStatus: "모든 상태 한눈에 보기(영어 페이지)",
    undecoded:
      "아직 여기에 설명이 없고, 노동부는 용어집을 공개하지 않으므로 이 페이지는 추측하지 않습니다. 노동부가 고용주에게 보낸 통지에 설명이 있으며, 고용주의 변호사가 가지고 있습니다.",

    queueFoldTitle: "대기열에서의 위치",
    queueFoldHint: "접수 월별 결정되지 않은 케이스와 노동부 심사 위치",
    restTitle: (month) => `${month}의 나머지 케이스는 어디에 있나`,
    restHint: "심사관 검토, 보류, RFI, 항소",
    inOrder: (ordinary, pending) => [
      `아직 열려 있는 ${pending}건 중 `,
      `${ordinary}건`,
      "이 접수 순서대로 진행되는 심사관 검토 단계에 있습니다. 보류, RFI, 감사 또는 항소가 생기면 케이스는 그 순서에서 빠집니다.",
    ],
    stageChart: (month) => `${month}에 접수된 심사 중 케이스, 단계별`,
    stageTipHeading: (month) => `${month} 접수`,
    everyStatusIn: (month) => `${month}의 모든 노동부 상태(링크는 영어 페이지)`,
    censusCaption: (month) => `${month}에 접수된 심사 중 케이스가 현재 있는 모든 노동부 상태, 대기열별`,
    fullSplit: (month) => `${month}의 전체 구분(영어 페이지)`,

    neighboursTitle: "이 접수 월과 앞뒤 달 비교",
    neighboursHint: "앞뒤로 두 달씩",
    neighboursIntro: (month) => `한 달만 봐서는 느린지 빠른지 알 수 없습니다. 앞뒤로 두 달씩 보면 ${month}이 평범한지 알 수 있습니다.`,
    everyMonth: "모든 접수 월(영어 페이지)",

    employerTitle: "이 고용주의 기록",
    employerHint: (name) => `노동부가 ${name}에 대해 공개한 결정된 PERM 케이스 전체`,
    employerIntro: "2024~2026 회계연도 기준입니다. 이 케이스가 아니라 고용주의 신청을 설명합니다.",
    fig: { decided: "결정된 케이스", certified: "승인", denied: "거부", medianDays: "중앙값 일수", rate: "승인" },
    cleanRecord: (n) =>
      `${n}건 모두 문제없이 승인된 기록은 알아 둘 만하지만 비율은 아닙니다. 이 정도 건수에서는 거부 한 건만으로 수치가 수십 퍼센트포인트 움직이므로, 여기에는 건수만 보여 드리고 비율은 보여 드리지 않습니다.`,
    thinRecord: (n) => `결정된 케이스가 ${n}건뿐이라 비율을 내기에는 표본이 너무 작습니다. 그래서 건수만 보여 드리고 비율은 보여 드리지 않습니다.`,
    rateRecord: (rate, n) =>
      `결정된 케이스 ${n}건 중 ${rate}가 승인되었습니다. 이는 노동부가 이 스폰서의 과거 신청을 어떻게 처리했는지를 설명할 뿐, 이 케이스에 대해서는 아무것도 말하지 않습니다.`,
    everythingAbout: (name) => `${name}에 대해 공개된 모든 정보(영어 페이지)`,
    end: ".",

    wontSayTitle: "이 페이지가 알려 드리지 않는 것",
    wontSay: {
      date: {
        lead: "보장된 결정일.",
        body: [
          " 추정은 일정표가 아니라 통계입니다. 감사와 항소가 생기면 케이스가 순서에서 빠집니다. 모든 모델을 나란히 비교한 내용은 ",
          "처리 기간 계산기(영어 페이지)",
          "에 있습니다.",
        ],
      },
      odds: {
        lead: "이 케이스가 승인될 가능성.",
        body: [" 확률 숫자 하나는 데이터가 뒷받침할 수 있는 것보다 많은 것을 주장하게 됩니다. 요인별로 측정한 비율은 ", "거부율 페이지(영어 페이지)", "에 있습니다."],
      },
      next: {
        lead: "이 케이스의 다음 단계.",
        body: [" PERM은 세 단계 중 첫 번째이며, 노동부는 다음 두 단계에 대해 케이스 번호별로 아무것도 공개하지 않습니다. ", "영주권 타임라인(영어 페이지)", "에서 이후 단계를 다룹니다."],
      },
      worker: {
        lead: "근로자 본인에 관한 정보.",
        body: " 노동부 파일에는 고용주, 직책, 케이스 번호만 나오고 근로자 본인은 나오지 않으며, 이 사이트도 마찬가지입니다.",
      },
    },
  },

  vi: {
    sep: " ",
    staleTitle: (days) => `DOL hiển thị tình trạng này cách đây ${days} ngày`,
    staleBody: (date) => [`, vào ${date}, và từ đó chưa được kiểm tra lại. Thay đổi gần đây sẽ xuất hiện trước tiên trên `, ", trang tình trạng của chính DOL."],
    reopenedTitle: "Hồ sơ lưu của DOL ghi nhận một quyết định cho hồ sơ này, và hồ sơ đã quay lại xử lý.",
    reopenedBody: (decided, date, live) => [
      ` Tệp hằng quý của DOL ghi hồ sơ là ${decided}${date ? ` vào ${date}` : ""}. Tình trạng trực tiếp của DOL hiện là ${live}, và đó là tình trạng mới nhất. Điều này bình thường: quyết định từ chối có thể được kháng cáo trong vòng 30 ngày theo `,
      ".",
    ],
    disagreeTitle: "Hai nguồn liên bang ghi khác nhau về hồ sơ này.",
    disagreeBody: (decided, live) =>
      ` Tệp công bố hằng quý của DOL ghi hồ sơ là ${decided}. Trang tình trạng trực tiếp hiện ${live}. Cứ khoảng năm nghìn hồ sơ thì có một hồ sơ như vậy, thường do tình trạng thay đổi sau khi tệp đã chốt. Cả hai đều được hiển thị bên dưới.`,
    censusTitle: "Hôm nay thiếu một số phần.",
    censusBody:
      " Không đọc được bản đếm hằng ngày của mọi hồ sơ đang chờ (bản đếm xác định vị trí của hồ sơ này trong tháng nộp), hoặc bản đếm đã quá tám ngày. Tình trạng ở trên là mới nhất. Phần còn lại sẽ có lại khi bản đếm được làm lại, thường là sáng hôm sau.",

    verdictDecided: "Đã có quyết định",
    verdictPending: "Đang chờ",
    aheadLabel: (n) => `${n} hồ sơ phía trước`,
    sourceShown: (date) => `DOL hiển thị tình trạng này vào ${date}`,
    sourceQueue: (date) => `Vị trí hàng chờ của DOL tính đến ${date}`,
    estimatedDecision: "Ngày quyết định ước tính",
    around: (date) => `Khoảng ${date}`,
    howWorkedOut: "Cách tính",
    noDateYet: "Hiện chưa thể đưa ra một ngày trung thực cho hồ sơ này.",
    hereIsWhy: "Lý do",
    statusIs: ["Tình trạng của DOL cho hồ sơ này là ", "."],
    inRecords: "Hồ sơ này có trong hồ sơ lưu của DOL.",
    filed: (date, ago) => `Hồ sơ được nộp vào ${date}${ago ? `, cách đây ${ago} ngày` : ""}.`,
    decidedOn: (date, after) => `DOL quyết định vào ${date}${after ? `, ${after} ngày sau khi nộp` : ""}.`,
    working: (published, front, differs, ahead) => [
      `${
        published
          ? `DOL cho biết đang xét các hồ sơ nộp trong ${published}${differs ? ` (tháng cũ nhất vẫn còn mở là ${front})` : ""}`
          : `Tháng cũ nhất vẫn còn mở là ${front}`
      }, và `,
      ahead,
      " hồ sơ trong hàng chờ thông thường của DOL được nộp trước hồ sơ này.",
    ],
    pastFront: "DOL đã đi qua tháng nộp này, nên hồ sơ này không còn chờ theo thứ tự nộp nữa.",

    planNext: {
      label: "Lên kế hoạch cho phần còn lại của thẻ xanh (trang tiếng Anh)",
      note: "I-140, bản tin thị thực và I-485, tính ngày từ hồ sơ này.",
    },
    deniedNext: {
      label: "Điều gì xảy ra sau khi bị từ chối (trang tiếng Anh)",
      note: "Xem xét lại, kháng cáo và nộp lại, cùng các thời hạn.",
    },

    recordTitle: "Hồ sơ lưu",
    recordLede: "Đúng như DOL lưu, không tính toán gì thêm.",
    row: {
      status: "Tình trạng",
      caseNumber: "Số hồ sơ",
      filed: "Ngày nộp",
      employer: "Chủ lao động",
      jobTitle: "Chức danh",
      checked: "Đối chiếu với DOL",
    },
    notRecorded: "Không có",
    filedRow: (date, ago) => `${date}${ago ? ` (cách đây ${ago} ngày)` : ""}`,
    checkedRow: (date, age, n) => `${date} (${age === 0 ? "hôm nay" : `cách đây ${n} ngày`})`,
    numberSays: "Số hồ sơ cho biết điều gì",

    positionIntro: "Số liệu từ tình trạng trực tiếp của DOL cho mọi hồ sơ đang chờ, theo tháng nộp.",
    earlierMonths: { label: "Nộp trong các tháng trước", note: "vẫn chờ trong hàng chờ thông thường của DOL" },
    sameMonth: { label: "Nộp cùng tháng", note: "vẫn đang chờ, gồm cả hồ sơ này" },
    behindFront: "Khoảng cách đến nơi DOL đang xét",
    monthsBehind: (_n, f) => `${f} tháng`,
    monthsAhead: (f) => `trước ${f} tháng`,
    frontNote: (front, past) =>
      past ? `tháng cũ nhất vẫn còn mở: ${front}, muộn hơn hồ sơ này` : `tháng cũ nhất vẫn còn mở: ${front}`,
    wallTitle: "Những hồ sơ đứng trước hồ sơ này",
    wallSubject: "Hồ sơ chưa có quyết định theo tháng nộp",
    wallCaption:
      "Thời gian chờ không trải đều. Hai tháng chiếm phần lớn, vì vậy hàng chờ có thể như đứng yên một thời gian rồi tiến lên vài tháng cùng lúc.",
    wallSource: (asOf) =>
      asOf
        ? `Tình trạng từng hồ sơ từ hệ thống tra cứu tình trạng hồ sơ của chính DOL, kiểm tra hằng ngày · vị trí hàng chờ của DOL tính đến ${asOf}`
        : "Tình trạng từng hồ sơ từ hệ thống tra cứu tình trạng hồ sơ của chính DOL, kiểm tra hằng ngày",
    cohortLine: (total, month, decided, pct) => [
      `Có ${total} hồ sơ được nộp trong ${month}. `,
      `${decided} hồ sơ trong số đó đã có quyết định`,
      ` cho đến nay, tức ${pct} của tháng.`,
    ],
    cohortUntouched:
      " Còn quá sớm nên các hồ sơ đã có quyết định gần như đều là hồ sơ rút lại, không phải hồ sơ đã đi hết quy trình, vì vậy không đưa ra thời gian xử lý cho tháng này.",

    decisionTitle: "Những gì DOL ghi lại khi quyết định",
    decisionLede: "Từ tệp công bố hằng quý, có những trường mà trang tình trạng trực tiếp không có.",
    outcome: "Kết quả",
    daysTaken: { label: "Số ngày", note: "từ khi nhận đến khi quyết định" },
    offeredWage: "Mức lương đưa ra",
    asFiled: "theo đơn",
    worksiteState: "Bang nơi làm việc",
    duration: (n, month, median, p25, p75, days, cmp) => [
      `Trong ${n} hồ sơ đã có quyết định được nộp trong ${month}, hồ sơ ở giữa mất `,
      `${median} ngày`,
      `, và một nửa nằm trong khoảng ${p25} đến ${p75} ngày. Hồ sơ này mất ${days} ngày${
        cmp.kind === "longer"
          ? `, lâu hơn hồ sơ ở giữa của tháng ${cmp.diff} ngày.`
          : cmp.kind === "quicker"
            ? `, nhanh hơn hồ sơ ở giữa của tháng ${cmp.diff} ngày.`
            : cmp.kind === "same"
              ? ", đúng bằng hồ sơ ở giữa của tháng."
              : "."
      }`,
    ],

    wageTitle: "Mức lương này nằm ở đâu",
    wageScope: (job, state) => `${job} tại ${state}`,
    wageBand: (p25, p75) =>
      `Dải tô đậm là một nửa ở giữa${p25 !== null && p75 !== null ? `, từ ${p25} đến ${p75}` : ""}. Chỉ tính hồ sơ được chứng nhận: mức lương trong một đơn bị từ chối chưa từng được ai chấp nhận, nên đưa vào sẽ định giá công việc ở một mức mà không chủ lao động nào phải trả.`,
    wageSource: (n) => `Các tệp công bố hằng quý của DOL · ${n} hồ sơ được chứng nhận`,
    wageChart: (scope) => `Vị trí của mức lương này trong các mức lương được chứng nhận của ${scope}`,
    wageTip: {
      thisCase: (v) => `Hồ sơ này: ${v}`,
      p5: (v) => `Phân vị thứ 5: ${v}`,
      p25: (v) => `Phân vị thứ 25: ${v}`,
      median: (v) => `Trung vị: ${v}`,
      p75: (v) => `Phân vị thứ 75: ${v}`,
      p95: (v) => `Phân vị thứ 95: ${v}`,
      certified: (n) => `${n} hồ sơ được chứng nhận`,
    },
    medianMark: (v) => `${v} trung vị`,

    means: (label) => `“${label}” nghĩa là gì`,
    clock: "Thời hạn:",
    whoActs: "Ai phải làm:",
    nowIn: (n) => [
      "",
      `${n} hồ sơ`,
      " đang ở tình trạng này ngay lúc này, trên mọi tháng nộp. Con số này cho biết tình trạng này phổ biến đến đâu, không phải khả năng hồ sơ này rời khỏi nó. Thay đổi tình trạng chỉ được ghi lại từ tháng 8 năm 2026, quá ngắn để tính các xác suất đó.",
    ],
    noDefinition: "Không có định nghĩa được công bố",
    everyStatus: "Mọi tình trạng, đặt cạnh nhau (trang tiếng Anh)",
    undecoded:
      "Ở đây chưa có giải thích, và DOL không công bố bảng thuật ngữ, nên trang này sẽ không đoán. Thông báo DOL gửi cho chủ lao động có giải thích; luật sư của họ có thông báo đó.",

    queueFoldTitle: "Vị trí trong hàng chờ",
    queueFoldHint: "Hồ sơ chưa có quyết định theo tháng nộp, và nơi DOL đang xét",
    restTitle: (month) => `Phần còn lại của ${month} đang ở đâu`,
    restHint: "Chuyên viên xét duyệt, tạm giữ, RFI và kháng cáo",
    inOrder: (ordinary, pending) => [
      "",
      ordinary,
      ` trong số ${pending} hồ sơ vẫn còn mở đang được chuyên viên xét duyệt, theo thứ tự nộp. Tạm giữ, RFI, kiểm tra (audit) hoặc kháng cáo sẽ đưa hồ sơ ra khỏi thứ tự đó.`,
    ],
    stageChart: (month) => `Hồ sơ đang chờ nộp trong ${month}, theo giai đoạn`,
    stageTipHeading: (month) => `Nộp trong ${month}`,
    everyStatusIn: (month) => `Mọi tình trạng của DOL trong ${month} (liên kết đến trang tiếng Anh)`,
    censusCaption: (month) => `Mọi tình trạng của DOL mà các hồ sơ đang chờ nộp trong ${month} đang ở, nhóm theo hàng chờ`,
    fullSplit: (month) => `Phân chia đầy đủ của ${month} (trang tiếng Anh)`,

    neighboursTitle: "Tháng nộp này so với các tháng lân cận",
    neighboursHint: "Hai tháng mỗi bên",
    neighboursIntro: (month) => `Một tháng tự nó không chậm hay nhanh. Hai tháng mỗi bên là đủ để thấy ${month} có bình thường không.`,
    everyMonth: "Mọi tháng nộp (trang tiếng Anh)",

    employerTitle: "Hồ sơ của chủ lao động này",
    employerHint: (name) => `Mọi hồ sơ PERM đã có quyết định mà DOL công bố cho ${name}`,
    employerIntro: "Từ năm tài khóa 2024 đến 2026. Số liệu mô tả các đơn của chủ lao động, không phải hồ sơ này.",
    fig: { decided: "hồ sơ đã quyết định", certified: "được chứng nhận", denied: "bị từ chối", medianDays: "ngày (trung vị)", rate: "được chứng nhận" },
    cleanRecord: (n) =>
      `Một hồ sơ sạch trên ${n} hồ sơ là điều đáng biết, nhưng đó không phải là một tỷ lệ. Với số lượng này, chỉ một lần từ chối cũng làm con số thay đổi hàng chục điểm phần trăm, nên ở đây chỉ có số đếm, không có tỷ lệ phần trăm.`,
    thinRecord: (n) =>
      `Với ${n} hồ sơ đã có quyết định, mẫu quá nhỏ để đưa ra tỷ lệ phần trăm, nên ở đây chỉ có số đếm, không có tỷ lệ.`,
    rateRecord: (rate, n) =>
      `${rate} trong ${n} hồ sơ đã có quyết định được chứng nhận. Con số này mô tả cách DOL xử lý các đơn trước đây của bên bảo lãnh này, không nói gì về hồ sơ này.`,
    everythingAbout: (name) => `Mọi thông tin đã công bố về ${name} (trang tiếng Anh)`,
    end: ".",

    wontSayTitle: "Những điều trang này không cho bạn biết",
    wontSay: {
      date: {
        lead: "Một ngày quyết định chắc chắn.",
        body: [
          " Ước tính là thống kê, không phải lịch hẹn: kiểm tra (audit) và kháng cáo đưa hồ sơ ra khỏi thứ tự. Mọi mô hình, đặt cạnh nhau, có trên ",
          "công cụ tính thời gian xử lý (trang tiếng Anh)",
          ".",
        ],
      },
      odds: {
        lead: "Khả năng hồ sơ này được chứng nhận.",
        body: [
          " Một con số xác suất duy nhất sẽ khẳng định nhiều hơn những gì dữ liệu chứng minh được. Các tỷ lệ đo được, theo từng yếu tố, có trên ",
          "trang tỷ lệ từ chối (trang tiếng Anh)",
          ".",
        ],
      },
      next: {
        lead: "Điều gì tiếp theo cho hồ sơ này.",
        body: [
          " PERM là giai đoạn đầu tiên trong ba giai đoạn, và DOL không công bố gì về hai giai đoạn sau theo số hồ sơ. ",
          "Dòng thời gian thẻ xanh (trang tiếng Anh)",
          " trình bày các giai đoạn sau giai đoạn này.",
        ],
      },
      worker: {
        lead: "Bất cứ điều gì về người lao động.",
        body: " Các tệp của DOL ghi tên chủ lao động, chức danh và số hồ sơ, không bao giờ ghi tên người lao động, và trang này cũng vậy.",
      },
    },
  },
} satisfies Messages<CaseStatusResultText>;
