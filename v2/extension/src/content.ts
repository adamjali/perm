/**
 * The content script: on a listed job site, from page load; on any other
 * site, when the toolbar button injects it. See controller.ts for what it
 * does and panel.ts for what it draws.
 */
import { createController } from "./controller";
import { siteFor } from "./extract";
import type { LookupReply } from "./lookup";
import { mountPanel } from "./panel";

declare global {
  interface Window {
    __permTrackerOpen?: () => void;
  }
}

function start(): void {
  // Injected a second time by the toolbar button: open the panel already here.
  if (window.__permTrackerOpen) {
    window.__permTrackerOpen();
    return;
  }
  const manual = !siteFor(new URL(location.href));
  const panel = mountPanel(document, {
    onClose: () => controller.closed(),
    onRetry: () => void controller.open(),
  });
  const controller = createController({
    doc: () => document,
    url: () => new URL(location.href),
    lookup: (name) => chrome.runtime.sendMessage<LookupReply>({ type: "pt-lookup", name }).catch(() => null),
    panel,
    manual,
  });
  window.__permTrackerOpen = () => void controller.open();
  chrome.runtime.onMessage.addListener((message) => {
    if ((message as { type?: unknown } | null)?.type === "pt-show") window.__permTrackerOpen?.();
  });

  void controller.check();
  if (manual) return;
  // Job sites swap postings in place; look again a moment after the page settles.
  let timer: ReturnType<typeof setTimeout> | undefined;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => void controller.check(), 600);
  }).observe(document.body ?? document.documentElement, { childList: true, subtree: true });
}

start();
