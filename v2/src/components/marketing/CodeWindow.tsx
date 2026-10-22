/**
 * A request and the answer it got, as text in a terminal frame on the same lime block as AppWindow: for a
 * developer the answer is the picture. Real text, so it reads aloud, copies and wraps; the request line is marked
 * with a lime prompt. The caption dates the answer.
 */
export function CodeWindow({
  title = "Terminal",
  command,
  output,
  label,
  caption,
  className,
}: {
  title?: string;
  /** The command, shown after a prompt. */
  command: string;
  /** What came back, as printed. */
  output: string;
  /** What the window shows, for a screen reader's figure name. */
  label: string;
  caption?: string;
  className?: string;
}) {
  return (
    <figure className={className} aria-label={label}>
      <div className="relative">
        <div aria-hidden="true" className="absolute inset-0 translate-x-2.5 translate-y-2.5 border-2 border-border bg-primary sm:translate-x-3.5 sm:translate-y-3.5" />
        <div className="relative border-2 border-border bg-[#141414] text-white">
          <div className="flex items-center gap-3 border-b-2 border-white/25 px-3 py-2">
            <span aria-hidden="true" className="flex gap-1.5">
              <span className="size-3 border-2 border-white/40" />{" "}
              <span className="size-3 border-2 border-white/40" />{" "}
              <span className="size-3 border-2 border-white/40 bg-primary" />
            </span>{" "}
            <span className="truncate font-mono text-sm text-white/75">{title}</span>
          </div>
          <pre className="whitespace-pre-wrap px-4 py-4 font-mono text-sm leading-relaxed [overflow-wrap:anywhere] sm:px-5">
            <code>
              <span aria-hidden="true" className="text-primary">
                ${" "}
              </span>
              {command}
              {"\n\n"}
              <span className="text-white/85">{output}</span>
            </code>
          </pre>
        </div>
      </div>{" "}
      {caption ? <figcaption className="mt-6 text-sm text-muted-foreground sm:mt-7">{caption}</figcaption> : null}
    </figure>
  );
}
