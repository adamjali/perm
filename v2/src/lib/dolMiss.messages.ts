import type { Messages } from "@/lib/i18n/lang";
import type { LookupGap } from "@/lib/dolMiss";

/**
 * Why a lookup has no answer, in a translated page's language. English stays in dolMiss.ts, which the API,
 * the embed and the wage-request and LCA pages read too; this is the same four answers for /es and the rest.
 */
export interface DolMissText {
  verdict: Record<LookupGap, string>;
  /** The clause after "We hold no record for <number> yet, " (or "We couldn't check <number> just now: "). */
  clause: (m: LookupGap, resetAt: string) => string;
}

export const DOL_MISS = {
  en: {
    verdict: {
      records: "Our records couldn't be read",
      unavailable: "DOL didn't answer",
      budget: "Live checks used up for today",
      "not-asked": "Not checked with DOL",
    },
    clause: (m, at) =>
      m === "records"
        ? "this site's own case records couldn't be read, so this doesn't mean the case isn't there."
        : m === "unavailable"
          ? "and DOL's case system didn't answer when we asked just now (it gets 8 seconds), so we can't say whether DOL has it. That's usually brief."
          : m === "budget"
            ? `and we couldn't ask DOL live, because the site's daily allowance of live checks is used up. It resets at ${at} Eastern.`
            : "and the live check with DOL couldn't be made just now, so we can't say whether DOL has it.",
  },
  es: {
    verdict: {
      records: "No se pudieron leer nuestros registros",
      unavailable: "El DOL no respondió",
      budget: "Consultas en vivo agotadas por hoy",
      "not-asked": "No se consultó al DOL",
    },
    clause: (m, at) =>
      m === "records"
        ? "no se pudieron leer los registros de casos de este sitio, así que esto no significa que el caso no esté."
        : m === "unavailable"
          ? "y el sistema de casos del DOL no respondió cuando le preguntamos (tiene 8 segundos), así que no sabemos si el DOL lo tiene. Suele ser algo pasajero."
          : m === "budget"
            ? `y no pudimos consultar al DOL en vivo porque se agotaron las consultas en vivo del día. Se renuevan a las ${at}, hora del Este.`
            : "y la consulta en vivo al DOL no se pudo hacer ahora, así que no sabemos si el DOL lo tiene.",
  },
  zh: {
    verdict: {
      records: "无法读取我们的记录",
      unavailable: "劳工部没有回应",
      budget: "今天的实时查询次数已用完",
      "not-asked": "未向劳工部查询",
    },
    clause: (m, at) =>
      m === "records"
        ? "本站自己的案件记录读取失败，所以这不代表案件不存在。"
        : m === "unavailable"
          ? "而且刚才询问时，劳工部的案件系统没有回应（等待时间为 8 秒），因此无法确定劳工部是否有这个案件。这种情况通常很快恢复。"
          : m === "budget"
            ? `而且本站今天向劳工部实时查询的次数已用完，所以无法实时查询。美国东部时间 ${at} 恢复。`
            : "而且刚才无法向劳工部实时查询，因此无法确定劳工部是否有这个案件。",
  },
  "pt-br": {
    verdict: {
      records: "Não foi possível ler nossos registros",
      unavailable: "O DOL não respondeu",
      budget: "Consultas ao vivo esgotadas por hoje",
      "not-asked": "O DOL não foi consultado",
    },
    clause: (m, at) =>
      m === "records"
        ? "os registros de casos deste site não puderam ser lidos, então isso não significa que o caso não está aqui."
        : m === "unavailable"
          ? "e o sistema de casos do DOL não respondeu quando perguntamos agora há pouco (ele tem 8 segundos), então não sabemos se o DOL tem o caso. Isso costuma passar rápido."
          : m === "budget"
            ? `e não pudemos consultar o DOL ao vivo porque as consultas ao vivo do dia acabaram. Elas voltam às ${at}, horário do Leste.`
            : "e a consulta ao vivo ao DOL não pôde ser feita agora, então não sabemos se o DOL tem o caso.",
  },
  ko: {
    verdict: {
      records: "저희 기록을 읽지 못했습니다",
      unavailable: "노동부가 응답하지 않았습니다",
      budget: "오늘의 실시간 조회 한도를 다 썼습니다",
      "not-asked": "노동부에 조회하지 못했습니다",
    },
    clause: (m, at) =>
      m === "records"
        ? "이 사이트의 케이스 기록을 읽지 못했을 뿐, 케이스가 없다는 뜻은 아닙니다."
        : m === "unavailable"
          ? "방금 노동부 케이스 시스템에 물었지만 응답이 없었습니다(대기 시간 8초). 그래서 노동부에 이 케이스가 있는지 알 수 없습니다. 보통 금방 해결됩니다."
          : m === "budget"
            ? `오늘 노동부 실시간 조회 한도를 다 써서 실시간으로 물어보지 못했습니다. 미국 동부 시간 ${at}에 다시 가능합니다.`
            : "방금 노동부에 실시간 조회를 하지 못해서 노동부에 이 케이스가 있는지 알 수 없습니다.",
  },
  vi: {
    verdict: {
      records: "Không đọc được dữ liệu của chúng tôi",
      unavailable: "DOL không trả lời",
      budget: "Đã hết lượt tra cứu trực tiếp hôm nay",
      "not-asked": "Chưa tra cứu với DOL",
    },
    clause: (m, at) =>
      m === "records"
        ? "không đọc được dữ liệu hồ sơ của trang này, nên điều này không có nghĩa là hồ sơ không có."
        : m === "unavailable"
          ? "và hệ thống hồ sơ của DOL không trả lời khi chúng tôi vừa hỏi (chờ tối đa 8 giây), nên chưa thể biết DOL có hồ sơ này không. Việc này thường chỉ thoáng qua."
          : m === "budget"
            ? `và chúng tôi không thể hỏi DOL trực tiếp vì đã hết lượt tra cứu trực tiếp trong ngày. Lượt sẽ có lại lúc ${at} giờ miền Đông.`
            : "và lúc này không tra cứu trực tiếp với DOL được, nên chưa thể biết DOL có hồ sơ này không.",
  },
} satisfies Messages<DolMissText>;
