import { Fragment } from "react";

/**
 * Text with each occupation code ("15-1133") kept on one line: a browser breaks a line at a code's hyphen, and
 * "15-" at a line's end reads as a different number. The characters stay as written, so search still matches them.
 */
export function SocCodeText({ text }: { text: string }) {
  const parts = text.split(/(\b\d{2}-\d{4}(?:\.\d{2})?\b)/);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className="whitespace-nowrap">
            {p}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}
