import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * ProgressBar - Animated progress indicator for video sections.
 * Neobrutalist style with hard edges and brand color fill.
 */

type ProgressBarProps = {
  progress: number; // 0 to 1
  width?: number;
  height?: number;
  bgColor?: string;
  fillColor?: string;
  borderColor?: string;
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  width = 600,
  height = 12,
  bgColor = "rgba(255,255,255,0.15)",
  fillColor = "#2ECC40",
  borderColor = "#1a1a1a",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const animatedWidth = interpolate(frame, [0, 0.5 * fps], [0, progress * 100], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: bgColor,
        border: `2px solid ${borderColor}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${animatedWidth}%`,
          height: "100%",
          backgroundColor: fillColor,
        }}
      />
    </div>
  );
};
