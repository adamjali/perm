/**
 * The H-1B cap lottery, by year, from USCIS's own table, and DHS's estimate
 * of the odds under the wage-weighted selection that began with FY2027.
 *
 * Typed rather than ingested: six rows a year, published once a year on one
 * page. Transcribed 2026-09-26 from the page as USCIS last revised it on
 * 2026-09-21; `h1bLottery.test.ts` checks every row adds up the way USCIS's
 * own columns do. Add FY2027 when USCIS adds it.
 */

export const H1B_REGISTRATION_SOURCE =
  "https://www.uscis.gov/working-in-the-united-states/temporary-workers/h-1b-specialty-occupations/h-1b-electronic-registration-process";
export const H1B_REGISTRATION_READ = "2026-09-26";
export const H1B_REGISTRATION_REVISED = "2026-09-21";

export interface H1bYear {
  /** The cap fiscal year the registrations were for. */
  fy: number;
  total: number;
  /** Excludes duplicates, registrations deleted before the period closed, invalid passports and failed payments. */
  eligible: number;
  /** Eligible registrations for beneficiaries with no other eligible registration. */
  soleRegistrations: number;
  /** Eligible registrations for beneficiaries with more than one. */
  multipleRegistrations: number;
  selected: number;
  /** "Approximately", as USCIS rounds it; published for FY2025 and FY2026 only. */
  uniqueBeneficiaries: number | null;
}

export const H1B_REGISTRATIONS: readonly H1bYear[] = [
  { fy: 2021, total: 274_237, eligible: 269_424, soleRegistrations: 241_299, multipleRegistrations: 28_125, selected: 124_415, uniqueBeneficiaries: null },
  { fy: 2022, total: 308_613, eligible: 301_447, soleRegistrations: 211_304, multipleRegistrations: 90_143, selected: 131_924, uniqueBeneficiaries: null },
  { fy: 2023, total: 483_927, eligible: 474_421, soleRegistrations: 309_241, multipleRegistrations: 165_180, selected: 127_600, uniqueBeneficiaries: null },
  { fy: 2024, total: 780_884, eligible: 758_994, soleRegistrations: 350_103, multipleRegistrations: 408_891, selected: 188_400, uniqueBeneficiaries: null },
  { fy: 2025, total: 479_953, eligible: 470_342, soleRegistrations: 423_028, multipleRegistrations: 47_314, selected: 135_137, uniqueBeneficiaries: 442_000 },
  { fy: 2026, total: 358_737, eligible: 343_981, soleRegistrations: 336_153, multipleRegistrations: 7_828, selected: 120_141, uniqueBeneficiaries: 339_000 },
];

/** The first cap year USCIS selected by beneficiary rather than by registration. */
export const BENEFICIARY_CENTRIC_FROM = 2025;
/** The first cap year USCIS weighted the selection by wage level. */
export const WEIGHTED_FROM = 2027;

export function perRegistrationRate(y: H1bYear): number {
  return y.selected / y.eligible;
}

export function registrationsPerBeneficiary(y: H1bYear): number | null {
  return y.uniqueBeneficiaries ? y.eligible / y.uniqueBeneficiaries : null;
}

/**
 * DHS's estimate, in the final rule, of a unique beneficiary's chance of
 * selection by OEWS wage level under the weighted lottery, against 29.59% for
 * everyone under the random one. A simple weighted probability over one
 * combined pool, assuming employers keep their current wages (DHS's footnote
 * 119 says this may understate higher-wage selections). Level IV is entered
 * four times, level III three, level II twice, level I once.
 */
export const WEIGHTED_ESTIMATE = {
  source: "https://www.federalregister.gov/documents/2025/12/29/2025-23853/weighted-selection-process-for-registrants-and-petitioners-seeking-to-file-cap-subject-h-1b",
  citation: "90 FR 60864 (Dec. 29, 2025), estimate at 60947-60948",
  effective: "2026-02-27",
  randomPercent: 29.59,
  levels: [
    { level: "I", entries: 1, percent: 15.29 },
    { level: "II", entries: 2, percent: 30.58 },
    { level: "III", entries: 3, percent: 45.87 },
    { level: "IV", entries: 4, percent: 61.16 },
  ],
} as const;
