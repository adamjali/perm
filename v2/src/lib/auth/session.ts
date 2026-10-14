/**
 * How long a signed-in session may sit idle. OWASP ASVS 4.0.3 requirement
 * 3.3.2, Level 2 ("12 hours or 30 minutes of inactivity"): the standard level
 * for apps holding sensitive data. Level 3's 15 minutes also requires
 * two-factor sign-in, which this app does not have.
 *
 * A plain module so a server page can print the figure the client enforces.
 */
export const IDLE_SIGN_OUT_MINUTES = 30;

/** The warning shows this many minutes before the sign-out. */
export const IDLE_WARNING_LEAD_MINUTES = 2;
