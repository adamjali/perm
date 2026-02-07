import { Composition, Folder } from "remotion";
import { ProductDemo } from "./compositions/ProductDemo";
import { PERMExplainer } from "./compositions/PERMExplainer";

/**
 * Remotion Root
 *
 * Registers all video compositions.
 * Used by @remotion/cli for preview and rendering.
 */
export const RemotionRoot = () => {
  return (
    <Folder name="PERM-Tracker">
      <Composition
        id="ProductDemo"
        component={ProductDemo}
        durationInFrames={450}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          brandColor: "#2ECC40",
        }}
      />
      <Composition
        id="PERMExplainer"
        component={PERMExplainer}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          brandColor: "#2ECC40",
        }}
      />
    </Folder>
  );
};
