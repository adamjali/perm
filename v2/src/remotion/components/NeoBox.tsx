import { interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";

/**
 * NeoBox - Neobrutalist card/container for Remotion compositions.
 * Matches the app's design: 0 border radius, 2px border, hard shadow.
 * All animation via useCurrentFrame — no CSS transitions.
 */

type NeoBoxProps = {
  children: React.ReactNode;
  width?: number;
  height?: number;
  bgColor?: string;
  borderColor?: string;
  shadowColor?: string;
  shadowSize?: number;
  delay?: number;
  className?: string;
};

export const NeoBox: React.FC<NeoBoxProps> = ({
  children,
  width,
  height,
  bgColor = "#ffffff",
  borderColor = "#1a1a1a",
  shadowColor = "#1a1a1a",
  shadowSize = 6,
  delay = 0,
  className = "",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    delay,
    config: { damping: 20, stiffness: 200 },
  });

  const translateY = interpolate(entrance, [0, 1], [30, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const shadow = interpolate(entrance, [0, 1], [0, shadowSize]);

  return (
    <div
      className={className}
      style={{
        width,
        height,
        backgroundColor: bgColor,
        border: `2px solid ${borderColor}`,
        boxShadow: `${shadow}px ${shadow}px 0 ${shadowColor}`,
        opacity,
        transform: `translateY(${translateY}px)`,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {children}
    </div>
  );
};
