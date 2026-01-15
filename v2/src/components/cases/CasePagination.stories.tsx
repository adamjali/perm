import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CasePagination } from "./CasePagination";

// Mock function for stories
const fn = () => () => {};

const meta = {
  title: "Cases/CasePagination",
  component: CasePagination,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    currentPage: {
      control: { type: "number", min: 1, max: 10 },
      description: "Current page number (1-indexed)",
    },
    totalPages: {
      control: { type: "number", min: 1, max: 100 },
      description: "Total number of pages",
    },
    totalCount: {
      control: { type: "number", min: 0, max: 1000 },
      description: "Total number of cases",
    },
    pageSize: {
      control: { type: "select" },
      options: [6, 12, 24, 50],
      description: "Number of cases per page",
    },
  },
  args: {
    onPageChange: fn(),
    onPageSizeChange: fn(),
  },
} satisfies Meta<typeof CasePagination>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// INDIVIDUAL STATE STORIES
// ============================================================================

export const Default: Story = {
  args: {
    currentPage: 3,
    totalPages: 10,
    totalCount: 120,
    pageSize: 12,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default pagination state showing page 3 of 10 with 12 cases per page. Both Previous and Next buttons are enabled.",
      },
    },
  },
};

export const FirstPage: Story = {
  args: {
    currentPage: 1,
    totalPages: 5,
    totalCount: 60,
    pageSize: 12,
  },
  parameters: {
    docs: {
      description: {
        story:
          "First page state with Previous button disabled. Shows 'Showing 1-12 of 60 cases'.",
      },
    },
  },
};

export const LastPage: Story = {
  args: {
    currentPage: 5,
    totalPages: 5,
    totalCount: 60,
    pageSize: 12,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Last page state with Next button disabled. Shows 'Showing 49-60 of 60 cases' (partial page).",
      },
    },
  },
};

export const SinglePage: Story = {
  args: {
    currentPage: 1,
    totalPages: 1,
    totalCount: 8,
    pageSize: 12,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Single page state with both navigation buttons disabled. All cases fit on one page.",
      },
    },
  },
};

export const EmptyResults: Story = {
  args: {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    pageSize: 12,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Empty state showing 'Showing 0 of 0 cases' with navigation disabled.",
      },
    },
  },
};

// ============================================================================
// PAGE SIZE VARIANTS
// ============================================================================

export const SmallPageSize: Story = {
  args: {
    currentPage: 1,
    totalPages: 10,
    totalCount: 60,
    pageSize: 6,
  },
  parameters: {
    docs: {
      description: {
        story: "Pagination with 6 cases per page (smallest option).",
      },
    },
  },
};

export const MediumPageSize: Story = {
  args: {
    currentPage: 1,
    totalPages: 2,
    totalCount: 24,
    pageSize: 12,
  },
  parameters: {
    docs: {
      description: {
        story: "Pagination with 12 cases per page (default option).",
      },
    },
  },
};

export const LargePageSize: Story = {
  args: {
    currentPage: 1,
    totalPages: 2,
    totalCount: 48,
    pageSize: 24,
  },
  parameters: {
    docs: {
      description: {
        story: "Pagination with 24 cases per page.",
      },
    },
  },
};

export const ExtraLargePageSize: Story = {
  args: {
    currentPage: 1,
    totalPages: 1,
    totalCount: 50,
    pageSize: 50,
  },
  parameters: {
    docs: {
      description: {
        story: "Pagination with 50 cases per page (largest option).",
      },
    },
  },
};

// ============================================================================
// EDGE CASES
// ============================================================================

export const ManyPages: Story = {
  args: {
    currentPage: 42,
    totalPages: 100,
    totalCount: 1200,
    pageSize: 12,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Pagination with many pages (100 total). Shows page 42 of 100.",
      },
    },
  },
};

export const LastPagePartial: Story = {
  args: {
    currentPage: 5,
    totalPages: 5,
    totalCount: 50,
    pageSize: 12,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Last page with partial results. Shows 'Showing 49-50 of 50 cases' (only 2 cases on last page).",
      },
    },
  },
};

export const ExactFit: Story = {
  args: {
    currentPage: 5,
    totalPages: 5,
    totalCount: 60,
    pageSize: 12,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Last page with exact fit. Shows 'Showing 49-60 of 60 cases' (full page).",
      },
    },
  },
};

// ============================================================================
// INTERACTIVE DEMO
// ============================================================================

export const Interactive: Story = {
  args: {
    currentPage: 1,
    totalPages: 10,
    totalCount: 120,
    pageSize: 12,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interactive demo. Use the controls to change page, page size, and total count. Click Previous/Next buttons and page size dropdown to see the Actions panel log the callbacks.",
      },
    },
  },
};

// ============================================================================
// SHOWCASE STORY - ALL VARIANTS
// ============================================================================

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8 p-4">
      {/* Navigation States */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Navigation States</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              First Page (Previous disabled)
            </h3>
            <CasePagination
              currentPage={1}
              totalPages={5}
              totalCount={60}
              pageSize={12}
              onPageChange={fn()}
              onPageSizeChange={fn()}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              Middle Page (Both enabled)
            </h3>
            <CasePagination
              currentPage={3}
              totalPages={5}
              totalCount={60}
              pageSize={12}
              onPageChange={fn()}
              onPageSizeChange={fn()}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              Last Page (Next disabled)
            </h3>
            <CasePagination
              currentPage={5}
              totalPages={5}
              totalCount={60}
              pageSize={12}
              onPageChange={fn()}
              onPageSizeChange={fn()}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              Single Page (Both disabled)
            </h3>
            <CasePagination
              currentPage={1}
              totalPages={1}
              totalCount={8}
              pageSize={12}
              onPageChange={fn()}
              onPageSizeChange={fn()}
            />
          </div>
        </div>
      </section>

      {/* Page Size Options */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Page Size Options</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              6 per page
            </h3>
            <CasePagination
              currentPage={1}
              totalPages={10}
              totalCount={60}
              pageSize={6}
              onPageChange={fn()}
              onPageSizeChange={fn()}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              12 per page (default)
            </h3>
            <CasePagination
              currentPage={1}
              totalPages={5}
              totalCount={60}
              pageSize={12}
              onPageChange={fn()}
              onPageSizeChange={fn()}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              24 per page
            </h3>
            <CasePagination
              currentPage={1}
              totalPages={3}
              totalCount={60}
              pageSize={24}
              onPageChange={fn()}
              onPageSizeChange={fn()}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              50 per page
            </h3>
            <CasePagination
              currentPage={1}
              totalPages={2}
              totalCount={60}
              pageSize={50}
              onPageChange={fn()}
              onPageSizeChange={fn()}
            />
          </div>
        </div>
      </section>

      {/* Edge Cases */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Edge Cases</h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              Empty Results
            </h3>
            <CasePagination
              currentPage={1}
              totalPages={1}
              totalCount={0}
              pageSize={12}
              onPageChange={fn()}
              onPageSizeChange={fn()}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              Last Page Partial (49-50 of 50)
            </h3>
            <CasePagination
              currentPage={5}
              totalPages={5}
              totalCount={50}
              pageSize={12}
              onPageChange={fn()}
              onPageSizeChange={fn()}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              Many Pages (Page 42 of 100)
            </h3>
            <CasePagination
              currentPage={42}
              totalPages={100}
              totalCount={1200}
              pageSize={12}
              onPageChange={fn()}
              onPageSizeChange={fn()}
            />
          </div>
        </div>
      </section>
    </div>
  ),
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        story:
          "Comprehensive showcase of all pagination variants including navigation states, page size options, and edge cases.",
      },
    },
  },
};
