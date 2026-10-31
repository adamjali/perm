import { describe, expect, it } from "vitest";

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  fromBrowserExtension,
  fromExtensionMessage,
  fromInjectedBridge,
  fromInjectedPageScript,
  fromServiceWorkerRegister,
  sentryEventFromInjectedPageScript,
  serverEventFromStrayPost,
} from "../exceptionNoise";

const frames = (...fns: string[]) => ({ $exception_list: [{ stacktrace: { frames: fns.map((f) => ({ function: f })) } }] });

describe("fromServiceWorkerRegister", () => {
  it("drops the browser's own registration failure", () => {
    expect(fromServiceWorkerRegister(frames("ServiceWorkerContainer.register"), "Rejected")).toBe(true);
  });

  it("drops Serwist's register() reading a registration that never came", () => {
    expect(fromServiceWorkerRegister(frames("s.register"), "Cannot read properties of undefined (reading 'waiting')")).toBe(true);
    expect(fromServiceWorkerRegister(frames("t.register"), "undefined is not an object (evaluating 'e.installing')")).toBe(true);
  });

  it("keeps any other error thrown from a register(), and the same message from elsewhere", () => {
    expect(fromServiceWorkerRegister(frames("s.register"), "Cannot read properties of undefined (reading 'call')")).toBe(false);
    expect(fromServiceWorkerRegister(frames("Object.onClick"), "Cannot read properties of undefined (reading 'waiting')")).toBe(false);
    expect(fromServiceWorkerRegister(undefined, "Cannot read properties of undefined (reading 'waiting')")).toBe(false);
  });
});

describe("fromInjectedBridge", () => {
  it("drops a wallet's or an app's own bridge, as Safari words it", () => {
    expect(fromInjectedBridge("undefined is not an object (evaluating 'window.ethereum.selectedAddress = undefined')")).toBe(true);
    expect(fromInjectedBridge("undefined is not an object (evaluating 'window.webkit.messageHandlers')")).toBe(true);
    expect(fromInjectedBridge("Error invoking postMessage: Java object is gone")).toBe(true);
    expect(
      fromInjectedBridge(
        "undefined is not an object (evaluating 'top.webkit.messageHandlers.foregroundToBackground.postMessage')",
      ),
    ).toBe(true);
  });

  it("keeps errors that only share a word", () => {
    expect(fromInjectedBridge("Cannot read properties of undefined (reading 'call')")).toBe(false);
    expect(fromInjectedBridge("window.ethereumish is not defined")).toBe(false);
    expect(fromInjectedBridge("webkitRequestFullscreen is not a function")).toBe(false);
    expect(fromInjectedBridge()).toBe(false);
  });
});

describe("fromInjectedPageScript", () => {
  const CHROME_IOS =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0.0.0 Mobile/15E148 Safari/604.1";
  const SAFARI_IOS =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1";
  const at = (...files: string[]) => ({ $exception_list: [{ stacktrace: { frames: files.map((filename) => ({ filename, function: "Ik" })) } }] });

  it("drops Chrome for iPhone's own scripts, filed under the page's address", () => {
    expect(fromInjectedPageScript(at("https://permtracker.app/case-search", "https://permtracker.app/case-search"), CHROME_IOS)).toBe(true);
    expect(fromInjectedPageScript(at("https://permtracker.app/perm-employers/bartlett-foods-llc?ref=x"), CHROME_IOS)).toBe(true);
  });

  it("keeps anything that ran in one of the site's script files", () => {
    expect(fromInjectedPageScript(at("https://permtracker.app/case-search", "https://permtracker.app/_next/static/chunks/app-1.js"), CHROME_IOS)).toBe(false);
    expect(fromInjectedPageScript(at("https://permtracker.app/sw.js"), CHROME_IOS)).toBe(false);
  });

  it("keeps the same shape from any other browser, and an error with no frames", () => {
    expect(fromInjectedPageScript(at("https://permtracker.app/case-search"), SAFARI_IOS)).toBe(false);
    expect(fromInjectedPageScript({ $exception_list: [{}] }, CHROME_IOS)).toBe(false);
    expect(fromInjectedPageScript(at(""), CHROME_IOS)).toBe(false);
    expect(fromInjectedPageScript(undefined, CHROME_IOS)).toBe(false);
  });
});

describe("sentryEventFromInjectedPageScript", () => {
  const CHROME_IOS =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0.8059 Mobile/15E148 Safari/604.1";
  const SAFARI_IOS =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Mobile/15E148 Safari/604.1";
  const event = (...files: string[]) => ({
    exception: { values: [{ stacktrace: { frames: files.map((filename) => ({ filename, function: "Hk" })) } }] },
  });

  it("drops Sentry 5E: Chrome for iPhone, every frame on a page document as Sentry names it", () => {
    const page = "app:///perm-employers/merritt-hospitality-llc";
    expect(sentryEventFromInjectedPageScript(event(page, page, page), CHROME_IOS)).toBe(true);
    expect(sentryEventFromInjectedPageScript(event("https://permtracker.app/signup"), CHROME_IOS)).toBe(true);
  });

  it("keeps an error with one frame in the site's own scripts, or from any other browser", () => {
    expect(
      sentryEventFromInjectedPageScript(
        event("app:///perm-employers/x", "app:///_next/static/chunks/app/page-1.js"),
        CHROME_IOS,
      ),
    ).toBe(false);
    expect(sentryEventFromInjectedPageScript(event("app:///sw.js"), CHROME_IOS)).toBe(false);
    expect(sentryEventFromInjectedPageScript(event("app:///perm-employers/x"), SAFARI_IOS)).toBe(false);
    expect(sentryEventFromInjectedPageScript({ exception: { values: [{}] } }, CHROME_IOS)).toBe(false);
    expect(sentryEventFromInjectedPageScript(undefined, CHROME_IOS)).toBe(false);
  });
});

describe("fromBrowserExtension", () => {
  const ex = (...files: string[]) => ({ $exception_list: [{ stacktrace: { frames: files.map((filename) => ({ filename })) } }] });
  const honey =
    "file:///Applications/PayPal%20Honey.app/Contents/PlugIns/Extension.appex/Contents/Resources/Honey.safariextension/h0.js";

  it("drops an error thrown wholly inside an extension's own files", () => {
    expect(fromBrowserExtension(ex(honey, honey))).toBe(true);
    expect(fromBrowserExtension(ex("chrome-extension://abcdefghijklmnopabcdefghijklmnop/content.js"))).toBe(true);
    expect(fromBrowserExtension(ex("safari-web-extension://A1B2/script.js"))).toBe(true);
  });

  it("keeps an error with any frame of ours, or no frames at all", () => {
    expect(fromBrowserExtension(ex(honey, "https://permtracker.app/_next/static/chunks/app.js"))).toBe(false);
    expect(fromBrowserExtension(ex("https://permtracker.app/_next/static/chunks/app.js"))).toBe(false);
    expect(fromBrowserExtension({ $exception_list: [] })).toBe(false);
    expect(fromBrowserExtension(undefined)).toBe(false);
  });
});

describe("fromExtensionMessage", () => {
  it("drops errors that name the extension messaging API or the iPhone extension's variables", () => {
    expect(fromExtensionMessage("Invalid call to runtime.sendMessage(). Tab not found.")).toBe(true);
    expect(fromExtensionMessage("Could not establish connection: runtime.connect failed")).toBe(true);
    expect(fromExtensionMessage("Cannot read properties of undefined (reading 'id') at chrome.runtime")).toBe(true);
    expect(
      fromExtensionMessage(
        "self.smartRules.filter is not a function. (In 'self.smartRules.filter(item => {return item && item.url != self.curSiteRule.url})', 'self.smartRules.filter' is undefined)",
      ),
    ).toBe(true);
    expect(fromExtensionMessage("Can't find variable: DarkReader")).toBe(true);
    expect(fromExtensionMessage("DarkReader is not defined")).toBe(true);
  });

  it("keeps ordinary errors, and words that only look alike", () => {
    expect(fromExtensionMessage("Cannot read properties of undefined (reading 'call')")).toBe(false);
    expect(fromExtensionMessage("smartRulesEngine failed")).toBe(false);
    expect(fromExtensionMessage("Can't find variable: DarkReaderTheme")).toBe(false);
    expect(fromExtensionMessage("runtime.sendMessages is not defined")).toBe(false);
    expect(fromExtensionMessage("")).toBe(false);
  });

  it("names APIs this site's own code never calls, so the filter can't hide one of ours", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx|js|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name) && !p.endsWith("exceptionNoise.ts")) files.push(p);
      }
    };
    walk(join(process.cwd(), "src"));
    expect(files.length).toBeGreaterThan(500);
    const hits = files.filter((f) =>
      /\b(?:runtime\.(?:sendMessage|connect)|(?:chrome|browser)\.runtime)\b|\b(?:smartRules|curSiteRule|DarkReader)\b/.test(readFileSync(f, "utf8")),
    );
    expect(hits).toEqual([]);
  });
});

describe("serverEventFromStrayPost", () => {
  const event = (method: string, url: string, value: string) => ({
    request: { method, url },
    exception: { values: [{ type: "TypeError", value }] },
  });

  it("drops the malformed form body an exploit probe sent to a page that doesn't exist (Sentry 5F)", () => {
    const url = "https://permtracker.app/logupload?logMetaData=%7B%22itrLogPath%22%3A+%22..%2F..%22%7D";
    expect(serverEventFromStrayPost(event("POST", url, "Failed to parse body as FormData."))).toBe(true);
  });

  it("drops Next's RSC invariant from a POST to the homepage (Sentry 5B)", () => {
    const value = "Invariant: Expected RSC response, got text/plain. This is a bug in Next.js.";
    expect(serverEventFromStrayPost(event("POST", "https://permtracker.app/?_rsc=MhcDH", value))).toBe(true);
  });

  it("keeps the same errors from routes that take POSTs on purpose", () => {
    for (const path of ["/api/auth", "/v1/cases", "/mcp", "/api/chat"]) {
      expect(serverEventFromStrayPost(event("POST", `https://permtracker.app${path}`, "Failed to parse body as FormData.")), path).toBe(false);
    }
  });

  it("keeps any other error, and any GET", () => {
    expect(serverEventFromStrayPost(event("POST", "https://permtracker.app/", "database query deadline (20000ms)"))).toBe(false);
    expect(serverEventFromStrayPost(event("GET", "https://permtracker.app/", "Failed to parse body as FormData."))).toBe(false);
    expect(serverEventFromStrayPost(undefined)).toBe(false);
  });
});
