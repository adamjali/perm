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
import type * as abuseBlocklist from "../abuseBlocklist.js";
import type * as admin from "../admin.js";
import type * as adminSecurity from "../adminSecurity.js";
import type * as apiUsage from "../apiUsage.js";
import type * as auth from "../auth.js";
import type * as authRateLimit from "../authRateLimit.js";
import type * as calendar from "../calendar.js";
import type * as cases from "../cases.js";
import type * as chatCaseData from "../chatCaseData.js";
import type * as conversationMessages from "../conversationMessages.js";
import type * as conversationSummary from "../conversationSummary.js";
import type * as conversations from "../conversations.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as dataExport from "../dataExport.js";
import type * as deadlineEnforcement from "../deadlineEnforcement.js";
import type * as documents from "../documents.js";
import type * as googleAuth from "../googleAuth.js";
import type * as googleCalendarActions from "../googleCalendarActions.js";
import type * as googleCalendarSync from "../googleCalendarSync.js";
import type * as http from "../http.js";
import type * as incidentCleanup from "../incidentCleanup.js";
import type * as jobDescriptionTemplates from "../jobDescriptionTemplates.js";
import type * as knowledge from "../knowledge.js";
import type * as lib_admin from "../lib/admin.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_calendarEventExtractor from "../lib/calendarEventExtractor.js";
import type * as lib_calendarHelpers from "../lib/calendarHelpers.js";
import type * as lib_calendarSyncHelpers from "../lib/calendarSyncHelpers.js";
import type * as lib_calendarTypes from "../lib/calendarTypes.js";
import type * as lib_caseListHelpers from "../lib/caseListHelpers.js";
import type * as lib_caseListTypes from "../lib/caseListTypes.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_dashboardHelpers from "../lib/dashboardHelpers.js";
import type * as lib_dashboardTypes from "../lib/dashboardTypes.js";
import type * as lib_dateTypes from "../lib/dateTypes.js";
import type * as lib_dateValidation from "../lib/dateValidation.js";
import type * as lib_deadlineEnforcementHelpers from "../lib/deadlineEnforcementHelpers.js";
import type * as lib_deadlineTypeMapping from "../lib/deadlineTypeMapping.js";
import type * as lib_deletion from "../lib/deletion.js";
import type * as lib_derivedCalculations from "../lib/derivedCalculations.js";
import type * as lib_digestHelpers from "../lib/digestHelpers.js";
import type * as lib_documents from "../lib/documents.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_emailBlocklist from "../lib/emailBlocklist.js";
import type * as lib_errorRecording from "../lib/errorRecording.js";
import type * as lib_formatDate from "../lib/formatDate.js";
import type * as lib_googleHelpers from "../lib/googleHelpers.js";
import type * as lib_logging from "../lib/logging.js";
import type * as lib_nameValidation from "../lib/nameValidation.js";
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
import type * as lib_perm_deadlines_timezones from "../lib/perm/deadlines/timezones.js";
import type * as lib_perm_deadlines_types from "../lib/perm/deadlines/types.js";
import type * as lib_perm_index from "../lib/perm/index.js";
import type * as lib_perm_recruitment_isRecruitmentComplete from "../lib/perm/recruitment/isRecruitmentComplete.js";
import type * as lib_perm_recruitment_methodCategories from "../lib/perm/recruitment/methodCategories.js";
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
import type * as lib_sentry from "../lib/sentry.js";
import type * as lib_userDefaults from "../lib/userDefaults.js";
import type * as lib_userProfileHelpers from "../lib/userProfileHelpers.js";
import type * as lib_validation from "../lib/validation.js";
import type * as marketingEmail from "../marketingEmail.js";
import type * as marketingEmailHelpers from "../marketingEmailHelpers.js";
import type * as marketingWebhook from "../marketingWebhook.js";
import type * as notificationActions from "../notificationActions.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as pushNotifications from "../pushNotifications.js";
import type * as pushSubscriptions from "../pushSubscriptions.js";
import type * as rateLimitConfig from "../rateLimitConfig.js";
import type * as scheduledJobs from "../scheduledJobs.js";
import type * as sentryReportAction from "../sentryReportAction.js";
import type * as supportEmail from "../supportEmail.js";
import type * as systemErrors from "../systemErrors.js";
import type * as timeline from "../timeline.js";
import type * as toolCache from "../toolCache.js";
import type * as turnstile from "../turnstile.js";
import type * as userCaseOrder from "../userCaseOrder.js";
import type * as users from "../users.js";
import type * as webSearch from "../webSearch.js";
import type * as welcomeEmail from "../welcomeEmail.js";
import type * as welcomeEmailHelpers from "../welcomeEmailHelpers.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ResendOTP: typeof ResendOTP;
  ResendPasswordReset: typeof ResendPasswordReset;
  abuseBlocklist: typeof abuseBlocklist;
  admin: typeof admin;
  adminSecurity: typeof adminSecurity;
  apiUsage: typeof apiUsage;
  auth: typeof auth;
  authRateLimit: typeof authRateLimit;
  calendar: typeof calendar;
  cases: typeof cases;
  chatCaseData: typeof chatCaseData;
  conversationMessages: typeof conversationMessages;
  conversationSummary: typeof conversationSummary;
  conversations: typeof conversations;
  crons: typeof crons;
  dashboard: typeof dashboard;
  dataExport: typeof dataExport;
  deadlineEnforcement: typeof deadlineEnforcement;
  documents: typeof documents;
  googleAuth: typeof googleAuth;
  googleCalendarActions: typeof googleCalendarActions;
  googleCalendarSync: typeof googleCalendarSync;
  http: typeof http;
  incidentCleanup: typeof incidentCleanup;
  jobDescriptionTemplates: typeof jobDescriptionTemplates;
  knowledge: typeof knowledge;
  "lib/admin": typeof lib_admin;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/calendarEventExtractor": typeof lib_calendarEventExtractor;
  "lib/calendarHelpers": typeof lib_calendarHelpers;
  "lib/calendarSyncHelpers": typeof lib_calendarSyncHelpers;
  "lib/calendarTypes": typeof lib_calendarTypes;
  "lib/caseListHelpers": typeof lib_caseListHelpers;
  "lib/caseListTypes": typeof lib_caseListTypes;
  "lib/crypto": typeof lib_crypto;
  "lib/dashboardHelpers": typeof lib_dashboardHelpers;
  "lib/dashboardTypes": typeof lib_dashboardTypes;
  "lib/dateTypes": typeof lib_dateTypes;
  "lib/dateValidation": typeof lib_dateValidation;
  "lib/deadlineEnforcementHelpers": typeof lib_deadlineEnforcementHelpers;
  "lib/deadlineTypeMapping": typeof lib_deadlineTypeMapping;
  "lib/deletion": typeof lib_deletion;
  "lib/derivedCalculations": typeof lib_derivedCalculations;
  "lib/digestHelpers": typeof lib_digestHelpers;
  "lib/documents": typeof lib_documents;
  "lib/email": typeof lib_email;
  "lib/emailBlocklist": typeof lib_emailBlocklist;
  "lib/errorRecording": typeof lib_errorRecording;
  "lib/formatDate": typeof lib_formatDate;
  "lib/googleHelpers": typeof lib_googleHelpers;
  "lib/logging": typeof lib_logging;
  "lib/nameValidation": typeof lib_nameValidation;
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
  "lib/perm/deadlines/timezones": typeof lib_perm_deadlines_timezones;
  "lib/perm/deadlines/types": typeof lib_perm_deadlines_types;
  "lib/perm/index": typeof lib_perm_index;
  "lib/perm/recruitment/isRecruitmentComplete": typeof lib_perm_recruitment_isRecruitmentComplete;
  "lib/perm/recruitment/methodCategories": typeof lib_perm_recruitment_methodCategories;
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
  "lib/sentry": typeof lib_sentry;
  "lib/userDefaults": typeof lib_userDefaults;
  "lib/userProfileHelpers": typeof lib_userProfileHelpers;
  "lib/validation": typeof lib_validation;
  marketingEmail: typeof marketingEmail;
  marketingEmailHelpers: typeof marketingEmailHelpers;
  marketingWebhook: typeof marketingWebhook;
  notificationActions: typeof notificationActions;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  pushNotifications: typeof pushNotifications;
  pushSubscriptions: typeof pushSubscriptions;
  rateLimitConfig: typeof rateLimitConfig;
  scheduledJobs: typeof scheduledJobs;
  sentryReportAction: typeof sentryReportAction;
  supportEmail: typeof supportEmail;
  systemErrors: typeof systemErrors;
  timeline: typeof timeline;
  toolCache: typeof toolCache;
  turnstile: typeof turnstile;
  userCaseOrder: typeof userCaseOrder;
  users: typeof users;
  webSearch: typeof webSearch;
  welcomeEmail: typeof welcomeEmail;
  welcomeEmailHelpers: typeof welcomeEmailHelpers;
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
  rag: import("@convex-dev/rag/_generated/component.js").ComponentApi<"rag">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
