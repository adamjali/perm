import { interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { AnimatedText } from "./AnimatedText";

/**
 * StageCard - Animated PERM stage card for the explainer video.
 * Each stage has a number, title, description, color, and icon area.
 * Neobrutalist style: hard borders, bold colors, no border-radius.
 */

type StageCardProps = {
  number: string;
  title: string;
  description: string;
  stageColor: string;
  delay?: number;
  meta?: Array<{ text: string }>;
};

export const StageCard: React.FC<StageCardProps> = ({
  number,
  title,
  description,
  stageColor,
  delay = 0,
  meta = [],
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    delay,
    config: { damping: 15, stiffness: 180 },
  });

  const scale = interpolate(entrance, [0, 1], [0.8, 1]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);
  const translateX = interpolate(entrance, [0, 1], [60, 0]);

  const numberPop = spring({
    frame,
    fps,
    delay: delay + 8,
    config: { damping: 8 },
  });
  const numberScale = interpolate(numberPop, [0, 1], [0, 1]);

  return (
    <div
      style={{
        opacity,
        transform: `translateX(${translateX}px) scale(${scale})`,
        display: "flex",
        alignItems: "flex-start",
        gap: 28,
      }}
    >
      {/* Stage number badge */}
      <div
        style={{
          width: 72,
          height: 72,
          backgroundColor: stageColor,
          border: "3px solid #1a1a1a",
          boxShadow: "4px 4px 0 #1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transform: `scale(${numberScale})`,
        }}
      >
        <span
          style={{
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontSize: 32,
            fontWeight: 800,
            color: "#000000",
          }}
        >
          {number}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <AnimatedText
          text={title}
          fontSize={36}
          fontWeight={800}
          color="#ffffff"
          delay={delay + 5}
          mode="fade-up"
        />
        <div style={{ marginTop: 8 }}>
          <AnimatedText
            text={description}
            fontSize={20}
            fontFamily="'Inter', system-ui, sans-serif"
            fontWeight={400}
            color="rgba(255,255,255,0.85)"
            delay={delay + 10}
            mode="fade-up"
            lineHeight={1.5}
            maxWidth={500}
          />
        </div>

        {/* Meta items */}
        {meta.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 16,
            }}
          >
            {meta.map((item, i) => {
              const metaSpring = spring({
                frame,
                fps,
                delay: delay + 15 + i * 4,
                config: { damping: 200 },
              });
              const metaOpacity = interpolate(metaSpring, [0, 1], [0, 1]);

              return (
                <div
                  key={i}
                  style={{
                    opacity: metaOpacity,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    padding: "6px 14px",
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: 14,
                    color: "rgba(255,255,255,0.9)",
                    fontWeight: 500,
                  }}
                >
                  {item.text}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
