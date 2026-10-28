import type { Messages } from "@/lib/i18n/lang";

/**
 * The lookup box's own words. The terms follow each language's guide (`src/lib/i18n/guide/*.tsx`), so a reader
 * meets the same word for "case number" on both pages. A link to a page that is only in English says so.
 */
export interface LookupFormText {
  label: string;
  help: string;
  button: string;
  noNumber: string;
  searchLabel: string;
  receipt: string;
  malformed: string;
}

export const LOOKUP_FORM = {
  en: {
    label: "Your PERM case number",
    help: "It's on your ETA-9089 receipt. It goes into the page's address, so you can bookmark the result.",
    button: "Check",
    noNumber: "Don't have the number?",
    searchLabel: "Find a case by employer name",
    receipt:
      "That looks like a USCIS receipt number, which is USCIS's record rather than DOL's. Checking it takes you to the USCIS page.",
    malformed: "That isn't the shape of a case number. They look like G-100-26125-868956.",
  },
  es: {
    label: "Su número de caso PERM",
    help: "Aparece en el recibo del ETA-9089. Queda en la dirección de la página, así que puede guardar el resultado.",
    button: "Consultar",
    noNumber: "¿No tiene el número?",
    searchLabel: "Busque el caso por el nombre del empleador (en inglés)",
    receipt:
      "Parece un número de recibo de USCIS, que es un registro de USCIS y no del DOL. Al consultarlo, irá a la página de USCIS.",
    malformed: "Eso no tiene la forma de un número de caso. Se ven así: G-100-26125-868956.",
  },
  zh: {
    label: "您的 PERM 案件编号",
    help: "编号印在 ETA-9089 回执上。查询后编号会出现在网页地址中，方便您收藏结果。",
    button: "查询",
    noNumber: "没有案件编号？",
    searchLabel: "按雇主名称查找案件（英文页面）",
    receipt: "这看起来是移民局（USCIS）的收据编号，属于移民局的记录，而不是劳工部的。查询时会转到移民局的页面。",
    malformed: "这不是案件编号的格式。案件编号的样子是 G-100-26125-868956。",
  },
  "pt-br": {
    label: "Seu número de caso PERM",
    help: "Ele está no recibo do ETA-9089. Ele vai para o endereço da página, então você pode salvar o resultado.",
    button: "Consultar",
    noNumber: "Não tem o número?",
    searchLabel: "Encontre o caso pelo nome do empregador (em inglês)",
    receipt:
      "Isso parece um número de recibo do USCIS, que é um registro do USCIS e não do DOL. Ao consultá-lo, você irá para a página do USCIS.",
    malformed: "Isso não tem o formato de um número de caso. Eles são assim: G-100-26125-868956.",
  },
  ko: {
    label: "PERM 케이스 번호",
    help: "ETA-9089 접수증에 적혀 있습니다. 번호가 페이지 주소에 들어가므로 결과를 즐겨찾기할 수 있습니다.",
    button: "조회",
    noNumber: "번호를 모르시나요?",
    searchLabel: "고용주 이름으로 케이스 찾기(영어 페이지)",
    receipt: "USCIS 접수 번호로 보입니다. 노동부가 아니라 USCIS의 기록이므로, 조회하면 USCIS 페이지로 이동합니다.",
    malformed: "케이스 번호 형식이 아닙니다. 케이스 번호는 G-100-26125-868956과 같은 모양입니다.",
  },
  vi: {
    label: "Số hồ sơ PERM của bạn",
    help: "Số này có trên biên nhận ETA-9089. Số sẽ nằm trong địa chỉ trang, nên bạn có thể lưu lại kết quả.",
    button: "Tra cứu",
    noNumber: "Không có số hồ sơ?",
    searchLabel: "Tìm hồ sơ theo tên chủ lao động (trang tiếng Anh)",
    receipt:
      "Đây có vẻ là số biên nhận của USCIS, tức hồ sơ của USCIS chứ không phải của DOL. Khi tra cứu, bạn sẽ được chuyển sang trang USCIS.",
    malformed: "Đây không phải dạng số hồ sơ. Số hồ sơ có dạng G-100-26125-868956.",
  },
} satisfies Messages<LookupFormText>;
