import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
  Easing,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { AnimatedText } from "../components/AnimatedText";
import { NeoBox } from "../components/NeoBox";

/**
 * ProductDemo - Animated product walkthrough of PERM Tracker.
 *
 * Scenes:
 * 1. Title card (0-3s)
 * 2. Dashboard overview (3-6s)
 * 3. Case management (6-9s)
 * 4. Calendar & deadlines (9-12s)
 * 5. CTA / outro (12-15s)
 *
 * 450 frames @ 30fps = 15 seconds
 */

type ProductDemoProps = {
  brandColor: string;
};

/* ---------- Scene: Title ---------- */
const TitleScene: React.FC<{ brandColor: string }> = ({ brandColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 8 } });
  const logoScaleVal = interpolate(logoScale, [0, 1], [0, 1]);

  const bgShift = interpolate(frame, [0, 90], [0, 10], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated background grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(46,204,64,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(46,204,64,0.06) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
          transform: `translateY(${bgShift}px)`,
        }}
      />

      {/* Decorative accent shapes */}
      <div
        style={{
          position: "absolute",
          top: 80,
          right: 120,
          width: 120,
          height: 120,
          border: `3px solid ${brandColor}`,
          transform: `rotate(${interpolate(frame, [0, 90], [0, 45])}deg)`,
          opacity: 0.3,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 140,
          width: 80,
          height: 80,
          backgroundColor: brandColor,
          opacity: 0.15,
          transform: `rotate(${interpolate(frame, [0, 90], [12, -12])}deg)`,
        }}
      />

      {/* Logo badge */}
      <div
        style={{
          transform: `scale(${logoScaleVal})`,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            backgroundColor: brandColor,
            border: "3px solid #1a1a1a",
            boxShadow: "6px 6px 0 #1a1a1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: 40,
              fontWeight: 800,
              color: "#000",
            }}
          >
            PT
          </span>
        </div>
      </div>

      <AnimatedText
        text="PERM Tracker"
        fontSize={72}
        fontWeight={800}
        color="#ffffff"
        delay={10}
        mode="fade-up"
        textAlign="center"
      />

      <div style={{ marginTop: 16 }}>
        <AnimatedText
          text="The modern way to manage PERM cases"
          fontSize={28}
          fontFamily="'Inter', system-ui, sans-serif"
          fontWeight={400}
          color="rgba(255,255,255,0.7)"
          delay={20}
          mode="fade-up"
          textAlign="center"
        />
      </div>
    </div>
  );
};

/* ---------- Scene: Dashboard ---------- */
const DashboardScene: React.FC<{ brandColor: string }> = ({ brandColor }) => {

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        padding: 60,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Section label */}
      <Sequence from={0} layout="none">
        <div
          style={{
            backgroundColor: brandColor,
            border: "2px solid #1a1a1a",
            padding: "4px 16px",
            display: "inline-block",
            marginBottom: 12,
            width: "fit-content",
          }}
        >
          <AnimatedText
            text="DASHBOARD"
            fontSize={14}
            fontWeight={700}
            color="#000000"
            delay={0}
            mode="fade-up"
          />
        </div>
      </Sequence>

      <AnimatedText
        text="Everything at a glance"
        fontSize={48}
        fontWeight={800}
        color="#ffffff"
        delay={5}
        mode="fade-up"
      />

      {/* Mock dashboard cards */}
      <div
        style={{
          display: "flex",
          gap: 24,
          marginTop: 40,
          flex: 1,
        }}
      >
        {[
          { label: "Active Cases", value: "24", color: brandColor },
          { label: "Pending PWDs", value: "8", color: "#0066FF" },
          { label: "Upcoming Deadlines", value: "12", color: "#D97706" },
          { label: "Filed This Month", value: "5", color: "#9333ea" },
        ].map((card, i) => (
          <NeoBox
            key={i}
            bgColor="#1a1a1a"
            borderColor="#333"
            shadowColor={card.color}
            shadowSize={5}
            delay={10 + i * 6}
          >
            <div style={{ padding: 28 }}>
              <div
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: 14,
                  color: "rgba(255,255,255,0.5)",
                  fontWeight: 500,
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                {card.label}
              </div>
              <Sequence from={Math.round((10 + i * 6) / 1)} layout="none">
                <CountUp
                  target={parseInt(card.value)}
                  color={card.color}
                  delay={5}
                />
              </Sequence>
            </div>
          </NeoBox>
        ))}
      </div>
    </div>
  );
};

/* ---------- CountUp helper ---------- */
const CountUp: React.FC<{ target: number; color: string; delay?: number }> = ({
  target,
  color,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    delay,
    config: { damping: 200 },
    durationInFrames: Math.round(fps * 0.8),
  });

  const value = Math.round(interpolate(progress, [0, 1], [0, target]));

  return (
    <span
      style={{
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
        fontSize: 56,
        fontWeight: 800,
        color,
      }}
    >
      {value}
    </span>
  );
};

/* ---------- Scene: Case Management ---------- */
const CaseScene: React.FC<{ brandColor: string }> = ({ brandColor }) => {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        padding: 60,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Sequence from={0} layout="none">
        <div
          style={{
            backgroundColor: "#0066FF",
            border: "2px solid #1a1a1a",
            padding: "4px 16px",
            display: "inline-block",
            marginBottom: 12,
            width: "fit-content",
          }}
        >
          <AnimatedText
            text="CASE MANAGEMENT"
            fontSize={14}
            fontWeight={700}
            color="#000000"
            delay={0}
          />
        </div>
      </Sequence>

      <AnimatedText
        text="Track every detail"
        fontSize={48}
        fontWeight={800}
        color="#ffffff"
        delay={5}
        mode="fade-up"
      />

      {/* Mock case list */}
      <div
        style={{
          marginTop: 36,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {[
          { name: "Patel, Arun", status: "Recruitment", color: "#9333ea", progress: 40 },
          { name: "Chen, Wei", status: "PWD Pending", color: "#0066FF", progress: 15 },
          { name: "Kim, Soojin", status: "ETA 9089 Filed", color: "#D97706", progress: 65 },
          { name: "Nguyen, Thi", status: "I-140 Filed", color: "#059669", progress: 85 },
          { name: "Garcia, Maria", status: "Approved", color: brandColor, progress: 100 },
        ].map((c, i) => (
          <NeoBox
            key={i}
            bgColor="#1a1a1a"
            borderColor="#333"
            shadowColor="#333"
            shadowSize={3}
            delay={8 + i * 5}
          >
            <div
              style={{
                padding: "18px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <span
                  style={{
                    fontFamily: "'Space Grotesk', system-ui, sans-serif",
                    fontSize: 20,
                    fontWeight: 700,
                    color: "#ffffff",
                  }}
                >
                  {c.name}
                </span>
                <span
                  style={{
                    backgroundColor: c.color,
                    padding: "3px 12px",
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#000",
                    border: "1.5px solid #1a1a1a",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {c.status}
                </span>
              </div>

              {/* Progress bar */}
              <div
                style={{
                  width: 200,
                  height: 8,
                  backgroundColor: "#333",
                  border: "1px solid #444",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <Sequence from={Math.round(12 + i * 5)} layout="none">
                  <AnimatedBar progress={c.progress} color={c.color} />
                </Sequence>
              </div>
            </div>
          </NeoBox>
        ))}
      </div>
    </div>
  );
};

const AnimatedBar: React.FC<{ progress: number; color: string }> = ({
  progress,
  color,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const width = interpolate(frame, [0, fps * 0.6], [0, progress], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <div
      style={{
        width: `${width}%`,
        height: "100%",
        backgroundColor: color,
      }}
    />
  );
};

/* ---------- Scene: Calendar ---------- */
const CalendarScene: React.FC<{ brandColor: string }> = ({ brandColor }) => {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        padding: 60,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Sequence from={0} layout="none">
        <div
          style={{
            backgroundColor: "#D97706",
            border: "2px solid #1a1a1a",
            padding: "4px 16px",
            display: "inline-block",
            marginBottom: 12,
            width: "fit-content",
          }}
        >
          <AnimatedText
            text="DEADLINE TRACKING"
            fontSize={14}
            fontWeight={700}
            color="#000000"
            delay={0}
          />
        </div>
      </Sequence>

      <AnimatedText
        text="Never miss a deadline"
        fontSize={48}
        fontWeight={800}
        color="#ffffff"
        delay={5}
        mode="fade-up"
      />

      {/* Calendar grid mockup */}
      <div
        style={{
          marginTop: 36,
          display: "flex",
          gap: 32,
          flex: 1,
        }}
      >
        {/* Calendar */}
        <NeoBox
          bgColor="#1a1a1a"
          borderColor="#333"
          shadowColor="#D97706"
          shadowSize={4}
          delay={10}
          width={560}
        >
          <div style={{ padding: 24 }}>
            <div
              style={{
                fontFamily: "'Space Grotesk', system-ui, sans-serif",
                fontSize: 22,
                fontWeight: 700,
                color: "#fff",
                marginBottom: 20,
              }}
            >
              January 2026
            </div>
            <CalendarGrid brandColor={brandColor} />
          </div>
        </NeoBox>

        {/* Upcoming deadlines */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { date: "Jan 15", event: "PWD Expires - Patel", color: "#ef4444", urgent: true },
            { date: "Jan 20", event: "Filing Window Opens - Chen", color: "#D97706", urgent: false },
            { date: "Jan 28", event: "I-140 Deadline - Kim", color: "#059669", urgent: false },
            { date: "Feb 5", event: "Recruitment Ends - Lee", color: "#9333ea", urgent: false },
          ].map((d, i) => (
            <NeoBox
              key={i}
              bgColor={d.urgent ? "rgba(239,68,68,0.1)" : "#1a1a1a"}
              borderColor={d.urgent ? "#ef4444" : "#333"}
              shadowColor="#333"
              shadowSize={2}
              delay={15 + i * 5}
            >
              <div
                style={{
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <span
                  style={{
                    fontFamily: "'Space Grotesk', system-ui, sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    color: d.color,
                    width: 60,
                  }}
                >
                  {d.date}
                </span>
                <span
                  style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: 16,
                    fontWeight: 500,
                    color: "#fff",
                  }}
                >
                  {d.event}
                </span>
                {d.urgent && (
                  <span
                    style={{
                      backgroundColor: "#ef4444",
                      padding: "2px 8px",
                      fontFamily: "'Inter', system-ui, sans-serif",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#fff",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                    }}
                  >
                    Urgent
                  </span>
                )}
              </div>
            </NeoBox>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ---------- Calendar grid (simplified) ---------- */
const CalendarGrid: React.FC<{ brandColor: string }> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const dates = Array.from({ length: 35 }, (_, i) => {
    const d = i - 3; // offset for Jan starting on Thu
    return d >= 1 && d <= 31 ? d : null;
  });

  const highlights: Record<number, string> = {
    15: "#ef4444",
    20: "#D97706",
    28: "#059669",
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
      {days.map((d, i) => (
        <div
          key={`h-${i}`}
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(255,255,255,0.4)",
            textAlign: "center",
            padding: "6px 0",
          }}
        >
          {d}
        </div>
      ))}
      {dates.map((d, i) => {
        const highlight = d && highlights[d];
        const cellDelay = 5 + i * 0.3;
        const cellSpring = spring({
          frame,
          fps,
          delay: cellDelay,
          config: { damping: 200 },
        });
        const cellOpacity = interpolate(cellSpring, [0, 1], [0, 1]);

        return (
          <div
            key={i}
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 14,
              fontWeight: highlight ? 700 : 400,
              color: d ? (highlight ? "#fff" : "rgba(255,255,255,0.7)") : "transparent",
              textAlign: "center",
              padding: "8px 0",
              backgroundColor: highlight || "transparent",
              border: highlight ? "1.5px solid #1a1a1a" : "none",
              opacity: cellOpacity,
            }}
          >
            {d ?? ""}
          </div>
        );
      })}
    </div>
  );
};

/* ---------- Scene: CTA / Outro ---------- */
const CTAScene: React.FC<{ brandColor: string }> = ({ brandColor }) => {
  const frame = useCurrentFrame();

  const pulse = Math.sin(frame * 0.1) * 0.03 + 1;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background radial glow */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${brandColor}20 0%, transparent 70%)`,
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${pulse})`,
        }}
      />

      <AnimatedText
        text="Start tracking smarter"
        fontSize={64}
        fontWeight={800}
        color="#ffffff"
        delay={5}
        mode="word-reveal"
        textAlign="center"
      />

      <div style={{ marginTop: 24 }}>
        <AnimatedText
          text="Join immigration professionals who trust PERM Tracker"
          fontSize={24}
          fontFamily="'Inter', system-ui, sans-serif"
          fontWeight={400}
          color="rgba(255,255,255,0.6)"
          delay={20}
          mode="fade-up"
          textAlign="center"
        />
      </div>

      {/* CTA button */}
      <Sequence from={30} layout="none">
        <CTAButton brandColor={brandColor} />
      </Sequence>

      {/* URL */}
      <Sequence from={40} layout="none">
        <div style={{ marginTop: 20 }}>
          <AnimatedText
            text="permtracker.app"
            fontSize={20}
            fontFamily="'Inter', system-ui, sans-serif"
            fontWeight={500}
            color="rgba(255,255,255,0.4)"
            delay={0}
            mode="fade-up"
            textAlign="center"
          />
        </div>
      </Sequence>
    </div>
  );
};

const CTAButton: React.FC<{ brandColor: string }> = ({ brandColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 180 },
  });

  const scale = interpolate(entrance, [0, 1], [0.8, 1]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  return (
    <div
      style={{
        marginTop: 40,
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      <div
        style={{
          backgroundColor: brandColor,
          border: "3px solid #1a1a1a",
          boxShadow: "6px 6px 0 #1a1a1a",
          padding: "16px 48px",
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          fontSize: 22,
          fontWeight: 700,
          color: "#000",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        Get Started Free
      </div>
    </div>
  );
};

/* ---------- Main Composition ---------- */
export const ProductDemo: React.FC<ProductDemoProps> = ({ brandColor }) => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={100}>
        <TitleScene brandColor={brandColor} />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />

      <TransitionSeries.Sequence durationInFrames={100}>
        <DashboardScene brandColor={brandColor} />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: 15 })}
      />

      <TransitionSeries.Sequence durationInFrames={100}>
        <CaseScene brandColor={brandColor} />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-bottom" })}
        timing={linearTiming({ durationInFrames: 15 })}
      />

      <TransitionSeries.Sequence durationInFrames={100}>
        <CalendarScene brandColor={brandColor} />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />

      <TransitionSeries.Sequence durationInFrames={110}>
        <CTAScene brandColor={brandColor} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
