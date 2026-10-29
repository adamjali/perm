import type { Messages } from "@/lib/i18n/lang";

/** The preferences-link form's own words, in every language the email preferences page is published in. */
export interface PrefsFormText {
  label: string;
  button: string;
  sending: string;
  after: string;
}

export const PREFS_FORM = {
  en: {
    label: "Get your preferences link",
    button: "Email me the link",
    sending: "Sending…",
    after: "The link opens a page listing everything we send to that address, with a switch to turn each one off, or all of them at once.",
  },
  es: {
    label: "Reciba su enlace de preferencias",
    button: "Enviarme el enlace",
    sending: "Enviando…",
    after: "El enlace abre una página con todo lo que enviamos a esa dirección y un interruptor para cancelar cada envío o todos a la vez.",
  },
  zh: {
    label: "获取您的偏好链接",
    button: "把链接发给我",
    sending: "正在发送…",
    after: "该链接会打开一个页面，列出我们发到这个邮箱的全部内容，可以逐项关闭，也可以一次全部关闭。",
  },
  "pt-br": {
    label: "Receba seu link de preferências",
    button: "Enviar o link para mim",
    sending: "Enviando…",
    after: "O link abre uma página com tudo o que enviamos para esse endereço e um botão para cancelar cada envio ou todos de uma vez.",
  },
  ko: {
    label: "설정 링크 받기",
    button: "링크 보내기",
    sending: "보내는 중…",
    after: "링크를 열면 이 주소로 보내는 모든 것이 나오고, 하나씩 또는 한 번에 모두 끌 수 있습니다.",
  },
  vi: {
    label: "Nhận liên kết tùy chọn",
    button: "Gửi liên kết cho tôi",
    sending: "Đang gửi…",
    after: "Liên kết mở một trang liệt kê mọi thứ chúng tôi gửi đến địa chỉ đó, với nút tắt từng mục hoặc tắt tất cả cùng lúc.",
  },
} satisfies Messages<PrefsFormText>;
