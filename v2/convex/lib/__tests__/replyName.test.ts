import { describe, expect, it } from "vitest";
import { replyGreetingName } from "../replyName";

describe("replyGreetingName", () => {
  it("greets by the first word of the display name", () => {
    expect(replyGreetingName("Jane Q Example", "jane.example@mail.test")).toBe("Jane");
    expect(replyGreetingName("Example, Jane", "x@mail.test")).toBe("Jane");
    expect(replyGreetingName('"Jane Example"', "x@mail.test")).toBe("Jane");
  });

  it("fixes a name typed all in one case and keeps mixed case", () => {
    expect(replyGreetingName("JANE EXAMPLE", "x@mail.test")).toBe("Jane");
    expect(replyGreetingName("jane example", "x@mail.test")).toBe("Jane");
    expect(replyGreetingName("McKenna Example", "x@mail.test")).toBe("McKenna");
  });

  it("reads a name from the address when there's no display name, never the whole local part", () => {
    expect(replyGreetingName(undefined, "jane.example@mail.test")).toBe("Jane");
    expect(replyGreetingName("", "jane_example99@mail.test")).toBe("Jane");
  });

  it("says 'there' when nothing reads as a name", () => {
    expect(replyGreetingName(undefined, "j1234@mail.test")).toBe("there");
    expect(replyGreetingName("support@mail.test", "info@mail.test")).toBe("Info");
    expect(replyGreetingName("1234", "9@mail.test")).toBe("there");
  });
});
