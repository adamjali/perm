import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageLanguage } from "../PageLanguage";

describe("PageLanguage", () => {
  it("declares the page's language while it's shown and hands the old one back", () => {
    document.documentElement.lang = "en";
    const { unmount } = render(<PageLanguage tag="ko" />);
    expect(document.documentElement.lang).toBe("ko");
    unmount();
    expect(document.documentElement.lang).toBe("en");
  });
});
