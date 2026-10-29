import { replyHeading } from "@/lib/alertReply";
import type { Messages } from "@/lib/i18n/lang";

/**
 * The filing-month and visa-bulletin alert forms' own words, in every language the alerts page is published in.
 * The shared parts (the note, the done line, the opt-in boxes) are in alerts.messages.ts. Category codes
 * (EB-2) and DOL's own terms stay as printed.
 */
export interface FormsText {
  replyHeading: (queued: boolean) => string;
  email: string;
  failed: string;
  dropped: string;
  queue: {
    heading: string;
    whatPerm: string;
    whatPwd: string;
    month: (perm: boolean) => string;
    pick: string;
    reached: (label: string) => string;
    whichQueue: string;
    oews: string;
    nonOews: string;
    button: string;
    more: string;
    youAre: string;
    optional: string;
    roles: { none: string; attorney: string; applicant: string; employer: string };
    oneMonth: string;
  };
  bulletin: {
    heading: string;
    what: string;
    priority: (date: string) => string;
    category: string;
    country: string;
    countries: { worldwide: string; india: string; china: string; mexico: string; philippines: string };
    otherWorkers: string;
    unreserved: string;
    button: string;
    after: string;
  };
}

export const FORMS_TEXT = {
  en: {
    replyHeading,
    email: "Email",
    failed: "Something went wrong. Try again in a moment.",
    dropped: "Couldn't reach the server. Try again in a moment.",
    queue: {
      heading: "Email me when DOL reaches my month",
      whatPerm: "One email when DOL's analyst-review queue reaches the month your case was filed, and nothing after it.",
      whatPwd: "One email when the prevailing wage queue you pick reaches the month your request was filed, and nothing after it.",
      month: (perm) => `Month your ${perm ? "case" : "request"} was filed`,
      pick: "Select a month",
      reached: (label) => `${label} (already reached)`,
      whichQueue: "Which prevailing wage queue",
      oews: "OEWS, the standard survey",
      nonOews: "Employer-provided survey",
      button: "Email me when it happens",
      more: "More options",
      youAre: "You are",
      optional: "(optional)",
      roles: { none: "Prefer not to say", attorney: "Attorney or paralegal", applicant: "The person the case is for", employer: "The sponsoring employer" },
      oneMonth: "One address watches one filing month per queue; a new month replaces the old one.",
    },
    bulletin: {
      heading: "Email me when my cutoff moves",
      what: "When a new bulletin changes the final-action cutoff for your category and country, one email with the change. Nothing in the months it doesn't move.",
      priority: (d) => `Your priority date is ${d}. Pick the category on your I-140 and your country of birth, and set each cutoff we send against that date.`,
      category: "Category",
      country: "Country of birth",
      countries: { worldwide: "All countries (worldwide)", india: "India", china: "China", mexico: "Mexico", philippines: "Philippines" },
      otherWorkers: "EB-3 Other Workers",
      unreserved: "EB-5 (unreserved)",
      button: "Email me when it moves",
      after: "Once confirmed, you'll hear from us when a new bulletin moves your cutoff, and not otherwise.",
    },
  },
  es: {
    replyHeading: (q) => (q ? "Su correo está en una fila corta" : "Revise su bandeja de entrada"),
    email: "Correo electrónico",
    failed: "Algo salió mal. Inténtelo de nuevo en un momento.",
    dropped: "No se pudo conectar con el servidor. Inténtelo de nuevo en un momento.",
    queue: {
      heading: "Avíseme cuando el DOL llegue a mi mes",
      whatPerm: "Un correo cuando la fila de revisión del analista (ANALYST REVIEW) del DOL llegue al mes en que se presentó su caso, y nada más.",
      whatPwd: "Un correo cuando la fila de salario prevaleciente que elija llegue al mes en que se presentó su solicitud, y nada más.",
      month: (perm) => `Mes en que se presentó su ${perm ? "caso" : "solicitud"}`,
      pick: "Elija un mes",
      reached: (label) => `${label} (ya alcanzado)`,
      whichQueue: "Qué fila de salario prevaleciente",
      oews: "OEWS, la encuesta estándar",
      nonOews: "Encuesta presentada por el empleador",
      button: "Avisarme cuando ocurra",
      more: "Más opciones",
      youAre: "Usted es",
      optional: "(opcional)",
      roles: { none: "Prefiero no decirlo", attorney: "Abogado o asistente legal", applicant: "La persona del caso", employer: "El empleador patrocinador" },
      oneMonth: "Una dirección sigue un mes de presentación por fila; un mes nuevo reemplaza al anterior.",
    },
    bulletin: {
      heading: "Avíseme cuando se mueva mi fecha límite",
      what: "Cuando un boletín nuevo cambie la fecha de acción final de su categoría y país, un correo con el cambio. Nada en los meses en que no se mueve.",
      priority: (d) => `Su fecha de prioridad es ${d}. Elija la categoría de su I-140 y su país de nacimiento, y compare cada fecha límite que le enviemos con esa fecha.`,
      category: "Categoría",
      country: "País de nacimiento",
      countries: { worldwide: "Todos los países (resto del mundo)", india: "India", china: "China", mexico: "México", philippines: "Filipinas" },
      otherWorkers: "EB-3 Otros trabajadores",
      unreserved: "EB-5 (no reservada)",
      button: "Avisarme cuando se mueva",
      after: "Una vez confirmado, le escribiremos cuando un boletín nuevo mueva su fecha límite, y en ningún otro caso.",
    },
  },
  zh: {
    replyHeading: (q) => (q ? "您的邮件正在短暂排队" : "请查看收件箱"),
    email: "邮箱",
    failed: "出了点问题。请稍后再试。",
    dropped: "无法连接服务器。请稍后再试。",
    queue: {
      heading: "劳工部处理到我的月份时通知我",
      whatPerm: "劳工部的分析员审核（ANALYST REVIEW）排队处理到您案件的递交月份时，发一封邮件，之后不再发送。",
      whatPwd: "您选择的现行工资排队处理到您申请的递交月份时，发一封邮件，之后不再发送。",
      month: (perm) => `${perm ? "案件" : "申请"}递交月份`,
      pick: "选择月份",
      reached: (label) => `${label}（已处理到）`,
      whichQueue: "哪一个现行工资排队",
      oews: "OEWS，标准调查",
      nonOews: "雇主提供的调查",
      button: "到时发邮件给我",
      more: "更多选项",
      youAre: "您是",
      optional: "（可选）",
      roles: { none: "不愿透露", attorney: "律师或律师助理", applicant: "案件本人", employer: "担保雇主" },
      oneMonth: "每个邮箱在每个排队中关注一个递交月份；选择新月份会替换旧月份。",
    },
    bulletin: {
      heading: "我的排期日期变动时通知我",
      what: "新的签证公告改变您类别和国家的最终行动日期时，发一封邮件说明变化。日期不动的月份不会发送。",
      priority: (d) => `您的优先日期是 ${d}。请选择您 I-140 上的类别和出生国家，并用这个日期对照我们发送的每个排期日期。`,
      category: "类别",
      country: "出生国家",
      countries: { worldwide: "所有国家（全球）", india: "印度", china: "中国", mexico: "墨西哥", philippines: "菲律宾" },
      otherWorkers: "EB-3 其他工人",
      unreserved: "EB-5（非预留）",
      button: "日期变动时发邮件给我",
      after: "确认后，只有新的签证公告移动您的排期日期时，我们才会发邮件。",
    },
  },
  "pt-br": {
    replyHeading: (q) => (q ? "Seu e-mail está em uma fila curta" : "Veja sua caixa de entrada"),
    email: "E-mail",
    failed: "Algo deu errado. Tente de novo em instantes.",
    dropped: "Não foi possível falar com o servidor. Tente de novo em instantes.",
    queue: {
      heading: "Avise-me quando o DOL chegar ao meu mês",
      whatPerm: "Um e-mail quando a fila de análise (ANALYST REVIEW) do DOL chegar ao mês em que seu caso foi protocolado, e nada mais.",
      whatPwd: "Um e-mail quando a fila de salário prevalecente que você escolher chegar ao mês em que seu pedido foi protocolado, e nada mais.",
      month: (perm) => `Mês em que seu ${perm ? "caso" : "pedido"} foi protocolado`,
      pick: "Escolha um mês",
      reached: (label) => `${label} (já alcançado)`,
      whichQueue: "Qual fila de salário prevalecente",
      oews: "OEWS, a pesquisa padrão",
      nonOews: "Pesquisa apresentada pelo empregador",
      button: "Avisar quando acontecer",
      more: "Mais opções",
      youAre: "Você é",
      optional: "(opcional)",
      roles: { none: "Prefiro não dizer", attorney: "Advogado ou paralegal", applicant: "A pessoa do caso", employer: "O empregador patrocinador" },
      oneMonth: "Um endereço acompanha um mês de protocolo por fila; um mês novo substitui o anterior.",
    },
    bulletin: {
      heading: "Avise-me quando minha data de corte mudar",
      what: "Quando um boletim novo mudar a data de ação final da sua categoria e país, um e-mail com a mudança. Nada nos meses em que ela não se move.",
      priority: (d) => `Sua data de prioridade é ${d}. Escolha a categoria do seu I-140 e seu país de nascimento, e compare cada data de corte que enviarmos com essa data.`,
      category: "Categoria",
      country: "País de nascimento",
      countries: { worldwide: "Todos os países (resto do mundo)", india: "Índia", china: "China", mexico: "México", philippines: "Filipinas" },
      otherWorkers: "EB-3 Outros trabalhadores",
      unreserved: "EB-5 (não reservada)",
      button: "Avisar quando mudar",
      after: "Depois de confirmar, você terá notícias nossas quando um boletim novo mover sua data de corte, e só então.",
    },
  },
  ko: {
    replyHeading: (q) => (q ? "이메일이 잠시 대기 중입니다" : "받은편지함을 확인해 주세요"),
    email: "이메일",
    failed: "문제가 생겼습니다. 잠시 후 다시 시도해 주세요.",
    dropped: "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    queue: {
      heading: "노동부가 내 접수 월에 도달하면 알려 주세요",
      whatPerm: "노동부의 분석관 심사(ANALYST REVIEW) 대기열이 케이스 접수 월에 도달하면 이메일 한 통을 보내고, 그 뒤로는 보내지 않습니다.",
      whatPwd: "선택한 적정 임금 대기열이 신청 접수 월에 도달하면 이메일 한 통을 보내고, 그 뒤로는 보내지 않습니다.",
      month: (perm) => `${perm ? "케이스" : "신청"} 접수 월`,
      pick: "월 선택",
      reached: (label) => `${label} (이미 도달)`,
      whichQueue: "적정 임금 대기열",
      oews: "OEWS, 표준 조사",
      nonOews: "고용주 제출 조사",
      button: "그때 이메일 받기",
      more: "옵션 더 보기",
      youAre: "본인은",
      optional: "(선택)",
      roles: { none: "밝히지 않음", attorney: "변호사 또는 패러리걸", applicant: "케이스 당사자", employer: "스폰서 고용주" },
      oneMonth: "한 주소는 대기열마다 접수 월 하나를 지켜봅니다. 새 월을 고르면 이전 월을 대신합니다.",
    },
    bulletin: {
      heading: "내 컷오프 날짜가 바뀌면 알려 주세요",
      what: "새 비자 공보가 카테고리와 국가의 최종 조치 날짜를 바꾸면, 변경 내용을 담은 이메일 한 통을 보냅니다. 바뀌지 않는 달에는 보내지 않습니다.",
      priority: (d) => `우선일자는 ${d}입니다. I-140의 카테고리와 출생 국가를 고르고, 보내 드리는 각 컷오프 날짜를 이 날짜와 비교해 보세요.`,
      category: "카테고리",
      country: "출생 국가",
      countries: { worldwide: "모든 국가(전 세계)", india: "인도", china: "중국", mexico: "멕시코", philippines: "필리핀" },
      otherWorkers: "EB-3 기타 근로자",
      unreserved: "EB-5(비할당)",
      button: "바뀌면 이메일 받기",
      after: "확인하면 새 공보가 컷오프 날짜를 옮길 때만 연락드립니다.",
    },
  },
  vi: {
    replyHeading: (q) => (q ? "Email của bạn đang chờ trong một hàng ngắn" : "Hãy kiểm tra hộp thư"),
    email: "Email",
    failed: "Đã có lỗi. Hãy thử lại sau giây lát.",
    dropped: "Không kết nối được máy chủ. Hãy thử lại sau giây lát.",
    queue: {
      heading: "Báo cho tôi khi DOL xét đến tháng của tôi",
      whatPerm: "Một email khi hàng chờ thẩm định của chuyên viên (ANALYST REVIEW) của DOL xét đến tháng hồ sơ của bạn được nộp, và không gửi gì thêm.",
      whatPwd: "Một email khi hàng chờ mức lương hiện hành bạn chọn xét đến tháng đơn của bạn được nộp, và không gửi gì thêm.",
      month: (perm) => `Tháng nộp ${perm ? "hồ sơ" : "đơn"}`,
      pick: "Chọn tháng",
      reached: (label) => `${label} (đã xét đến)`,
      whichQueue: "Hàng chờ mức lương hiện hành nào",
      oews: "OEWS, khảo sát tiêu chuẩn",
      nonOews: "Khảo sát do chủ lao động cung cấp",
      button: "Gửi email khi đến lúc",
      more: "Thêm tùy chọn",
      youAre: "Bạn là",
      optional: "(không bắt buộc)",
      roles: { none: "Không muốn nói", attorney: "Luật sư hoặc trợ lý luật", applicant: "Người đứng tên hồ sơ", employer: "Chủ lao động bảo lãnh" },
      oneMonth: "Mỗi địa chỉ theo dõi một tháng nộp cho mỗi hàng chờ; chọn tháng mới sẽ thay tháng cũ.",
    },
    bulletin: {
      heading: "Báo cho tôi khi ngày khóa sổ của tôi thay đổi",
      what: "Khi bản tin thị thực mới thay đổi ngày hành động cuối cùng cho diện và quốc gia của bạn, một email về thay đổi đó. Những tháng không đổi thì không gửi.",
      priority: (d) => `Ngày ưu tiên của bạn là ${d}. Hãy chọn diện ghi trên I-140 và quốc gia nơi sinh, rồi so từng ngày khóa sổ chúng tôi gửi với ngày đó.`,
      category: "Diện",
      country: "Quốc gia nơi sinh",
      countries: { worldwide: "Tất cả quốc gia (toàn cầu)", india: "Ấn Độ", china: "Trung Quốc", mexico: "Mexico", philippines: "Philippines" },
      otherWorkers: "EB-3 Lao động khác",
      unreserved: "EB-5 (không dành riêng)",
      button: "Gửi email khi thay đổi",
      after: "Sau khi xác nhận, chúng tôi chỉ liên hệ khi bản tin mới thay đổi ngày khóa sổ của bạn.",
    },
  },
} satisfies Messages<FormsText>;
