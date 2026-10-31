import { POSTAL_ADDRESS, TRADE_NAME } from "../../src/lib/constants/about";

/**
 * The sender and its postal address, the last line of every plain-text email
 * (CAN-SPAM asks for the address, not the legal name).
 * The HTML part carries the same line in EmailLayout; a mail client that shows
 * only the text part used to see "PERM Tracker" and nothing more.
 */
export const TEXT_LEGAL_LINE = `${TRADE_NAME}, ${POSTAL_ADDRESS}`;
