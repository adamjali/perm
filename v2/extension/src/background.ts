/**
 * The service worker: answers the content script's lookups, and the toolbar
 * button.
 *
 * The lookup is made here rather than in the page, so the request goes from
 * the extension to permtracker.app with no cookies and nothing from the page
 * but the employer's name.
 *
 * The toolbar button shows the panel again on a listed job site. On any other
 * site it reads the posting there, once, using the access Chrome grants for
 * that one click (activeTab); nothing runs on other sites otherwise.
 */
import { createLookup } from "./lookup";
import { EXTENSION_VERSION } from "./manifest";

const lookup = createLookup({
  fetch: (input, init) => fetch(input, init),
  store: chrome.storage.session,
  version: EXTENSION_VERSION,
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const m = message as { type?: unknown; name?: unknown } | null;
  if (m?.type !== "pt-lookup" || typeof m.name !== "string" || m.name.length > 200) return;
  void lookup(m.name).then(sendResponse);
  return true;
});

chrome.action.onClicked.addListener((tab) => {
  const tabId = tab.id;
  if (tabId === undefined) return;
  void chrome.tabs
    .sendMessage(tabId, { type: "pt-show" })
    .catch(() => chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }))
    .catch(() => undefined);
});
