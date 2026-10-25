/**
 * The spam check holds selling and lets people through, in any language. The
 * spam below has the shapes support@ received Feb 12 to Oct 23 2026 (written
 * fresh here: no real sender or message is copied). The real messages are the
 * kinds of thing people write to us, several of them not in English.
 *
 * Measured on all 130 stored messages before it shipped: the rules alone held
 * 23 spam messages and no real person's message; every real message scored 0.
 */
import { describe, expect, it } from "vitest";

import {
  aiUserPrompt,
  HOLD_AT,
  isNoticeSender,
  linkHosts,
  readAiAnswer,
  ruleScore,
  senderKey,
  verdictFor,
  type MailForCheck,
} from "./spamCheck";

const NONE = { allowed: false, blocked: false, answersUs: false };

const SPAM: Array<[string, MailForCheck]> = [
  [
    "a link-selling pitch with a messenger handle",
    {
      from: "outreach@growthlinks.example",
      subject: "Guest posts on high-DR sites",
      text: "We offer do-follow backlinks and guest posts. Message us on WhatsApp for the price list.",
    },
  ],
  [
    "a launch-directory pitch from a bulk sender",
    {
      from: "hello@launchlist.example",
      subject: "Get featured on our curated directory",
      text: "List your product on our curated directory and get featured on the front page. https://a.example https://b.example https://c.example",
      listUnsubscribe: "<mailto:unsub@launchlist.example>",
    },
  ],
  [
    "a fake domain renewal with replies elsewhere",
    {
      from: "billing@domain-notice.example",
      subject: "RENEWAL NOTICE: PERMTRACKER.APP",
      text: "Your domain permtracker.app is about to expire. Renew now to keep your listing.",
      replyTo: "pay@other-host.example",
    },
  ],
  [
    "a lead list for sale",
    {
      from: "data@leads.example",
      subject: "Attendee list",
      text: "We have the verified attendee list for the expo, 12,000 contacts, leads for sale at a discount.",
    },
  ],
  [
    "a link typed into the name",
    {
      from: "noreply@mailer.example",
      fromName: "Claim your prize at win-now.xyz",
      subject: "You have won",
      text: "Click to claim.",
    },
  ],
  [
    "an upstream spam flag and a loan pitch",
    {
      from: "offers@fast-funds.example",
      subject: "Business funding",
      text: "Pre-approved loan for your company. Credit facility up to $500,000.",
      spamFlag: "YES",
    },
  ],
  [
    "a Japanese fake delivery notice with a messenger push",
    {
      from: "system@mail-host.example",
      subject: "メール配信エラー",
      text: "お客様のメールは配信されませんでした。詳細は Telegram でご確認ください。",
    },
  ],
];

const REAL: Array<[string, MailForCheck]> = [
  [
    "a question about a pending case",
    {
      from: "maria.lopez@gmail.com",
      fromName: "Maria Lopez",
      subject: "My PERM case shows analyst review",
      text: "Hi, my case G-100-25350-123456 has said analyst review since March. Is that normal? Thank you.",
    },
  ],
  [
    "a removal request that names contact data",
    {
      from: "a.person@example.org",
      subject: "Please remove my name",
      text: "Please remove my name and contact data from your employer page. It is a small family business.",
    },
  ],
  [
    "a reply to us",
    {
      from: "owner@smallfirm.example",
      subject: "Re: your note",
      text: "Thanks for writing back. We will try the alert.",
      thread: "<abc@permtracker.app>",
    },
  ],
  ["Chinese", { from: "wang@qq.com", subject: "关于我的PERM案件", text: "您好，我的案件已经等了十个月，请问什么时候会有结果？谢谢。" }],
  ["Korean", { from: "kim@naver.com", subject: "PERM 진행 상황 문의", text: "안녕하세요. 제 케이스가 아직 진행 중인데 언제쯤 결과가 나올까요?" }],
  ["Vietnamese", { from: "nguyen@gmail.com", subject: "Hỏi về hồ sơ PERM", text: "Xin chào, hồ sơ của tôi nộp tháng 12 năm 2025. Khi nào có kết quả ạ?" }],
  ["Spanish", { from: "jose@hotmail.com", subject: "Pregunta sobre mi caso", text: "Hola, ¿cuánto tarda el Departamento de Trabajo en decidir un caso PERM?" }],
  [
    "a person whose code didn't arrive",
    {
      from: "late.signup@gmail.com",
      subject: "Verification code",
      text: "I tried to sign up but the verification code never arrived. Can you help?",
    },
  ],
];

describe("the rules", () => {
  it.each(SPAM)("hold %s", (_label, mail) => {
    const v = verdictFor(mail, NONE);
    expect(v.action).toBe("hold");
    expect(v.score).toBeGreaterThanOrEqual(HOLD_AT);
    expect(v.reasons.length).toBeGreaterThan(0);
  });

  it.each(REAL)("let through %s", (_label, mail) => {
    expect(verdictFor(mail, NONE).action).toBe("forward");
  });

  it("count a pitch at 2, never enough to hold alone", () => {
    const one = ruleScore({ from: "x@y.example", subject: "Website redesign", text: "We do web design." });
    expect(one.score).toBe(2);
    expect(verdictFor({ from: "x@y.example", subject: "Website redesign", text: "We do web design." }, NONE).action).toBe(
      "forward",
    );
  });

  it("count at most three pitches", () => {
    const text = "SEO backlinks, web design, loan offers, wholesale factory quotation, lottery winnings";
    expect(ruleScore({ from: "x@y.example", subject: "Hi", text }).score).toBe(2 + 1 + 1);
  });
});

describe("Cloudflare's AI opinion", () => {
  const onePitch: MailForCheck = { from: "x@y.example", subject: "Web design", text: "We do web design for law firms." };

  it("tips a one-pitch message over, but can't hold a clean one alone", () => {
    expect(verdictFor(onePitch, NONE, "spam").action).toBe("hold");
    expect(verdictFor(REAL[0]![1], NONE, "spam")).toMatchObject({ action: "forward", score: 2 });
  });

  it("can rescue a weak score and never a strong one", () => {
    const code = REAL.find(([label]) => label.includes("code"))![1];
    expect(verdictFor(code, NONE, "spam").action).toBe("hold");
    expect(verdictFor(code, NONE, "not_spam").action).toBe("forward");
    expect(verdictFor(SPAM[0]![1], NONE, "not_spam").action).toBe("hold");
  });

  it("is read from the model's JSON, anything else is unsure", () => {
    expect(readAiAnswer('{"verdict":"spam"}')).toBe("spam");
    expect(readAiAnswer({ verdict: "not_spam" })).toBe("not_spam");
    expect(readAiAnswer("spam")).toBe("unsure");
    expect(readAiAnswer({ verdict: "SPAM" })).toBe("unsure");
    expect(readAiAnswer(null)).toBe("unsure");
  });

  it("is shown the sender's domain, never the address, and only the start of the text", () => {
    const prompt = aiUserPrompt({ from: "someone@private.example", subject: "Hi", text: "x".repeat(5_000) });
    expect(prompt).toContain("private.example");
    expect(prompt).not.toContain("someone@");
    expect(prompt.length).toBeLessThan(1_700);
  });
});

describe("the owner's word and replies", () => {
  it("lets a reply to us through whatever it says", () => {
    expect(verdictFor(SPAM[0]![1], { ...NONE, answersUs: true }).action).toBe("forward");
  });

  it("lets an allowed sender through and holds a blocked one", () => {
    expect(verdictFor(SPAM[0]![1], { ...NONE, allowed: true }).action).toBe("forward");
    expect(verdictFor(REAL[0]![1], { ...NONE, blocked: true }).action).toBe("hold");
  });

  it("files a service's notices", () => {
    expect(isNoticeSender("noreply@medium.com")).toBe(true);
    expect(isNoticeSender("digest@email.medium.com")).toBe(true);
    expect(isNoticeSender("medium.com@evil.example")).toBe(false);
    expect(verdictFor({ from: "noreply@medium.com", subject: "Your stats", text: "", listUnsubscribe: "x" }, NONE).action).toBe(
      "notice",
    );
  });

  it("lets a service we hold an account with through, even when it reads like a renewal pitch", () => {
    const oracle: MailForCheck = {
      from: "noreply@identity.oci.oraclecloud.com",
      subject: "Your account is about to expire",
      text: "Renew now: https://a.example https://b.example https://c.example https://d.example",
    };
    expect(verdictFor(oracle, NONE, "spam")).toMatchObject({ action: "forward", reasons: ["a service this site has an account with"] });
    // A lookalike domain gets no such pass.
    expect(verdictFor({ ...oracle, from: "noreply@oraclecloud.com.renew-now.example" }, NONE).action).toBe("hold");
    // The owner's word still wins over the list.
    expect(verdictFor(oracle, { ...NONE, blocked: true }).action).toBe("hold");
  });

  it("keys free mail by address and a company by its domain", () => {
    expect(senderKey("Person@Gmail.com")).toBe("person@gmail.com");
    expect(senderKey("sales@vendor.example")).toBe("@vendor.example");
  });
});

describe("linkHosts", () => {
  it("counts distinct sites, not links", () => {
    expect(linkHosts("https://www.a.example/x https://a.example/y http://b.example").sort()).toEqual(["a.example", "b.example"]);
  });
});
