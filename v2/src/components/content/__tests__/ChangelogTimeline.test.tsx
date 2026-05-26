// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../../../../test-utils/render-utils";
import ChangelogTimeline from "../ChangelogTimeline";
import type { PostSummary } from "@/lib/content/types";

// GSAP is lazily dynamic-imported by useScrollStagger and pulls real browser
// globals; stub the hook to a no-op so it doesn't actually run in jsdom.
vi.mock("@/lib/hooks/useGSAP", () => ({
  useScrollStagger: vi.fn(),
}));

// next/image — render a plain <img> so jsdom doesn't choke on optimizer paths.
vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // Strip Next-specific props (fill, sizes, priority) before forwarding.
    const { fill: _fill, sizes: _sizes, priority: _priority, ...rest } = props;
    void _fill;
    void _sizes;
    void _priority;
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...(rest as React.ImgHTMLAttributes<HTMLImageElement>)} />;
  },
}));

function createTestPost(overrides: Partial<PostSummary["meta"]> & { slug?: string } = {}): PostSummary {
  const { slug = "test-slug", ...metaOverrides } = overrides;
  return {
    slug,
    type: "changelog",
    meta: {
      title: "Test Update",
      description: "A test changelog entry.",
      date: "2026-01-15",
      author: "PERM Tracker",
      tags: [],
      readingTime: "1 min read",
      published: true,
      ...metaOverrides,
    },
  };
}

describe("ChangelogTimeline", () => {
  it("each entry has id=slug on its outer wrapper so anchor links scroll to it", () => {
    const posts: PostSummary[] = [
      createTestPost({ slug: "first-entry", title: "First" }),
      createTestPost({ slug: "second-entry", title: "Second" }),
    ];

    renderWithProviders(<ChangelogTimeline posts={posts} />);

    expect(document.getElementById("first-entry")).not.toBeNull();
    expect(document.getElementById("second-entry")).not.toBeNull();
  });

  it("renders <time dateTime> matching raw ISO for published, and a second <time> for updated when present", () => {
    const post = createTestPost({
      slug: "with-updated",
      date: "2026-01-15",
      updated: "2026-03-04",
    });

    const { container } = renderWithProviders(<ChangelogTimeline posts={[post]} />);

    const times = container.querySelectorAll("time");
    expect(times.length).toBe(2);
    expect(times[0]!.getAttribute("datetime")).toBe("2026-01-15");
    expect(times[1]!.getAttribute("datetime")).toBe("2026-03-04");
  });

  it("does NOT render an 'Updated' label when meta.updated equals meta.date or is undefined", () => {
    const posts: PostSummary[] = [
      createTestPost({ slug: "same-dates", date: "2026-01-15", updated: "2026-01-15" }),
      createTestPost({ slug: "no-updated", date: "2026-02-20" }),
    ];

    renderWithProviders(<ChangelogTimeline posts={posts} />);

    expect(screen.queryByText(/^updated$/i)).not.toBeInTheDocument();
  });

  it("renders an 'Updated' label and second <time> when meta.updated differs from meta.date", () => {
    const post = createTestPost({
      slug: "edited",
      date: "2026-01-15",
      updated: "2026-03-04",
    });

    const { container } = renderWithProviders(<ChangelogTimeline posts={[post]} />);

    expect(screen.getByText(/updated/i)).toBeInTheDocument();
    expect(container.querySelectorAll("time")).toHaveLength(2);
  });
});
