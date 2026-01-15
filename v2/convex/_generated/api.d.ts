/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ResendOTP from "../ResendOTP.js";
import type * as ResendPasswordReset from "../ResendPasswordReset.js";
import type * as apiUsage from "../apiUsage.js";
import type * as auditLogs from "../auditLogs.js";
import type * as auth from "../auth.js";
import type * as calendar from "../calendar.js";
import type * as cases from "../cases.js";
import type * as chatCaseData from "../chatCaseData.js";
import type * as conversationMessages from "../conversationMessages.js";
import type * as conversationSummary from "../conversationSummary.js";
import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as deadlineEnforcement from "../deadlineEnforcement.js";
import type * as googleAuth from "../googleAuth.js";
import type * as googleCalendarActions from "../googleCalendarActions.js";
import type * as googleCalendarSync from "../googleCalendarSync.js";
import type * as http from "../http.js";
import type * as knowledge from "../knowledge.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_calendarEventExtractor from "../lib/calendarEventExtractor.js";
import type * as lib_calendarHelpers from "../lib/calendarHelpers.js";
import type * as lib_calendarSyncHelpers from "../lib/calendarSyncHelpers.js";
import type * as lib_calendarTypes from "../lib/calendarTypes.js";
import type * as lib_caseListHelpers from "../lib/caseListHelpers.js";
import type * as lib_caseListTypes from "../lib/caseListTypes.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_dashboard from "../lib/dashboard.js";
import type * as lib_dashboardHelpers from "../lib/dashboardHelpers.js";
import type * as lib_dashboardTypes from "../lib/dashboardTypes.js";
import type * as lib_dateTypes from "../lib/dateTypes.js";
import type * as lib_dateValidation from "../lib/dateValidation.js";
import type * as lib_deadlineEnforcementHelpers from "../lib/deadlineEnforcementHelpers.js";
import type * as lib_deadlineTypeMapping from "../lib/deadlineTypeMapping.js";
import type * as lib_derivedCalculations from "../lib/derivedCalculations.js";
import type * as lib_digestHelpers from "../lib/digestHelpers.js";
import type * as lib_googleHelpers from "../lib/googleHelpers.js";
import type * as lib_index from "../lib/index.js";
import type * as lib_logging from "../lib/logging.js";
import type * as lib_notificationHelpers from "../lib/notificationHelpers.js";
import type * as lib_perm_calculators_eta9089 from "../lib/perm/calculators/eta9089.js";
import type * as lib_perm_calculators_i140 from "../lib/perm/calculators/i140.js";
import type * as lib_perm_calculators_index from "../lib/perm/calculators/index.js";
import type * as lib_perm_calculators_pwd from "../lib/perm/calculators/pwd.js";
import type * as lib_perm_calculators_recruitment from "../lib/perm/calculators/recruitment.js";
import type * as lib_perm_calculators_rfi from "../lib/perm/calculators/rfi.js";
import type * as lib_perm_cascade from "../lib/perm/cascade.js";
import type * as lib_perm_constants from "../lib/perm/constants.js";
import type * as lib_perm_dates_businessDays from "../lib/perm/dates/businessDays.js";
import type * as lib_perm_dates_dateUtils from "../lib/perm/dates/dateUtils.js";
import type * as lib_perm_dates_filingWindow from "../lib/perm/dates/filingWindow.js";
import type * as lib_perm_dates_holidays from "../lib/perm/dates/holidays.js";
import type * as lib_perm_dates_index from "../lib/perm/dates/index.js";
import type * as lib_perm_deadlines_extractActiveDeadlines from "../lib/perm/deadlines/extractActiveDeadlines.js";
import type * as lib_perm_deadlines_index from "../lib/perm/deadlines/index.js";
import type * as lib_perm_deadlines_isDeadlineActive from "../lib/perm/deadlines/isDeadlineActive.js";
import type * as lib_perm_deadlines_types from "../lib/perm/deadlines/types.js";
import type * as lib_perm_index from "../lib/perm/index.js";
import type * as lib_perm_recruitment_isRecruitmentComplete from "../lib/perm/recruitment/isRecruitmentComplete.js";
import type * as lib_perm_statusCalculation from "../lib/perm/statusCalculation.js";
import type * as lib_perm_statusTypes from "../lib/perm/statusTypes.js";
import type * as lib_perm_types from "../lib/perm/types.js";
import type * as lib_perm_utils_fieldMapper from "../lib/perm/utils/fieldMapper.js";
import type * as lib_perm_utils_validation from "../lib/perm/utils/validation.js";
import type * as lib_perm_validators_eta9089 from "../lib/perm/validators/eta9089.js";
import type * as lib_perm_validators_i140 from "../lib/perm/validators/i140.js";
import type * as lib_perm_validators_index from "../lib/perm/validators/index.js";
import type * as lib_perm_validators_pwd from "../lib/perm/validators/pwd.js";
import type * as lib_perm_validators_recruitment from "../lib/perm/validators/recruitment.js";
import type * as lib_perm_validators_rfe from "../lib/perm/validators/rfe.js";
import type * as lib_perm_validators_rfi from "../lib/perm/validators/rfi.js";
import type * as lib_perm_validators_validateCase from "../lib/perm/validators/validateCase.js";
import type * as lib_rag_appGuideKnowledge from "../lib/rag/appGuideKnowledge.js";
import type * as lib_rag_index from "../lib/rag/index.js";
import type * as lib_rag_ingest from "../lib/rag/ingest.js";
import type * as lib_rag_permKnowledge from "../lib/rag/permKnowledge.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_userProfileHelpers from "../lib/userProfileHelpers.js";
import type * as migrations from "../migrations.js";
import type * as notificationActions from "../notificationActions.js";
import type * as notifications from "../notifications.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as pushSubscriptions from "../pushSubscriptions.js";
import type * as scheduledJobs from "../scheduledJobs.js";
import type * as timeline from "../timeline.js";
import type * as toolCache from "../toolCache.js";
import type * as userCaseOrder from "../userCaseOrder.js";
import type * as users from "../users.js";
import type * as webSearch from "../webSearch.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  ResendPasswordReset: typeof ResendPasswordReset;
  apiUsage: typeof apiUsage;
  auditLogs: typeof auditLogs;
  auth: typeof auth;
  calendar: typeof calendar;
  cases: typeof cases;
  chatCaseData: typeof chatCaseData;
  conversationMessages: typeof conversationMessages;
  conversationSummary: typeof conversationSummary;
  conversations: typeof conversations;
  crons: typeof crons;
  dashboard: typeof dashboard;
  deadlineEnforcement: typeof deadlineEnforcement;
  googleAuth: typeof googleAuth;
  googleCalendarActions: typeof googleCalendarActions;
  googleCalendarSync: typeof googleCalendarSync;
  http: typeof http;
  knowledge: typeof knowledge;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/calendarEventExtractor": typeof lib_calendarEventExtractor;
  "lib/calendarHelpers": typeof lib_calendarHelpers;
  "lib/calendarSyncHelpers": typeof lib_calendarSyncHelpers;
  "lib/calendarTypes": typeof lib_calendarTypes;
  "lib/caseListHelpers": typeof lib_caseListHelpers;
  "lib/caseListTypes": typeof lib_caseListTypes;
  "lib/crypto": typeof lib_crypto;
  "lib/dashboard": typeof lib_dashboard;
  "lib/dashboardHelpers": typeof lib_dashboardHelpers;
  "lib/dashboardTypes": typeof lib_dashboardTypes;
  "lib/dateTypes": typeof lib_dateTypes;
  "lib/dateValidation": typeof lib_dateValidation;
  "lib/deadlineEnforcementHelpers": typeof lib_deadlineEnforcementHelpers;
  "lib/deadlineTypeMapping": typeof lib_deadlineTypeMapping;
  "lib/derivedCalculations": typeof lib_derivedCalculations;
  "lib/digestHelpers": typeof lib_digestHelpers;
  "lib/googleHelpers": typeof lib_googleHelpers;
  "lib/index": typeof lib_index;
  "lib/logging": typeof lib_logging;
  "lib/notificationHelpers": typeof lib_notificationHelpers;
  "lib/perm/calculators/eta9089": typeof lib_perm_calculators_eta9089;
  "lib/perm/calculators/i140": typeof lib_perm_calculators_i140;
  "lib/perm/calculators/index": typeof lib_perm_calculators_index;
  "lib/perm/calculators/pwd": typeof lib_perm_calculators_pwd;
  "lib/perm/calculators/recruitment": typeof lib_perm_calculators_recruitment;
  "lib/perm/calculators/rfi": typeof lib_perm_calculators_rfi;
  "lib/perm/cascade": typeof lib_perm_cascade;
  "lib/perm/constants": typeof lib_perm_constants;
  "lib/perm/dates/businessDays": typeof lib_perm_dates_businessDays;
  "lib/perm/dates/dateUtils": typeof lib_perm_dates_dateUtils;
  "lib/perm/dates/filingWindow": typeof lib_perm_dates_filingWindow;
  "lib/perm/dates/holidays": typeof lib_perm_dates_holidays;
  "lib/perm/dates/index": typeof lib_perm_dates_index;
  "lib/perm/deadlines/extractActiveDeadlines": typeof lib_perm_deadlines_extractActiveDeadlines;
  "lib/perm/deadlines/index": typeof lib_perm_deadlines_index;
  "lib/perm/deadlines/isDeadlineActive": typeof lib_perm_deadlines_isDeadlineActive;
  "lib/perm/deadlines/types": typeof lib_perm_deadlines_types;
  "lib/perm/index": typeof lib_perm_index;
  "lib/perm/recruitment/isRecruitmentComplete": typeof lib_perm_recruitment_isRecruitmentComplete;
  "lib/perm/statusCalculation": typeof lib_perm_statusCalculation;
  "lib/perm/statusTypes": typeof lib_perm_statusTypes;
  "lib/perm/types": typeof lib_perm_types;
  "lib/perm/utils/fieldMapper": typeof lib_perm_utils_fieldMapper;
  "lib/perm/utils/validation": typeof lib_perm_utils_validation;
  "lib/perm/validators/eta9089": typeof lib_perm_validators_eta9089;
  "lib/perm/validators/i140": typeof lib_perm_validators_i140;
  "lib/perm/validators/index": typeof lib_perm_validators_index;
  "lib/perm/validators/pwd": typeof lib_perm_validators_pwd;
  "lib/perm/validators/recruitment": typeof lib_perm_validators_recruitment;
  "lib/perm/validators/rfe": typeof lib_perm_validators_rfe;
  "lib/perm/validators/rfi": typeof lib_perm_validators_rfi;
  "lib/perm/validators/validateCase": typeof lib_perm_validators_validateCase;
  "lib/rag/appGuideKnowledge": typeof lib_rag_appGuideKnowledge;
  "lib/rag/index": typeof lib_rag_index;
  "lib/rag/ingest": typeof lib_rag_ingest;
  "lib/rag/permKnowledge": typeof lib_rag_permKnowledge;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/userProfileHelpers": typeof lib_userProfileHelpers;
  migrations: typeof migrations;
  notificationActions: typeof notificationActions;
  notifications: typeof notifications;
  pushNotifications: typeof pushNotifications;
  pushSubscriptions: typeof pushSubscriptions;
  scheduledJobs: typeof scheduledJobs;
  timeline: typeof timeline;
  toolCache: typeof toolCache;
  userCaseOrder: typeof userCaseOrder;
  users: typeof users;
  webSearch: typeof webSearch;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rag: {
    chunks: {
      insert: FunctionReference<
        "mutation",
        "internal",
        {
          chunks: Array<{
            content: { metadata?: Record<string, any>; text: string };
            embedding: Array<number>;
            searchableText?: string;
          }>;
          entryId: string;
          startOrder: number;
        },
        { status: "pending" | "ready" | "replaced" }
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          entryId: string;
          order: "desc" | "asc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            metadata?: Record<string, any>;
            order: number;
            state: "pending" | "ready" | "replaced";
            text: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      replaceChunksPage: FunctionReference<
        "mutation",
        "internal",
        { entryId: string; startOrder: number },
        { nextStartOrder: number; status: "pending" | "ready" | "replaced" }
      >;
    };
    entries: {
      add: FunctionReference<
        "mutation",
        "internal",
        {
          allChunks?: Array<{
            content: { metadata?: Record<string, any>; text: string };
            embedding: Array<number>;
            searchableText?: string;
          }>;
          entry: {
            contentHash?: string;
            filterValues: Array<{ name: string; value: any }>;
            importance: number;
            key?: string;
            metadata?: Record<string, any>;
            namespaceId: string;
            title?: string;
          };
          onComplete?: string;
        },
        {
          created: boolean;
          entryId: string;
          status: "pending" | "ready" | "replaced";
        }
      >;
      addAsync: FunctionReference<
        "mutation",
        "internal",
        {
          chunker: string;
          entry: {
            contentHash?: string;
            filterValues: Array<{ name: string; value: any }>;
            importance: number;
            key?: string;
            metadata?: Record<string, any>;
            namespaceId: string;
            title?: string;
          };
          onComplete?: string;
        },
        { created: boolean; entryId: string; status: "pending" | "ready" }
      >;
      deleteAsync: FunctionReference<
        "mutation",
        "internal",
        { entryId: string; startOrder: number },
        null
      >;
      deleteByKeyAsync: FunctionReference<
        "mutation",
        "internal",
        { beforeVersion?: number; key: string; namespaceId: string },
        null
      >;
      deleteByKeySync: FunctionReference<
        "action",
        "internal",
        { key: string; namespaceId: string },
        null
      >;
      deleteSync: FunctionReference<
        "action",
        "internal",
        { entryId: string },
        null
      >;
      findByContentHash: FunctionReference<
        "query",
        "internal",
        {
          contentHash: string;
          dimension: number;
          filterNames: Array<string>;
          key: string;
          modelId: string;
          namespace: string;
        },
        {
          contentHash?: string;
          entryId: string;
          filterValues: Array<{ name: string; value: any }>;
          importance: number;
          key?: string;
          metadata?: Record<string, any>;
          replacedAt?: number;
          status: "pending" | "ready" | "replaced";
          title?: string;
        } | null
      >;
      get: FunctionReference<
        "query",
        "internal",
        { entryId: string },
        {
          contentHash?: string;
          entryId: string;
          filterValues: Array<{ name: string; value: any }>;
          importance: number;
          key?: string;
          metadata?: Record<string, any>;
          replacedAt?: number;
          status: "pending" | "ready" | "replaced";
          title?: string;
        } | null
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          namespaceId?: string;
          order?: "desc" | "asc";
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          status: "pending" | "ready" | "replaced";
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            contentHash?: string;
            entryId: string;
            filterValues: Array<{ name: string; value: any }>;
            importance: number;
            key?: string;
            metadata?: Record<string, any>;
            replacedAt?: number;
            status: "pending" | "ready" | "replaced";
            title?: string;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      promoteToReady: FunctionReference<
        "mutation",
        "internal",
        { entryId: string },
        {
          replacedEntry: {
            contentHash?: string;
            entryId: string;
            filterValues: Array<{ name: string; value: any }>;
            importance: number;
            key?: string;
            metadata?: Record<string, any>;
            replacedAt?: number;
            status: "pending" | "ready" | "replaced";
            title?: string;
          } | null;
        }
      >;
    };
    namespaces: {
      deleteNamespace: FunctionReference<
        "mutation",
        "internal",
        { namespaceId: string },
        {
          deletedNamespace: null | {
            createdAt: number;
            dimension: number;
            filterNames: Array<string>;
            modelId: string;
            namespace: string;
            namespaceId: string;
            status: "pending" | "ready" | "replaced";
            version: number;
          };
        }
      >;
      deleteNamespaceSync: FunctionReference<
        "action",
        "internal",
        { namespaceId: string },
        null
      >;
      get: FunctionReference<
        "query",
        "internal",
        {
          dimension: number;
          filterNames: Array<string>;
          modelId: string;
          namespace: string;
        },
        null | {
          createdAt: number;
          dimension: number;
          filterNames: Array<string>;
          modelId: string;
          namespace: string;
          namespaceId: string;
          status: "pending" | "ready" | "replaced";
          version: number;
        }
      >;
      getOrCreate: FunctionReference<
        "mutation",
        "internal",
        {
          dimension: number;
          filterNames: Array<string>;
          modelId: string;
          namespace: string;
          onComplete?: string;
          status: "pending" | "ready";
        },
        { namespaceId: string; status: "pending" | "ready" }
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          status: "pending" | "ready" | "replaced";
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            createdAt: number;
            dimension: number;
            filterNames: Array<string>;
            modelId: string;
            namespace: string;
            namespaceId: string;
            status: "pending" | "ready" | "replaced";
            version: number;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      listNamespaceVersions: FunctionReference<
        "query",
        "internal",
        {
          namespace: string;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
        },
        {
          continueCursor: string;
          isDone: boolean;
          page: Array<{
            createdAt: number;
            dimension: number;
            filterNames: Array<string>;
            modelId: string;
            namespace: string;
            namespaceId: string;
            status: "pending" | "ready" | "replaced";
            version: number;
          }>;
          pageStatus?: "SplitRecommended" | "SplitRequired" | null;
          splitCursor?: string | null;
        }
      >;
      lookup: FunctionReference<
        "query",
        "internal",
        {
          dimension: number;
          filterNames: Array<string>;
          modelId: string;
          namespace: string;
        },
        null | string
      >;
      promoteToReady: FunctionReference<
        "mutation",
        "internal",
        { namespaceId: string },
        {
          replacedNamespace: null | {
            createdAt: number;
            dimension: number;
            filterNames: Array<string>;
            modelId: string;
            namespace: string;
            namespaceId: string;
            status: "pending" | "ready" | "replaced";
            version: number;
          };
        }
      >;
    };
    search: {
      search: FunctionReference<
        "action",
        "internal",
        {
          chunkContext?: { after: number; before: number };
          embedding: Array<number>;
          filters: Array<{ name: string; value: any }>;
          limit: number;
          modelId: string;
          namespace: string;
          vectorScoreThreshold?: number;
        },
        {
          entries: Array<{
            contentHash?: string;
            entryId: string;
            filterValues: Array<{ name: string; value: any }>;
            importance: number;
            key?: string;
            metadata?: Record<string, any>;
            replacedAt?: number;
            status: "pending" | "ready" | "replaced";
            title?: string;
          }>;
          results: Array<{
            content: Array<{ metadata?: Record<string, any>; text: string }>;
            entryId: string;
            order: number;
            score: number;
            startOrder: number;
          }>;
        }
      >;
    };
  };
};
