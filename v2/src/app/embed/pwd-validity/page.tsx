import { EmbedFrame, embedMetadata } from "@/components/embed/EmbedFrame";
import ToolPage from "@/app/(site)/(public)/tools/pwd-validity/page";

// The tool's own page, framed (see EmbedFrame). Same data window as the page.
export const dynamic = "force-static";

export const metadata = embedMetadata("pwd-validity");

export default function Embed() {
  return (
    <EmbedFrame slug="pwd-validity">
      <ToolPage />
    </EmbedFrame>
  );
}
