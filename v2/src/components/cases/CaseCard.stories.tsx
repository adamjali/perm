import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CaseCard } from "./CaseCard";
import { createCaseCardData } from "../../../convex/lib/caseListTypes";
import type { Id } from "../../../convex/_generated/dataModel";

// Helper function to generate mock case ID
const mockCaseId = (num: number) => `case${num}` as Id<"cases">;

// Helper to get dates relative to today
const getDate = (daysFromNow: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split("T")[0]; // YYYY-MM-DD
};

const meta = {
  title: "Cases/CaseCard",
  component: CaseCard,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    isSelected: {
      control: "boolean",
      description: "Whether the card is selected (shows ring)",
    },
    selectionMode: {
      control: "boolean",
      description: "Whether selection checkbox is visible",
    },
  },
} satisfies Meta<typeof CaseCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// INDIVIDUAL STAGE STORIES
// ============================================================================

export const PWDStage: Story = {
  args: {
    case: createCaseCardData({
      _id: mockCaseId(1),
      employerName: "Google Inc.",
      beneficiaryIdentifier: "John Smith",
      caseStatus: "pwd",
      progressStatus: "filed",
      nextDeadline: getDate(45), // 45 days from now
      nextDeadlineLabel: "PWD expires",
      isFavorite: false,
      isProfessionalOccupation: true,
      calendarSyncEnabled: true,
      pwdFilingDate: getDate(-30), // 30 days ago
      pwdDeterminationDate: getDate(-15), // 15 days ago
      pwdExpirationDate: getDate(45), // 45 days from now
      _creationTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Case in PWD stage with professional occupation badge, filed status, and calendar sync enabled.",
      },
    },
  },
};

export const RecruitmentStage: Story = {
  args: {
    case: createCaseCardData({
      _id: mockCaseId(2),
      employerName: "Microsoft Corp.",
      beneficiaryIdentifier: "Jane Doe",
      caseStatus: "recruitment",
      progressStatus: "under_review",
      nextDeadline: getDate(15), // 15 days from now
      nextDeadlineLabel: "ETA window closes",
      isFavorite: true, // Favorite!
      calendarSyncEnabled: true,
      notes: "Recruitment ads posted on 12/15. Waiting for applicant responses.",
      jobOrderStartDate: getDate(-20),
      additionalRecruitmentEndDate: getDate(15),
      pwdFilingDate: getDate(-60),
      pwdDeterminationDate: getDate(-50),
      pwdExpirationDate: getDate(200),
      _creationTime: Date.now() - 60 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Case in recruitment stage with favorite star filled, notes preview on hover, and soon deadline.",
      },
    },
  },
};

export const ETA9089Stage: Story = {
  args: {
    case: createCaseCardData({
      _id: mockCaseId(3),
      employerName: "Amazon LLC",
      beneficiaryIdentifier: "Alice Johnson",
      caseStatus: "eta9089",
      progressStatus: "rfi_rfe",
      nextDeadline: getDate(5), // 5 days from now - urgent!
      nextDeadlineLabel: "RFI due",
      isFavorite: false,
      hasActiveRfi: true, // RFI active!
      isProfessionalOccupation: true,
      calendarSyncEnabled: true,
      notes: "RFI received on 12/20. Preparing response documentation.",
      pwdFilingDate: getDate(-120),
      pwdDeterminationDate: getDate(-110),
      pwdExpirationDate: getDate(150),
      jobOrderStartDate: getDate(-90),
      additionalRecruitmentEndDate: getDate(-60),
      eta9089FilingDate: getDate(-30),
      eta9089WindowOpens: getDate(-30),
      _creationTime: Date.now() - 120 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Case in ETA 9089 stage with active RFI badge (red), urgent deadline (≤7 days), and professional occupation.",
      },
    },
  },
};

export const I140Stage: Story = {
  args: {
    case: createCaseCardData({
      _id: mockCaseId(4),
      employerName: "Apple Inc.",
      beneficiaryIdentifier: "Bob Williams",
      caseStatus: "i140",
      progressStatus: "filed",
      nextDeadline: getDate(100), // 100 days from now
      nextDeadlineLabel: "I-140 deadline",
      isFavorite: false,
      isProfessionalOccupation: false, // NOT professional
      calendarSyncEnabled: false, // Calendar sync disabled
      pwdFilingDate: getDate(-180),
      pwdDeterminationDate: getDate(-170),
      pwdExpirationDate: getDate(50),
      jobOrderStartDate: getDate(-150),
      additionalRecruitmentEndDate: getDate(-120),
      eta9089FilingDate: getDate(-90),
      eta9089WindowOpens: getDate(-90),
      eta9089CertificationDate: getDate(-60),
      eta9089ExpirationDate: getDate(120),
      i140FilingDate: getDate(-30),
      _creationTime: Date.now() - 180 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Case in I-140 stage, filed status, no professional occupation badge, calendar sync disabled.",
      },
    },
  },
};

// ============================================================================
// SPECIAL STATE STORIES
// ============================================================================

export const WithUrgentDeadline: Story = {
  args: {
    case: createCaseCardData({
      _id: mockCaseId(5),
      employerName: "Meta Platforms Inc.",
      beneficiaryIdentifier: "Charlie Brown",
      caseStatus: "recruitment",
      progressStatus: "working",
      nextDeadline: getDate(3), // 3 days - URGENT!
      nextDeadlineLabel: "ETA window closes",
      isFavorite: false,
      isProfessionalOccupation: true,
      calendarSyncEnabled: true,
      notes: "URGENT: Sunday ad placement deadline approaching!",
      jobOrderStartDate: getDate(-10),
      pwdFilingDate: getDate(-40),
      pwdDeterminationDate: getDate(-35),
      pwdExpirationDate: getDate(200),
      _creationTime: Date.now() - 40 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now(),
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Case with urgent deadline (≤7 days). Deadline text shows in red with 'in 3 days' format.",
      },
    },
  },
};

export const WithSoonDeadline: Story = {
  args: {
    case: createCaseCardData({
      _id: mockCaseId(6),
      employerName: "Netflix Inc.",
      beneficiaryIdentifier: "Diana Prince",
      caseStatus: "eta9089",
      progressStatus: "working",
      nextDeadline: getDate(20), // 20 days - soon
      nextDeadlineLabel: "ETA window closes",
      isFavorite: true,
      isProfessionalOccupation: false,
      calendarSyncEnabled: true,
      pwdFilingDate: getDate(-80),
      pwdDeterminationDate: getDate(-70),
      pwdExpirationDate: getDate(180),
      jobOrderStartDate: getDate(-60),
      additionalRecruitmentEndDate: getDate(-30),
      eta9089WindowOpens: getDate(0),
      _creationTime: Date.now() - 80 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Case with soon deadline (8-30 days). Deadline text shows in orange with 'in 20 days' format.",
      },
    },
  },
};

export const WithActiveRFE: Story = {
  args: {
    case: createCaseCardData({
      _id: mockCaseId(7),
      employerName: "Tesla Inc.",
      beneficiaryIdentifier: "Eve Martinez",
      caseStatus: "i140",
      progressStatus: "rfi_rfe",
      nextDeadline: getDate(14), // 14 days
      nextDeadlineLabel: "RFE due",
      isFavorite: false,
      hasActiveRfe: true, // RFE active!
      isProfessionalOccupation: true,
      calendarSyncEnabled: true,
      notes: "RFE received for additional evidence of employer's ability to pay.",
      pwdFilingDate: getDate(-200),
      pwdDeterminationDate: getDate(-190),
      pwdExpirationDate: getDate(30),
      jobOrderStartDate: getDate(-170),
      additionalRecruitmentEndDate: getDate(-140),
      eta9089FilingDate: getDate(-110),
      eta9089WindowOpens: getDate(-110),
      eta9089CertificationDate: getDate(-80),
      eta9089ExpirationDate: getDate(100),
      i140FilingDate: getDate(-50),
      _creationTime: Date.now() - 200 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now(),
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Case with active RFE badge (red). Shows RFE Active badge alongside professional occupation badge.",
      },
    },
  },
};

export const WithAllBadges: Story = {
  args: {
    case: createCaseCardData({
      _id: mockCaseId(8),
      employerName: "SpaceX",
      beneficiaryIdentifier: "Frank Castle",
      caseStatus: "eta9089",
      progressStatus: "rfi_rfe",
      nextDeadline: getDate(2), // 2 days - URGENT
      nextDeadlineLabel: "RFI due",
      isFavorite: true, // Favorite
      hasActiveRfi: true, // RFI active
      isProfessionalOccupation: true, // Professional
      calendarSyncEnabled: true, // Calendar sync
      notes: "Critical case with multiple urgent items. RFI response due soon.",
      pwdFilingDate: getDate(-100),
      pwdDeterminationDate: getDate(-90),
      pwdExpirationDate: getDate(80),
      jobOrderStartDate: getDate(-80),
      additionalRecruitmentEndDate: getDate(-50),
      eta9089FilingDate: getDate(-30),
      eta9089WindowOpens: getDate(-30),
      _creationTime: Date.now() - 100 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now(),
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Case showing all possible badges: Case stage, Professional occupation, RFI Active, Calendar sync, and Favorite star. Urgent deadline.",
      },
    },
  },
};

export const WithSelectionMode: Story = {
  args: {
    case: createCaseCardData({
      _id: mockCaseId(9),
      employerName: "NVIDIA Corporation",
      beneficiaryIdentifier: "Grace Hopper",
      caseStatus: "pwd",
      progressStatus: "working",
      nextDeadline: getDate(30),
      nextDeadlineLabel: "PWD expires",
      isFavorite: false,
      isProfessionalOccupation: true,
      calendarSyncEnabled: true,
      pwdFilingDate: getDate(-10),
      _creationTime: Date.now() - 10 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now(),
    }),
    selectionMode: true, // Show checkbox
    isSelected: true, // Selected
  },
  parameters: {
    docs: {
      description: {
        story:
          "Card in selection mode with checkbox visible in top-left corner. Shows selection ring when selected.",
      },
    },
  },
};

export const WithNoDeadline: Story = {
  args: {
    case: createCaseCardData({
      _id: mockCaseId(10),
      employerName: "IBM Corporation",
      beneficiaryIdentifier: "Henry Ford",
      caseStatus: "closed",
      progressStatus: "approved",
      // No nextDeadline
      isFavorite: false,
      isProfessionalOccupation: false,
      calendarSyncEnabled: false,
      pwdFilingDate: getDate(-365),
      pwdDeterminationDate: getDate(-355),
      pwdExpirationDate: getDate(-90),
      jobOrderStartDate: getDate(-340),
      additionalRecruitmentEndDate: getDate(-310),
      eta9089FilingDate: getDate(-280),
      eta9089WindowOpens: getDate(-280),
      eta9089CertificationDate: getDate(-250),
      eta9089ExpirationDate: getDate(-70),
      i140FilingDate: getDate(-220),
      i140Approved: getDate(-150),
      _creationTime: Date.now() - 365 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now() - 150 * 24 * 60 * 60 * 1000,
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Closed case with no upcoming deadlines. Shows 'No upcoming deadlines' message.",
      },
    },
  },
};

export const WithLongNotes: Story = {
  args: {
    case: createCaseCardData({
      _id: mockCaseId(11),
      employerName: "Oracle Corporation",
      beneficiaryIdentifier: "Irene Adler",
      caseStatus: "recruitment",
      progressStatus: "under_review",
      nextDeadline: getDate(25),
      nextDeadlineLabel: "ETA window closes",
      isFavorite: false,
      isProfessionalOccupation: true,
      calendarSyncEnabled: true,
      notes:
        "This case has extensive notes that will be truncated in the preview. The notes section shows a maximum of 2 lines with ellipsis. Hover over the card to see the full notes preview in the expanded content area. Additional recruitment activities scheduled for next week including professional journal posting and university outreach.",
      jobOrderStartDate: getDate(-15),
      additionalRecruitmentEndDate: getDate(25),
      pwdFilingDate: getDate(-50),
      pwdDeterminationDate: getDate(-40),
      pwdExpirationDate: getDate(210),
      _creationTime: Date.now() - 50 * 24 * 60 * 60 * 1000,
      updatedAt: Date.now(),
    }),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Case with long notes that get truncated to 2 lines in the expanded content. Hover to see notes preview.",
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
      {/* Stage Variants */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Stage Variants</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <CaseCard
            case={createCaseCardData({
              _id: mockCaseId(101),
              employerName: "Google Inc.",
              beneficiaryIdentifier: "PWD Stage",
              caseStatus: "pwd",
              progressStatus: "filed",
              nextDeadline: getDate(45),
              nextDeadlineLabel: "PWD expires",
              isFavorite: false,
              isProfessionalOccupation: true,
              pwdFilingDate: getDate(-30),
              pwdDeterminationDate: getDate(-15),
              pwdExpirationDate: getDate(45),
              _creationTime: Date.now(),
              updatedAt: Date.now(),
            })}
          />
          <CaseCard
            case={createCaseCardData({
              _id: mockCaseId(102),
              employerName: "Microsoft Corp.",
              beneficiaryIdentifier: "Recruitment Stage",
              caseStatus: "recruitment",
              progressStatus: "under_review",
              nextDeadline: getDate(15),
              nextDeadlineLabel: "ETA window closes",
              isFavorite: false,
              jobOrderStartDate: getDate(-20),
              additionalRecruitmentEndDate: getDate(15),
              _creationTime: Date.now(),
              updatedAt: Date.now(),
            })}
          />
          <CaseCard
            case={createCaseCardData({
              _id: mockCaseId(103),
              employerName: "Amazon LLC",
              beneficiaryIdentifier: "ETA 9089 Stage",
              caseStatus: "eta9089",
              progressStatus: "filed",
              nextDeadline: getDate(60),
              nextDeadlineLabel: "ETA window closes",
              isFavorite: false,
              eta9089FilingDate: getDate(-30),
              _creationTime: Date.now(),
              updatedAt: Date.now(),
            })}
          />
          <CaseCard
            case={createCaseCardData({
              _id: mockCaseId(104),
              employerName: "Apple Inc.",
              beneficiaryIdentifier: "I-140 Stage",
              caseStatus: "i140",
              progressStatus: "filed",
              nextDeadline: getDate(100),
              nextDeadlineLabel: "I-140 deadline",
              isFavorite: false,
              i140FilingDate: getDate(-30),
              _creationTime: Date.now(),
              updatedAt: Date.now(),
            })}
          />
        </div>
      </section>

      {/* Urgency Levels */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Deadline Urgency</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              Urgent (≤7 days)
            </h3>
            <CaseCard
              case={createCaseCardData({
                _id: mockCaseId(201),
                employerName: "Meta Platforms",
                beneficiaryIdentifier: "Urgent Case",
                caseStatus: "recruitment",
                progressStatus: "working",
                nextDeadline: getDate(3), // 3 days
                nextDeadlineLabel: "ETA window closes",
                isFavorite: false,
                _creationTime: Date.now(),
                updatedAt: Date.now(),
              })}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              Soon (8-30 days)
            </h3>
            <CaseCard
              case={createCaseCardData({
                _id: mockCaseId(202),
                employerName: "Netflix Inc.",
                beneficiaryIdentifier: "Soon Case",
                caseStatus: "eta9089",
                progressStatus: "working",
                nextDeadline: getDate(20), // 20 days
                nextDeadlineLabel: "ETA window closes",
                isFavorite: false,
                _creationTime: Date.now(),
                updatedAt: Date.now(),
              })}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              Normal (30+ days)
            </h3>
            <CaseCard
              case={createCaseCardData({
                _id: mockCaseId(203),
                employerName: "Tesla Inc.",
                beneficiaryIdentifier: "Normal Case",
                caseStatus: "pwd",
                progressStatus: "filed",
                nextDeadline: getDate(60), // 60 days
                nextDeadlineLabel: "PWD expires",
                isFavorite: false,
                _creationTime: Date.now(),
                updatedAt: Date.now(),
              })}
            />
          </div>
        </div>
      </section>

      {/* Special States */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Special States</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              Favorite + Professional
            </h3>
            <CaseCard
              case={createCaseCardData({
                _id: mockCaseId(301),
                employerName: "SpaceX",
                beneficiaryIdentifier: "Special Case 1",
                caseStatus: "recruitment",
                progressStatus: "working",
                nextDeadline: getDate(20),
                nextDeadlineLabel: "ETA window closes",
                isFavorite: true,
                isProfessionalOccupation: true,
                calendarSyncEnabled: true,
                _creationTime: Date.now(),
                updatedAt: Date.now(),
              })}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              RFI Active
            </h3>
            <CaseCard
              case={createCaseCardData({
                _id: mockCaseId(302),
                employerName: "NVIDIA Corp.",
                beneficiaryIdentifier: "Special Case 2",
                caseStatus: "eta9089",
                progressStatus: "rfi_rfe",
                nextDeadline: getDate(5),
                nextDeadlineLabel: "RFI due",
                isFavorite: false,
                hasActiveRfi: true,
                _creationTime: Date.now(),
                updatedAt: Date.now(),
              })}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              RFE Active
            </h3>
            <CaseCard
              case={createCaseCardData({
                _id: mockCaseId(303),
                employerName: "Intel Corporation",
                beneficiaryIdentifier: "Special Case 3",
                caseStatus: "i140",
                progressStatus: "rfi_rfe",
                nextDeadline: getDate(14),
                nextDeadlineLabel: "RFE due",
                isFavorite: false,
                hasActiveRfe: true,
                isProfessionalOccupation: true,
                _creationTime: Date.now(),
                updatedAt: Date.now(),
              })}
            />
          </div>
        </div>
      </section>

      {/* Interaction States */}
      <section>
        <h2 className="text-2xl font-bold mb-4">Interaction States</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              Selection Mode (Selected)
            </h3>
            <CaseCard
              case={createCaseCardData({
                _id: mockCaseId(401),
                employerName: "Adobe Inc.",
                beneficiaryIdentifier: "Selected Case",
                caseStatus: "pwd",
                progressStatus: "working",
                nextDeadline: getDate(30),
                nextDeadlineLabel: "PWD expires",
                isFavorite: false,
                _creationTime: Date.now(),
                updatedAt: Date.now(),
              })}
              selectionMode={true}
              isSelected={true}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
              Selection Mode (Unselected)
            </h3>
            <CaseCard
              case={createCaseCardData({
                _id: mockCaseId(402),
                employerName: "Salesforce Inc.",
                beneficiaryIdentifier: "Unselected Case",
                caseStatus: "pwd",
                progressStatus: "working",
                nextDeadline: getDate(30),
                nextDeadlineLabel: "PWD expires",
                isFavorite: false,
                _creationTime: Date.now(),
                updatedAt: Date.now(),
              })}
              selectionMode={true}
              isSelected={false}
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
          "Comprehensive showcase of all CaseCard variants including different stages, urgency levels, badges, and interaction states. Hover over cards to see expanded content with detailed dates and notes.",
      },
    },
  },
};
