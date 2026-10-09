import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

let state: unknown;
const createEndpoint = vi.fn();
const mutation = vi.fn(() => Promise.resolve());
vi.mock("convex/react", () => ({
  useQuery: () => state,
  useAction: () => createEndpoint,
  useMutation: () => mutation,
}));
const toast = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
vi.mock("@/lib/toast", () => ({ toast }));

const { default: WebhooksSection } = await import("../WebhooksSection");

const BASE = {
  endpointsAllowed: 5,
  watchesAllowed: 100,
  planLabel: "Plus",
  endpoints: [] as unknown[],
  watches: [] as unknown[],
  deliveries: [] as unknown[],
};

const ENDPOINT = {
  id: "e2",
  url: "https://h.example.com/live",
  events: ["case.status_changed"],
  secretHint: "XyZ=",
  createdAt: 0,
  pausedAt: null,
  pauseReason: null,
  lastDeliveryAt: null,
  lastStatusCode: null,
};

beforeEach(() => {
  state = BASE;
  createEndpoint.mockReset();
  mutation.mockClear();
  toast.error.mockClear();
});

describe("WebhooksSection", () => {
  it("shows a new endpoint's secret once, after it's made", async () => {
    createEndpoint.mockResolvedValue({ ok: true, id: "e1", secret: "whsec_abc" });
    render(<WebhooksSection />);
    fireEvent.change(screen.getByPlaceholderText("https://example.com/hooks/perm"), { target: { value: "https://h.example.com/x" } });
    fireEvent.click(screen.getByRole("button", { name: "Add the endpoint" }));
    await waitFor(() => expect(screen.getByText("whsec_abc")).toBeInTheDocument());
    expect(createEndpoint).toHaveBeenCalledWith({ url: "https://h.example.com/x", events: ["case.status_changed"] });
    expect(screen.getByText(/it isn.t shown again/)).toBeInTheDocument();
  });

  it("says why an endpoint wasn't made", async () => {
    createEndpoint.mockResolvedValue({ ok: false, message: "Webhooks are sent over https only." });
    render(<WebhooksSection />);
    fireEvent.change(screen.getByPlaceholderText("https://example.com/hooks/perm"), { target: { value: "http://x" } });
    fireEvent.click(screen.getByRole("button", { name: "Add the endpoint" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Webhooks are sent over https only."));
  });

  it("tells the owner a paused endpoint keeps its events, and offers to resume it", () => {
    state = {
      ...BASE,
      endpoints: [
        {
          id: "e1",
          url: "https://h.example.com/x",
          events: ["queue.moved"],
          secretHint: "AbC=",
          createdAt: 0,
          pausedAt: Date.UTC(2026, 9, 9, 16, 0),
          pauseReason: "Deliveries failed for 24 hours (last: answered 500).",
          lastDeliveryAt: null,
          lastStatusCode: 500,
        },
      ],
    };
    render(<WebhooksSection />);
    expect(screen.getByText(/Events since then are kept/)).toBeInTheDocument();
    expect(screen.getByText(/12:00 PM ET, Oct 9/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(mutation).toHaveBeenCalledWith({ endpointId: "e1" });
  });

  it("says when the plan's endpoints are all used", () => {
    state = { ...BASE, endpointsAllowed: 1, endpoints: [ENDPOINT] };
    render(<WebhooksSection />);
    expect(screen.getByText(/Delete one to add another/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add the endpoint" })).toBeNull();
  });

  it("says webhooks come with Plus on a plan that has none, and keeps the delete button", () => {
    state = { ...BASE, planLabel: "Free", endpointsAllowed: 0, watchesAllowed: 0, endpoints: [ENDPOINT] };
    render(<WebhooksSection />);
    expect(screen.getAllByText(/Webhooks come with the Plus plan/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Add the endpoint" })).toBeNull();
    expect(screen.queryByText(/Free plan: 0/)).toBeNull();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});
