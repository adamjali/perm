import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/tools/i485-queue-position/page";

// The tool's own page, framed (see EmbedFrame). Same data window as the page.
export const revalidate = 86400;

export const metadata = embedMetadata("i485-position");

export default function Embed() {
  return (
    <EmbedFrame slug="i485-position">
      <ToolPage />
    </EmbedFrame>
  );
}
