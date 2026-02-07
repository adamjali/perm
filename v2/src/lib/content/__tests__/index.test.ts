import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ContentType, PostMeta, PostSummary } from "../types";

// ---------------------------------------------------------------------------
// Module mocks — vi.hoisted ensures these are available when vi.mock factories run
// ---------------------------------------------------------------------------

const {
  mockExistsSync,
  mockReaddirSync,
  mockReadFileSync,
  mockMatter,
  mockReadingTime,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockMatter: vi.fn(),
  mockReadingTime: vi.fn(),
}));

vi.mock("fs", () => ({
  default: {
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync,
    readFileSync: mockReadFileSync,
  },
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  readFileSync: mockReadFileSync,
}));

vi.mock("gray-matter", () => ({
  default: mockMatter,
}));

vi.mock("reading-time", () => ({
  default: mockReadingTime,
}));

// Import module under test AFTER mocks are defined
import {
  getPostSlugs,
  getPostBySlug,
  getAllPosts,
  getRelatedPosts,
  getAllTags,
  getFeaturedPosts,
} from "../index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONTENT_DIR = `${process.cwd()}/content`;

function createTestMeta(overrides: Partial<PostMeta> = {}): PostMeta {
  return {
    title: "Test Post",
    description: "A test description.",
    date: "2025-06-15",
    author: "PERM Tracker Team",
    tags: ["perm", "immigration"],
    readingTime: "3 min read",
    published: true,
    featured: false,
    ...overrides,
  };
}

/**
 * Set up a mock filesystem for a single content type directory.
 */
function setupMockDir(type: ContentType, files: string[]) {
  const existingPaths = new Set<string>();
  existingPaths.add(`${CONTENT_DIR}/${type}`);
  for (const file of files) {
    existingPaths.add(`${CONTENT_DIR}/${type}/${file}`);
  }

  mockExistsSync.mockImplementation((p: string) => existingPaths.has(p));
  mockReaddirSync.mockImplementation((p: string) => {
    if (p === `${CONTENT_DIR}/${type}`) return files;
    return [];
  });
  mockReadFileSync.mockImplementation((p: string) => {
    if (existingPaths.has(p)) return "raw mdx content";
    throw new Error(`ENOENT: no such file or directory, open '${p}'`);
  });
}

/**
 * Set up a multi-type filesystem with per-slug frontmatter data.
 * Uses a closure variable to track the last-read path so that
 * the matter mock can return the right data for each file.
 */
function setupMultiTypePosts(
  posts: Array<{
    type: ContentType;
    slug: string;
    data: Record<string, unknown>;
    content?: string;
  }>
) {
  const typeMap: Record<string, string[]> = {};
  const pathToData: Record<string, { data: Record<string, unknown>; content: string }> = {};
  const existingPaths = new Set<string>();

  for (const post of posts) {
    if (!typeMap[post.type]) typeMap[post.type] = [];
    typeMap[post.type].push(`${post.slug}.mdx`);
    const filePath = `${CONTENT_DIR}/${post.type}/${post.slug}.mdx`;
    existingPaths.add(`${CONTENT_DIR}/${post.type}`);
    existingPaths.add(filePath);
    pathToData[filePath] = {
      data: post.data,
      content: post.content ?? "Body",
    };
  }

  mockExistsSync.mockImplementation((p: string) => existingPaths.has(p));
  mockReaddirSync.mockImplementation((p: string) => {
    for (const [type, files] of Object.entries(typeMap)) {
      if (p === `${CONTENT_DIR}/${type}`) return files;
    }
    return [];
  });

  let lastReadPath = "";
  mockReadFileSync.mockImplementation((p: string) => {
    if (pathToData[p]) {
      lastReadPath = p;
      return "raw mdx";
    }
    throw new Error("ENOENT");
  });

  mockMatter.mockImplementation(() => {
    const entry = pathToData[lastReadPath];
    if (entry) return { data: entry.data, content: entry.content };
    return { data: {}, content: "" };
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();

  // Default: fs calls return empty/false
  mockExistsSync.mockReturnValue(false);
  mockReaddirSync.mockReturnValue([]);
  mockReadFileSync.mockReturnValue("");

  // Default gray-matter mock
  mockMatter.mockReturnValue({
    data: {
      title: "Test Post",
      description: "A test description.",
      date: "2025-06-15",
      author: "PERM Tracker Team",
      tags: ["perm", "immigration"],
      published: true,
      featured: false,
    },
    content: "Body content here.",
  });

  // Default reading-time mock
  mockReadingTime.mockReturnValue({
    text: "3 min read",
    minutes: 3,
    time: 180000,
    words: 600,
  });
});

// ---------------------------------------------------------------------------
// getPostSlugs
// ---------------------------------------------------------------------------

describe("getPostSlugs", () => {
  it("returns slugs for existing directory with MDX files", () => {
    setupMockDir("blog", ["first-post.mdx", "second-post.mdx"]);

    const slugs = getPostSlugs("blog");

    expect(slugs).toEqual(["first-post", "second-post"]);
  });

  it("returns empty array for non-existent directory", () => {
    mockExistsSync.mockReturnValue(false);

    const slugs = getPostSlugs("tutorials");

    expect(slugs).toEqual([]);
  });

  it("filters out non-MDX files", () => {
    setupMockDir("guides", [
      "real-guide.mdx",
      "readme.md",
      "draft.txt",
      "image.png",
      "another-guide.mdx",
    ]);

    const slugs = getPostSlugs("guides");

    expect(slugs).toEqual(["real-guide", "another-guide"]);
  });

  it("returns empty array for empty directory", () => {
    setupMockDir("changelog", []);

    const slugs = getPostSlugs("changelog");

    expect(slugs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getPostBySlug
// ---------------------------------------------------------------------------

describe("getPostBySlug", () => {
  it("returns a post with correct meta and content", () => {
    setupMockDir("blog", ["my-post.mdx"]);

    const post = getPostBySlug("blog", "my-post");

    expect(post).not.toBeNull();
    expect(post!.slug).toBe("my-post");
    expect(post!.type).toBe("blog");
    expect(post!.meta.title).toBe("Test Post");
    expect(post!.meta.description).toBe("A test description.");
    expect(post!.meta.date).toBe("2025-06-15");
    expect(post!.meta.author).toBe("PERM Tracker Team");
    expect(post!.meta.tags).toEqual(["perm", "immigration"]);
    expect(post!.meta.readingTime).toBe("3 min read");
    expect(post!.meta.published).toBe(true);
    expect(post!.meta.featured).toBe(false);
    expect(post!.content).toBe("Body content here.");
  });

  it("returns null for non-existent file", () => {
    mockExistsSync.mockReturnValue(false);

    const post = getPostBySlug("blog", "non-existent");

    expect(post).toBeNull();
  });

  it("returns null and logs error when readFileSync throws", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => {
      throw new Error("Permission denied");
    });

    const post = getPostBySlug("blog", "broken");

    expect(post).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      "[content] Failed to read blog/broken.mdx:",
      expect.any(Error)
    );
  });

  it("returns null and logs error when matter() throws a parse error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("invalid frontmatter");
    mockMatter.mockImplementation(() => {
      throw new Error("Invalid YAML");
    });

    const post = getPostBySlug("tutorials", "bad-yaml");

    expect(post).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      "[content] Failed to parse frontmatter in tutorials/bad-yaml.mdx:",
      expect.any(Error)
    );
  });

  it("warns when title is missing and defaults to 'Untitled'", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("raw");
    mockMatter.mockReturnValue({
      data: { date: "2025-01-01", tags: ["test"], published: true },
      content: "Some body",
    });

    const post = getPostBySlug("blog", "no-title");

    expect(post).not.toBeNull();
    expect(post!.meta.title).toBe("Untitled");
    expect(warnSpy).toHaveBeenCalledWith(
      "[content] Missing title in blog/no-title.mdx"
    );
  });

  it("warns when date is missing and defaults to today's date", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("raw");
    mockMatter.mockReturnValue({
      data: { title: "Has Title", tags: ["test"], published: true },
      content: "Body",
    });

    const post = getPostBySlug("blog", "no-date");

    expect(post).not.toBeNull();
    expect(post!.meta.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing date in blog/no-date.mdx")
    );
  });

  it("warns when tags is not an array and defaults to empty array", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("raw");
    mockMatter.mockReturnValue({
      data: { title: "Post", date: "2025-01-01", tags: "not-an-array", published: true },
      content: "Body",
    });

    const post = getPostBySlug("blog", "bad-tags");

    expect(post).not.toBeNull();
    expect(post!.meta.tags).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      "[content] tags should be an array in blog/bad-tags.mdx"
    );
  });

  it("defaults author to 'PERM Tracker Team' when not provided", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("raw");
    mockMatter.mockReturnValue({
      data: { title: "Post", date: "2025-01-01", tags: [], published: true },
      content: "Body",
    });

    const post = getPostBySlug("blog", "no-author");

    expect(post).not.toBeNull();
    expect(post!.meta.author).toBe("PERM Tracker Team");
  });

  it("defaults description to empty string when not provided", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("raw");
    mockMatter.mockReturnValue({
      data: { title: "Post", date: "2025-01-01", tags: [], published: true },
      content: "Body",
    });

    const post = getPostBySlug("blog", "no-desc");

    expect(post).not.toBeNull();
    expect(post!.meta.description).toBe("");
  });

  it("defaults published to true when not explicitly set to false", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("raw");
    mockMatter.mockReturnValue({
      data: { title: "Post", date: "2025-01-01", tags: [] },
      content: "Body",
    });

    const post = getPostBySlug("blog", "pub-default");

    expect(post).not.toBeNull();
    expect(post!.meta.published).toBe(true);
  });

  it("sets published to false when frontmatter has published: false", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("raw");
    mockMatter.mockReturnValue({
      data: { title: "Draft", date: "2025-01-01", tags: [], published: false },
      content: "Body",
    });

    const post = getPostBySlug("blog", "draft");

    expect(post).not.toBeNull();
    expect(post!.meta.published).toBe(false);
  });

  it("defaults featured to false when not provided", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("raw");
    mockMatter.mockReturnValue({
      data: { title: "Post", date: "2025-01-01", tags: [], published: true },
      content: "Body",
    });

    const post = getPostBySlug("blog", "not-featured");

    expect(post).not.toBeNull();
    expect(post!.meta.featured).toBe(false);
  });

  it("includes optional fields when provided", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue("raw");
    mockMatter.mockReturnValue({
      data: {
        title: "Full Post",
        description: "Full description",
        date: "2025-06-15",
        updated: "2025-07-01",
        author: "Custom Author",
        image: "/images/hero.png",
        imageAlt: "Hero image",
        tags: ["perm"],
        category: "filing",
        published: true,
        featured: true,
        seoTitle: "SEO Title Override",
        seoDescription: "SEO desc override",
      },
      content: "Full body",
    });

    const post = getPostBySlug("blog", "full-post");

    expect(post).not.toBeNull();
    expect(post!.meta.updated).toBe("2025-07-01");
    expect(post!.meta.image).toBe("/images/hero.png");
    expect(post!.meta.imageAlt).toBe("Hero image");
    expect(post!.meta.category).toBe("filing");
    expect(post!.meta.featured).toBe(true);
    expect(post!.meta.seoTitle).toBe("SEO Title Override");
    expect(post!.meta.seoDescription).toBe("SEO desc override");
  });
});

// ---------------------------------------------------------------------------
// getAllPosts
// ---------------------------------------------------------------------------

describe("getAllPosts", () => {
  it("returns all published posts sorted by date descending", () => {
    setupMultiTypePosts([
      { type: "blog", slug: "old-post", data: { title: "Old", date: "2024-01-01", tags: [], published: true } },
      { type: "blog", slug: "new-post", data: { title: "New", date: "2025-06-15", tags: [], published: true } },
      { type: "blog", slug: "mid-post", data: { title: "Mid", date: "2024-06-15", tags: [], published: true } },
    ]);

    const posts = getAllPosts("blog");

    expect(posts).toHaveLength(3);
    expect(posts[0].slug).toBe("new-post");
    expect(posts[1].slug).toBe("mid-post");
    expect(posts[2].slug).toBe("old-post");
  });

  it("filters out unpublished posts", () => {
    setupMultiTypePosts([
      { type: "blog", slug: "published", data: { title: "Published", date: "2025-01-01", tags: [], published: true } },
      { type: "blog", slug: "draft", data: { title: "Draft", date: "2025-06-01", tags: [], published: false } },
    ]);

    const posts = getAllPosts("blog");

    expect(posts).toHaveLength(1);
    expect(posts[0].slug).toBe("published");
  });

  it("returns posts from a specific type when type is provided", () => {
    setupMultiTypePosts([
      { type: "blog", slug: "blog-post", data: { title: "Blog", date: "2025-01-01", tags: [], published: true } },
      { type: "tutorials", slug: "tutorial-post", data: { title: "Tutorial", date: "2025-02-01", tags: [], published: true } },
    ]);

    const blogPosts = getAllPosts("blog");
    const tutorialPosts = getAllPosts("tutorials");

    expect(blogPosts).toHaveLength(1);
    expect(blogPosts[0].slug).toBe("blog-post");
    expect(tutorialPosts).toHaveLength(1);
    expect(tutorialPosts[0].slug).toBe("tutorial-post");
  });

  it("returns posts from all types when no type is provided", () => {
    setupMultiTypePosts([
      { type: "blog", slug: "blog-a", data: { title: "Blog A", date: "2025-01-01", tags: [], published: true } },
      { type: "guides", slug: "guide-a", data: { title: "Guide A", date: "2025-02-01", tags: [], published: true } },
    ]);

    const posts = getAllPosts();

    expect(posts).toHaveLength(2);
    // Sorted by date desc: guide-a (Feb) before blog-a (Jan)
    expect(posts[0].slug).toBe("guide-a");
    expect(posts[1].slug).toBe("blog-a");
  });

  it("returns empty array when no content directories exist", () => {
    mockExistsSync.mockReturnValue(false);

    const posts = getAllPosts();

    expect(posts).toEqual([]);
  });

  it("includes post type in each PostSummary", () => {
    setupMultiTypePosts([
      { type: "tutorials", slug: "tut-1", data: { title: "Tut", date: "2025-01-01", tags: [], published: true } },
    ]);

    const posts = getAllPosts("tutorials");

    expect(posts[0].type).toBe("tutorials");
  });
});

// ---------------------------------------------------------------------------
// getRelatedPosts
// ---------------------------------------------------------------------------

describe("getRelatedPosts", () => {
  function setupRelatedPosts() {
    setupMultiTypePosts([
      { type: "blog", slug: "current", data: { title: "Current", date: "2025-06-01", tags: ["perm", "labor"], published: true } },
      { type: "blog", slug: "related-2-tags", data: { title: "Related 2", date: "2025-05-01", tags: ["perm", "labor"], published: true } },
      { type: "blog", slug: "related-1-tag", data: { title: "Related 1", date: "2025-04-01", tags: ["perm", "dol"], published: true } },
      { type: "blog", slug: "unrelated", data: { title: "Unrelated", date: "2025-03-01", tags: ["cooking", "recipe"], published: true } },
      { type: "tutorials", slug: "tutorial-related", data: { title: "Tutorial", date: "2025-02-01", tags: ["labor"], published: true } },
    ]);
  }

  it("returns posts with matching tags, sorted by score", () => {
    setupRelatedPosts();

    const inputPost: PostSummary = {
      slug: "current",
      type: "blog",
      meta: createTestMeta({ tags: ["perm", "labor"], date: "2025-06-01" }),
    };

    const related = getRelatedPosts(inputPost);

    // related-2-tags has score 2 (both perm+labor match), so it should be first
    expect(related.length).toBeGreaterThanOrEqual(1);
    expect(related[0].slug).toBe("related-2-tags");
  });

  it("excludes the input post from results", () => {
    setupRelatedPosts();

    const inputPost: PostSummary = {
      slug: "current",
      type: "blog",
      meta: createTestMeta({ tags: ["perm", "labor"], date: "2025-06-01" }),
    };

    const related = getRelatedPosts(inputPost);

    expect(related.find((p) => p.slug === "current" && p.type === "blog")).toBeUndefined();
  });

  it("respects the limit parameter", () => {
    setupRelatedPosts();

    const inputPost: PostSummary = {
      slug: "current",
      type: "blog",
      meta: createTestMeta({ tags: ["perm", "labor"], date: "2025-06-01" }),
    };

    const related = getRelatedPosts(inputPost, 1);

    expect(related).toHaveLength(1);
    expect(related[0].slug).toBe("related-2-tags");
  });

  it("returns empty array when no posts share tags", () => {
    setupRelatedPosts();

    const inputPost: PostSummary = {
      slug: "unrelated",
      type: "blog",
      meta: createTestMeta({ tags: ["cooking", "recipe"], date: "2025-03-01" }),
    };

    const related = getRelatedPosts(inputPost);

    expect(related).toEqual([]);
  });

  it("returns empty array when input post has no tags", () => {
    setupRelatedPosts();

    const inputPost: PostSummary = {
      slug: "lonely",
      type: "blog",
      meta: createTestMeta({ tags: [], date: "2025-01-01" }),
    };

    const related = getRelatedPosts(inputPost);

    expect(related).toEqual([]);
  });

  it("uses default limit of 3", () => {
    setupMultiTypePosts([
      { type: "blog", slug: "target", data: { title: "target", date: "2025-01-01", tags: ["a", "b", "c"], published: true } },
      { type: "blog", slug: "r1", data: { title: "r1", date: "2025-01-02", tags: ["a", "b", "c"], published: true } },
      { type: "blog", slug: "r2", data: { title: "r2", date: "2025-01-03", tags: ["a", "b"], published: true } },
      { type: "blog", slug: "r3", data: { title: "r3", date: "2025-01-04", tags: ["a", "b"], published: true } },
      { type: "blog", slug: "r4", data: { title: "r4", date: "2025-01-05", tags: ["a"], published: true } },
      { type: "blog", slug: "r5", data: { title: "r5", date: "2025-01-06", tags: ["a"], published: true } },
    ]);

    const inputPost: PostSummary = {
      slug: "target",
      type: "blog",
      meta: createTestMeta({ tags: ["a", "b", "c"], date: "2025-01-01" }),
    };

    const related = getRelatedPosts(inputPost);

    // Default limit is 3, but there are 5 related posts
    expect(related).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// getAllTags
// ---------------------------------------------------------------------------

describe("getAllTags", () => {
  it("returns sorted unique tags across all posts", () => {
    setupMultiTypePosts([
      { type: "blog", slug: "p1", data: { title: "P1", date: "2025-01-01", tags: ["perm", "immigration", "dol"], published: true } },
      { type: "blog", slug: "p2", data: { title: "P2", date: "2025-01-02", tags: ["perm", "labor"], published: true } },
      { type: "tutorials", slug: "t1", data: { title: "T1", date: "2025-01-03", tags: ["tutorial", "immigration"], published: true } },
    ]);

    const tags = getAllTags();

    expect(tags).toEqual(["dol", "immigration", "labor", "perm", "tutorial"]);
  });

  it("returns tags filtered by type when type is provided", () => {
    setupMultiTypePosts([
      { type: "blog", slug: "p1", data: { title: "P1", date: "2025-01-01", tags: ["perm", "dol"], published: true } },
      { type: "tutorials", slug: "t1", data: { title: "T1", date: "2025-01-02", tags: ["tutorial", "guide"], published: true } },
    ]);

    const blogTags = getAllTags("blog");

    expect(blogTags).toEqual(["dol", "perm"]);
    expect(blogTags).not.toContain("tutorial");
  });

  it("returns empty array when no posts exist", () => {
    mockExistsSync.mockReturnValue(false);

    const tags = getAllTags();

    expect(tags).toEqual([]);
  });

  it("deduplicates tags that appear in multiple posts", () => {
    setupMultiTypePosts([
      { type: "blog", slug: "p1", data: { title: "P1", date: "2025-01-01", tags: ["perm"], published: true } },
      { type: "blog", slug: "p2", data: { title: "P2", date: "2025-01-02", tags: ["perm"], published: true } },
      { type: "blog", slug: "p3", data: { title: "P3", date: "2025-01-03", tags: ["perm"], published: true } },
    ]);

    const tags = getAllTags("blog");

    expect(tags).toEqual(["perm"]);
  });
});

// ---------------------------------------------------------------------------
// getFeaturedPosts
// ---------------------------------------------------------------------------

describe("getFeaturedPosts", () => {
  it("returns only featured posts", () => {
    setupMultiTypePosts([
      { type: "blog", slug: "featured-1", data: { title: "F1", date: "2025-01-01", tags: [], published: true, featured: true } },
      { type: "blog", slug: "regular-1", data: { title: "R1", date: "2025-01-02", tags: [], published: true, featured: false } },
      { type: "blog", slug: "featured-2", data: { title: "F2", date: "2025-01-03", tags: [], published: true, featured: true } },
    ]);

    const featured = getFeaturedPosts("blog");

    expect(featured).toHaveLength(2);
    expect(featured.map((p) => p.slug).sort()).toEqual(["featured-1", "featured-2"]);
  });

  it("returns empty array when no posts are featured", () => {
    setupMultiTypePosts([
      { type: "blog", slug: "regular-1", data: { title: "R1", date: "2025-01-01", tags: [], published: true, featured: false } },
      { type: "blog", slug: "regular-2", data: { title: "R2", date: "2025-01-02", tags: [], published: true, featured: false } },
    ]);

    const featured = getFeaturedPosts("blog");

    expect(featured).toEqual([]);
  });

  it("filters by type when type is provided", () => {
    setupMultiTypePosts([
      { type: "blog", slug: "blog-feat", data: { title: "BF", date: "2025-01-01", tags: [], published: true, featured: true } },
      { type: "tutorials", slug: "tut-feat", data: { title: "TF", date: "2025-01-02", tags: [], published: true, featured: true } },
    ]);

    const blogFeatured = getFeaturedPosts("blog");

    expect(blogFeatured).toHaveLength(1);
    expect(blogFeatured[0].slug).toBe("blog-feat");
  });

  it("returns featured posts from all types when no type specified", () => {
    setupMultiTypePosts([
      { type: "blog", slug: "blog-feat", data: { title: "BF", date: "2025-02-01", tags: [], published: true, featured: true } },
      { type: "tutorials", slug: "tut-feat", data: { title: "TF", date: "2025-01-01", tags: [], published: true, featured: true } },
      { type: "guides", slug: "guide-regular", data: { title: "GR", date: "2025-03-01", tags: [], published: true, featured: false } },
    ]);

    const featured = getFeaturedPosts();

    expect(featured).toHaveLength(2);
    // Sorted by date desc: blog-feat (Feb) then tut-feat (Jan)
    expect(featured.map((p) => p.slug)).toEqual(["blog-feat", "tut-feat"]);
  });

  it("returns empty array when no content exists", () => {
    mockExistsSync.mockReturnValue(false);

    const featured = getFeaturedPosts();

    expect(featured).toEqual([]);
  });
});
