import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Easing,
} from "remotion";
import { AnimatedText } from "../components/AnimatedText";

/**
 * PERMInfographic - Horizontal 5-stage process overview.
 *
 * 300 frames @ 30fps = 10 seconds.
 * Shows all 5 PERM stages simultaneously in a horizontal layout
 * with connecting arrows and time estimates.
 *
 * Timeline:
 * 0-30:   Title fade in
 * 30-90:  Stage cards enter L-to-R with spring stagger
 * 60-90:  Connecting arrows draw in
 * 90-120: Time estimates appear below cards
 * 120-240: Hold for readability
 * 240-300: Brand bar + CTA fade in
 */

type PERMInfographicProps = {
  brandColor: string;
};

interface InfographicStage {
  number: string;
  title: string;
  subtitle: string;
  timeEstimate: string;
  color: string;
}

const STAGES: InfographicStage[] = [
  {
    number: "1",
    title: "PWD Request",
    subtitle: "Prevailing Wage",
    timeEstimate: "4-6 months",
    color: "#0066FF",
  },
  {
    number: "2",
    title: "Recruitment",
    subtitle: "Job Postings",
    timeEstimate: "2-3 months",
    color: "#9333ea",
  },
  {
    number: "3",
    title: "ETA 9089",
    subtitle: "PERM Filing",
    timeEstimate: "6-12 months",
    color: "#D97706",
  },
  {
    number: "4",
    title: "I-140",
    subtitle: "Immigrant Petition",
    timeEstimate: "4-12 months",
    color: "#059669",
  },
  {
    number: "5",
    title: "Approved",
    subtitle: "Priority Date Set",
    timeEstimate: "Complete",
    color: "#2ECC40",
  },
];

/* ---------- Connecting Arrow ---------- */
const ConnectingArrow: React.FC<{
  delay: number;
  color: string;
  nextColor: string;
}> = ({ delay, color, nextColor }) => {
  const frame = useCurrentFrame();

  const drawProgress = interpolate(frame, [delay, delay + 20], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const arrowOpacity = interpolate(frame, [delay + 15, delay + 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: 80,
        height: 60,
        position: "relative",
        flexShrink: 0,
      }}
    >
      {/* Line */}
      <svg
        width="80"
        height="60"
        viewBox="0 0 80 60"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <defs>
          <linearGradient
            id={`grad-${delay}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={nextColor} />
          </linearGradient>
        </defs>
        <line
          x1="0"
          y1="30"
          x2="60"
          y2="30"
          stroke={`url(#grad-${delay})`}
          strokeWidth="3"
          strokeDasharray="60"
          strokeDashoffset={60 - (drawProgress / 100) * 60}
        />
        {/* Arrowhead */}
        <polygon
          points="55,22 70,30 55,38"
          fill={nextColor}
          opacity={arrowOpacity}
        />
      </svg>
    </div>
  );
};

/* ---------- Stage Card ---------- */
const InfographicCard: React.FC<{
  stage: InfographicStage;
  index: number;
}> = ({ stage, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Card entrance: staggered spring from bottom
  const cardDelay = 30 + index * 8;
  const cardSpring = spring({
    frame,
    fps,
    delay: cardDelay,
    config: { damping: 12, stiffness: 200 },
  });
  const translateY = interpolate(cardSpring, [0, 1], [60, 0]);
  const opacity = interpolate(cardSpring, [0, 1], [0, 1]);

  // Number badge pop
  const badgeDelay = cardDelay + 5;
  const badgeSpring = spring({
    frame,
    fps,
    delay: badgeDelay,
    config: { damping: 8, stiffness: 250 },
  });
  const badgeScale = interpolate(badgeSpring, [0, 1], [0, 1]);

  // Time estimate fade in
  const timeDelay = 90 + index * 5;
  const timeOpacity = interpolate(frame, [timeDelay, timeDelay + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const timeY = interpolate(frame, [timeDelay, timeDelay + 15], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        opacity,
        transform: `translateY(${translateY}px)`,
        flexShrink: 0,
      }}
    >
      {/* Number badge */}
      <div
        style={{
          width: 56,
          height: 56,
          backgroundColor: stage.color,
          border: "3px solid #1a1a1a",
          boxShadow: "4px 4px 0 #1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${badgeScale})`,
        }}
      >
        <span
          style={{
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontSize: 26,
            fontWeight: 800,
            color: "#000",
          }}
        >
          {stage.number}
        </span>
      </div>

      {/* Card body */}
      <div
        style={{
          width: 200,
          backgroundColor: "#141414",
          border: "2px solid rgba(255,255,255,0.15)",
          padding: "16px 12px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontSize: 18,
            fontWeight: 700,
            color: "#ffffff",
            marginBottom: 4,
          }}
        >
          {stage.title}
        </div>
        <div
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 400,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          {stage.subtitle}
        </div>
      </div>

      {/* Time estimate pill */}
      <div
        style={{
          opacity: timeOpacity,
          transform: `translateY(${timeY}px)`,
          backgroundColor: `${stage.color}20`,
          border: `1px solid ${stage.color}60`,
          padding: "4px 14px",
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: stage.color,
        }}
      >
        {stage.timeEstimate}
      </div>
    </div>
  );
};

/* ---------- Main Composition ---------- */
export const PERMInfographic: React.FC<PERMInfographicProps> = ({
  brandColor,
}) => {
  const frame = useCurrentFrame();

  // Brand bar entrance (frames 240-270)
  const brandEntrance = interpolate(frame, [240, 270], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const brandY = interpolate(brandEntrance, [0, 1], [40, 0]);

  // Total timeline bar progress (frames 60-120)
  const timelineProgress = interpolate(frame, [60, 120], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Dot grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(46,204,64,0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Title area */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 80,
          position: "relative",
        }}
      >
        <Sequence from={0} layout="none">
          <AnimatedText
            text="The PERM Process at a Glance"
            fontSize={52}
            fontWeight={800}
            color="#ffffff"
            delay={3}
            mode="word-reveal"
            textAlign="center"
          />
        </Sequence>

        <Sequence from={15} layout="none">
          <div style={{ marginTop: 12 }}>
            <AnimatedText
              text="From prevailing wage to green card approval"
              fontSize={22}
              fontFamily="'Inter', system-ui, sans-serif"
              fontWeight={400}
              color="rgba(255,255,255,0.5)"
              delay={5}
              mode="fade-up"
              textAlign="center"
            />
          </div>
        </Sequence>
      </div>

      {/* Stage cards row */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 60px",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
          }}
        >
          {STAGES.map((stage, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center" }}
            >
              <InfographicCard stage={stage} index={i} />
              {i < STAGES.length - 1 && (
                <ConnectingArrow
                  delay={60 + i * 6}
                  color={stage.color}
                  nextColor={STAGES[i + 1]!.color}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Total timeline progress bar */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Sequence from={60} layout="none">
          <div
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 14,
              fontWeight: 500,
              color: "rgba(255,255,255,0.4)",
              opacity: interpolate(frame, [60, 75], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            Total Timeline: 18-36 months
          </div>
          <div
            style={{
              width: 400,
              height: 6,
              backgroundColor: "rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${timelineProgress}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${STAGES[0]!.color}, ${STAGES[4]!.color})`,
              }}
            />
          </div>
        </Sequence>
      </div>

      {/* Brand bar + CTA */}
      <div
        style={{
          height: 80,
          borderTop: "2px solid rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 60px",
          opacity: brandEntrance,
          transform: `translateY(${brandY}px)`,
          position: "relative",
        }}
      >
        {/* Left: Logo + brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              backgroundColor: brandColor,
              border: "2px solid #1a1a1a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#000"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: 22,
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            PERM Tracker
          </span>
        </div>

        {/* Right: CTA */}
        <div
          style={{
            backgroundColor: brandColor,
            border: "2px solid #1a1a1a",
            boxShadow: "4px 4px 0 #1a1a1a",
            padding: "10px 28px",
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontSize: 16,
            fontWeight: 700,
            color: "#000",
            letterSpacing: 0.5,
          }}
        >
          Track Your Cases Free
        </div>
      </div>
    </div>
  );
};
