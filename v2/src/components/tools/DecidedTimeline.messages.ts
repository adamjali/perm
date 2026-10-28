import type { Messages } from "@/lib/i18n/lang";
import type { TimelineTone } from "@/lib/decidedTimeline";

/**
 * A decided case's dates, wage request to decision. The step labels are keyed by the timeline's own step keys
 * (and DOL's recruitment step ids), so English keeps the labels `decidedTimeline` builds and the other languages
 * never parse them. Newspaper names, case numbers and DOL's decision word stay as DOL prints them.
 */
export type StepKey = "pwd-filed" | "pwd-determined" | "job-order" | "ad1" | "ad-only" | "ad2" | "quiet" | "filed" | "pwd-expires";

/** The pay periods in scripts/data/pay_periods.json, by their English label. */
export type PeriodLabel = "per year" | "per hour" | "per week" | "every two weeks" | "per month";

export interface DecidedTimelineText {
  title: string;
  lede: string;
  range: (from: string, to: string) => string;
  step: Record<StepKey, string>;
  /** DOL's additional recruitment steps, by the id DOL's file uses. */
  recruitment: Readonly<Record<string, string>>;
  level: (level: string) => string;
  /** "$65.00 per hour", in the language's own order. */
  wage: (amount: string, period: string) => string;
  period: Record<PeriodLabel, string>;
  quietDetail: string;
  afterQuiet: (n: number) => string;
  decided: Record<Extract<TimelineTone, "certified" | "denied" | "withdrawn">, string>;
  /** The outcome in the reader's language, DOL's own word beside it. */
  decidedLabel: (word: string, dol: string) => string;
  pwdNamed: string;
  /** What ends the sentence after the linked number, with the space before the next one. */
  pwdNamedEnd: string;
  size: (n: string, count: number) => string;
  founded: (year: string) => string;
  gave: (facts: readonly string[]) => string;
}

export const DECIDED_TIMELINE = {
  en: {
    title: "From wage request to decision",
    lede: "Every date DOL's published files print for this case, in order.",
    range: (from, to) => `${from} to ${to}`,
    step: {
      "pwd-filed": "Wage request filed",
      "pwd-determined": "Wage determined",
      "job-order": "Job order",
      ad1: "First Sunday ad",
      "ad-only": "Sunday ad",
      ad2: "Second Sunday ad",
      quiet: "Quiet period ended",
      filed: "PERM filed",
      "pwd-expires": "Wage determination's last day",
    },
    recruitment: {},
    level: (level) => `Level ${level}`,
    wage: (amount, period) => `${amount} ${period}`,
    period: {
      "per year": "per year",
      "per hour": "per hour",
      "per week": "per week",
      "every two weeks": "every two weeks",
      "per month": "per month",
    },
    quietDetail: "The first day the PERM could be filed",
    afterQuiet: (n) => `${n === 0 ? "The day" : `${n} ${n === 1 ? "day" : "days"}`} after the quiet period ended`,
    decided: { certified: "Certified", denied: "Denied", withdrawn: "Withdrawn" },
    decidedLabel: (_word, dol) => dol,
    pwdNamed: "The wage request this case names: ",
    pwdNamedEnd: ". ",
    size: (n, count) => `its size as ${n} ${count === 1 ? "employee" : "employees"}`,
    founded: (year) => `its founding year as ${year}`,
    gave: (facts) => `On the application, the employer gave ${facts.join(" and ")}.`,
  },
  es: {
    title: "De la solicitud de salario a la decisión",
    lede: "Cada fecha que imprimen los archivos publicados del DOL para este caso, en orden.",
    range: (from, to) => `${from} a ${to}`,
    step: {
      "pwd-filed": "Solicitud de salario presentada",
      "pwd-determined": "Salario determinado",
      "job-order": "Orden de trabajo (job order)",
      ad1: "Primer anuncio dominical",
      "ad-only": "Anuncio dominical",
      ad2: "Segundo anuncio dominical",
      quiet: "Fin del período de espera",
      filed: "PERM presentado",
      "pwd-expires": "Último día de la determinación de salario",
    },
    recruitment: {
      job_fair: "Ferias de empleo",
      employer_website: "El sitio web del empleador",
      job_search_website: "Sitios web de búsqueda de empleo",
      on_campus: "Reclutamiento en el campus",
      trade_org: "Organizaciones comerciales o profesionales",
      private_firm: "Agencias privadas de empleo",
      employee_referral: "Programas de recomendación de empleados",
      campus_placement: "Oficinas de colocación universitaria",
      local_newspaper: "Periódicos locales o étnicos",
      radio_tv: "Anuncios de radio o televisión",
    },
    level: (level) => `Nivel ${level}`,
    wage: (amount, period) => `${amount} ${period}`,
    period: {
      "per year": "al año",
      "per hour": "por hora",
      "per week": "por semana",
      "every two weeks": "cada dos semanas",
      "per month": "al mes",
    },
    quietDetail: "El primer día en que se podía presentar el PERM",
    afterQuiet: (n) =>
      n === 0
        ? "El mismo día en que terminó el período de espera"
        : `${n} ${n === 1 ? "día" : "días"} después de que terminó el período de espera`,
    decided: { certified: "Certificado", denied: "Negado", withdrawn: "Retirado" },
    decidedLabel: (word, dol) => `${word} (${dol})`,
    pwdNamed: "La solicitud de salario que indica este caso: ",
    pwdNamedEnd: ". ",
    size: (n, count) => `un tamaño de ${n} ${count === 1 ? "empleado" : "empleados"}`,
    founded: (year) => `el año de fundación ${year}`,
    gave: (facts) => `En la solicitud, el empleador indicó ${facts.join(" y ")}.`,
  },
  zh: {
    title: "从工资申请到判定",
    lede: "劳工部公开文件为本案件列出的每个日期，按先后排列。",
    range: (from, to) => `${from}至${to}`,
    step: {
      "pwd-filed": "递交工资申请",
      "pwd-determined": "工资已认定",
      "job-order": "州劳工机构职位登记（job order）",
      ad1: "第一次周日报纸广告",
      "ad-only": "周日报纸广告",
      ad2: "第二次周日报纸广告",
      quiet: "等待期结束",
      filed: "递交 PERM",
      "pwd-expires": "工资认定的最后有效日",
    },
    recruitment: {
      job_fair: "招聘会",
      employer_website: "雇主网站",
      job_search_website: "求职网站",
      on_campus: "校园招聘",
      trade_org: "行业或专业组织",
      private_firm: "私营职业介绍机构",
      employee_referral: "员工推荐计划",
      campus_placement: "校园就业办公室",
      local_newspaper: "本地或族裔报纸",
      radio_tv: "广播或电视广告",
    },
    level: (level) => `${level} 级`,
    wage: (amount, period) => `${period} ${amount}`,
    period: {
      "per year": "每年",
      "per hour": "每小时",
      "per week": "每周",
      "every two weeks": "每两周",
      "per month": "每月",
    },
    quietDetail: "可以递交 PERM 的第一天",
    afterQuiet: (n) => (n === 0 ? "等待期结束当天" : `等待期结束后 ${n} 天`),
    decided: { certified: "获批", denied: "被拒", withdrawn: "撤回" },
    decidedLabel: (word, dol) => `${word}（${dol}）`,
    pwdNamed: "本案件对应的工资申请：",
    pwdNamedEnd: "。",
    size: (n) => `员工人数为 ${n}`,
    founded: (year) => `成立年份为 ${year}`,
    gave: (facts) => `申请中，雇主填写的${facts.join("，")}。`,
  },
  "pt-br": {
    title: "Do pedido de salário à decisão",
    lede: "Cada data que os arquivos publicados do DOL mostram para este caso, em ordem.",
    range: (from, to) => `${from} a ${to}`,
    step: {
      "pwd-filed": "Pedido de salário protocolado",
      "pwd-determined": "Salário determinado",
      "job-order": "Ordem de emprego (job order)",
      ad1: "Primeiro anúncio de domingo",
      "ad-only": "Anúncio de domingo",
      ad2: "Segundo anúncio de domingo",
      quiet: "Fim do período de espera",
      filed: "PERM protocolado",
      "pwd-expires": "Último dia da determinação de salário",
    },
    recruitment: {
      job_fair: "Feiras de emprego",
      employer_website: "O site do empregador",
      job_search_website: "Sites de busca de emprego",
      on_campus: "Recrutamento no campus",
      trade_org: "Organizações comerciais ou profissionais",
      private_firm: "Agências privadas de emprego",
      employee_referral: "Programas de indicação de funcionários",
      campus_placement: "Escritórios de colocação universitária",
      local_newspaper: "Jornais locais ou étnicos",
      radio_tv: "Anúncios de rádio ou TV",
    },
    level: (level) => `Nível ${level}`,
    wage: (amount, period) => `${amount} ${period}`,
    period: {
      "per year": "por ano",
      "per hour": "por hora",
      "per week": "por semana",
      "every two weeks": "a cada duas semanas",
      "per month": "por mês",
    },
    quietDetail: "O primeiro dia em que o PERM podia ser protocolado",
    afterQuiet: (n) =>
      n === 0
        ? "No mesmo dia em que o período de espera terminou"
        : `${n} ${n === 1 ? "dia" : "dias"} depois do fim do período de espera`,
    decided: { certified: "Certificado", denied: "Negado", withdrawn: "Retirado" },
    decidedLabel: (word, dol) => `${word} (${dol})`,
    pwdNamed: "O pedido de salário que este caso indica: ",
    pwdNamedEnd: ". ",
    size: (n, count) => `um porte de ${n} ${count === 1 ? "funcionário" : "funcionários"}`,
    founded: (year) => `o ano de fundação ${year}`,
    gave: (facts) => `Na solicitação, o empregador informou ${facts.join(" e ")}.`,
  },
  ko: {
    title: "임금 신청부터 결정까지",
    lede: "노동부 공개 파일에 나오는 이 케이스의 모든 날짜를 순서대로 보여 줍니다.",
    range: (from, to) => `${from}~${to}`,
    step: {
      "pwd-filed": "임금 신청 접수",
      "pwd-determined": "임금 결정",
      "job-order": "주 정부 구인 등록(job order)",
      ad1: "첫 번째 일요일 신문 광고",
      "ad-only": "일요일 신문 광고",
      ad2: "두 번째 일요일 신문 광고",
      quiet: "대기 기간 종료",
      filed: "PERM 접수",
      "pwd-expires": "임금 결정 유효 마지막 날",
    },
    recruitment: {
      job_fair: "채용 박람회",
      employer_website: "고용주 웹사이트",
      job_search_website: "구인 구직 웹사이트",
      on_campus: "캠퍼스 채용",
      trade_org: "업계 또는 전문 단체",
      private_firm: "민간 채용 업체",
      employee_referral: "직원 추천 프로그램",
      campus_placement: "대학 취업 지원실",
      local_newspaper: "지역 또는 민족 신문",
      radio_tv: "라디오 또는 TV 광고",
    },
    level: (level) => `${level}단계`,
    wage: (amount, period) => `${period} ${amount}`,
    period: {
      "per year": "연",
      "per hour": "시간당",
      "per week": "주당",
      "every two weeks": "2주마다",
      "per month": "월",
    },
    quietDetail: "PERM을 접수할 수 있었던 첫날",
    afterQuiet: (n) => (n === 0 ? "대기 기간이 끝난 당일" : `대기 기간이 끝나고 ${n}일 후`),
    decided: { certified: "승인", denied: "거부", withdrawn: "철회" },
    decidedLabel: (word, dol) => `${word}(${dol})`,
    pwdNamed: "이 케이스가 가리키는 임금 신청: ",
    pwdNamedEnd: ". ",
    size: (n) => `직원 수 ${n}명`,
    founded: (year) => `${year}년 설립`,
    gave: (facts) => `신청서에 따르면 고용주는 ${facts.join(", ")}입니다.`,
  },
  vi: {
    title: "Từ yêu cầu xác định lương đến quyết định",
    lede: "Mọi ngày tháng mà các tệp DOL công bố ghi cho hồ sơ này, theo thứ tự.",
    range: (from, to) => `${from} đến ${to}`,
    step: {
      "pwd-filed": "Nộp yêu cầu xác định lương",
      "pwd-determined": "Đã xác định lương",
      "job-order": "Đăng tuyển tại cơ quan bang (job order)",
      ad1: "Quảng cáo Chủ nhật lần đầu",
      "ad-only": "Quảng cáo Chủ nhật",
      ad2: "Quảng cáo Chủ nhật lần hai",
      quiet: "Hết thời gian chờ",
      filed: "Nộp PERM",
      "pwd-expires": "Ngày cuối hiệu lực của quyết định lương",
    },
    recruitment: {
      job_fair: "Hội chợ việc làm",
      employer_website: "Trang web của chủ lao động",
      job_search_website: "Trang web tìm việc",
      on_campus: "Tuyển dụng tại trường",
      trade_org: "Tổ chức ngành nghề hoặc chuyên môn",
      private_firm: "Công ty tuyển dụng tư nhân",
      employee_referral: "Chương trình giới thiệu của nhân viên",
      campus_placement: "Văn phòng giới thiệu việc làm của trường",
      local_newspaper: "Báo địa phương hoặc báo cộng đồng",
      radio_tv: "Quảng cáo trên radio hoặc TV",
    },
    level: (level) => `Bậc ${level}`,
    wage: (amount, period) => `${amount} ${period}`,
    period: {
      "per year": "mỗi năm",
      "per hour": "mỗi giờ",
      "per week": "mỗi tuần",
      "every two weeks": "mỗi hai tuần",
      "per month": "mỗi tháng",
    },
    quietDetail: "Ngày đầu tiên có thể nộp PERM",
    afterQuiet: (n) => (n === 0 ? "Ngay ngày hết thời gian chờ" : `${n} ngày sau khi hết thời gian chờ`),
    decided: { certified: "Được chứng nhận", denied: "Bị từ chối", withdrawn: "Đã rút" },
    decidedLabel: (word, dol) => `${word} (${dol})`,
    pwdNamed: "Yêu cầu xác định lương mà hồ sơ này ghi: ",
    pwdNamedEnd: ". ",
    size: (n) => `quy mô ${n} nhân viên`,
    founded: (year) => `năm thành lập ${year}`,
    gave: (facts) => `Trong đơn, chủ lao động ghi ${facts.join(" và ")}.`,
  },
} satisfies Messages<DecidedTimelineText>;
