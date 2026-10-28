import type { Messages } from "@/lib/i18n/lang";

/**
 * The source block's words. Its sentences are complete in every language. Dataset names, coverage notes and
 * cadences are translated for the datasets translated pages show; any other falls back to the English (the
 * fallback-locale pattern), so a page in another language never shows a blank. Source names (DOL, FLAG,
 * flag.dol.gov) stay as printed.
 */
export interface ProvenanceText {
  /** " · data through Oct 28, 2026" */
  dataThrough: (date: string) => string;
  /** Keyed by the registry's cadence, lower-cased. */
  cadence: Readonly<Record<string, string>>;
  howCounted: string;
  spotted: string;
  tellUs: string;
  everyFix: string;
  correctionsLog: string;
  includesOne: string;
  includesMany: string;
  /** "{label} has not refreshed in {n} days." */
  stale: (label: string, days: number | null) => string;
  staleBody: (cadence: string) => string;
  source: string;
  labels: Readonly<Record<string, string>>;
  coverage: Readonly<Record<string, string>>;
  citeSummary: string;
  /** The citation's own words. */
  citeData: (date: string) => string;
  citeAccessed: (date: string) => string;
  /** A sentence's last mark: ".", or "。" in Chinese. */
  end: string;
}

export const PROVENANCE = {
  en: {
    dataThrough: (d) => `data through ${d}`,
    cadence: {},
    howCounted: "How these figures are counted",
    spotted: "Spotted an error?",
    tellUs: "Tell us",
    everyFix: "; every fix is dated in the",
    correctionsLog: "corrections log",
    includesOne: "What this data includes",
    includesMany: "What each source includes",
    stale: (label, days) => `${label} has not refreshed${days === null ? "" : days === 1 ? " in a day" : ` in ${days} days`}.`,
    staleBody: (c) =>
      `It should update ${c}, so the figures below are the last ones that arrived rather than the current ones.`,
    source: "Source:",
    labels: {},
    coverage: {},
    citeData: (d) => `, data through ${d}`,
    citeAccessed: (d) => `(accessed ${d})`,
    end: ".",
    citeSummary: "Cite this page",
  },
  es: {
    dataThrough: (d) => `datos hasta el ${d}`,
    cadence: {
      daily: "a diario",
      weekly: "cada semana",
      monthly: "cada mes",
      quarterly: "cada trimestre",
      yearly: "cada año",
      "every 30 minutes": "cada 30 minutos",
      "several times a day": "varias veces al día",
      "hourly on weekdays, and daily": "cada hora en días hábiles, y a diario",
    },
    howCounted: "Cómo se cuentan estas cifras (en inglés)",
    spotted: "¿Vio un error?",
    tellUs: "Avísenos",
    everyFix: "; cada corrección queda fechada en el",
    correctionsLog: "registro de correcciones (en inglés)",
    includesOne: "Qué incluyen estos datos",
    includesMany: "Qué incluye cada fuente",
    stale: (label, days) =>
      `${label} no se ha actualizado${days === null ? "" : days === 1 ? " en un día" : ` en ${days} días`}.`,
    staleBody: (c) =>
      `Debería actualizarse ${c}, así que las cifras de abajo son las últimas que llegaron, no las actuales.`,
    source: "Fuente:",
    labels: {
      "perm-case-status": "Estados de cada caso",
      "perm-cases": "Datos de casos",
      "processing-times": "Tiempos de procesamiento",
    },
    coverage: {
      "perm-case-status":
        "Todos los casos PERM que el DOL indexa, incluidos los pendientes. Sin salario, bufete ni lugar de trabajo: el DOL los muestra solo cuando publica el caso.",
      "perm-cases":
        "Solo casos PERM ya decididos. Un caso que sigue esperando no está aquí, así que los conteos y las duraciones describen casos terminados.",
      "processing-times":
        "La posición de la fila y el tiempo promedio de decisión que publica el DOL. Es la cifra del propio DOL, no nuestra.",
    },
    citeData: (d) => `, datos hasta el ${d}`,
    citeAccessed: (d) => `(consultado el ${d})`,
    end: ".",
    citeSummary: "Citar esta página",
  },
  zh: {
    dataThrough: (d) => `数据截至 ${d}`,
    cadence: {
      daily: "每天",
      weekly: "每周",
      monthly: "每月",
      quarterly: "每季度",
      yearly: "每年",
      "every 30 minutes": "每 30 分钟",
      "several times a day": "每天数次",
      "hourly on weekdays, and daily": "工作日每小时，另每天一次",
    },
    howCounted: "这些数字是怎么统计的（英文页面）",
    spotted: "发现错误？",
    tellUs: "告诉我们",
    everyFix: "；每次更正都会注明日期，记录在",
    correctionsLog: "更正记录（英文页面）",
    includesOne: "这些数据包括什么",
    includesMany: "每个来源包括什么",
    stale: (label, days) => `${label}${days === null ? "未更新" : `已 ${days} 天未更新`}。`,
    staleBody: (c) => `它应当${c}更新，因此下面的数字是最后收到的，而不是最新的。`,
    source: "来源：",
    labels: {
      "perm-case-status": "单个案件状态",
      "perm-cases": "案件数据",
      "processing-times": "处理时间",
    },
    coverage: {
      "perm-case-status": "劳工部收录的所有 PERM 案件，包括待审案件。不含工资、律所和工作地点：劳工部只在公布案件时才提供这些信息。",
      "perm-cases": "只包括已判定的 PERM 案件。仍在等待的案件不在其中，因此数量和用时描述的是已结案的案件。",
      "processing-times": "劳工部公布的队列位置和平均判定时间。这是劳工部自己的数字，不是我们算的。",
    },
    citeData: (d) => `，数据截至 ${d}`,
    citeAccessed: (d) => `（访问于 ${d}）`,
    end: "。",
    citeSummary: "引用本页",
  },
  "pt-br": {
    dataThrough: (d) => `dados até ${d}`,
    cadence: {
      daily: "diariamente",
      weekly: "semanalmente",
      monthly: "mensalmente",
      quarterly: "trimestralmente",
      yearly: "anualmente",
      "every 30 minutes": "a cada 30 minutos",
      "several times a day": "várias vezes ao dia",
      "hourly on weekdays, and daily": "a cada hora em dias úteis, e diariamente",
    },
    howCounted: "Como estes números são contados (em inglês)",
    spotted: "Viu um erro?",
    tellUs: "Avise-nos",
    everyFix: "; cada correção fica datada no",
    correctionsLog: "registro de correções (em inglês)",
    includesOne: "O que estes dados incluem",
    includesMany: "O que cada fonte inclui",
    stale: (label, days) =>
      `${label} não é atualizado${days === null ? "" : days === 1 ? " há um dia" : ` há ${days} dias`}.`,
    staleBody: (c) =>
      `Deveria ser atualizado ${c}, então os números abaixo são os últimos que chegaram, não os atuais.`,
    source: "Fonte:",
    labels: {
      "perm-case-status": "Status de cada caso",
      "perm-cases": "Dados de casos",
      "processing-times": "Tempos de processamento",
    },
    coverage: {
      "perm-case-status":
        "Todos os casos PERM que o DOL indexa, inclusive os pendentes. Sem salário, escritório de advocacia ou local de trabalho: o DOL só os mostra quando publica o caso.",
      "perm-cases":
        "Somente casos PERM já decididos. Um caso ainda em espera não está aqui, então as contagens e durações descrevem casos encerrados.",
      "processing-times":
        "A posição na fila e o tempo médio de decisão que o DOL publica. É o número do próprio DOL, não nosso.",
    },
    citeData: (d) => `, dados até ${d}`,
    citeAccessed: (d) => `(acessado em ${d})`,
    end: ".",
    citeSummary: "Citar esta página",
  },
  ko: {
    dataThrough: (d) => `${d}까지의 데이터`,
    cadence: {
      daily: "매일",
      weekly: "매주",
      monthly: "매월",
      quarterly: "분기마다",
      yearly: "매년",
      "every 30 minutes": "30분마다",
      "several times a day": "하루 여러 번",
      "hourly on weekdays, and daily": "평일 매시간, 그리고 매일",
    },
    howCounted: "이 숫자를 세는 방법(영어 페이지)",
    spotted: "오류를 발견하셨나요?",
    tellUs: "알려 주세요",
    everyFix: ". 모든 수정은 날짜와 함께",
    correctionsLog: "수정 기록(영어 페이지)에 남습니다",
    includesOne: "이 데이터에 포함된 것",
    includesMany: "각 출처에 포함된 것",
    stale: (label, days) => `${label}${days === null ? "이(가) 업데이트되지 않았습니다" : `이(가) ${days}일 동안 업데이트되지 않았습니다`}.`,
    staleBody: (c) => `${c} 업데이트되어야 하므로, 아래 숫자는 최신이 아니라 마지막으로 받은 값입니다.`,
    source: "출처:",
    labels: {
      "perm-case-status": "케이스별 상태",
      "perm-cases": "케이스 데이터",
      "processing-times": "처리 시간",
    },
    coverage: {
      "perm-case-status":
        "노동부가 색인한 모든 PERM 케이스로, 심사 중인 케이스도 포함합니다. 임금, 법률 사무소, 근무지는 없습니다. 노동부는 케이스를 공개할 때만 이를 보여 줍니다.",
      "perm-cases":
        "결정된 PERM 케이스만 포함합니다. 아직 대기 중인 케이스는 없으므로, 건수와 기간은 끝난 케이스를 설명합니다.",
      "processing-times": "노동부가 공개한 대기열 위치와 평균 결정 기간입니다. 저희가 계산한 것이 아니라 노동부의 숫자입니다.",
    },
    citeData: (d) => `, ${d}까지의 데이터`,
    citeAccessed: (d) => `(${d} 접속)`,
    end: ".",
    citeSummary: "이 페이지 인용하기",
  },
  vi: {
    dataThrough: (d) => `dữ liệu đến ${d}`,
    cadence: {
      daily: "hằng ngày",
      weekly: "hằng tuần",
      monthly: "hằng tháng",
      quarterly: "hằng quý",
      yearly: "hằng năm",
      "every 30 minutes": "mỗi 30 phút",
      "several times a day": "vài lần mỗi ngày",
      "hourly on weekdays, and daily": "mỗi giờ vào ngày làm việc, và hằng ngày",
    },
    howCounted: "Cách tính các con số này (trang tiếng Anh)",
    spotted: "Thấy lỗi?",
    tellUs: "Báo cho chúng tôi",
    everyFix: "; mỗi lần sửa đều được ghi ngày trong",
    correctionsLog: "nhật ký sửa lỗi (trang tiếng Anh)",
    includesOne: "Dữ liệu này gồm những gì",
    includesMany: "Mỗi nguồn gồm những gì",
    stale: (label, days) =>
      `${label} chưa được cập nhật${days === null ? "" : days === 1 ? " trong một ngày" : ` trong ${days} ngày`}.`,
    staleBody: (c) =>
      `Dữ liệu lẽ ra được cập nhật ${c}, nên các con số bên dưới là số cuối cùng nhận được, không phải số hiện tại.`,
    source: "Nguồn:",
    labels: {
      "perm-case-status": "Tình trạng từng hồ sơ",
      "perm-cases": "Dữ liệu hồ sơ",
      "processing-times": "Thời gian xử lý",
    },
    coverage: {
      "perm-case-status":
        "Mọi hồ sơ PERM mà DOL lập chỉ mục, kể cả hồ sơ đang chờ. Không có lương, công ty luật hay nơi làm việc: DOL chỉ cho biết khi công bố hồ sơ.",
      "perm-cases":
        "Chỉ gồm hồ sơ PERM đã có quyết định. Hồ sơ còn đang chờ không có ở đây, nên số lượng và thời gian mô tả các hồ sơ đã xong.",
      "processing-times": "Vị trí hàng chờ và thời gian quyết định trung bình do DOL công bố. Đây là con số của chính DOL, không phải của chúng tôi.",
    },
    citeData: (d) => `, dữ liệu đến ${d}`,
    citeAccessed: (d) => `(truy cập ngày ${d})`,
    end: ".",
    citeSummary: "Trích dẫn trang này",
  },
} satisfies Messages<ProvenanceText>;
