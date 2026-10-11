/**
 * The words of the daily deadline email: its subject, the line under the
 * greeting, and the inbox preview. One place, so the subject and the body
 * can't disagree, and so a count of one gets a singular verb (it went out as
 * "1 PERM deadline need your attention" until Oct 11 2026).
 */
export interface DeadlineDigestWords {
  subject: string;
  headline: string;
  preview: string;
}

const noun = (n: number) => `deadline${n === 1 ? "" : "s"}`;
const deadlines = (n: number) => `${n} ${noun(n)}`;
const needs = (n: number) => (n === 1 ? "needs" : "need");

export function deadlineDigestWords(total: number, overdue: number): DeadlineDigestWords {
  if (overdue > 0 && overdue === total) {
    const is = total === 1 ? "is" : "are";
    return {
      subject: `${total} PERM ${noun(total)} ${is} overdue`,
      headline: `${deadlines(total)} ${is} overdue`,
      preview: `${total} PERM ${noun(total)} ${is} past due`,
    };
  }
  if (overdue > 0) {
    return {
      subject: `${total} PERM ${noun(total)} ${needs(total)} attention, ${overdue} overdue`,
      headline: `${deadlines(total)} ${needs(total)} attention, ${overdue} overdue`,
      preview: `${overdue} overdue of ${total} PERM ${noun(total)}`,
    };
  }
  return {
    subject: `${total} PERM ${noun(total)} ${needs(total)} your attention`,
    headline: `${deadlines(total)} ${needs(total)} your attention`,
    preview: `${total} PERM ${noun(total)} coming up`,
  };
}
