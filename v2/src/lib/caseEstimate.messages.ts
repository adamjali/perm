import type { Lang } from "@/lib/i18n/lang";

/**
 * The estimate's own sentences in the five translations: the models' labels, bases and sources, every caveat,
 * the RFI and behind-the-queue branches, and the stage notes.
 *
 * NO ENGLISH ENTRY, ON PURPOSE. The English is the text the calculator, the API and the scorecard already read
 * (convex/lib/perm/calculators/queueEstimate.ts, src/lib/caseEstimate.ts, src/lib/queueForecast.ts), so it stays
 * there and stays the one English copy. A translation takes the same figures from the structured notes and facts
 * beside that English (`EstimateNote`, `ModelFacts`), never parsed English. `satisfies` makes a language missing
 * a sentence a type error.
 *
 * Arguments arrive formatted for the reader's language (numbers, months, days, percents), except where a plural
 * needs the number itself.
 */
export type Translated<T> = Record<Exclude<Lang, "en">, T>;

/** The statuses the stage table places (src/lib/queueForecast.ts STAGE_PLACEMENT). */
export type StageKey =
  | "ANALYST REVIEW"
  | "IN PROCESS"
  | "APPLICATION ON HOLD"
  | "RFI ISSUED"
  | "NORD ISSUED"
  | "RECONSIDERATION APPEALS"
  | "BALCA APPEALS";

export const STAGE_KEYS: readonly StageKey[] = [
  "ANALYST REVIEW",
  "IN PROCESS",
  "APPLICATION ON HOLD",
  "RFI ISSUED",
  "NORD ISSUED",
  "RECONSIDERATION APPEALS",
  "BALCA APPEALS",
];

export type ModelKey =
  | "decision-pace"
  | "queue-advance"
  | "dol-average"
  | "cohort-percentile"
  | "cohort-shape"
  | "stragglers"
  | "rfi-clock";

export interface EstimateLibText {
  modelLabel: Record<ModelKey, string>;
  basisPace: (casesAhead: string, pace: string, rawDays: string) => string;
  basisAdvance: (month: string, monthsBehind: number, monthsBehindText: string, rate: string) => string;
  basisAverage: (days: string) => string;
  basisCohort: (decided: string, month: string, medianDays: string) => string;
  basisShape: (decided: string, total: string, month: string, percentile: string) => string;
  sourcePace: string;
  sourceAdvance: (asOf: string) => string;
  sourceAverage: (asOf: string) => string;
  sourceCohort: string;
  sourceShape: string;
  /** The RFI and behind-the-queue models' source. */
  sourceCheck: string;
  overdue: (month: string, months: number, monthsText: string) => string;
  /** Lead-in to why the cases-ahead model isn't used, followed by one of the four reasons below. */
  paceAbsent: string;
  paceStale: (days: number, daysText: string) => string;
  paceUnmeasurable: string;
  paceNoCount: string;
  paceNoRate: string;
  cohortUnstarted: (month: string) => string;
  cohortOpen: (month: string) => string;
  noData: string;
  outOfOrder: string;
  rangeMeasuredLead: string;
  rangePaceLead: string;
  rangeServed: (judged: string, inside: string, stuck: string, wait: string) => string;
  rangeRow: (judged: string, inside: string, stuck: string, wait: string) => string;
  rangeFar: string;
  rangeUntested: string;
  rangeTested: (inside: string, judged: string, within7: string | null) => string;
  /** 14 days as two weeks, 7 as a week, otherwise a count. */
  waitDays: (days: number, daysText: string) => string;
  rfiLateMeasured: (days: string) => string;
  rfiLateEstimate: (days: string) => string;
  rfiMoreTime: string;
  rfiTested: (judged: string, miss: number, missText: string, inside: string) => string;
  rfiBasis: (entered: string, watched: string, leaveDay: string, afterDays: string) => string;
  rfiPastWindow: (days: string) => string;
  stragglerBasis: (p: {
    months: number | null;
    monthsText: string;
    windowDays: string;
    decided: string;
    pool: string;
    rate: string;
    median: string;
    p80: string;
  }) => string;
  stragglerCaveat: string;
  /** A case DOL's queue has passed, with no model left to date it. */
  overdueNote: (months: number | null, monthsText: string) => string;
  unmeasuredStage: string;
  stage: Record<StageKey, string>;
}

const esMes = (n: number) => (n === 1 ? "mes" : "meses");
const ptMes = (n: number) => (n === 1 ? "mês" : "meses");

export const ESTIMATE_TEXT = {
  es: {
    modelLabel: {
      "decision-pace": "Casos delante del suyo, al ritmo medido del DOL",
      "queue-advance": "Avance de la fila",
      "dol-average": "Promedio publicado por el DOL",
      "cohort-percentile": "Casos presentados el mismo mes",
      "cohort-shape": "Mismo mes, ajustado según los casos ya decididos",
      stragglers: "Detrás de la fila del DOL",
      "rfi-clock": "Solicitud de información (RFI)",
    },
    basisPace: (c, p, d) =>
      `${c} casos de la fila normal del DOL se presentaron antes que el suyo (los casos en espera, con una RFI o en apelación están fuera de la fila y no se cuentan). El DOL ha decidido unos ${p} casos al día, contando los fines de semana. Eso equivale a ${d} días de trabajo.`,
    basisAdvance: (m, n, nt, r) =>
      `El DOL está trabajando en ${m} y su mes está ${nt} ${esMes(n)} más atrás. La fila ha avanzado unos ${r} meses de presentación por cada mes del calendario.`,
    basisAverage: (d) =>
      `El DOL informa un promedio de ${d} días calendario hasta una decisión. Ese promedio se calcula sobre casos decididos hace poco, así que los casos con auditoría y los que tardan mucho lo suben.`,
    basisCohort: (dc, m, md) => `Se han decidido ${dc} casos presentados en ${m}. La mitad tardó ${md} días o menos.`,
    basisShape: (d, t, m, p) =>
      `De los ${t} casos presentados en ${m}, ya se decidieron ${d}, y los más rápidos salen primero, así que sus tiempos por sí solos resultan demasiado optimistas. En 20 meses ya terminados, la dispersión de un mes es estrecha (del percentil 5 al 95, a menos de un 5 % del centro). Por eso el percentil ${p} observado hasta ahora permite deducir dónde cae el centro.`,
    sourcePace:
      "Nuestro propio conteo de la fila del DOL en vivo, y el ritmo de decisiones que hemos observado en los últimos 28 días",
    sourceAdvance: (a) => `Avance de la fila medido con FLAG del DOL, al ${a}`,
    sourceAverage: (a) => `Tiempos de procesamiento de FLAG del DOL, al ${a}`,
    sourceCohort: "Datos de divulgación PERM del DOL",
    sourceShape: "Datos de divulgación PERM del DOL, ajustados con meses ya terminados",
    sourceCheck:
      "La revisión diaria que hace PERM Tracker de cada caso PERM pendiente en el sistema FLAG del DOL, medida de nuevo cada noche",
    overdue: (m, n, nt) =>
      `La fila de revisión por un analista del DOL pasó ${m} hace unos ${nt} ${esMes(n)}. Un caso de ese mes que sigue pendiente suele estar en auditoría, en reclutamiento supervisado o esperando la respuesta a una solicitud de información.`,
    paceAbsent: "El modelo de casos por delante, que suele ser el principal, no se usa aquí:",
    paceStale: (n, nt) => `nuestra última revisión del DOL fue hace ${nt} ${n === 1 ? "día" : "días"}.`,
    paceUnmeasurable: "hay muy pocos días hábiles observados para medir el ritmo del DOL.",
    paceNoCount: "no se pudo contar con los datos de hoy cuántos casos hay delante de este.",
    paceNoRate: "hoy no se pudo leer el ritmo de decisiones medido del DOL.",
    cohortUnstarted: (m) =>
      `El DOL todavía no ha empezado con ${m}. Unos pocos casos de ese mes ya tienen decisión, pero son retiros y otros cierres tempranos, no un tiempo de procesamiento, así que se dejan fuera.`,
    cohortOpen: (m) =>
      `El DOL todavía está trabajando en ${m}. Los primeros casos decididos son los más rápidos, así que los tiempos tal cual de los ya decididos serían demasiado optimistas para el resto del mes.`,
    noData: "Todavía no hay suficientes datos publicados del DOL para estimar esta fecha de presentación.",
    outOfOrder:
      "El DOL no decide los casos en un orden estricto. Una auditoría, un reclutamiento supervisado o una solicitud de información añaden meses, y ninguno se puede prever a partir de la fecha de presentación.",
    rangeMeasuredLead:
      "El rango es donde cayeron la mayoría de las decisiones recientes del DOL frente a fechas así de lejanas. Se mide de nuevo cada noche.",
    rangePaceLead: "El rango es lo que pasaría si el DOL mantiene su ritmo reciente. No es un intervalo de confianza.",
    rangeServed: (j, i, s, w) =>
      `Probado en ${j} casos que no se usaron para calcularlo, el ${i} se decidió dentro del rango y el ${s} seguía esperando ${w} después de su fecha, casi siempre en espera o con una RFI.`,
    rangeRow: (j, i, s, w) =>
      `En los ${j} casos recientes con que se midió, el ${i} se decidió dentro del rango y el ${s} seguía esperando ${w} después de su fecha, casi siempre en espera o con una RFI.`,
    rangeFar: "Todavía no se pueden probar fechas tan lejanas con decisiones reales, así que guíese por la fecha única.",
    rangeUntested: "Las decisiones reales a menudo caen fuera de él, así que guíese por la fecha única.",
    rangeTested: (i, j, w) =>
      `Probado cada semana con decisiones reales, acertó en el ${i} de ${j} casos${w !== null ? `, y el ${w} se decidió a menos de una semana de la fecha única` : ""}.`,
    waitDays: (d, dt) => (d === 14 ? "dos semanas" : d === 7 ? "una semana" : `${dt} días`),
    rfiLateMeasured: (d) =>
      `El extremo tardío deja ${d} días después de los 30, lo que tardó la décima parte más lenta de las RFI que hemos seguido.`,
    rfiLateEstimate: (d) =>
      `El extremo tardío deja ${d} días después de los 30. Es la estimación de un abogado de inmigración, hasta que nuestro registro haya seguido suficientes RFI por ese tiempo como para medirlo.`,
    rfiMoreTime:
      "El empleador puede pedir más tiempo, y el DOL puede pedir información una segunda vez. Cualquiera de las dos cosas mueve la fecha, y el estado de arriba lo mostrará.",
    rfiTested: (j, m, mt, i) =>
      `Probado en ${j} RFI de días que no se usaron para calcularlo, la fecha falló normalmente por ${mt} ${m === 1 ? "día" : "días"} y el ${i} se decidió dentro del rango.`,
    rfiBasis: (e, w, l, a) =>
      `Nuestra revisión diaria vio que el DOL emitió una solicitud de información (RFI) en este caso el ${e}. De las ${w} RFI que hemos seguido desde su primer día, casi todas cambiaron el día ${l} de nuestro registro (el plazo de respuesta de 30 días, y la revisión ve cada cambio un día después de que lo hace el DOL). La mayoría volvió a revisión por un analista, y el DOL las decidió una mediana de ${a} días después.`,
    rfiPastWindow: (d) =>
      `Esta RFI lleva ${d} días, más que los 30 habituales y los días que el DOL suele tardar después. Un caso que a estas alturas sigue con una RFI normalmente tiene una prórroga o una segunda solicitud, y ninguna de las dos se puede fechar.`,
    stragglerBasis: (p) =>
      `${p.months ? `La fila del DOL pasó este mes de presentación hace ${p.monthsText} ${esMes(p.months)}` : "La fila del DOL ya pasó este mes de presentación"}, y este caso sigue en revisión por un analista. En los últimos ${p.windowDays} días, el DOL decidió ${p.decided} de los ${p.pool} casos en la misma situación, cerca del ${p.rate} al día. La mitad se decidió en ${p.median} días y ocho de cada diez en ${p.p80}.`,
    stragglerCaveat:
      "Un caso todavía puede salir de la fila por una auditoría, una solicitud de información o una espera, y un ritmo no puede prever eso. Si el estado de arriba cambia, esta estimación también cambia.",
    overdueNote: (n, nt) =>
      `${n ? `La fila del DOL pasó este mes de presentación hace ${nt} ${esMes(n)}` : "La fila del DOL ya pasó este mes de presentación"}. Un caso que sigue pendiente a esas alturas normalmente salió del orden de presentación por una auditoría, una solicitud de información o una espera, y nada de eso se puede fechar a partir del mes de presentación. El estado en vivo de arriba es la lectura correcta.`,
    unmeasuredStage:
      "Este estado no se ha medido frente a su mes de presentación, así que la estimación toma el centro del mes en lugar de ajustarse a la etapa.",
    stage: {
      "ANALYST REVIEW": "El camino normal. El centro de su mes de presentación es la lectura correcta.",
      "IN PROCESS": "El camino normal. El centro de su mes de presentación es la lectura correcta.",
      "APPLICATION ON HOLD":
        "Los casos en espera han esperado más que la mayoría de su mes, así que el centro del mes daría una fecha demasiado temprana.",
      "RFI ISSUED":
        "Los casos con una solicitud de información están en la parte más lenta de su mes de presentación y ya han esperado más o menos el doble que un caso que sigue en revisión por un analista.",
      "NORD ISSUED":
        "Un caso en NORD ISSUED está cerca del extremo más lento de su mes de presentación. El DOL no dice qué significa NORD.",
      "RECONSIDERATION APPEALS":
        "La reconsideración es un procedimiento aparte, con sus propios plazos. Ningún percentil del mes de presentación original lo describe.",
      "BALCA APPEALS":
        "Una apelación ante BALCA es otra instancia por completo, no una decisión PERM lenta. Nada en los datos del mes de presentación permite fecharla.",
    },
  },
  zh: {
    modelLabel: {
      "decision-pace": "排在您前面的案件，按劳工部实测的速度",
      "queue-advance": "队列推进速度",
      "dol-average": "劳工部公布的平均时间",
      "cohort-percentile": "同月递交的案件",
      "cohort-shape": "同月案件，按已判定的部分调整",
      stragglers: "已被劳工部队列越过的案件",
      "rfi-clock": "补充信息要求（RFI）",
    },
    basisPace: (c, p, d) =>
      `劳工部正常队列中有 ${c} 个案件比您的案件更早递交（暂缓、处于 RFI 或上诉中的案件不在队列里，不计算在内）。劳工部最近每天大约判定 ${p} 个案件，包括周末在内。这相当于 ${d} 天的工作量。`,
    basisAdvance: (m, _n, nt, r) =>
      `劳工部正在审理${m}的案件，您的月份还要再往后 ${nt} 个月。审理进度大约每个日历月推进 ${r} 个月。`,
    basisAverage: (d) =>
      `劳工部公布的平均判定时间为 ${d} 个日历日。这个平均值来自最近判定的案件，因此经过审计和耗时很长的案件会把它拉高。`,
    basisCohort: (dc, m, md) => `${m}递交的案件中已有 ${dc} 个判定。其中一半用时 ${md} 天或更短。`,
    basisShape: (d, t, m, p) =>
      `${m}递交的 ${t} 个案件中已有 ${d} 个判定，而最快的案件最先判定，所以只看它们的用时会过于乐观。在 20 个已审完的月份中，同月案件的用时分布很集中（第 5 到第 95 百分位都在中位数上下约 5% 以内），因此可以用目前观察到的第 ${p} 百分位推算中位数的位置。`,
    sourcePace: "我们自己对劳工部实时队列的统计，以及过去 28 天观察到的判定速度",
    sourceAdvance: (a) => `根据劳工部 FLAG 系统测得的审理进度变化，截至 ${a}`,
    sourceAverage: (a) => `劳工部 FLAG 系统公布的处理时间，截至 ${a}`,
    sourceCohort: "劳工部公开的 PERM 数据",
    sourceShape: "劳工部公开的 PERM 数据，按已审完的月份调整",
    sourceCheck: "PERM Tracker 每天对劳工部 FLAG 系统中每个审理中 PERM 案件的检查，每晚重新测算",
    overdue: (m, _n, nt) =>
      `劳工部审查员审核的队列大约在 ${nt} 个月前已越过${m}。这个月份仍在审理中的案件，通常处于审计、监督招聘，或在等待对补充信息要求的答复。`,
    paceAbsent: "通常作为主要依据的“前方案件数”模型，这里没有使用：",
    paceStale: (_n, nt) => `我们上次检查劳工部是在 ${nt} 天前。`,
    paceUnmeasurable: "观察到的工作日太少，无法测出劳工部的速度。",
    paceNoCount: "无法用今天的数据统计排在这个案件前面的案件数。",
    paceNoRate: "今天无法读取劳工部实测的判定速度。",
    cohortUnstarted: (m) =>
      `劳工部还没有开始审理${m}的案件。那个月已有少数案件得到判定，但那些是撤回和其他提前结案的情况，不代表处理时间，所以不计入。`,
    cohortOpen: (m) =>
      `劳工部仍在审理${m}的案件。最先判定的是最快的案件，所以直接看已判定案件的用时，对这个月其余的案件来说会过于乐观。`,
    noData: "劳工部公布的数据还不足以对这个递交日期作出估计。",
    outOfOrder: "劳工部并不严格按顺序判定案件。审计、监督招聘或补充信息要求都会增加几个月，而这些都无法从递交日期预测。",
    rangeMeasuredLead: "这个范围是劳工部最近的判定相对于同样远的预计日期大多落在的区间，每晚重新测算。",
    rangePaceLead: "这个范围表示劳工部保持最近速度时的情况，不是置信区间。",
    rangeServed: (j, i, s, w) =>
      `在 ${j} 个未用于测算它的案件上检验，${i} 在这个范围内判定，${s} 在预计日期过后${w}仍未判定，通常处于暂缓或 RFI 状态。`,
    rangeRow: (j, i, s, w) =>
      `在用来测算它的 ${j} 个近期案件中，${i} 在这个范围内判定，${s} 在预计日期过后${w}仍未判定，通常处于暂缓或 RFI 状态。`,
    rangeFar: "这么远的日期还无法用真实判定检验，所以请以单一日期为主。",
    rangeUntested: "真实判定常常落在范围之外，所以请以单一日期为主。",
    rangeTested: (i, j, w) =>
      `每周用真实判定检验，${j} 个案件中有 ${i} 落在范围内${w !== null ? `，${w} 在单一日期前后一周内判定` : ""}。`,
    waitDays: (d, dt) => (d === 14 ? "两周" : d === 7 ? "一周" : ` ${dt} 天`),
    rfiLateMeasured: (d) => `范围的较晚一端在 30 天之后再留出 ${d} 天，这是我们跟踪的 RFI 中最慢的十分之一所用的时间。`,
    rfiLateEstimate: (d) =>
      `范围的较晚一端在 30 天之后再留出 ${d} 天。这是一位移民律师的估计，等我们的记录跟踪到足够多持续这么久的 RFI 后，再改用实测数字。`,
    rfiMoreTime: "雇主可以申请延期，劳工部也可能再次要求补充信息。任何一种情况都会改变日期，上面的状态会显示出来。",
    rfiTested: (j, _m, mt, i) => `在 ${j} 个未用于测算的日子里的 RFI 上检验，日期通常相差 ${mt} 天，${i} 在范围内判定。`,
    rfiBasis: (e, w, l, a) =>
      `我们的每日检查看到劳工部在 ${e} 对这个案件发出了补充信息要求（RFI）。在我们从第一天起跟踪的 ${w} 个 RFI 中，几乎全部在我们记录的第 ${l} 天发生变化（即 30 天的答复期限，我们的检查会在劳工部改动后一天看到）。大多数回到审查员审核，劳工部之后再过中位数 ${a} 天作出判定。`,
    rfiPastWindow: (d) =>
      `这个 RFI 已经持续 ${d} 天，超过了通常的 30 天以及劳工部之后一般需要的天数。到现在仍处于 RFI 的案件，通常是获得了延期或收到了第二次要求，这两种情况都无法推算日期。`,
    stragglerBasis: (p) =>
      `${p.months ? `劳工部的队列在 ${p.monthsText} 个月前已越过这个递交月份` : "劳工部的队列已越过这个递交月份"}，而这个案件仍在审查员审核中。过去 ${p.windowDays} 天里，劳工部判定了处境相同的 ${p.pool} 个案件中的 ${p.decided} 个，大约每天 ${p.rate}。其中一半在 ${p.median} 天内判定，十分之八在 ${p.p80} 天内判定。`,
    stragglerCaveat: "案件仍可能因审计、补充信息要求或暂缓而离开队列，而速度无法预见这些。如果上面的状态变了，这个估计也会跟着变。",
    overdueNote: (n, nt) =>
      `${n ? `劳工部的队列在 ${nt} 个月前已越过这个递交月份` : "劳工部的队列已越过这个递交月份"}。到这时仍在审理的案件，通常已因审计、补充信息要求或暂缓而不再按递交顺序处理，这些都无法根据递交月份推算日期。上面的实时状态才是准确的情况。`,
    unmeasuredStage: "这个状态还没有对照递交月份测算过，所以估计取该月的中位数，而不按阶段调整。",
    stage: {
      "ANALYST REVIEW": "正常流程。以您递交月份的中位数来看是对的。",
      "IN PROCESS": "正常流程。以您递交月份的中位数来看是对的。",
      "APPLICATION ON HOLD": "暂缓中的案件比同月大多数案件等得更久，所以按中位数估计会偏早。",
      "RFI ISSUED": "收到补充信息要求的案件处于同一递交月份中较慢的一端，已经等了大约是仍在审查员审核中的案件的两倍。",
      "NORD ISSUED": "处于 NORD ISSUED 的案件接近同一递交月份最慢的一端。劳工部没有说明 NORD 代表什么。",
      "RECONSIDERATION APPEALS": "重新考虑是一个单独的程序，有自己的时间表。原递交月份的任何百分位都无法描述它。",
      "BALCA APPEALS": "向 BALCA 上诉是完全不同的程序，不是一个慢的 PERM 判定。递交月份的数据无法推算它的日期。",
    },
  },
  "pt-br": {
    modelLabel: {
      "decision-pace": "Casos à frente do seu, no ritmo medido do DOL",
      "queue-advance": "Avanço da fila",
      "dol-average": "Média publicada pelo DOL",
      "cohort-percentile": "Casos protocolados no mesmo mês",
      "cohort-shape": "Mesmo mês, ajustado pelos casos já decididos",
      stragglers: "Atrás da fila do DOL",
      "rfi-clock": "Pedido de informações (RFI)",
    },
    basisPace: (c, p, d) =>
      `${c} casos da fila normal do DOL foram protocolados antes do seu (casos em espera, com RFI ou em recurso estão fora da fila e não são contados). O DOL tem decidido cerca de ${p} casos por dia, contando os fins de semana. Isso equivale a ${d} dias de trabalho.`,
    basisAdvance: (m, n, nt, r) =>
      `O DOL está trabalhando em ${m} e o seu mês está ${nt} ${ptMes(n)} adiante. A fila tem avançado cerca de ${r} meses de protocolo por mês do calendário.`,
    basisAverage: (d) =>
      `O DOL informa uma média de ${d} dias corridos até uma decisão. Essa média é calculada sobre casos decididos recentemente, então casos com auditoria e casos demorados a puxam para cima.`,
    basisCohort: (dc, m, md) => `Foram decididos ${dc} casos protocolados em ${m}. Metade levou ${md} dias ou menos.`,
    basisShape: (d, t, m, p) =>
      `Dos ${t} casos protocolados em ${m}, ${d} já foram decididos, e os mais rápidos saem primeiro, então os tempos deles sozinhos parecem otimistas demais. Em 20 meses já concluídos, a dispersão de um mês é estreita (do percentil 5 ao 95, a cerca de 5% do centro). É isso que permite que o percentil ${p} observado até agora indique onde fica o centro.`,
    sourcePace: "Nossa própria contagem da fila do DOL ao vivo, e o ritmo de decisões que observamos nos últimos 28 dias",
    sourceAdvance: (a) => `Avanço da fila medido no FLAG do DOL, em ${a}`,
    sourceAverage: (a) => `Tempos de processamento do FLAG do DOL, em ${a}`,
    sourceCohort: "Dados de divulgação PERM do DOL",
    sourceShape: "Dados de divulgação PERM do DOL, ajustados com meses já concluídos",
    sourceCheck:
      "A verificação diária que o PERM Tracker faz de cada caso PERM pendente no sistema FLAG do DOL, medida de novo toda noite",
    overdue: (m, n, nt) =>
      `A fila de revisão por analista do DOL passou ${m} há cerca de ${nt} ${ptMes(n)}. Um caso desse mês que ainda está pendente geralmente está em auditoria, em recrutamento supervisionado ou aguardando resposta a um pedido de informações.`,
    paceAbsent: "O modelo de casos à frente, que costuma ser o principal, não é usado aqui:",
    paceStale: (n, nt) => `nossa última verificação do DOL foi há ${nt} ${n === 1 ? "dia" : "dias"}.`,
    paceUnmeasurable: "há poucos dias úteis observados para medir o ritmo do DOL.",
    paceNoCount: "não foi possível contar, com os dados de hoje, quantos casos estão à frente deste.",
    paceNoRate: "hoje não foi possível ler o ritmo de decisões medido do DOL.",
    cohortUnstarted: (m) =>
      `O DOL ainda não começou ${m}. Alguns casos desse mês já têm decisão, mas são desistências e outros encerramentos antecipados, não um tempo de processamento, então ficam de fora.`,
    cohortOpen: (m) =>
      `O DOL ainda está trabalhando em ${m}. Os primeiros casos decididos são os mais rápidos, então os tempos brutos dos já decididos seriam otimistas demais para o resto do mês.`,
    noData: "Ainda não há dados publicados do DOL suficientes para estimar esta data de protocolo.",
    outOfOrder:
      "O DOL não decide os casos em ordem estrita. Uma auditoria, um recrutamento supervisionado ou um pedido de informações acrescentam meses, e nenhum deles pode ser previsto pela data de protocolo.",
    rangeMeasuredLead:
      "A faixa é onde caiu a maioria das decisões recentes do DOL em relação a datas tão distantes quanto esta. É medida de novo toda noite.",
    rangePaceLead: "A faixa é o que acontece se o DOL mantiver o ritmo recente. Não é um intervalo de confiança.",
    rangeServed: (j, i, s, w) =>
      `Testada em ${j} casos que não foram usados para calculá-la, ${i} foram decididos dentro dela e ${s} ainda esperavam ${w} depois da data, geralmente em espera ou com RFI.`,
    rangeRow: (j, i, s, w) =>
      `Nos ${j} casos recentes em que foi medida, ${i} foram decididos dentro dela e ${s} ainda esperavam ${w} depois da data, geralmente em espera ou com RFI.`,
    rangeFar: "Ainda não dá para testar datas tão distantes com decisões reais, então confie na data única.",
    rangeUntested: "As decisões reais costumam cair fora dela, então confie na data única.",
    rangeTested: (i, j, w) =>
      `Testada toda semana com decisões reais, acertou ${i} de ${j} casos${w !== null ? `, e ${w} foram decididos a menos de uma semana da data única` : ""}.`,
    waitDays: (d, dt) => (d === 14 ? "duas semanas" : d === 7 ? "uma semana" : `${dt} dias`),
    rfiLateMeasured: (d) =>
      `O fim tardio dá ${d} dias depois dos 30, o que levou o décimo mais lento dos RFIs que acompanhamos.`,
    rfiLateEstimate: (d) =>
      `O fim tardio dá ${d} dias depois dos 30. É a estimativa de um advogado de imigração, até que nosso registro tenha acompanhado RFIs suficientes por esse tempo para medir.`,
    rfiMoreTime:
      "O empregador pode pedir mais prazo, e o DOL pode pedir informações uma segunda vez. Qualquer um dos dois muda a data, e o status acima vai mostrar.",
    rfiTested: (j, m, mt, i) =>
      `Testada em ${j} RFIs de dias que não foram usados para calculá-la, a data errou em geral por ${mt} ${m === 1 ? "dia" : "dias"} e ${i} foram decididos dentro da faixa.`,
    rfiBasis: (e, w, l, a) =>
      `Nossa verificação diária viu o DOL emitir um pedido de informações (RFI) neste caso em ${e}. Dos ${w} RFIs que acompanhamos desde o primeiro dia, quase todos mudaram no dia ${l} do nosso registro (o prazo de resposta de 30 dias, e a verificação vê cada mudança um dia depois de o DOL fazê-la). A maioria voltou para revisão por analista, e o DOL os decidiu uma mediana de ${a} dias depois.`,
    rfiPastWindow: (d) =>
      `Este RFI já dura ${d} dias, mais que os 30 habituais e os dias que o DOL costuma levar depois. Um caso que ainda está em RFI a esta altura geralmente tem uma prorrogação ou um segundo pedido, e nenhum dos dois pode ser datado.`,
    stragglerBasis: (p) =>
      `${p.months ? `A fila do DOL passou este mês de protocolo há ${p.monthsText} ${ptMes(p.months)}` : "A fila do DOL já passou este mês de protocolo"}, e este caso ainda está em revisão por analista. Nos últimos ${p.windowDays} dias, o DOL decidiu ${p.decided} dos ${p.pool} casos na mesma situação, cerca de ${p.rate} por dia. Metade foi decidida em ${p.median} dias e oito em cada dez em ${p.p80}.`,
    stragglerCaveat:
      "Um caso ainda pode sair da fila por uma auditoria, um pedido de informações ou uma espera, e um ritmo não consegue prever isso. Se o status acima mudar, esta estimativa também muda.",
    overdueNote: (n, nt) =>
      `${n ? `A fila do DOL passou este mês de protocolo há ${nt} ${ptMes(n)}` : "A fila do DOL já passou este mês de protocolo"}. Um caso que ainda está pendente a essa altura geralmente saiu da ordem de protocolo por uma auditoria, um pedido de informações ou uma espera, e nada disso pode ser datado pelo mês de protocolo. O status ao vivo acima é a leitura correta.`,
    unmeasuredStage:
      "Este status não foi medido em relação ao mês de protocolo, então a estimativa usa o meio do mês em vez de ajustar pela etapa.",
    stage: {
      "ANALYST REVIEW": "O caminho normal. O meio do seu mês de protocolo é a leitura certa.",
      "IN PROCESS": "O caminho normal. O meio do seu mês de protocolo é a leitura certa.",
      "APPLICATION ON HOLD":
        "Os casos em espera já esperaram mais que a maioria do mês, então o meio do mês daria uma data cedo demais.",
      "RFI ISSUED":
        "Os casos com pedido de informações ficam na parte mais lenta do mês de protocolo e já esperaram cerca do dobro de um caso ainda em revisão por analista.",
      "NORD ISSUED":
        "Um caso em NORD ISSUED fica perto do extremo mais lento do mês de protocolo. O DOL não diz o que NORD significa.",
      "RECONSIDERATION APPEALS":
        "A reconsideração é um procedimento à parte, com seus próprios prazos. Nenhum percentil do mês de protocolo original a descreve.",
      "BALCA APPEALS":
        "Um recurso ao BALCA é outra instância, não uma decisão PERM lenta. Nada nos dados do mês de protocolo permite datá-lo.",
    },
  },
  ko: {
    modelLabel: {
      "decision-pace": "앞선 케이스 수, 노동부의 실측 처리 속도 기준",
      "queue-advance": "대기열 진행 속도",
      "dol-average": "노동부가 공개한 평균",
      "cohort-percentile": "같은 달에 접수된 케이스",
      "cohort-shape": "같은 달, 결정된 케이스 기준으로 보정",
      stragglers: "노동부 대기열이 지나간 케이스",
      "rfi-clock": "추가 정보 요청(RFI)",
    },
    basisPace: (c, p, d) =>
      `노동부 일반 대기열에서 ${c}건이 귀하의 케이스보다 먼저 접수되었습니다(보류, RFI, 항소 중인 케이스는 대기열 밖에 있어 세지 않습니다). 노동부는 주말을 포함해 하루 약 ${p}건을 결정해 왔습니다. 이는 ${d}일 분량의 작업입니다.`,
    basisAdvance: (m, _n, nt, r) =>
      `노동부는 ${m} 접수분을 심사 중이며, 귀하의 접수 월은 그보다 ${nt}개월 뒤입니다. 심사 진행 위치는 달력상 한 달에 약 ${r}개월씩 나아가 왔습니다.`,
    basisAverage: (d) =>
      `노동부는 결정까지 평균 ${d}일(달력일)이 걸린다고 공개합니다. 이 평균은 최근 결정된 케이스로 계산하므로, 감사를 받았거나 오래 걸린 케이스가 평균을 끌어올립니다.`,
    basisCohort: (dc, m, md) => `${m}에 접수된 케이스 중 ${dc}건이 결정되었습니다. 그중 절반은 ${md}일 이하가 걸렸습니다.`,
    basisShape: (d, t, m, p) =>
      `${m}에 접수된 ${t}건 중 ${d}건이 결정되었고, 가장 빠른 케이스가 먼저 결정되므로 그 기간만 보면 지나치게 낙관적입니다. 끝난 20개월을 보면 한 달 안의 분포는 좁습니다(5번째부터 95번째 백분위수가 중앙값의 약 5% 안에 있음). 그래서 지금까지 관찰된 ${p}번째 백분위수로 중앙값이 어디쯤일지 추정할 수 있습니다.`,
    sourcePace: "노동부 실시간 대기열에 대한 저희 자체 집계와, 최근 28일 동안 관찰한 결정 속도",
    sourceAdvance: (a) => `노동부 FLAG 기준으로 측정한 심사 진행 위치 변화, ${a} 기준`,
    sourceAverage: (a) => `노동부 FLAG 처리 시간, ${a} 기준`,
    sourceCohort: "노동부 PERM 공개 데이터",
    sourceShape: "노동부 PERM 공개 데이터, 끝난 달을 기준으로 보정",
    sourceCheck: "PERM Tracker가 노동부 FLAG 시스템에서 심사 중인 모든 PERM 케이스를 매일 확인한 결과, 매일 밤 다시 측정",
    overdue: (m, _n, nt) =>
      `노동부 심사관 검토 대기열은 약 ${nt}개월 전에 ${m}을 지나갔습니다. 이 달에 접수되어 아직 심사 중인 케이스는 대개 감사나 감독 하 모집 중이거나, 추가 정보 요청에 대한 답변을 기다리는 중입니다.`,
    paceAbsent: "보통 기준이 되는 '앞선 케이스 수' 모델은 여기서 쓰지 않습니다.",
    paceStale: (_n, nt) => `마지막으로 노동부를 확인한 것이 ${nt}일 전입니다.`,
    paceUnmeasurable: "관찰된 근무일이 너무 적어 노동부의 속도를 측정할 수 없습니다.",
    paceNoCount: "오늘 데이터로는 이 케이스 앞의 케이스 수를 셀 수 없었습니다.",
    paceNoRate: "오늘은 노동부의 측정된 결정 속도를 읽을 수 없었습니다.",
    cohortUnstarted: (m) =>
      `노동부는 아직 ${m} 접수분을 시작하지 않았습니다. 그 달의 케이스 몇 건은 이미 결정이 났지만, 처리 기간이 아니라 철회나 조기 종료이므로 제외합니다.`,
    cohortOpen: (m) =>
      `노동부는 아직 ${m} 접수분을 심사하고 있습니다. 먼저 결정되는 케이스가 가장 빠른 케이스이므로, 이미 결정된 케이스의 기간을 그대로 보면 그 달의 나머지 케이스에는 지나치게 낙관적입니다.`,
    noData: "아직 이 접수일을 추정할 만큼 노동부의 공개 데이터가 충분하지 않습니다.",
    outOfOrder:
      "노동부는 케이스를 엄격한 순서대로 결정하지 않습니다. 감사, 감독 하 모집, 추가 정보 요청은 몇 달을 더하며, 어느 것도 접수일로 예측할 수 없습니다.",
    rangeMeasuredLead: "이 범위는 이만큼 먼 날짜에 대해 노동부의 최근 결정이 대부분 실제로 떨어진 구간이며, 매일 밤 다시 측정합니다.",
    rangePaceLead: "이 범위는 노동부가 최근 속도를 유지할 경우의 결과이며, 신뢰 구간이 아닙니다.",
    rangeServed: (j, i, s, w) =>
      `이 범위를 만드는 데 쓰지 않은 ${j}건으로 검증한 결과, ${i}는 범위 안에서 결정되었고 ${s}는 예상일로부터 ${w}가 지나도 기다리고 있었으며, 대개 보류 또는 RFI 상태였습니다.`,
    rangeRow: (j, i, s, w) =>
      `이 범위를 측정한 최근 ${j}건 중 ${i}는 범위 안에서 결정되었고 ${s}는 예상일로부터 ${w}가 지나도 기다리고 있었으며, 대개 보류 또는 RFI 상태였습니다.`,
    rangeFar: "이렇게 먼 날짜는 아직 실제 결정으로 검증할 수 없으므로, 하나의 날짜를 기준으로 보십시오.",
    rangeUntested: "실제 결정은 이 범위 밖에서 나오는 경우가 많으므로, 하나의 날짜를 기준으로 보십시오.",
    rangeTested: (i, j, w) =>
      `매주 실제 결정으로 검증한 결과, ${j}건 중 ${i}가 범위 안에 들었습니다.${w !== null ? ` ${w}는 하나의 날짜로부터 일주일 안에 결정되었습니다.` : ""}`,
    waitDays: (d, dt) => (d === 14 ? "2주" : d === 7 ? "1주" : `${dt}일`),
    rfiLateMeasured: (d) =>
      `범위의 늦은 끝은 30일 뒤에 ${d}일을 더 둡니다. 저희가 추적한 RFI 중 가장 느린 10%가 걸린 기간입니다.`,
    rfiLateEstimate: (d) =>
      `범위의 늦은 끝은 30일 뒤에 ${d}일을 더 둡니다. 이는 이민 변호사의 추정치이며, 저희 기록이 그만큼 오래 걸린 RFI를 충분히 추적해 측정할 수 있을 때까지 사용합니다.`,
    rfiMoreTime:
      "고용주가 기한 연장을 요청할 수 있고, 노동부가 두 번째로 요청할 수도 있습니다. 둘 중 어느 쪽이든 날짜가 바뀌며, 위의 상태에 나타납니다.",
    rfiTested: (j, _m, mt, i) =>
      `계산에 쓰지 않은 날의 RFI ${j}건으로 검증한 결과, 날짜는 보통 ${mt}일 차이가 났고 ${i}가 범위 안에서 결정되었습니다.`,
    rfiBasis: (e, w, l, a) =>
      `저희의 매일 확인에서 노동부가 ${e}에 이 케이스에 추가 정보 요청(RFI)을 보낸 것을 확인했습니다. 첫날부터 추적한 RFI ${w}건 중 거의 모두가 저희 기록의 ${l}일째에 상태가 바뀌었습니다(30일 답변 기한이며, 확인은 노동부의 변경을 하루 뒤에 봅니다). 대부분은 심사관 검토로 돌아갔고, 노동부는 그 뒤 중앙값 ${a}일 만에 결정했습니다.`,
    rfiPastWindow: (d) =>
      `이 RFI는 ${d}일째로, 보통의 30일과 그 뒤 노동부가 대개 걸리는 기간을 넘었습니다. 지금까지 RFI 상태인 케이스는 대개 기한 연장이나 두 번째 요청이 있었던 경우이며, 둘 다 날짜를 추정할 수 없습니다.`,
    stragglerBasis: (p) =>
      `${p.months ? `노동부 대기열은 ${p.monthsText}개월 전에 이 접수 월을 지나갔지만` : "노동부 대기열은 이미 이 접수 월을 지나갔지만"}, 이 케이스는 아직 심사관 검토 중입니다. 최근 ${p.windowDays}일 동안 노동부는 같은 처지의 ${p.pool}건 중 ${p.decided}건을 결정했으며, 하루 약 ${p.rate}입니다. 절반은 ${p.median}일 안에, 10건 중 8건은 ${p.p80}일 안에 결정되었습니다.`,
    stragglerCaveat:
      "케이스는 여전히 감사, 추가 정보 요청, 보류로 대기열에서 빠질 수 있으며, 처리 속도로는 이를 미리 알 수 없습니다. 위의 상태가 바뀌면 이 추정도 바뀝니다.",
    overdueNote: (n, nt) =>
      `${n ? `노동부 대기열은 ${nt}개월 전에 이 접수 월을 지나갔습니다.` : "노동부 대기열은 이미 이 접수 월을 지나갔습니다."} 그 시점까지 심사 중인 케이스는 대개 감사, 추가 정보 요청, 보류로 접수 순서에서 빠진 경우이며, 이런 경우는 접수 월로 날짜를 추정할 수 없습니다. 위의 실시간 상태가 정확한 정보입니다.`,
    unmeasuredStage:
      "이 상태는 접수 월 기준으로 측정된 적이 없으므로, 추정은 단계에 맞춰 보정하지 않고 그 달의 중간값을 사용합니다.",
    stage: {
      "ANALYST REVIEW": "일반적인 경로입니다. 접수 월의 중간값으로 보는 것이 맞습니다.",
      "IN PROCESS": "일반적인 경로입니다. 접수 월의 중간값으로 보는 것이 맞습니다.",
      "APPLICATION ON HOLD": "보류 중인 케이스는 같은 달의 대부분보다 오래 기다렸으므로, 중간값으로 보면 너무 이르게 나옵니다.",
      "RFI ISSUED":
        "추가 정보 요청을 받은 케이스는 같은 접수 월에서 느린 쪽에 있으며, 아직 심사관 검토 중인 케이스보다 이미 두 배 정도 오래 기다렸습니다.",
      "NORD ISSUED":
        "NORD ISSUED 상태의 케이스는 같은 접수 월의 가장 느린 끝 가까이에 있습니다. 노동부는 NORD가 무엇의 약자인지 밝히지 않습니다.",
      "RECONSIDERATION APPEALS": "재심은 자체 일정이 있는 별도의 절차입니다. 원래 접수 월의 어떤 백분위수로도 설명할 수 없습니다.",
      "BALCA APPEALS": "BALCA 항소는 완전히 다른 기관의 절차이며, 느린 PERM 결정이 아닙니다. 접수 월 데이터로는 날짜를 추정할 수 없습니다.",
    },
  },
  vi: {
    modelLabel: {
      "decision-pace": "Số hồ sơ đứng trước bạn, theo tốc độ đo được của DOL",
      "queue-advance": "Tốc độ tiến của hàng chờ",
      "dol-average": "Mức trung bình DOL công bố",
      "cohort-percentile": "Hồ sơ nộp cùng tháng",
      "cohort-shape": "Cùng tháng, điều chỉnh theo số hồ sơ đã có quyết định",
      stragglers: "Nằm sau hàng chờ của DOL",
      "rfi-clock": "Yêu cầu bổ sung thông tin (RFI)",
    },
    basisPace: (c, p, d) =>
      `Có ${c} hồ sơ trong hàng chờ thông thường của DOL được nộp trước hồ sơ của bạn (hồ sơ tạm giữ, đang có RFI hoặc đang kháng cáo nằm ngoài hàng chờ và không được tính). DOL gần đây quyết định khoảng ${p} hồ sơ mỗi ngày, tính cả cuối tuần. Như vậy là ${d} ngày làm việc.`,
    basisAdvance: (m, _n, nt, r) =>
      `DOL đang xét ${m} và tháng của bạn còn cách ${nt} tháng. Hàng chờ đã tiến khoảng ${r} tháng nộp cho mỗi tháng lịch.`,
    basisAverage: (d) =>
      `DOL công bố thời gian trung bình là ${d} ngày theo lịch cho đến khi có quyết định. Mức trung bình này tính trên các hồ sơ mới được quyết định gần đây, nên các hồ sơ bị kiểm tra (audit) hoặc kéo dài làm nó tăng lên.`,
    basisCohort: (dc, m, md) => `Đã có ${dc} hồ sơ nộp trong ${m} được quyết định. Một nửa mất ${md} ngày hoặc ít hơn.`,
    basisShape: (d, t, m, p) =>
      `Trong ${t} hồ sơ nộp trong ${m}, đã có ${d} hồ sơ có quyết định, và hồ sơ nhanh nhất được quyết định trước, nên chỉ nhìn thời gian của chúng thì quá lạc quan. Qua 20 tháng đã xong, độ phân tán trong một tháng rất hẹp (từ bách phân vị thứ 5 đến 95 nằm trong khoảng 5% quanh mức giữa). Nhờ vậy, bách phân vị thứ ${p} quan sát được đến nay cho biết mức giữa sẽ rơi vào đâu.`,
    sourcePace: "Số đếm riêng của chúng tôi về hàng chờ trực tiếp của DOL, và tốc độ quyết định chúng tôi quan sát được trong 28 ngày qua",
    sourceAdvance: (a) => `Mức tiến của hàng chờ đo trên hệ thống FLAG của DOL, tính đến ${a}`,
    sourceAverage: (a) => `Thời gian xử lý trên FLAG của DOL, tính đến ${a}`,
    sourceCohort: "Dữ liệu công bố PERM của DOL",
    sourceShape: "Dữ liệu công bố PERM của DOL, điều chỉnh theo các tháng đã xong",
    sourceCheck:
      "Việc PERM Tracker kiểm tra hằng ngày mọi hồ sơ PERM đang chờ trên hệ thống FLAG của DOL, được đo lại mỗi đêm",
    overdue: (m, _n, nt) =>
      `Hàng chờ chuyên viên xét duyệt của DOL đã qua ${m} khoảng ${nt} tháng trước. Một hồ sơ của tháng này mà vẫn đang chờ thường đang bị kiểm tra (audit), đang tuyển dụng có giám sát, hoặc đang chờ trả lời một yêu cầu bổ sung thông tin.`,
    paceAbsent: "Mô hình số hồ sơ đứng trước, vốn thường là mô hình chính, không được dùng ở đây:",
    paceStale: (_n, nt) => `lần cuối chúng tôi quét dữ liệu DOL là ${nt} ngày trước.`,
    paceUnmeasurable: "số ngày làm việc quan sát được quá ít để đo tốc độ của DOL.",
    paceNoCount: "không thể đếm số hồ sơ đứng trước hồ sơ này từ dữ liệu hôm nay.",
    paceNoRate: "hôm nay không đọc được tốc độ quyết định đo được của DOL.",
    cohortUnstarted: (m) =>
      `DOL chưa bắt đầu xét ${m}. Một vài hồ sơ của tháng đó đã có quyết định, nhưng đó là hồ sơ rút lại và các trường hợp kết thúc sớm khác, không phải thời gian xử lý, nên không được tính.`,
    cohortOpen: (m) =>
      `DOL vẫn đang xét ${m}. Những hồ sơ được quyết định trước là những hồ sơ nhanh nhất, nên thời gian thô của các hồ sơ đã có quyết định sẽ quá lạc quan cho phần còn lại của tháng.`,
    noData: "Chưa có đủ dữ liệu DOL công bố để ước tính cho ngày nộp này.",
    outOfOrder:
      "DOL không quyết định hồ sơ theo đúng thứ tự. Một lần kiểm tra (audit), tuyển dụng có giám sát hoặc yêu cầu bổ sung thông tin sẽ thêm vài tháng, và không điều nào đoán trước được từ ngày nộp.",
    rangeMeasuredLead:
      "Khoảng này là nơi phần lớn các quyết định gần đây của DOL rơi vào, so với những ngày ước tính xa như thế này. Khoảng này được đo lại mỗi đêm.",
    rangePaceLead: "Khoảng này là điều xảy ra nếu DOL giữ tốc độ gần đây, không phải khoảng tin cậy.",
    rangeServed: (j, i, s, w) =>
      `Kiểm tra trên ${j} hồ sơ không dùng để tính ra khoảng này, ${i} được quyết định trong khoảng và ${s} vẫn đang chờ ${w} sau ngày ước tính, thường là đang tạm giữ hoặc có RFI.`,
    rangeRow: (j, i, s, w) =>
      `Trên ${j} hồ sơ gần đây dùng để đo, ${i} được quyết định trong khoảng và ${s} vẫn đang chờ ${w} sau ngày ước tính, thường là đang tạm giữ hoặc có RFI.`,
    rangeFar: "Chưa thể kiểm tra những ngày xa như vậy bằng quyết định thật, nên hãy dựa vào ngày ước tính duy nhất.",
    rangeUntested: "Quyết định thật thường rơi ra ngoài khoảng này, nên hãy dựa vào ngày ước tính duy nhất.",
    rangeTested: (i, j, w) =>
      `Được kiểm tra mỗi tuần bằng quyết định thật, khoảng này đúng với ${i} trong ${j} hồ sơ${w !== null ? `, và ${w} được quyết định trong vòng một tuần quanh ngày ước tính` : ""}.`,
    waitDays: (d, dt) => (d === 14 ? "hai tuần" : d === 7 ? "một tuần" : `${dt} ngày`),
    rfiLateMeasured: (d) =>
      `Đầu muộn của khoảng cho thêm ${d} ngày sau 30 ngày, bằng thời gian của một phần mười RFI chậm nhất mà chúng tôi theo dõi.`,
    rfiLateEstimate: (d) =>
      `Đầu muộn của khoảng cho thêm ${d} ngày sau 30 ngày. Đây là ước tính của một luật sư di trú, cho đến khi hồ sơ của chúng tôi theo dõi đủ RFI kéo dài như vậy để đo được.`,
    rfiMoreTime:
      "Chủ lao động có thể xin thêm thời gian, và DOL có thể yêu cầu lần thứ hai. Việc nào cũng làm ngày thay đổi, và tình trạng ở trên sẽ cho thấy điều đó.",
    rfiTested: (j, _m, mt, i) =>
      `Kiểm tra trên ${j} RFI của những ngày không dùng để tính, ngày ước tính thường lệch ${mt} ngày và ${i} được quyết định trong khoảng.`,
    rfiBasis: (e, w, l, a) =>
      `Đợt kiểm tra hằng ngày của chúng tôi thấy DOL gửi yêu cầu bổ sung thông tin (RFI) cho hồ sơ này vào ngày ${e}. Trong ${w} RFI chúng tôi theo dõi từ ngày đầu, gần như tất cả thay đổi vào ngày thứ ${l} trong hồ sơ của chúng tôi (thời hạn trả lời 30 ngày, và đợt kiểm tra thấy mỗi thay đổi một ngày sau khi DOL thực hiện). Phần lớn quay lại chuyên viên xét duyệt, và DOL quyết định những hồ sơ đó sau trung vị ${a} ngày.`,
    rfiPastWindow: (d) =>
      `RFI này đã kéo dài ${d} ngày, quá 30 ngày thông thường và số ngày DOL thường cần sau đó. Một hồ sơ đến giờ vẫn còn RFI thường đã được gia hạn hoặc nhận yêu cầu lần hai, và cả hai đều không thể ước tính ngày.`,
    stragglerBasis: (p) =>
      `${p.months ? `Hàng chờ của DOL đã qua tháng nộp này ${p.monthsText} tháng trước` : "Hàng chờ của DOL đã qua tháng nộp này"}, và hồ sơ này vẫn đang ở chuyên viên xét duyệt. Trong ${p.windowDays} ngày qua, DOL đã quyết định ${p.decided} trong số ${p.pool} hồ sơ ở cùng vị trí, khoảng ${p.rate} mỗi ngày. Một nửa được quyết định trong ${p.median} ngày, và tám phần mười trong ${p.p80} ngày.`,
    stragglerCaveat:
      "Một hồ sơ vẫn có thể rời hàng chờ vì kiểm tra (audit), yêu cầu bổ sung thông tin hoặc bị tạm giữ, và tốc độ không thể thấy trước điều đó. Nếu tình trạng ở trên thay đổi, ước tính này cũng thay đổi.",
    overdueNote: (n, nt) =>
      `${n ? `Hàng chờ của DOL đã qua tháng nộp này ${nt} tháng trước` : "Hàng chờ của DOL đã qua tháng nộp này"}. Một hồ sơ vẫn còn chờ vào lúc đó thường đã bị đưa ra khỏi thứ tự nộp vì kiểm tra (audit), yêu cầu bổ sung thông tin hoặc bị tạm giữ, và không trường hợp nào ước tính được ngày từ tháng nộp. Tình trạng trực tiếp ở trên mới là thông tin chính xác.`,
    unmeasuredStage:
      "Tình trạng này chưa được đo theo tháng nộp, nên ước tính lấy mức giữa của tháng thay vì điều chỉnh theo giai đoạn.",
    stage: {
      "ANALYST REVIEW": "Con đường thông thường. Mức giữa của tháng nộp là cách đọc đúng.",
      "IN PROCESS": "Con đường thông thường. Mức giữa của tháng nộp là cách đọc đúng.",
      "APPLICATION ON HOLD":
        "Hồ sơ đang tạm giữ đã chờ lâu hơn phần lớn hồ sơ cùng tháng, nên lấy mức giữa sẽ cho ra ngày quá sớm.",
      "RFI ISSUED":
        "Hồ sơ có yêu cầu bổ sung thông tin nằm ở phần chậm hơn của tháng nộp, và đã chờ lâu khoảng gấp đôi một hồ sơ còn đang ở chuyên viên xét duyệt.",
      "NORD ISSUED": "Hồ sơ ở NORD ISSUED nằm gần cuối chậm nhất của tháng nộp. DOL không nói NORD là viết tắt của gì.",
      "RECONSIDERATION APPEALS":
        "Xem xét lại là một thủ tục riêng với thời hạn riêng. Không bách phân vị nào của tháng nộp ban đầu mô tả được nó.",
      "BALCA APPEALS":
        "Kháng cáo lên BALCA là một cơ quan hoàn toàn khác, không phải một quyết định PERM chậm. Dữ liệu tháng nộp không thể ước tính ngày cho nó.",
    },
  },
} satisfies Translated<EstimateLibText>;
