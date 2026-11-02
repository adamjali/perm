import Link from "next/link";

import { socGroup } from "@/lib/socCode";

/**
 * A SOC code printed in a case's record, linked to the job code finder, which shows the code's title, what the
 * job involves, its pay and how often DOL certifies it. A string that isn't a code prints as it is.
 */
export function SocCodeLink({ code, className }: { code: string; className?: string }) {
  const group = socGroup(code);
  if (!group) return <span className={className}>{code}</span>;
  return (
    <Link href={`/soc-codes?q=${group}`} className={className ? `link ${className}` : "link"}>
      {code}
    </Link>
  );
}
