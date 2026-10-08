import { describe, expect, it } from "vitest";

import { fromServiceWorkerRegister } from "../exceptionNoise";

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
