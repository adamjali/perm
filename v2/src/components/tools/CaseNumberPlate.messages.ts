import type { Messages } from "@/lib/i18n/lang";

/** The case number taken apart: its segments' names and what the middle digits say. */
export interface CaseNumberPlateText {
  prefix: string;
  year: string;
  dayOfYear: string;
  serial: string;
  middleLead: string;
  /** The bold part: "day 125 of 2026". */
  dayOf: (day: number, year: string) => string;
  /** After the bold part: ", which is May 5, 2026." */
  which: (date: string) => string;
  disagreeLead: string;
  disagreeRest: string;
  gNote: string;
  /** How often the decoded date is right (was CASE_NUMBER_ACCURACY). */
  accuracy: string;
}

export const CASE_NUMBER_PLATE = {
  en: {
    prefix: "Prefix",
    year: "Year",
    dayOfYear: "Day of year",
    serial: "Serial",
    middleLead: "The middle five digits are a date:",
    dayOf: (d, y) => `day ${d} of ${y}`,
    which: (date) => `, which is ${date}.`,
    disagreeLead: "DOL's own record puts the receipt date one or two days off that, at",
    disagreeRest: ", and the record is what every figure on this page uses.",
    gNote: "The G is PERM; DOL publishes no key for the number after it.",
    accuracy:
      "The filing date is read from the case number itself, for numbers in the current four-part format. Measured against 20,000 cases in DOL's own records, it matches exactly for 89% and is within a day or two otherwise. The older three-part format carries no readable date, so it is never decoded.",
  },
  es: {
    prefix: "Prefijo",
    year: "Año",
    dayOfYear: "Día del año",
    serial: "Serie",
    middleLead: "Los cinco dígitos del medio son una fecha:",
    dayOf: (d, y) => `el día ${d} de ${y}`,
    which: (date) => `, es decir, el ${date}.`,
    disagreeLead: "El registro del propio DOL pone la fecha de recepción uno o dos días antes o después, el",
    disagreeRest: ", y ese registro es el que usan todas las cifras de esta página.",
    gNote: "La G es de PERM; el DOL no publica qué significa el número que sigue.",
    accuracy:
      "La fecha de presentación se lee del propio número de caso, en los números con el formato actual de cuatro partes. Comparada con 20.000 casos de los registros del DOL, coincide exactamente en el 89 % y, si no, difiere en uno o dos días. El formato antiguo de tres partes no lleva una fecha legible, así que nunca se descifra.",
  },
  zh: {
    prefix: "前缀",
    year: "年份",
    dayOfYear: "当年第几天",
    serial: "序号",
    middleLead: "中间五位数字是一个日期：",
    dayOf: (d, y) => `${y} 年的第 ${d} 天`,
    which: (date) => `，即 ${date}。`,
    disagreeLead: "劳工部自己的记录中，收件日期与此相差一两天，为",
    disagreeRest: "，本页的所有数字都以该记录为准。",
    gNote: "G 代表 PERM；劳工部没有公布其后数字的含义。",
    accuracy:
      "递交日期是从案件编号本身读出的，适用于现行的四段式编号。与劳工部记录中的 20,000 个案件比对，89% 完全一致，其余相差一两天。较早的三段式编号不含可读的日期，因此从不解读。",
  },
  "pt-br": {
    prefix: "Prefixo",
    year: "Ano",
    dayOfYear: "Dia do ano",
    serial: "Série",
    middleLead: "Os cinco dígitos do meio são uma data:",
    dayOf: (d, y) => `o dia ${d} de ${y}`,
    which: (date) => `, ou seja, ${date}.`,
    disagreeLead: "O registro do próprio DOL coloca a data de recebimento um ou dois dias antes ou depois, em",
    disagreeRest: ", e é esse registro que todos os números desta página usam.",
    gNote: "O G é de PERM; o DOL não publica o significado do número seguinte.",
    accuracy:
      "A data de protocolo é lida do próprio número do caso, nos números no formato atual de quatro partes. Comparada com 20.000 casos dos registros do DOL, ela bate exatamente em 89% e, nos outros, erra por um ou dois dias. O formato antigo de três partes não traz uma data legível, então nunca é decifrado.",
  },
  ko: {
    prefix: "접두어",
    year: "연도",
    dayOfYear: "연중 일수",
    serial: "일련번호",
    middleLead: "가운데 다섯 자리는 날짜입니다.",
    dayOf: (d, y) => `${y}년의 ${d}번째 날`,
    which: (date) => `, 즉 ${date}입니다.`,
    disagreeLead: "노동부 자체 기록의 접수일은 이와 하루나 이틀 차이 나는",
    disagreeRest: "이며, 이 페이지의 모든 숫자는 그 기록을 따릅니다.",
    gNote: "G는 PERM을 뜻합니다. 노동부는 그 뒤 숫자의 의미를 공개하지 않습니다.",
    accuracy:
      "접수일은 현재의 네 부분 형식 번호에서 케이스 번호 자체로 읽습니다. 노동부 기록의 20,000건과 비교하면 89%가 정확히 일치하고, 나머지는 하루나 이틀 차이가 납니다. 예전의 세 부분 형식에는 읽을 수 있는 날짜가 없어 해석하지 않습니다.",
  },
  vi: {
    prefix: "Tiền tố",
    year: "Năm",
    dayOfYear: "Ngày trong năm",
    serial: "Số thứ tự",
    middleLead: "Năm chữ số ở giữa là một ngày:",
    dayOf: (d, y) => `ngày thứ ${d} của năm ${y}`,
    which: (date) => `, tức ${date}.`,
    disagreeLead: "Hồ sơ của chính DOL ghi ngày nhận lệch một hai ngày so với đó, là",
    disagreeRest: ", và mọi con số trên trang này dùng theo hồ sơ đó.",
    gNote: "Chữ G là PERM; DOL không công bố ý nghĩa của số đứng sau.",
    accuracy:
      "Ngày nộp được đọc từ chính số hồ sơ, với các số theo dạng bốn phần hiện nay. So với 20.000 hồ sơ trong dữ liệu của DOL, ngày này khớp chính xác 89%, còn lại lệch một hai ngày. Dạng cũ ba phần không chứa ngày đọc được, nên không bao giờ được giải mã.",
  },
} satisfies Messages<CaseNumberPlateText>;
