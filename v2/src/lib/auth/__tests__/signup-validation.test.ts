import { describe, it, expect } from "vitest";
import {
  validateEmailValue,
  validateNameValue,
  validatePasswordValue,
  validateConfirmPassword,
} from "../signup-validation";

// ---------------------------------------------------------------------------
// validateEmailValue
// ---------------------------------------------------------------------------

describe("validateEmailValue", () => {
  describe("pristine state (untouched)", () => {
    it("returns pristine when empty + untouched", () => {
      expect(validateEmailValue("", false).state).toBe("pristine");
    });

    it("returns invalid when empty + touched", () => {
      const result = validateEmailValue("", true);
      expect(result.state).toBe("invalid");
      expect(result.reason).toBe("EMPTY");
    });
  });

  describe("format check", () => {
    it.each(["adam@example.com", "a@b.c", "user.name+tag@subdomain.example.org"])(
      "accepts %s",
      (email) => {
        expect(validateEmailValue(email, true).state).toBe("valid");
      },
    );

    it.each(["plain", "no@dot", "no-at.dom", "spaces in@email.com", "@nostart.com"])(
      "rejects %s with INVALID_FORMAT",
      (email) => {
        const r = validateEmailValue(email, true);
        expect(r.state).toBe("invalid");
        expect(r.reason).toBe("INVALID_FORMAT");
      },
    );
  });

  it("trims whitespace before validating", () => {
    expect(validateEmailValue("  adam@example.com  ", true).state).toBe("valid");
  });
});

// ---------------------------------------------------------------------------
// validateNameValue
// ---------------------------------------------------------------------------

describe("validateNameValue", () => {
  it("returns pristine for empty + untouched", () => {
    expect(validateNameValue("", false).state).toBe("pristine");
  });

  it("returns valid for empty + touched (name is optional)", () => {
    expect(validateNameValue("", true).state).toBe("valid");
  });

  it("returns valid for legitimate names", () => {
    expect(validateNameValue("Maria Garcia", true).state).toBe("valid");
  });

  it("delegates to checkUserName for URL detection", () => {
    const r = validateNameValue("https://evil.com", true);
    expect(r.state).toBe("invalid");
    expect(r.reason).toBe("CONTAINS_URL");
  });

  it("delegates to checkUserName for emoji detection", () => {
    const r = validateNameValue("Adam 😀", true);
    expect(r.state).toBe("invalid");
    expect(r.reason).toBe("CONTAINS_EMOJI");
  });
});

// ---------------------------------------------------------------------------
// validatePasswordValue
// ---------------------------------------------------------------------------

describe("validatePasswordValue", () => {
  it("returns pristine for empty + untouched", () => {
    expect(validatePasswordValue("", false).state).toBe("pristine");
  });

  it("returns invalid (EMPTY) for empty + touched", () => {
    const r = validatePasswordValue("", true);
    expect(r.state).toBe("invalid");
    expect(r.reason).toBe("EMPTY");
  });

  it("rejects passwords shorter than 8 characters", () => {
    const r = validatePasswordValue("abc", true);
    expect(r.state).toBe("invalid");
    expect(r.reason).toBe("TOO_SHORT");
  });

  it("accepts password exactly 8 characters", () => {
    expect(validatePasswordValue("12345678", true).state).toBe("valid");
  });

  it("accepts longer passwords", () => {
    expect(validatePasswordValue("a-much-stronger-password", true).state).toBe("valid");
  });
});

// ---------------------------------------------------------------------------
// validateConfirmPassword
// ---------------------------------------------------------------------------

describe("validateConfirmPassword", () => {
  it("returns pristine for empty + untouched", () => {
    expect(validateConfirmPassword("", "anything", false).state).toBe("pristine");
  });

  it("returns invalid (EMPTY) for empty + touched", () => {
    const r = validateConfirmPassword("", "real-password", true);
    expect(r.state).toBe("invalid");
    expect(r.reason).toBe("EMPTY");
  });

  it("returns invalid (MISMATCH) when values differ", () => {
    const r = validateConfirmPassword("typo", "real-password", true);
    expect(r.state).toBe("invalid");
    expect(r.reason).toBe("MISMATCH");
  });

  it("returns valid when both match", () => {
    expect(validateConfirmPassword("same", "same", true).state).toBe("valid");
  });

  it("treats empty original password as match-against-empty (typing flow)", () => {
    // Touched + non-empty confirm + empty password: user typed confirm before
    // password — should report mismatch, not crash.
    const r = validateConfirmPassword("anything", "", true);
    expect(r.state).toBe("invalid");
    expect(r.reason).toBe("MISMATCH");
  });
});
