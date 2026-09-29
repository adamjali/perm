import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuthContext: () => ({ isSigningOut: false }) }));

import { useQuery } from "convex/react";
import { CaseCapNotice } from "../CaseCapNotice";

describe("CaseCapNotice (silent-limit audit #2)", () => {
  beforeEach(() => vi.mocked(useQuery).mockReset());

  it("renders nothing for an account under the ceiling", () => {
    vi.mocked(useQuery).mockReturnValue({ truncated: false, max: 5000 });
    const { container } = render(<CaseCapNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says the page shows the newest cases when the account is over it", () => {
    vi.mocked(useQuery).mockReturnValue({ truncated: true, max: 5000 });
    render(<CaseCapNotice />);
    expect(screen.getByRole("status")).toHaveTextContent(/more than 5,000 cases/i);
    expect(screen.getByRole("status")).toHaveTextContent(/shows the newest 5,000/i);
    expect(screen.getByRole("link", { name: /support@permtracker\.app/i })).toBeInTheDocument();
  });

  it("uses the page's own flag and skips its query when given one", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    render(<CaseCapNotice truncated />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(vi.mocked(useQuery).mock.calls[0]?.[1]).toBe("skip");
  });
});
