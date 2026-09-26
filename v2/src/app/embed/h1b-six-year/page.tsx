import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/tools/h1b-six-year-limit/page";

// The tool's own page, framed (see EmbedFrame). Same data window as the page.
export const dynamic = "force-static";

export const metadata = embedMetadata("h1b-six-year");

export default function Embed() {
  return (
    <EmbedFrame slug="h1b-six-year">
      <ToolPage />
    </EmbedFrame>
  );
}
