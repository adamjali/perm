/**
 * The credit a reporter pastes from /press: PERM Tracker, linked. The page
 * says to swap the homepage link for the page the figure came from.
 */
export function pressCreditHtml(siteUrl: string): string {
  return `Source: <a href="${siteUrl.replace(/\/$/, "")}">PERM Tracker</a>, from U.S. Department of Labor and other federal records.`;
}
