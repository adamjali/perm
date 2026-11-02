import { beforeEach, describe, expect, it, vi } from "vitest";

const socProfile = vi.fn();
vi.mock("@/lib/db/socProfile", () => ({ socProfile }));

const { GET } = await import("../route");

function call(code: string) {
  return GET(new Request(`https://permtracker.app/api/soc/${code}`), { params: Promise.resolve({ code }) });
}

describe("GET /api/soc/<code>", () => {
  beforeEach(() => {
    socProfile.mockReset();
  });

  it("refuses anything that isn't a SOC code before reading", async () => {
    for (const code of ["software", "15-125", "15-1252.0", "x"]) {
      const res = await call(code);
      expect(res.status, code).toBe(400);
      expect(((await res.json()) as { error: string }).error).toMatch(/SOC code/);
    }
    expect(socProfile).not.toHaveBeenCalled();
  });

  it("answers the profile, kept an hour at the edge", async () => {
    socProfile.mockResolvedValue({ soc: "15-1252", title: "Software Developers" });
    const res = await call("15-1252.00");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ soc: "15-1252" });
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
    expect(socProfile).toHaveBeenCalledWith("15-1252.00");
  });

  it("says a code nothing holds is a 404, and a failed read a 503, never the same thing", async () => {
    socProfile.mockResolvedValue(null);
    const missing = await call("99-9999");
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as { error: string }).error).toContain("99-9999");
    socProfile.mockRejectedValue(new Error("down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const failed = await call("15-1252");
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
    expect(failed.status).toBe(503);
    expect(failed.headers.get("Cache-Control")).toBe("no-store");
  });
});
