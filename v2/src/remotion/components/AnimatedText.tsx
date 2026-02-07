import { interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";

/**
 * AnimatedText - Text with entrance animation for Remotion.
 * Supports fade-up, typewriter, and word-by-word reveal.
 * Uses Space Grotesk (heading) or Inter (body) to match the app.
 */

type AnimatedTextProps = {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  color?: string;
  delay?: number;
  mode?: "fade-up" | "typewriter" | "word-reveal";
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
  maxWidth?: number;
};

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  fontSize = 48,
  fontFamily = "'Space Grotesk', system-ui, sans-serif",
  fontWeight = 700,
  color = "#1a1a1a",
  delay = 0,
  mode = "fade-up",
  lineHeight = 1.2,
  textAlign = "left",
  maxWidth,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (mode === "typewriter") {
    const charsPerFrame = 1.5;
    const adjustedFrame = Math.max(0, frame - delay);
    const visibleChars = Math.floor(adjustedFrame * charsPerFrame);
    const displayText = text.slice(0, visibleChars);
    const showCursor = adjustedFrame % 16 < 10;

    return (
      <div
        style={{
          fontSize,
          fontFamily,
          fontWeight,
          color,
          lineHeight,
          textAlign,
          maxWidth,
        }}
      >
        {displayText}
        {showCursor && (
          <span style={{ color, opacity: 0.8 }}>|</span>
        )}
      </div>
    );
  }

  if (mode === "word-reveal") {
    const words = text.split(" ");
    return (
      <div
        style={{
          fontSize,
          fontFamily,
          fontWeight,
          lineHeight,
          textAlign,
          maxWidth,
          display: "flex",
          flexWrap: "wrap",
          gap: fontSize * 0.25,
        }}
      >
        {words.map((word, i) => {
          const wordDelay = delay + i * 3;
          const wordSpring = spring({
            frame,
            fps,
            delay: wordDelay,
            config: { damping: 20, stiffness: 200 },
          });
          const y = interpolate(wordSpring, [0, 1], [20, 0]);
          const opacity = interpolate(wordSpring, [0, 1], [0, 1]);

          return (
            <span
              key={i}
              style={{
                color,
                opacity,
                transform: `translateY(${y}px)`,
                display: "inline-block",
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    );
  }

  // Default: fade-up
  const entrance = spring({
    frame,
    fps,
    delay,
    config: { damping: 200 },
  });

  const translateY = interpolate(entrance, [0, 1], [24, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  return (
    <div
      style={{
        fontSize,
        fontFamily,
        fontWeight,
        color,
        lineHeight,
        textAlign,
        maxWidth,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      {text}
    </div>
  );
};
