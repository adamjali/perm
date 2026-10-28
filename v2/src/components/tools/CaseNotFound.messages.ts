import type { Messages } from "@/lib/i18n/lang";

/** A PERM number we hold no record for: the answer, why that happens, and its filing month. */
export interface CaseNotFoundText {
  /** The answer panel's source line. */
  checked: (count: string) => string;
  afterDolUnavailable: string;
  afterNotAsked: string;
  thenAskedDol: string;
  /** "We couldn't check <N> just now: " / "We hold no record for <N> yet, ", split around the number. */
  gapLead: { records: string; other: string };
  gapAfter: { records: string; other: string };
  tryAgain: string;
  /** Between the two links, spaces included: " or use ", "，或使用", "하거나 ". */
  orUse: string;
  dolSearch: string;
  /** The end of that sentence, after the second link. */
  gapEnd: string;
  /** A sentence's last mark: ".", or "。" in Chinese. */
  end: string;
  /** Between a bold lead and the rest: " ", or nothing in Chinese. */
  sep: string;
  notInRecords: string;
  /** "We hold no record for this number. ... and <DOL's search> is the authority either way." Spaces included. */
  noRecordLead: string;
  noRecordEnd: string;
  whyTitle: string;
  whyDol: { lead: string; rest: string };
  whyOld: { lead: string; rest: string };
  whyDigitLead: string;
  /** Ends with the space before the link, where the language has one. */
  whyDigitRest: string;
  findByEmployer: string;
  numberSays: string;
  legacyTitle: string;
  /** Around the number and the bold "13% of the time", spaces included. */
  legacyBefore: string;
  legacyMiddle: string;
  legacyBold: string;
  legacyAfter: string;
  monthTitle: (month: string) => string;
  monthHint: string;
  notMeasuredBold: (caseNumber: string) => string;
  notMeasuredRest: (total: string) => string;
  filedThatMonth: string;
  checkedAgainstDol: string;
  stillUndecided: string;
  pctDecided: (pct: string) => string;
  ofThatMonth: string;
  filedBefore: string;
  filedBeforeNote: string;
  wallTitle: string;
  wallSubject: string;
  wallCaption: (month: string) => string;
  wallSource: string;
  wallSourceAsOf: (date: string) => string;
  fullSplit: (month: string) => string;
  getTold: string;
  wontSayTitle: string;
}

export const CASE_NOT_FOUND = {
  en: {
    checked: (n) => `Checked ${n} per-case statuses and DOL's decided files since October 2015`,
    afterDolUnavailable: "; DOL's live check didn't answer within 8 seconds",
    afterNotAsked: "; the live check with DOL wasn't made",
    thenAskedDol: ", then asked DOL directly",
    gapLead: { records: "We couldn't check", other: "We hold no record for" },
    gapAfter: { records: " just now: ", other: " yet, " },
    tryAgain: "Try again",
    orUse: " or use ",
    dolSearch: "DOL's own case-status search",
    gapEnd: ".",
    end: ".",
    sep: " ",
    notInRecords: "Not in our records",
    noRecordLead:
      "We hold no record for this number. That isn't a statement about the case, only that this project hasn't got it, and ",
    noRecordEnd: " is the authority either way.",
    whyTitle: "Why a real case can be missing here",
    whyDol: {
      lead: "DOL doesn't return it.",
      rest: "A number we don't already hold is asked of DOL at the moment you search, so a filing from this week resolves. If DOL's own system has no exact match, neither do we.",
    },
    whyOld: {
      lead: "It was decided before October 2015.",
      rest: "DOL's published decision files we hold start then.",
    },
    whyDigitLead: "A digit is off.",
    whyDigitRest: "One wrong digit in the serial is still a well-formed number that belongs to nobody. Check it against the receipt, or ",
    findByEmployer: "find the case by employer name",
    numberSays: "What the case number says",
    legacyTitle: "This is the older case-number format",
    legacyBefore: "Numbers like ",
    legacyMiddle:
      " are the older three-part format, used mostly in 2022 and 2023. Its middle digits aren't a filing date: read as one, they match DOL's receipt date only ",
    legacyBold: "13% of the time",
    legacyAfter:
      ", against 90% for the current format. Every case in this format is already decided and published, so a real one would be found here. Check the digits against the receipt.",
    monthTitle: (m) => `Cases filed in ${m}`,
    monthHint: "The month this number decodes to",
    notMeasuredBold: (n) => `None of this was measured on ${n}`,
    notMeasuredRest: (total) => `, which we couldn't find. It describes the ${total} cases we hold that were filed alongside it.`,
    filedThatMonth: "Filed that month",
    checkedAgainstDol: "cases checked against DOL",
    stillUndecided: "Still undecided",
    pctDecided: (p) => `${p}% of the month is decided`,
    ofThatMonth: "of that month",
    filedBefore: "Filed before that month",
    filedBeforeNote: "undecided, across every earlier month",
    wallTitle: "The wall in front of that filing month",
    wallSubject: "Undecided cases by filing month",
    wallCaption: (m) =>
      `Drawn for ${m}, the month this number decodes to: the queue in front of that month rather than in front of any one case.`,
    wallSource: "Per-case statuses from DOL's own case status system, checked daily",
    wallSourceAsOf: (d) => `Per-case statuses from DOL's own case status system, checked daily · DOL queue position as of ${d}`,
    fullSplit: (m) => `The full split for ${m}`,
    getTold: "Get told when DOL reaches that month",
    wontSayTitle: "What this page won't tell you",
  },
  es: {
    checked: (n) => `Se revisaron ${n} estados de casos y los archivos de casos decididos que el DOL publica desde octubre de 2015`,
    afterDolUnavailable: "; la consulta en vivo al DOL no respondió en 8 segundos",
    afterNotAsked: "; no se hizo la consulta en vivo al DOL",
    thenAskedDol: ", y luego se le preguntó directamente al DOL",
    gapLead: { records: "No pudimos consultar", other: "Todavía no tenemos registro de" },
    gapAfter: { records: " en este momento: ", other: ", " },
    tryAgain: "Inténtelo de nuevo",
    orUse: " o use la ",
    dolSearch: "búsqueda de estado de casos del propio DOL",
    gapEnd: ".",
    end: ".",
    sep: " ",
    notInRecords: "No está en nuestros registros",
    noRecordLead:
      "No tenemos registro de este número. Eso no dice nada sobre el caso, solo que este sitio no lo tiene, y la ",
    noRecordEnd: " es la autoridad en cualquier caso.",
    whyTitle: "Por qué puede faltar aquí un caso real",
    whyDol: {
      lead: "El DOL no lo devuelve.",
      rest: "Si no tenemos un número, se lo preguntamos al DOL en el momento de su búsqueda, así que un caso presentado esta semana aparece. Si el propio sistema del DOL no encuentra una coincidencia exacta, nosotros tampoco.",
    },
    whyOld: {
      lead: "Se decidió antes de octubre de 2015.",
      rest: "Los archivos de decisiones del DOL que tenemos empiezan en esa fecha.",
    },
    whyDigitLead: "Un dígito está mal.",
    whyDigitRest:
      "Un solo dígito equivocado en la serie igual forma un número válido que no es de nadie. Compárelo con el recibo, o ",
    findByEmployer: "busque el caso por el nombre del empleador (en inglés)",
    numberSays: "Qué dice el número de caso",
    legacyTitle: "Este es el formato antiguo de número de caso",
    legacyBefore: "Los números como ",
    legacyMiddle:
      " tienen el formato antiguo de tres partes, usado sobre todo en 2022 y 2023. Sus dígitos del medio no son una fecha de presentación: leídos como fecha, coinciden con la fecha de recepción del DOL solo ",
    legacyBold: "el 13 % de las veces",
    legacyAfter:
      ", frente al 90 % del formato actual. Todos los casos con este formato ya están decididos y publicados, así que uno real aparecería aquí. Compare los dígitos con el recibo.",
    monthTitle: (m) => `Casos presentados en ${m}`,
    monthHint: "El mes que indica este número",
    notMeasuredBold: (n) => `Nada de esto se midió sobre ${n}`,
    notMeasuredRest: (total) =>
      `, que no encontramos. Describe los ${total} casos que tenemos presentados en el mismo mes.`,
    filedThatMonth: "Presentados ese mes",
    checkedAgainstDol: "casos revisados con el DOL",
    stillUndecided: "Aún sin decidir",
    pctDecided: (p) => `${p} % del mes ya está decidido`,
    ofThatMonth: "de ese mes",
    filedBefore: "Presentados antes de ese mes",
    filedBeforeNote: "sin decidir, en todos los meses anteriores",
    wallTitle: "La fila delante de ese mes de presentación",
    wallSubject: "Casos sin decidir por mes de presentación",
    wallCaption: (m) =>
      `Dibujado para ${m}, el mes que indica este número: la fila delante de ese mes, no delante de un caso en particular.`,
    wallSource: "Estados de cada caso del sistema de estado de casos del propio DOL, revisados a diario",
    wallSourceAsOf: (d) =>
      `Estados de cada caso del sistema de estado de casos del propio DOL, revisados a diario · posición de la fila del DOL al ${d}`,
    fullSplit: (m) => `El desglose completo de ${m} (en inglés)`,
    getTold: "Reciba un aviso cuando el DOL llegue a ese mes (en inglés)",
    wontSayTitle: "Lo que esta página no le dirá",
  },
  zh: {
    checked: (n) => `已查询 ${n} 个案件状态，以及劳工部自 2015 年 10 月起公布的已判定案件文件`,
    afterDolUnavailable: "；劳工部的实时查询在 8 秒内没有回应",
    afterNotAsked: "；未能向劳工部实时查询",
    thenAskedDol: "，然后直接询问了劳工部",
    gapLead: { records: "目前无法查询", other: "我们还没有" },
    gapAfter: { records: "：", other: " 的记录，" },
    tryAgain: "重试",
    orUse: "，或使用",
    dolSearch: "劳工部自己的案件状态查询",
    gapEnd: "。",
    end: "。",
    sep: "",
    notInRecords: "不在我们的记录中",
    noRecordLead: "我们没有这个编号的记录。这并不说明案件本身有问题，只是本站没有收录。无论如何，",
    noRecordEnd: "才是权威来源。",
    whyTitle: "为什么真实的案件可能查不到",
    whyDol: {
      lead: "劳工部没有返回结果。",
      rest: "我们还没有收录的编号，会在您查询时直接询问劳工部，所以本周递交的案件也能查到。如果劳工部自己的系统没有完全匹配的结果，我们也不会有。",
    },
    whyOld: { lead: "案件在 2015 年 10 月之前就已判定。", rest: "我们收录的劳工部判定文件从那时开始。" },
    whyDigitLead: "有一位数字输错了。",
    whyDigitRest: "序号中输错一位，仍然是一个格式正确、但不属于任何人的编号。请对照回执检查，或",
    findByEmployer: "按雇主名称查找案件（英文页面）",
    numberSays: "案件编号包含的信息",
    legacyTitle: "这是较早的案件编号格式",
    legacyBefore: "像 ",
    legacyMiddle:
      " 这样的编号是较早的三段式格式，主要用于 2022 年和 2023 年。中间的数字不是递交日期：如果当作日期来读，与劳工部收件日期一致的比例只有 ",
    legacyBold: "13%",
    legacyAfter: "，而现行格式为 90%。这种格式的案件都已判定并公布，所以真实的案件在这里能查到。请对照回执检查数字。",
    monthTitle: (m) => `${m}递交的案件`,
    monthHint: "这个编号对应的月份",
    notMeasuredBold: (n) => `以下内容都不是针对 ${n} 测得的`,
    notMeasuredRest: (total) => `，因为我们没有查到它。这里描述的是我们收录的、与它同月递交的 ${total} 个案件。`,
    filedThatMonth: "当月递交",
    checkedAgainstDol: "个案件已与劳工部核对",
    stillUndecided: "仍未判定",
    pctDecided: (p) => `该月已判定 ${p}%`,
    ofThatMonth: "该月",
    filedBefore: "在该月之前递交",
    filedBeforeNote: "未判定，所有更早月份合计",
    wallTitle: "该递交月份前面的队列",
    wallSubject: "按递交月份统计的未判定案件",
    wallCaption: (m) => `按这个编号对应的月份 ${m} 绘制：这是排在该月份前面的队列，而不是排在某一个案件前面的队列。`,
    wallSource: "单个案件状态来自劳工部自己的案件状态系统，每天查询",
    wallSourceAsOf: (d) => `单个案件状态来自劳工部自己的案件状态系统，每天查询 · 劳工部队列位置截至 ${d}`,
    fullSplit: (m) => `${m}的完整分布（英文页面）`,
    getTold: "劳工部审到该月时通知我（英文页面）",
    wontSayTitle: "本页不会告诉您的内容",
  },
  "pt-br": {
    checked: (n) => `Foram verificados ${n} status de casos e os arquivos de casos decididos que o DOL publica desde outubro de 2015`,
    afterDolUnavailable: "; a consulta ao vivo ao DOL não respondeu em 8 segundos",
    afterNotAsked: "; a consulta ao vivo ao DOL não foi feita",
    thenAskedDol: ", e depois o DOL foi consultado diretamente",
    gapLead: { records: "Não conseguimos consultar", other: "Ainda não temos registro de" },
    gapAfter: { records: " agora: ", other: ", " },
    tryAgain: "Tente de novo",
    orUse: " ou use a ",
    dolSearch: "busca de status de casos do próprio DOL",
    gapEnd: ".",
    end: ".",
    sep: " ",
    notInRecords: "Não está em nossos registros",
    noRecordLead:
      "Não temos registro deste número. Isso não diz nada sobre o caso, só que este site não o tem, e a ",
    noRecordEnd: " é a autoridade de qualquer forma.",
    whyTitle: "Por que um caso real pode não aparecer aqui",
    whyDol: {
      lead: "O DOL não o retorna.",
      rest: "Um número que ainda não temos é perguntado ao DOL no momento da sua busca, então um caso protocolado nesta semana aparece. Se o próprio sistema do DOL não encontra uma correspondência exata, nós também não.",
    },
    whyOld: {
      lead: "Foi decidido antes de outubro de 2015.",
      rest: "Os arquivos de decisões do DOL que temos começam nessa data.",
    },
    whyDigitLead: "Um dígito está errado.",
    whyDigitRest:
      "Um único dígito errado na série ainda forma um número válido que não é de ninguém. Compare com o recibo, ou ",
    findByEmployer: "encontre o caso pelo nome do empregador (em inglês)",
    numberSays: "O que o número do caso diz",
    legacyTitle: "Este é o formato antigo de número de caso",
    legacyBefore: "Números como ",
    legacyMiddle:
      " têm o formato antigo de três partes, usado principalmente em 2022 e 2023. Os dígitos do meio não são uma data de protocolo: lidos como data, batem com a data de recebimento do DOL só ",
    legacyBold: "13% das vezes",
    legacyAfter:
      ", contra 90% no formato atual. Todos os casos nesse formato já foram decididos e publicados, então um caso real apareceria aqui. Compare os dígitos com o recibo.",
    monthTitle: (m) => `Casos protocolados em ${m}`,
    monthHint: "O mês que este número indica",
    notMeasuredBold: (n) => `Nada disto foi medido sobre ${n}`,
    notMeasuredRest: (total) => `, que não encontramos. Descreve os ${total} casos que temos protocolados no mesmo mês.`,
    filedThatMonth: "Protocolados naquele mês",
    checkedAgainstDol: "casos verificados com o DOL",
    stillUndecided: "Ainda sem decisão",
    pctDecided: (p) => `${p}% do mês já está decidido`,
    ofThatMonth: "daquele mês",
    filedBefore: "Protocolados antes daquele mês",
    filedBeforeNote: "sem decisão, em todos os meses anteriores",
    wallTitle: "A fila à frente daquele mês de protocolo",
    wallSubject: "Casos sem decisão por mês de protocolo",
    wallCaption: (m) =>
      `Desenhado para ${m}, o mês que este número indica: a fila à frente daquele mês, não à frente de um caso específico.`,
    wallSource: "Status de cada caso do sistema de status de casos do próprio DOL, verificados diariamente",
    wallSourceAsOf: (d) =>
      `Status de cada caso do sistema de status de casos do próprio DOL, verificados diariamente · posição da fila do DOL em ${d}`,
    fullSplit: (m) => `A divisão completa de ${m} (em inglês)`,
    getTold: "Receba um aviso quando o DOL chegar a esse mês (em inglês)",
    wontSayTitle: "O que esta página não vai dizer",
  },
  ko: {
    checked: (n) => `케이스 상태 ${n}건과 2015년 10월부터 노동부가 공개한 결정 케이스 파일을 확인했습니다`,
    afterDolUnavailable: ". 노동부 실시간 조회는 8초 안에 응답하지 않았습니다",
    afterNotAsked: ". 노동부 실시간 조회는 하지 못했습니다",
    thenAskedDol: ". 이어서 노동부에 직접 물었습니다",
    gapLead: { records: "지금은", other: "아직" },
    gapAfter: { records: "을(를) 조회하지 못했습니다. ", other: "에 대한 기록이 없습니다. " },
    tryAgain: "다시 시도",
    orUse: "하거나 ",
    dolSearch: "노동부 자체 케이스 상태 조회",
    gapEnd: "를 이용하세요.",
    end: ".",
    sep: " ",
    notInRecords: "저희 기록에 없습니다",
    noRecordLead:
      "이 번호에 대한 기록이 없습니다. 케이스에 대한 판단이 아니라 이 사이트가 갖고 있지 않다는 뜻일 뿐입니다. 어느 경우든 ",
    noRecordEnd: "가 기준입니다.",
    whyTitle: "실제 케이스가 여기 없을 수 있는 이유",
    whyDol: {
      lead: "노동부가 반환하지 않습니다.",
      rest: "저희에게 없는 번호는 검색하는 순간 노동부에 물어보므로, 이번 주에 접수된 케이스도 조회됩니다. 노동부 시스템에 정확히 일치하는 결과가 없으면 저희에게도 없습니다.",
    },
    whyOld: { lead: "2015년 10월 이전에 결정되었습니다.", rest: "저희가 가진 노동부 결정 파일은 그때부터 시작합니다." },
    whyDigitLead: "숫자 하나가 틀렸습니다.",
    whyDigitRest: "일련번호에서 한 자리만 틀려도 형식상 올바르지만 누구의 것도 아닌 번호가 됩니다. 접수증과 대조하거나 ",
    findByEmployer: "고용주 이름으로 케이스를 찾아 보세요(영어 페이지)",
    numberSays: "케이스 번호가 알려 주는 것",
    legacyTitle: "예전 형식의 케이스 번호입니다",
    legacyBefore: "",
    legacyMiddle:
      " 같은 번호는 주로 2022년과 2023년에 쓰인 예전의 세 부분 형식입니다. 가운데 숫자는 접수일이 아닙니다. 날짜로 읽으면 노동부 접수일과 일치하는 경우가 ",
    legacyBold: "13%에 불과하며",
    legacyAfter:
      ", 현재 형식은 90%입니다. 이 형식의 케이스는 모두 이미 결정되어 공개되었으므로, 실제 케이스라면 여기에서 조회됩니다. 접수증과 숫자를 대조해 보세요.",
    monthTitle: (m) => `${m} 접수 케이스`,
    monthHint: "이 번호가 가리키는 달",
    notMeasuredBold: (n) => `이 내용은 ${n}에 대해 측정한 것이 아닙니다`,
    notMeasuredRest: (total) => `. 해당 번호는 찾지 못했습니다. 같은 달에 접수되어 저희가 가진 케이스 ${total}건을 설명합니다.`,
    filedThatMonth: "그달 접수",
    checkedAgainstDol: "건, 노동부와 대조",
    stillUndecided: "아직 결정되지 않음",
    pctDecided: (p) => `그달의 ${p}%가 결정됨`,
    ofThatMonth: "그달 기준",
    filedBefore: "그달 이전 접수",
    filedBeforeNote: "결정되지 않은 케이스, 이전 모든 달 합계",
    wallTitle: "그 접수 월 앞의 대기열",
    wallSubject: "접수 월별 미결정 케이스",
    wallCaption: (m) => `이 번호가 가리키는 ${m} 기준으로 그렸습니다. 특정 케이스가 아니라 그달 앞에 있는 대기열입니다.`,
    wallSource: "케이스별 상태: 노동부 자체 케이스 상태 시스템, 매일 확인",
    wallSourceAsOf: (d) => `케이스별 상태: 노동부 자체 케이스 상태 시스템, 매일 확인 · 노동부 대기열 위치 ${d} 기준`,
    fullSplit: (m) => `${m} 전체 현황(영어 페이지)`,
    getTold: "노동부가 그달에 도달하면 알림 받기(영어 페이지)",
    wontSayTitle: "이 페이지가 알려 주지 않는 것",
  },
  vi: {
    checked: (n) => `Đã kiểm tra ${n} tình trạng hồ sơ và các tệp hồ sơ đã có quyết định do DOL công bố từ tháng 10 năm 2015`,
    afterDolUnavailable: "; tra cứu trực tiếp với DOL không trả lời trong 8 giây",
    afterNotAsked: "; chưa tra cứu trực tiếp với DOL",
    thenAskedDol: ", rồi hỏi trực tiếp DOL",
    gapLead: { records: "Lúc này chưa tra được", other: "Chúng tôi chưa có dữ liệu về" },
    gapAfter: { records: ": ", other: ", " },
    tryAgain: "Thử lại",
    orUse: " hoặc dùng ",
    dolSearch: "trang tra cứu tình trạng hồ sơ của chính DOL",
    gapEnd: ".",
    end: ".",
    sep: " ",
    notInRecords: "Không có trong dữ liệu của chúng tôi",
    noRecordLead:
      "Chúng tôi không có dữ liệu về số này. Điều đó không nói gì về hồ sơ, chỉ là trang này chưa có, và dù sao thì ",
    noRecordEnd: " vẫn là nơi có thẩm quyền.",
    whyTitle: "Vì sao một hồ sơ có thật có thể không hiện ở đây",
    whyDol: {
      lead: "DOL không trả về.",
      rest: "Số nào chúng tôi chưa có sẽ được hỏi DOL ngay lúc bạn tra cứu, nên hồ sơ nộp trong tuần này vẫn hiện ra. Nếu hệ thống của chính DOL không có kết quả khớp chính xác, chúng tôi cũng không có.",
    },
    whyOld: {
      lead: "Hồ sơ đã có quyết định trước tháng 10 năm 2015.",
      rest: "Các tệp quyết định của DOL mà chúng tôi có bắt đầu từ thời điểm đó.",
    },
    whyDigitLead: "Sai một chữ số.",
    whyDigitRest: "Chỉ sai một chữ số trong số thứ tự vẫn tạo ra một số đúng dạng nhưng không thuộc về ai. Hãy đối chiếu với biên nhận, hoặc ",
    findByEmployer: "tìm hồ sơ theo tên chủ lao động (trang tiếng Anh)",
    numberSays: "Số hồ sơ cho biết gì",
    legacyTitle: "Đây là dạng số hồ sơ cũ",
    legacyBefore: "Các số như ",
    legacyMiddle:
      " là dạng cũ ba phần, dùng chủ yếu trong năm 2022 và 2023. Các chữ số ở giữa không phải ngày nộp: nếu đọc như ngày, chúng chỉ khớp với ngày DOL nhận hồ sơ ",
    legacyBold: "13% số lần",
    legacyAfter:
      ", so với 90% ở dạng hiện nay. Mọi hồ sơ dạng này đều đã có quyết định và được công bố, nên hồ sơ có thật sẽ hiện ở đây. Hãy đối chiếu các chữ số với biên nhận.",
    monthTitle: (m) => `Hồ sơ nộp trong ${m}`,
    monthHint: "Tháng mà số này chỉ ra",
    notMeasuredBold: (n) => `Không có số liệu nào ở đây được đo trên ${n}`,
    notMeasuredRest: (total) => `, vì chúng tôi không tìm thấy số đó. Đây là ${total} hồ sơ chúng tôi có, nộp cùng tháng.`,
    filedThatMonth: "Nộp trong tháng đó",
    checkedAgainstDol: "hồ sơ đã đối chiếu với DOL",
    stillUndecided: "Chưa có quyết định",
    pctDecided: (p) => `${p}% của tháng đã có quyết định`,
    ofThatMonth: "của tháng đó",
    filedBefore: "Nộp trước tháng đó",
    filedBeforeNote: "chưa có quyết định, trong mọi tháng trước",
    wallTitle: "Hàng chờ phía trước tháng nộp đó",
    wallSubject: "Hồ sơ chưa có quyết định theo tháng nộp",
    wallCaption: (m) =>
      `Vẽ cho ${m}, tháng mà số này chỉ ra: hàng chờ phía trước tháng đó, không phải phía trước một hồ sơ cụ thể.`,
    wallSource: "Tình trạng từng hồ sơ từ hệ thống tình trạng hồ sơ của chính DOL, kiểm tra hằng ngày",
    wallSourceAsOf: (d) =>
      `Tình trạng từng hồ sơ từ hệ thống tình trạng hồ sơ của chính DOL, kiểm tra hằng ngày · vị trí hàng chờ của DOL tính đến ${d}`,
    fullSplit: (m) => `Phân bổ đầy đủ của ${m} (trang tiếng Anh)`,
    getTold: "Nhận thông báo khi DOL xét đến tháng đó (trang tiếng Anh)",
    wontSayTitle: "Những điều trang này không cho bạn biết",
  },
} satisfies Messages<CaseNotFoundText>;
