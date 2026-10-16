import { describe, expect, it } from "vitest";

import { fromInjectedBridge, fromInjectedPageScript, fromServiceWorkerRegister } from "../exceptionNoise";

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
