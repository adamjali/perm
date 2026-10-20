import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { StorageBlockedNotice } from "../StorageBlockedNotice";

/** The sign-in pages say why sign-in can't stick when the browser blocks this
 *  site's storage (src/lib/storageGuard.ts), and say nothing otherwise. */
describe("StorageBlockedNotice", () => {
  afterEach(() => {
    delete (window as { __ptStorageBlocked?: boolean }).__ptStorageBlocked;
  });

  it("says nothing in a browser that allows storage", () => {
    const { container } = render(<StorageBlockedNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names the problem and the fix when the guard stepped in", () => {
    (window as { __ptStorageBlocked?: boolean }).__ptStorageBlocked = true;
    render(<StorageBlockedNotice />);
    const note = screen.getByRole("status");
    expect(note).toHaveTextContent(/blocking cookies and site data for permtracker\.app/);
    expect(note).toHaveTextContent(/reload this page/);
  });
});
