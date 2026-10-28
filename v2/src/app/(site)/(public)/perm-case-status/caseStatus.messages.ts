import type { FlagProgram } from "@/lib/flagCaseNumber";
import type { Messages } from "@/lib/i18n/lang";

/**
 * The case status page's own words, in English and the five translations (plan: .planning/i18n-data-pages.md).
 *
 * What stays as printed in every language: DOL's status words, form names (ETA-9089), program names (PERM,
 * H-1B, LCA), case numbers and agency abbreviations (DOL, USCIS), each glossed where it first appears. The
 * terms follow each language's guide (src/lib/i18n/guide/*.tsx).
 */
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
      perm: "Check your PERM case status",
      pwd: "Check a prevailing wage request",
      lca: "Check an LCA",
      seasonal: "Check an H-2A, H-2B or CW-1 filing",
    },
    intro:
      "Its status in plain English, where it sits in DOL's queue, an estimated decision date, and an email when it changes. Wage request, LCA, H-2A, H-2B and CW-1 numbers work too. Free, and no account needed.",
    checkAnother: "Check another case",
    caseNumber: "Case number",
    faqTitle: "Questions about this page",
    faqs: [
      {
        q: "Where do I find my PERM case number?",
        a: "On the ETA-9089 filing receipt, and on any status notice DOL sent the employer. Current ones look like G-100-26125-868956; cases filed in 2022 and 2023 use a shorter form like A-23043-00641, and both work here. The employer's attorney has it if you don't.",
      },
      {
        q: "Is this DOL's official status?",
        a: "Close to it, and the chain is worth stating. These statuses come from DOL's own case-status search, which we sweep against every pending case twice a day and against the full corpus daily, and every 5 minutes on weekdays (every half hour otherwise) for a case someone has an alert on. DOL publishes no documented API for it, so this is the same endpoint their search page uses rather than a supported one. It is a sweep, not a live reading: a case decided since the last sweep will show at DOL first, and DOL is the authority for any single case.",
      },
      {
        q: "Is the decision date on this page a prediction for my case?",
        a: "It's an estimate, labeled as one, and the label is doing real work. The window comes from a named model over this case's own filing month, read at the percentile its current stage implies: a case at RFI reads its month's p90, not the median, because the audited tail is measured. It is checkable arithmetic over DOL's decided cases, and it is not a promise about any single case.",
      },
      {
        q: "Why won't you tell me my odds of being certified?",
        a: "A single odds figure would read as precision the data cannot support. The measured denial factors are not independent, so blending them into one score hides which one is doing the work. The denial-rate pages publish the measured rates separately and refuse the blend on purpose. What is real, and shown, is the employer's published record across its own decided cases.",
      },
      {
        q: "My case isn't here. Is something wrong?",
        a: "Almost certainly not. If we don't already hold your number, we ask DOL's case-status search for it and record what comes back, so a recent filing usually turns up. Decided cases are also in DOL's published files back to October 2015. A wrong digit is worth ruling out first, because it still makes a well-formed number.",
      },
      {
        q: "What does my case number actually mean?",
        a: "The current format encodes its own filing date. In G-100-26125-868956, the 26 is the year and the 125 is the day of that year, so it decodes to May 5, 2026. Measured against 20,000 cases in DOL's records, that decoded date matches exactly 89% of the time and is a day or two off otherwise. The older three-part format, like A-23043-00641, does not: the same reading lands 13% of the time, so this page refuses to decode one rather than guess a filing month.",
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
    readingWait: { label: "How long the wait runs", note: "This page counts what is in front of a case. That one gives the envelope, from cases DOL has actually decided." },
    readingQueue: { label: "The whole queue", note: "Every filing month DOL still has undecided cases in, and where the work front sits." },
    readingTitle: "The rules behind these numbers",
    machine: "",
    readInEnglish: "",
  },
  es: {
    metaTitle: "Estado de un caso PERM: consulte y siga su caso",
    metaDescription:
      "Consulte un número de caso PERM: su estado explicado, cuántos casos sin decidir se presentaron antes y el historial del empleador con el DOL.",
    heading: {
      perm: "Consulte el estado de su caso PERM",
      pwd: "Consulte una solicitud de salario prevaleciente",
      lca: "Consulte una LCA",
      seasonal: "Consulte una solicitud H-2A, H-2B o CW-1",
    },
    intro:
      "Su estado explicado, su lugar en la fila del Departamento de Trabajo (DOL), una fecha estimada de decisión y un correo cuando cambie. También sirven los números de salario prevaleciente, LCA, H-2A, H-2B y CW-1. Es gratis y no necesita cuenta.",
    checkAnother: "Consultar otro caso",
    caseNumber: "Número de caso",
    faqTitle: "Preguntas sobre esta página",
    faqs: [
      {
        q: "¿Dónde encuentro mi número de caso PERM?",
        a: "En el recibo de presentación del ETA-9089 y en cualquier aviso de estado que el DOL haya enviado al empleador. Los actuales se ven así: G-100-26125-868956. Los casos presentados en 2022 y 2023 usan una forma más corta, como A-23043-00641, y ambas funcionan aquí. Si usted no lo tiene, el abogado del empleador sí.",
      },
      {
        q: "¿Es el estado oficial del DOL?",
        a: "Casi, y vale la pena explicar de dónde viene. Estos estados vienen de la búsqueda de estado de casos del propio DOL, que revisamos para cada caso pendiente dos veces al día y para todos los casos a diario, y cada 5 minutos en días hábiles (cada media hora el resto del tiempo) si alguien pidió una alerta. El DOL no publica una API documentada para esto, así que usamos la misma dirección que usa su página de búsqueda. Es una revisión periódica, no una lectura en vivo: un caso decidido desde la última revisión aparecerá primero en el DOL, y el DOL es la autoridad sobre cada caso.",
      },
      {
        q: "¿La fecha de decisión de esta página es una predicción para mi caso?",
        a: "Es una estimación, marcada como tal, y esa etiqueta importa. El intervalo sale de un modelo con nombre aplicado al mes de presentación de este caso, leído en el percentil que corresponde a su etapa actual: un caso con RFI se lee en el percentil 90 de su mes, no en la mediana, porque la cola de los casos auditados está medida. Es aritmética que se puede verificar sobre los casos ya decididos por el DOL, y no es una promesa sobre ningún caso en particular.",
      },
      {
        q: "¿Por qué no me dicen qué probabilidad tengo de que me certifiquen?",
        a: "Una sola cifra de probabilidad daría una precisión que los datos no tienen. Los factores de negación medidos no son independientes entre sí, así que combinarlos en un solo puntaje esconde cuál de ellos pesa. Las páginas de tasas de negación publican cada tasa por separado y evitan la mezcla a propósito. Lo que sí es real, y se muestra, es el historial publicado del empleador en sus propios casos decididos.",
      },
      {
        q: "Mi caso no aparece. ¿Hay algún problema?",
        a: "Casi seguro que no. Si todavía no tenemos su número, se lo preguntamos a la búsqueda de estado de casos del DOL y guardamos la respuesta, así que un caso reciente suele aparecer. Los casos ya decididos también están en los archivos publicados del DOL desde octubre de 2015. Primero conviene descartar un dígito equivocado, porque igual forma un número válido.",
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
    readingWait: { label: "Cuánto dura la espera (en inglés)", note: "Esta página cuenta lo que hay delante de un caso. Aquella da el rango, a partir de casos que el DOL ya decidió." },
    readingQueue: { label: "Toda la fila (en inglés)", note: "Cada mes de presentación en el que el DOL aún tiene casos sin decidir, y dónde va el trabajo." },
    readingTitle: "Las reglas detrás de estas cifras",
    machine:
      "Esta página fue traducida por una máquina y ningún hablante nativo la ha revisado. Los términos del DOL quedan en inglés, como los publica el DOL. La versión en inglés es la que vale.",
    readInEnglish: "Ver en inglés",
  },
  zh: {
    metaTitle: "PERM 案件状态查询：查询并追踪案件",
    metaDescription: "输入 PERM 案件编号，查看状态说明、在它之前递交且尚未判定的案件数量，以及雇主在劳工部的记录。",
    heading: {
      perm: "查询您的 PERM 案件状态",
      pwd: "查询现行工资认定申请",
      lca: "查询劳工情况申请（LCA）",
      seasonal: "查询 H-2A、H-2B 或 CW-1 申请",
    },
    intro:
      "用通俗的话说明案件状态、它在劳工部（DOL）队列中的位置、预计的判定日期，并可在状态变化时收到邮件。现行工资认定、LCA、H-2A、H-2B 和 CW-1 编号同样适用。免费，无需注册。",
    checkAnother: "查询其他案件",
    caseNumber: "案件编号",
    faqTitle: "关于本页的常见问题",
    faqs: [
      {
        q: "在哪里找到我的 PERM 案件编号？",
        a: "编号印在 ETA-9089 递交回执上，劳工部寄给雇主的任何状态通知上也有。现行编号的样子是 G-100-26125-868956；2022 年和 2023 年递交的案件使用较短的格式，例如 A-23043-00641，两种格式在这里都能查询。如果您手上没有编号，雇主的律师会有。",
      },
      {
        q: "这是劳工部的官方状态吗？",
        a: "非常接近，但值得说明来源。这些状态来自劳工部自己的案件状态查询系统：所有待审案件每天查询两次，全部案件每天查询一次；有人订阅提醒的案件，工作日每 5 分钟查询一次（其他时间每半小时一次）。劳工部没有公开的文档化接口，因此我们使用的是其查询页面本身所用的地址。这是定期查询，而不是实时读取：上次查询之后才判定的案件会先在劳工部显示，任何单个案件都以劳工部为准。",
      },
      {
        q: "本页的判定日期是对我案件的预测吗？",
        a: "这是估计，并明确标注为估计，这个标注很重要。日期区间来自一个有名称的模型，用的是该案件所在递交月份的数据，并按照当前阶段对应的百分位来读取：处于补件要求（RFI）阶段的案件读取该月的第 90 百分位，而不是中位数，因为被审计案件的长尾是实际测量出来的。这是基于劳工部已判定案件的可核查计算，并不是对任何单个案件的承诺。",
      },
      {
        q: "为什么不告诉我获批的概率？",
        a: "单一的概率数字会显得比数据实际支持的更精确。已测得的拒批因素彼此并不独立，把它们合成一个分数会掩盖真正起作用的是哪一个。拒批率页面会分别公布每一项测得的比率，并刻意不做合成。真实且可以展示的，是雇主在自己已判定案件中的公开记录。",
      },
      {
        q: "查不到我的案件，是出问题了吗？",
        a: "几乎可以肯定没有。如果我们还没有您的编号，会向劳工部的案件状态查询系统询问并记录结果，所以最近递交的案件通常都能查到。已判定的案件还可以在劳工部自 2015 年 10 月起公布的文件中找到。请先排除输错数字的可能，因为输错一位仍然会构成格式正确的编号。",
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
    readingWait: { label: "等待需要多久（英文页面）", note: "本页统计排在案件前面的情况，那一页根据劳工部已判定的案件给出时间范围。" },
    readingQueue: { label: "整个队列（英文页面）", note: "劳工部仍有未判定案件的每个递交月份，以及审理进度所在的位置。" },
    readingTitle: "这些数字背后的规则",
    machine: "本页由机器翻译，尚未经过母语人士审阅。劳工部的用语保留英文原文。以英文版本为准。",
    readInEnglish: "查看英文版",
  },
  "pt-br": {
    metaTitle: "Status de caso PERM: consulte e acompanhe",
    metaDescription:
      "Consulte um número de caso PERM: o status explicado, quantos casos sem decisão foram protocolados antes dele e o histórico do empregador no DOL.",
    heading: {
      perm: "Consulte o status do seu caso PERM",
      pwd: "Consulte um pedido de salário prevalecente",
      lca: "Consulte uma LCA",
      seasonal: "Consulte um pedido H-2A, H-2B ou CW-1",
    },
    intro:
      "O status explicado, a posição na fila do Departamento do Trabalho (DOL), uma data estimada de decisão e um e-mail quando mudar. Números de salário prevalecente, LCA, H-2A, H-2B e CW-1 também funcionam. É grátis e não precisa de conta.",
    checkAnother: "Consultar outro caso",
    caseNumber: "Número do caso",
    faqTitle: "Perguntas sobre esta página",
    faqs: [
      {
        q: "Onde encontro meu número de caso PERM?",
        a: "No recibo de protocolo do ETA-9089 e em qualquer aviso de status que o DOL tenha enviado ao empregador. Os atuais são assim: G-100-26125-868956. Casos protocolados em 2022 e 2023 usam um formato mais curto, como A-23043-00641, e os dois funcionam aqui. Se você não tiver, o advogado do empregador tem.",
      },
      {
        q: "Este é o status oficial do DOL?",
        a: "Quase, e vale explicar de onde ele vem. Estes status vêm da busca de status de casos do próprio DOL, que consultamos para cada caso pendente duas vezes por dia e para todos os casos diariamente, e a cada 5 minutos em dias úteis (a cada meia hora no resto do tempo) quando alguém pediu um alerta. O DOL não publica uma API documentada para isso, então usamos o mesmo endereço que a página de busca dele usa. É uma consulta periódica, não uma leitura ao vivo: um caso decidido desde a última consulta aparece primeiro no DOL, e o DOL é a autoridade sobre cada caso.",
      },
      {
        q: "A data de decisão desta página é uma previsão para o meu caso?",
        a: "É uma estimativa, marcada como tal, e essa marcação importa. O intervalo vem de um modelo identificado aplicado ao mês de protocolo deste caso, lido no percentil que corresponde à etapa atual: um caso com RFI é lido no percentil 90 do seu mês, não na mediana, porque a cauda dos casos auditados é medida. É uma conta que pode ser conferida sobre os casos já decididos pelo DOL, e não é uma promessa sobre nenhum caso específico.",
      },
      {
        q: "Por que vocês não dizem minhas chances de certificação?",
        a: "Um único número de chance passaria uma precisão que os dados não têm. Os fatores de negação medidos não são independentes entre si, então juntá-los em uma nota esconde qual deles pesa de verdade. As páginas de taxas de negação publicam cada taxa separadamente e evitam essa mistura de propósito. O que é real, e aparece aqui, é o histórico publicado do empregador nos próprios casos decididos.",
      },
      {
        q: "Meu caso não aparece. Há algo errado?",
        a: "Quase certamente não. Se ainda não temos o seu número, perguntamos à busca de status de casos do DOL e guardamos a resposta, então um caso recente costuma aparecer. Casos já decididos também estão nos arquivos publicados do DOL desde outubro de 2015. Vale descartar primeiro um dígito errado, porque ele ainda forma um número válido.",
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
    readingWait: { label: "Quanto tempo dura a espera (em inglês)", note: "Esta página conta o que está à frente de um caso. Aquela dá a faixa, a partir de casos que o DOL já decidiu." },
    readingQueue: { label: "A fila inteira (em inglês)", note: "Cada mês de protocolo em que o DOL ainda tem casos sem decisão, e onde está o trabalho." },
    readingTitle: "As regras por trás destes números",
    machine:
      "Esta página foi traduzida por máquina e não foi revisada por um falante nativo. Os termos do DOL ficam em inglês, como o DOL os publica. A versão em inglês é a que vale.",
    readInEnglish: "Ver em inglês",
  },
  ko: {
    metaTitle: "PERM 케이스 상태: 케이스 조회와 추적",
    metaDescription:
      "PERM 케이스 번호를 입력하면 상태 설명, 그보다 먼저 접수되어 아직 결정되지 않은 케이스 수, 노동부에서의 고용주 기록을 보여 줍니다.",
    heading: {
      perm: "PERM 케이스 상태 조회",
      pwd: "적정임금(PWD) 신청 조회",
      lca: "노동조건신청(LCA) 조회",
      seasonal: "H-2A, H-2B 또는 CW-1 신청 조회",
    },
    intro:
      "상태를 쉬운 말로 설명하고, 노동부(DOL) 대기열에서의 위치, 예상 결정일을 보여 주며, 상태가 바뀌면 이메일로 알려 줍니다. 적정임금, LCA, H-2A, H-2B, CW-1 번호도 조회됩니다. 무료이며 계정이 필요 없습니다.",
    checkAnother: "다른 케이스 조회",
    caseNumber: "케이스 번호",
    faqTitle: "이 페이지에 대한 질문",
    faqs: [
      {
        q: "PERM 케이스 번호는 어디에서 찾나요?",
        a: "ETA-9089 접수증과 노동부가 고용주에게 보낸 상태 통지서에 있습니다. 현재 번호는 G-100-26125-868956과 같은 모양이고, 2022년과 2023년에 접수된 케이스는 A-23043-00641처럼 더 짧은 형식을 씁니다. 두 형식 모두 여기에서 조회됩니다. 번호가 없다면 고용주의 변호사가 갖고 있습니다.",
      },
      {
        q: "이것이 노동부의 공식 상태인가요?",
        a: "거의 그렇습니다. 출처를 정확히 말씀드리면, 이 상태는 노동부 자체의 케이스 상태 조회에서 가져옵니다. 심사 중인 모든 케이스는 하루 두 번, 전체 케이스는 매일 확인하며, 누군가 알림을 신청한 케이스는 평일에 5분마다(그 외에는 30분마다) 확인합니다. 노동부는 이에 대한 공식 API 문서를 공개하지 않으므로, 노동부 조회 페이지가 쓰는 것과 같은 주소를 사용합니다. 실시간 조회가 아니라 주기적 확인이므로, 마지막 확인 이후 결정된 케이스는 노동부에 먼저 나타납니다. 개별 케이스에 대해서는 노동부가 기준입니다.",
      },
      {
        q: "이 페이지의 결정일은 제 케이스에 대한 예측인가요?",
        a: "추정치이며, 추정치라고 분명히 표시합니다. 그 표시가 중요합니다. 기간은 이 케이스의 접수 월에 적용한 이름 있는 모델에서 나오며, 현재 단계에 해당하는 백분위로 읽습니다. 예를 들어 RFI 단계의 케이스는 중앙값이 아니라 해당 월의 90번째 백분위로 읽는데, 감사(audit)를 받은 케이스들의 긴 꼬리가 실제로 측정되었기 때문입니다. 노동부가 결정한 케이스로 검증할 수 있는 계산이며, 어떤 개별 케이스에 대한 약속도 아닙니다.",
      },
      {
        q: "승인 확률은 왜 알려 주지 않나요?",
        a: "확률 숫자 하나는 데이터가 뒷받침하지 못하는 정밀함처럼 보입니다. 측정된 거절 요인들은 서로 독립적이지 않아서, 하나의 점수로 합치면 어떤 요인이 실제로 작용하는지 가려집니다. 거절률 페이지는 측정된 비율을 각각 따로 공개하고 일부러 합치지 않습니다. 실제로 보여 드릴 수 있는 것은 고용주가 결정받은 자기 케이스들의 공개 기록입니다.",
      },
      {
        q: "제 케이스가 나오지 않습니다. 문제가 있나요?",
        a: "거의 확실히 문제없습니다. 저희가 아직 갖고 있지 않은 번호라면 노동부의 케이스 상태 조회에 물어보고 답을 기록하므로, 최근에 접수된 케이스도 대개 조회됩니다. 결정된 케이스는 2015년 10월부터 노동부가 공개한 파일에도 있습니다. 먼저 숫자를 잘못 입력하지 않았는지 확인해 보세요. 한 자리가 틀려도 형식상으로는 올바른 번호가 되기 때문입니다.",
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
    readingWait: { label: "대기 기간(영어 페이지)", note: "이 페이지는 케이스 앞에 있는 건수를 셉니다. 그 페이지는 노동부가 실제로 결정한 케이스로 기간의 범위를 보여 줍니다." },
    readingQueue: { label: "전체 대기열(영어 페이지)", note: "노동부에 아직 결정되지 않은 케이스가 남아 있는 접수 월과 심사가 진행 중인 위치." },
    readingTitle: "이 숫자들의 기준",
    machine:
      "이 페이지는 기계 번역되었으며 원어민의 검토를 거치지 않았습니다. 노동부의 용어는 노동부가 쓰는 대로 영어로 둡니다. 영어 페이지가 기준입니다.",
    readInEnglish: "영어로 보기",
  },
  vi: {
    metaTitle: "Tình trạng hồ sơ PERM: tra cứu và theo dõi",
    metaDescription:
      "Tra cứu số hồ sơ PERM: tình trạng được giải thích, số hồ sơ chưa có quyết định nộp trước nó và hồ sơ của chủ lao động tại Bộ Lao động.",
    heading: {
      perm: "Tra cứu tình trạng hồ sơ PERM",
      pwd: "Tra cứu đơn xác định mức lương hiện hành",
      lca: "Tra cứu LCA",
      seasonal: "Tra cứu hồ sơ H-2A, H-2B hoặc CW-1",
    },
    intro:
      "Tình trạng được giải thích dễ hiểu, vị trí trong hàng chờ của Bộ Lao động (DOL), ngày quyết định ước tính, và một email khi tình trạng thay đổi. Số hồ sơ lương hiện hành, LCA, H-2A, H-2B và CW-1 cũng tra được. Miễn phí, không cần tài khoản.",
    checkAnother: "Tra cứu hồ sơ khác",
    caseNumber: "Số hồ sơ",
    faqTitle: "Câu hỏi về trang này",
    faqs: [
      {
        q: "Tôi tìm số hồ sơ PERM ở đâu?",
        a: "Trên biên nhận nộp ETA-9089 và trên bất kỳ thông báo tình trạng nào DOL gửi cho chủ lao động. Số hiện nay có dạng G-100-26125-868956; hồ sơ nộp năm 2022 và 2023 dùng dạng ngắn hơn như A-23043-00641, và cả hai đều tra được ở đây. Nếu bạn không có, luật sư của chủ lao động sẽ có.",
      },
      {
        q: "Đây có phải là tình trạng chính thức của DOL không?",
        a: "Gần như vậy, và nên nói rõ nguồn. Các tình trạng này lấy từ trang tra cứu tình trạng hồ sơ của chính DOL: chúng tôi kiểm tra mọi hồ sơ đang chờ hai lần mỗi ngày và toàn bộ hồ sơ mỗi ngày, và với hồ sơ có người đăng ký nhận thông báo thì cứ 5 phút một lần vào ngày làm việc (nửa giờ một lần vào thời gian khác). DOL không công bố API có tài liệu cho việc này, nên chúng tôi dùng đúng địa chỉ mà trang tra cứu của họ dùng. Đây là kiểm tra định kỳ, không phải đọc trực tiếp: hồ sơ được quyết định sau lần kiểm tra gần nhất sẽ hiện ở DOL trước, và DOL là nơi có thẩm quyền với từng hồ sơ.",
      },
      {
        q: "Ngày quyết định trên trang này có phải là dự đoán cho hồ sơ của tôi không?",
        a: "Đó là ước tính, được ghi rõ là ước tính, và nhãn đó có ý nghĩa thật. Khoảng thời gian đến từ một mô hình có tên áp dụng cho tháng nộp của hồ sơ này, đọc ở bách phân vị tương ứng với giai đoạn hiện tại: hồ sơ đang ở bước RFI được đọc ở bách phân vị thứ 90 của tháng đó, không phải trung vị, vì phần đuôi của các hồ sơ bị kiểm tra (audit) đã được đo. Đây là phép tính có thể kiểm chứng trên các hồ sơ DOL đã quyết định, không phải lời hứa về bất kỳ hồ sơ nào.",
      },
      {
        q: "Tại sao trang không cho tôi biết khả năng được chấp thuận?",
        a: "Một con số khả năng duy nhất sẽ trông chính xác hơn mức dữ liệu cho phép. Các yếu tố từ chối đã đo không độc lập với nhau, nên gộp chúng thành một điểm sẽ che đi yếu tố nào thật sự có tác động. Các trang tỷ lệ từ chối công bố riêng từng tỷ lệ đã đo và cố ý không gộp lại. Điều có thật, và được hiển thị, là hồ sơ công bố của chủ lao động trên các hồ sơ đã được quyết định của chính họ.",
      },
      {
        q: "Không thấy hồ sơ của tôi. Có gì sai không?",
        a: "Gần như chắc chắn là không. Nếu chúng tôi chưa có số của bạn, chúng tôi sẽ hỏi trang tra cứu tình trạng hồ sơ của DOL và ghi lại câu trả lời, nên hồ sơ mới nộp thường vẫn hiện ra. Hồ sơ đã có quyết định cũng nằm trong các tệp DOL công bố từ tháng 10 năm 2015. Trước hết nên loại trừ khả năng gõ sai một chữ số, vì gõ sai vẫn tạo ra một số đúng dạng.",
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
    readingWait: { label: "Thời gian chờ bao lâu (trang tiếng Anh)", note: "Trang này đếm những gì đứng trước một hồ sơ. Trang kia cho khoảng thời gian, dựa trên các hồ sơ DOL đã thật sự quyết định." },
    readingQueue: { label: "Toàn bộ hàng chờ (trang tiếng Anh)", note: "Mọi tháng nộp mà DOL vẫn còn hồ sơ chưa quyết định, và nơi công việc đang đến." },
    readingTitle: "Quy tắc đằng sau các con số này",
    machine:
      "Trang này được dịch bằng máy và chưa được người bản ngữ xem lại. Các thuật ngữ của DOL được giữ bằng tiếng Anh như DOL công bố. Bản tiếng Anh là bản có giá trị.",
    readInEnglish: "Xem bằng tiếng Anh",
  },
} satisfies Messages<CaseStatusText>;
