/**
 * The few Chrome extension APIs this extension calls, declared by hand so the
 * build needs no @types/chrome package. Shapes follow the Chrome Extensions
 * reference (developer.chrome.com/docs/extensions/reference/api).
 */
declare namespace chrome {
  namespace runtime {
    interface MessageSender {
      tab?: { id?: number; url?: string };
    }
    function sendMessage<T = unknown>(message: unknown): Promise<T>;
    const onMessage: {
      addListener(
        cb: (message: unknown, sender: MessageSender, sendResponse: (response?: unknown) => void) => boolean | void,
      ): void;
    };
  }
  namespace storage {
    const session: {
      get(key: string): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  }
  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
    }
    function sendMessage<T = unknown>(tabId: number, message: unknown): Promise<T>;
  }
  namespace action {
    const onClicked: { addListener(cb: (tab: chrome.tabs.Tab) => void): void };
  }
  namespace scripting {
    function executeScript(injection: { target: { tabId: number }; files: string[] }): Promise<unknown[]>;
  }
}
