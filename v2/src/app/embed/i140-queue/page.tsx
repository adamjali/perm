import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/tools/i140-calculator/page";

// The tool's own page, framed (see EmbedFrame). Same data window as the page.
export const revalidate = 86400;

export const metadata = embedMetadata("i140-queue");

export default function Embed() {
  return (
    <EmbedFrame slug="i140-queue">
      <ToolPage />
    </EmbedFrame>
  );
}
