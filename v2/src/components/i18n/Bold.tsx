/**
 * A sentence with one bold run: what comes before it, the bold words, and what comes after. A message module
 * returns the three parts, so each language puts the bold phrase where its own word order wants it ("<b>75,048
 * undecided cases</b> in DOL's normal queue", "劳工部正常队列中有 <b>75,048 件未判定案件</b>").
 */
export type Bolded = readonly [before: string, bold: string, after: string];

export function Bold({ parts, className = "font-bold text-foreground" }: { parts: Bolded; className?: string }) {
  return (
    <>
      {parts[0]}
      <b className={className}>{parts[1]}</b>
      {parts[2]}
    </>
  );
}
