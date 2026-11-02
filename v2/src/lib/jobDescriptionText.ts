/**
 * A job description as written, read into blocks for display: paragraphs, and runs of lines starting "-", "*"
 * or "•" as lists. The text itself is never changed; this only says how to draw it. Pure.
 */
export type DescriptionBlock = { kind: "paragraph"; text: string } | { kind: "list"; items: string[] };

const BULLET = /^\s*[-*•]\s+/;

export function descriptionBlocks(text: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  let paragraph: string[] = [];
  const endParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  for (const raw of (text ?? "").split("\n")) {
    const line = raw.trim();
    if (!line) {
      endParagraph();
      continue;
    }
    if (BULLET.test(raw)) {
      endParagraph();
      const item = raw.replace(BULLET, "").trim();
      const last = blocks[blocks.length - 1];
      if (last?.kind === "list") last.items.push(item);
      else blocks.push({ kind: "list", items: [item] });
    } else {
      paragraph.push(line);
    }
  }
  endParagraph();
  return blocks;
}
