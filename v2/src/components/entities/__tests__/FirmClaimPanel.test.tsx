import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { FirmClaimPanel } from "../FirmClaimPanel";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example.convex.cloud");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, message: "Check your inbox." }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("FirmClaimPanel", () => {
  it("checks the rules before sending: a link in the description never leaves the browser", async () => {
    render(<FirmClaimPanel slug="smith-immigration-pllc" firmName="Smith Immigration PLLC" claimed={false} />);
    fill(/Your work email/, "jane@smithlaw.com");
    fill(/Your role at the firm/, "Partner");
    fill(/About the firm/, "See www.smithlaw.com for more");
    fireEvent.submit(screen.getByRole("form", { name: "Claim this firm's page" }));
    await waitFor(() => expect(screen.getByText(/Leave links/)).toBeTruthy());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the slug and the fields, never a firm name, to the claim route", async () => {
    render(<FirmClaimPanel slug="smith-immigration-pllc" firmName="Smith Immigration PLLC" claimed={false} />);
    fill(/Your work email/, "jane@smithlaw.com");
    fill(/Your role at the firm/, "Partner");
    fill(/Languages/, "Spanish, Mandarin");
    fill(/Offices/, "Tampa, FL");
    fireEvent.click(screen.getByLabelText("PERM"));
    fireEvent.submit(screen.getByRole("form", { name: "Claim this firm's page" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://example.convex.site/firm-claim/request");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toMatchObject({
      email: "jane@smithlaw.com",
      role: "Partner",
      slug: "smith-immigration-pllc",
      profile: { languages: ["Spanish", "Mandarin"], offices: [{ city: "Tampa", state: "FL" }], focus: ["perm"] },
    });
    expect(JSON.stringify(body)).not.toContain("Smith Immigration PLLC");
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Check your inbox."));
  });

  it("asks for an edit link with the address and the slug only", async () => {
    render(<FirmClaimPanel slug="smith-immigration-pllc" firmName="Smith Immigration PLLC" claimed />);
    fireEvent.change(screen.getByLabelText("The address you claimed with"), { target: { value: "jane@smithlaw.com" } });
    fireEvent.submit(screen.getByRole("form", { name: "Get a link to edit this firm's profile" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("https://example.convex.site/firm-claim/edit-link");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ email: "jane@smithlaw.com", slug: "smith-immigration-pllc" });
  });
});
