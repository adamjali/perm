import type { MailMessages } from "../../lib/i18n/mailLang";

/** The words every email's frame carries (EmailLayout), in each language an email is written in. */
export interface LayoutText {
  /** Account mail's footer, when a template gives none. */
  defaultFooter: string;
  /** Account mail's settings link. */
  settings: string;
  /** Subscriber mail's link to the emailed preferences page. */
  preferences: string;
  stopAlerts: string;
  open: string;
  privacy: string;
  terms: string;
  rights: string;
}

export const LAYOUT_TEXT: MailMessages<LayoutText> = {
  en: {
    defaultFooter: "You're receiving this email because you have notifications enabled for your PERM Tracker account.",
    settings: "Manage notification settings",
    preferences: "Email preferences",
    stopAlerts: "Stop these alerts",
    open: "Open PERM Tracker",
    privacy: "Privacy",
    terms: "Terms",
    rights: "All rights reserved.",
  },
  es: {
    defaultFooter: "Recibe este correo porque tiene las notificaciones activadas en su cuenta de PERM Tracker.",
    settings: "Administrar notificaciones",
    preferences: "Preferencias de correo",
    stopAlerts: "Dejar de recibir estas alertas",
    open: "Abrir PERM Tracker",
    privacy: "Privacidad",
    terms: "Términos",
    rights: "Todos los derechos reservados.",
  },
  zh: {
    defaultFooter: "您收到这封邮件，是因为您的 PERM Tracker 账户开启了通知。",
    settings: "管理通知设置",
    preferences: "邮件偏好",
    stopAlerts: "停止这些提醒",
    open: "打开 PERM Tracker",
    privacy: "隐私",
    terms: "条款",
    rights: "保留所有权利。",
  },
  "pt-br": {
    defaultFooter: "Você recebe este e-mail porque as notificações estão ativadas na sua conta do PERM Tracker.",
    settings: "Gerenciar notificações",
    preferences: "Preferências de e-mail",
    stopAlerts: "Parar estes alertas",
    open: "Abrir o PERM Tracker",
    privacy: "Privacidade",
    terms: "Termos",
    rights: "Todos os direitos reservados.",
  },
  ko: {
    defaultFooter: "PERM Tracker 계정에서 알림을 켜 두셨기 때문에 이 이메일을 받으셨습니다.",
    settings: "알림 설정 관리",
    preferences: "이메일 설정",
    stopAlerts: "이 알림 그만 받기",
    open: "PERM Tracker 열기",
    privacy: "개인정보",
    terms: "이용약관",
    rights: "모든 권리 보유.",
  },
  vi: {
    defaultFooter: "Bạn nhận được email này vì tài khoản PERM Tracker của bạn đang bật thông báo.",
    settings: "Quản lý cài đặt thông báo",
    preferences: "Tùy chọn email",
    stopAlerts: "Ngừng nhận các thông báo này",
    open: "Mở PERM Tracker",
    privacy: "Quyền riêng tư",
    terms: "Điều khoản",
    rights: "Bảo lưu mọi quyền.",
  },
};
