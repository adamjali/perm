import { LEGAL_DBA, POSTAL_ADDRESS } from "../../src/lib/constants/about";

/**
 * The company and its postal address, the last line of every plain-text email.
 * The HTML part carries the same line in EmailLayout; a mail client that shows
 * only the text part used to see "PERM Tracker" and nothing more.
 */
export const TEXT_LEGAL_LINE = `${LEGAL_DBA}, ${POSTAL_ADDRESS}`;
