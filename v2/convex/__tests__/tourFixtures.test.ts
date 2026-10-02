/**
 * Records the data the attorney page's product pictures are drawn from.
 *
 * A sample firm's cases go in through the same mutation a real account uses
 * (dates entered field by field through the form's cascade), the reminder
 * job's trigger query and message builders create its notifications, and then
 * every query the pictured pages read is run and its result saved to
 * src/components/tour/tour-fixtures.json. The Storybook stories under "Tour/"
 * serve that file in place of a live backend, and the pages are captured from
 * them.
 *
 * Skipped in ordinary runs. Regenerate with:
 *   UPDATE_TOUR_FIXTURES=1 pnpm exec vitest run tourFixtures --project convex -u
 */
import { describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";

import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { applyCascade } from "../lib/perm";
import { buildDefaultProfile } from "../lib/userDefaults";
import {
  calculatePriority,
  generateNotificationMessage,
  generateNotificationTitle,
  type NotificationType,
} from "../lib/notificationHelpers";
import { groupRemindersByUser, type DigestReminderInput } from "../lib/reminderDigest";
import { createTestContext } from "../../test-utils/convex";

/** The day the pictures are taken on; every sample date sits around it. */
const TOUR_TODAY = "2026-10-01";

/** The dates an attorney types, in the order the form takes them. */
type Entered = Array<[field: string, value: string]>;

interface SampleCase {
  employerName: string;
  positionTitle: string;
  beneficiaryIdentifier: string;
  caseStatus: "pwd" | "recruitment" | "eta9089" | "i140";
  progressStatus: "working" | "waiting_intake" | "filed" | "approved" | "under_review" | "rfi_rfe";
  isProfessionalOccupation: boolean;
  entered: Entered;
  extra?: Record<string, unknown>;
}

const SAMPLE: SampleCase[] = [
  {
    employerName: "Northwind Analytics",
    positionTitle: "Senior Data Engineer",
    beneficiaryIdentifier: "R. Okafor",
    caseStatus: "recruitment",
    progressStatus: "working",
    isProfessionalOccupation: true,
    entered: [
      ["pwdFilingDate", "2026-04-14"],
      ["pwdDeterminationDate", "2026-07-15"],
      ["jobOrderStartDate", "2026-08-24"],
      ["noticeOfFilingStartDate", "2026-08-24"],
      ["sundayAdFirstDate", "2026-08-30"],
      ["sundayAdSecondDate", "2026-09-06"],
    ],
  },
  {
    employerName: "Tidewater Logistics",
    positionTitle: "Operations Research Analyst",
    beneficiaryIdentifier: "M. Castillo",
    caseStatus: "recruitment",
    progressStatus: "working",
    isProfessionalOccupation: false,
    entered: [
      ["pwdFilingDate", "2026-05-11"],
      ["pwdDeterminationDate", "2026-07-06"],
      ["jobOrderStartDate", "2026-07-27"],
      ["noticeOfFilingStartDate", "2026-07-27"],
      ["sundayAdFirstDate", "2026-08-02"],
      ["sundayAdSecondDate", "2026-08-09"],
    ],
  },
  {
    employerName: "Juniper Biologics",
    positionTitle: "Senior Statistician",
    beneficiaryIdentifier: "A. Lindqvist",
    caseStatus: "eta9089",
    progressStatus: "rfi_rfe",
    isProfessionalOccupation: true,
    entered: [
      ["pwdFilingDate", "2025-09-02"],
      ["pwdDeterminationDate", "2025-11-18"],
      ["jobOrderStartDate", "2026-01-12"],
      ["noticeOfFilingStartDate", "2026-01-12"],
      ["sundayAdFirstDate", "2026-01-18"],
      ["sundayAdSecondDate", "2026-01-25"],
      ["eta9089FilingDate", "2026-04-02"],
    ],
    extra: {
      rfiEntries: [
        {
          id: "rfi-sample-1",
          title: "Request for information",
          description: "DOL asked for the recruitment report and a copy of the posted notice.",
          receivedDate: "2026-09-08",
          responseDueDate: "2026-10-08",
          createdAt: Date.parse("2026-09-08T14:00:00Z"),
        },
      ],
    },
  },
  {
    employerName: "Cobalt Freight Systems",
    positionTitle: "Software Engineer II",
    beneficiaryIdentifier: "S. Iyer",
    caseStatus: "i140",
    progressStatus: "working",
    isProfessionalOccupation: true,
    entered: [
      ["pwdFilingDate", "2024-09-03"],
      ["pwdDeterminationDate", "2024-11-12"],
      ["jobOrderStartDate", "2025-01-06"],
      ["noticeOfFilingStartDate", "2025-01-06"],
      ["sundayAdFirstDate", "2025-01-12"],
      ["sundayAdSecondDate", "2025-01-19"],
      ["eta9089FilingDate", "2025-04-14"],
      ["eta9089CertificationDate", "2026-04-19"],
    ],
  },
  {
    employerName: "Bellweather Health",
    positionTitle: "Clinical Research Scientist",
    beneficiaryIdentifier: "J. Moreau",
    caseStatus: "eta9089",
    progressStatus: "filed",
    isProfessionalOccupation: true,
    entered: [
      ["pwdFilingDate", "2025-06-16"],
      ["pwdDeterminationDate", "2025-08-25"],
      ["jobOrderStartDate", "2025-10-06"],
      ["noticeOfFilingStartDate", "2025-10-06"],
      ["sundayAdFirstDate", "2025-10-12"],
      ["sundayAdSecondDate", "2025-10-19"],
      ["eta9089FilingDate", "2026-01-21"],
    ],
  },
  {
    employerName: "Halcyon Robotics",
    positionTitle: "Controls Engineer",
    beneficiaryIdentifier: "T. Nakamura",
    caseStatus: "pwd",
    progressStatus: "working",
    isProfessionalOccupation: false,
    entered: [
      ["pwdFilingDate", "2026-07-20"],
      ["pwdDeterminationDate", "2026-09-11"],
    ],
  },
  {
    employerName: "Meridian Microsystems",
    positionTitle: "Firmware Engineer",
    beneficiaryIdentifier: "D. Petrov",
    caseStatus: "pwd",
    progressStatus: "filed",
    isProfessionalOccupation: true,
    entered: [["pwdFilingDate", "2026-08-31"]],
  },
  {
    employerName: "Ashgrove Partners",
    positionTitle: "Financial Analyst",
    beneficiaryIdentifier: "L. Haddad",
    caseStatus: "i140",
    progressStatus: "approved",
    isProfessionalOccupation: true,
    entered: [
      ["pwdFilingDate", "2024-08-05"],
      ["pwdDeterminationDate", "2024-10-14"],
      ["jobOrderStartDate", "2024-11-18"],
      ["noticeOfFilingStartDate", "2024-11-18"],
      ["sundayAdFirstDate", "2024-11-24"],
      ["sundayAdSecondDate", "2024-12-01"],
      ["eta9089FilingDate", "2025-02-10"],
      ["eta9089CertificationDate", "2026-02-02"],
      ["i140FilingDate", "2026-03-09"],
      ["i140ReceiptDate", "2026-03-12"],
      ["i140ApprovalDate", "2026-06-23"],
    ],
  },
];

const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The three extra recruitment steps a professional job needs, from the job order's start. */
function professionalSteps(start: string) {
  return [
    { method: "employer_website", date: addDays(start, 2), startDate: addDays(start, 2), endDate: addDays(start, 32) },
    { method: "job_website_ad", date: addDays(start, 3), startDate: addDays(start, 3), endDate: addDays(start, 33) },
    { method: "job_fair", date: addDays(start, 10), description: "Regional engineering and analytics fair" },
  ];
}

/** What the attorney fills in besides the dates: the job, the wage, the steps. */
const DETAILS: Record<string, Record<string, unknown>> = {
  "Northwind Analytics": {
    jobTitle: "Senior Data Engineer", socCode: "15-1243", socTitle: "Database Architects", jobOrderState: "WA",
    pwdWageLevel: "Level III", pwdWageAmount: 151320, additionalRecruitmentMethods: professionalSteps("2026-08-24"),
  },
  "Tidewater Logistics": {
    jobTitle: "Operations Research Analyst", socCode: "15-2031", socTitle: "Operations Research Analysts", jobOrderState: "VA",
    pwdWageLevel: "Level II", pwdWageAmount: 98093,
  },
  "Juniper Biologics": {
    jobTitle: "Senior Statistician", socCode: "15-2041", socTitle: "Statisticians", jobOrderState: "MA",
    pwdWageLevel: "Level III", pwdWageAmount: 128410, additionalRecruitmentMethods: professionalSteps("2026-01-12"),
    jobDescriptionPositionTitle: "Senior Statistician",
    jobDescription:
      "Design and analyze clinical and preclinical studies; write statistical analysis plans; build models in R and SAS; " +
      "review study protocols and report results to regulatory and research teams. Requires a master's degree in " +
      "statistics or biostatistics and 3 years of experience in the job offered.",
  },
  "Cobalt Freight Systems": {
    jobTitle: "Software Engineer II", socCode: "15-1252", socTitle: "Software Developers", jobOrderState: "TX",
    pwdWageLevel: "Level II", pwdWageAmount: 118997, additionalRecruitmentMethods: professionalSteps("2025-01-06"),
  },
  "Bellweather Health": {
    jobTitle: "Clinical Research Scientist", socCode: "19-1042", socTitle: "Medical Scientists", jobOrderState: "MN",
    pwdWageLevel: "Level II", pwdWageAmount: 96637, additionalRecruitmentMethods: professionalSteps("2025-10-06"),
  },
  "Halcyon Robotics": {
    jobTitle: "Controls Engineer", socCode: "17-2071", socTitle: "Electrical Engineers", jobOrderState: "OH",
    pwdWageLevel: "Level II", pwdWageAmount: 92706,
  },
  "Meridian Microsystems": {
    jobTitle: "Firmware Engineer", socCode: "15-1252", socTitle: "Software Developers", jobOrderState: "CA",
  },
  "Ashgrove Partners": {
    jobTitle: "Financial Analyst", socCode: "13-2051", socTitle: "Financial and Investment Analysts", jobOrderState: "NY",
    pwdWageLevel: "Level II", pwdWageAmount: 104187, additionalRecruitmentMethods: professionalSteps("2024-11-18"),
  },
};

const snake = (f: string) => f.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (f: string) => f.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/**
 * Run the entered dates through the form's cascade, as typing them would. The
 * cascade speaks the form's snake_case field names; a create takes camelCase.
 */
function cascaded(entered: Entered): Record<string, unknown> {
  let state: Record<string, unknown> = {};
  for (const [field, value] of entered) {
    state = applyCascade(state as never, { field: snake(field), value } as never) as unknown as Record<string, unknown>;
  }
  return Object.fromEntries(
    Object.entries(state)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => [camel(k), v]),
  );
}

describe.skipIf(!process.env.UPDATE_TOUR_FIXTURES)("tour fixtures", () => {
  it("records what the pictured pages read", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(`${TOUR_TODAY}T13:00:00Z`));
    try {
      const t = createTestContext();

      const userId = (await t.run(async (ctx) => {
        const id = await ctx.db.insert("users", {
          name: "Dana Whitfield",
          email: "dana@whitfield-immigration.example",
          emailVerificationTime: Date.now(),
        });
        await ctx.db.insert("userProfiles", {
          ...buildDefaultProfile(id, { fullName: "Dana Whitfield" }),
          googleCalendarConnected: true,
        });
        // A verified password sign-in: the reminder job writes only for these.
        await ctx.db.insert("authAccounts", {
          userId: id,
          provider: "password",
          providerAccountId: "dana@whitfield-immigration.example",
          emailVerified: "dana@whitfield-immigration.example",
        });
        return id;
      })) as Id<"users">;
      const as = t.withIdentity({ subject: userId, name: "Dana Whitfield" });

      // An account past its first-run steps, as a working firm's would be.
      await as.mutation(api.onboarding.updateOnboardingStep, { step: "done" });
      await as.mutation(api.onboarding.dismissChecklist, {});

      const caseIds: Id<"cases">[] = [];
      for (const s of SAMPLE) {
        const id = await as.mutation(api.cases.create, {
          employerName: s.employerName,
          positionTitle: s.positionTitle,
          beneficiaryIdentifier: s.beneficiaryIdentifier,
          caseStatus: s.caseStatus,
          progressStatus: s.progressStatus,
          isProfessionalOccupation: s.isProfessionalOccupation,
          ...cascaded(s.entered),
          ...(DETAILS[s.employerName] ?? {}),
          ...(s.extra ?? {}),
        } as never);
        caseIds.push(id as Id<"cases">);
      }

      // The reminder job's in-app half, replayed once a day over the past five
      // weeks so the account holds the history a real one would: the same
      // trigger query and the same title, message and priority builders the
      // daily run uses. Anything older than four days has been read.
      const DAY = 86_400_000;
      const today = Date.parse(`${TOUR_TODAY}T13:00:00Z`);
      let todaysDigest: DigestReminderInput[] = [];
      for (let back = 35; back >= 0; back--) {
        vi.setSystemTime(new Date(today - back * DAY));
        const reminders = await t.query(internal.scheduledJobs.getCasesNeedingReminders, {});
        if (back === 0) {
          todaysDigest = reminders.map((r) => ({
            userId: r.userId,
            to: r.userEmail,
            userName: "Dana",
            caseId: r.caseId,
            employerName: r.employerName,
            beneficiaryIdentifier: r.beneficiaryIdentifier,
            deadlineType: r.deadlineType,
            deadlineDate: r.deadlineDate,
            daysUntil: r.daysUntilDeadline,
          }));
        }
        for (const r of reminders) {
          let type: NotificationType = "deadline_reminder";
          if (r.deadlineType === "rfi_due") type = "rfi_alert";
          else if (r.deadlineType === "rfe_due") type = "rfe_alert";
          const context = {
            deadlineType: r.deadlineType,
            daysUntilDeadline: r.daysUntilDeadline,
            caseLabel: `${r.beneficiaryIdentifier} at ${r.employerName}`,
            deadlineDate: r.deadlineDate,
            employerName: r.employerName,
            beneficiaryIdentifier: r.beneficiaryIdentifier,
          };
          await t.mutation(internal.notifications.createNotification, {
            userId: r.userId,
            caseId: r.caseId,
            type,
            title: generateNotificationTitle(type, context),
            message: generateNotificationMessage(type, context),
            priority: calculatePriority(r.daysUntilDeadline, type),
            deadlineDate: r.deadlineDate,
            deadlineType: r.deadlineType,
            daysUntilDeadline: Number(r.daysUntilDeadline),
          });
        }
      }
      vi.setSystemTime(new Date(today));
      const notificationCount = await t.run(async (ctx) => {
        const all = await ctx.db.query("notifications").collect();
        for (const n of all) {
          if (n.createdAt < today - 4 * DAY) await ctx.db.patch(n._id, { isRead: true, readAt: n.createdAt + DAY });
        }
        return all.length;
      });

      // One assistant exchange, saved through the same mutations the chat uses.
      const conversationId = await as.mutation(api.conversations.create, { title: "Deadlines in the next two weeks" });
      await as.mutation(api.conversationMessages.createUserMessage, {
        conversationId,
        content: "Which of my cases have something due in the next two weeks?",
      });
      await as.mutation(api.conversationMessages.createAssistantMessage, {
        conversationId,
        content:
          "Two cases have a deadline in the next 14 days:\n\n" +
          "- **Juniper Biologics**: RFI response due **October 8** (7 days).\n" +
          "- **Cobalt Freight Systems**: I-140 due **October 15** (14 days), the day the certification expires.\n\n" +
          "Add both to your calendar?",
        toolCalls: [
          {
            tool: "queryCases",
            arguments: JSON.stringify({ deadlineWithinDays: 14 }),
            result: JSON.stringify({ count: 2 }),
            status: "success",
            executedAt: Date.now(),
          },
        ],
      } as never);

      const out: Record<string, unknown> = { "tour:today": TOUR_TODAY };
      // Today's reminder email, grouped by the job's own function.
      const [digest] = groupRemindersByUser(todaysDigest);
      out["tour:digest"] = digest ? { userName: digest.userName, items: digest.items } : null;
      const record = async (fn: FunctionReference<"query">, args: Record<string, unknown> = {}) => {
        out[`${getFunctionName(fn)} ${JSON.stringify(args)}`] = await as.query(fn, args as never);
      };

      await record(api.users.currentUser);
      await record(api.users.currentUserProfile);
      await record(api.users.getActionMode);
      await record(api.timeline.getPreferences);
      await record(api.dashboard.getDeadlines);
      await record(api.dashboard.getSummary);
      await record(api.dashboard.getUpcomingDeadlines);
      await record(api.dashboard.getRecentActivity);
      await record(api.calendar.getCalendarPreferences);
      await record(api.calendar.getCalendarEvents, {});
      await record(api.notifications.getNotificationStats);
      await record(api.notifications.getUnreadCount);
      await record(api.notifications.getNotifications, {});
      for (const id of caseIds) await record(api.cases.get, { id });
      const listArgs = { activeOnly: true, sortBy: "deadline", sortOrder: "asc", page: 1, pageSize: 12 };
      await record(api.cases.listFiltered, listArgs);
      await record(api.cases.readCoverage);
      await record(api.onboarding.getOnboardingState);
      await record(api.jobDescriptionTemplates.list);
      await record(api.userCaseOrder.getCaseOrder);
      await record(api.googleAuth.isGoogleCalendarConnected);
      await record(api.deadlineEnforcement.isEnforcementEnabled);
      await record(api.deadlineEnforcement.getAutoClosureAlerts);
      await record(api.dolProcessingTimes.getLatest);
      await record(api.conversations.list);
      await record(api.conversationMessages.getMostRecent);
      await record(api.conversationMessages.list, { conversationId });
      out["tour:caseIds"] = caseIds;

      expect(notificationCount).toBeGreaterThan(0);
      await expect(`${JSON.stringify(out, null, 2)}\n`).toMatchFileSnapshot(
        "../../src/components/tour/tour-fixtures.json",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
