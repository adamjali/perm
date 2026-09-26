import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/tools/salary-explorer/page";

// The tool's own page, framed (see EmbedFrame). Same data window as the page.
export const revalidate = 604800;

export const metadata = embedMetadata("salary-explorer");

export default function Embed() {
  return (
    <EmbedFrame slug="salary-explorer">
      <ToolPage />
    </EmbedFrame>
  );
}
