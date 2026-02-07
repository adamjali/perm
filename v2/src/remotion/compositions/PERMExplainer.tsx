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
import { StageCard } from "../components/StageCard";

/**
 * PERMExplainer - Animated explainer of the 4 PERM stages + approval.
 *
 * Scenes (with 12-15 frame transition overlaps between each):
 * 1. Intro title (frames 0-90)
 * 2. PWD Request stage (frames ~90-180)
 * 3. Recruitment stage (frames ~180-270)
 * 4. ETA 9089 Filing stage (frames ~270-360)
 * 5. I-140 Filing stage (frames ~360-450)
 * 6. Approval + CTA (frames ~450-600)
 *
 * 600 frames @ 30fps = 20 seconds
 */

type PERMExplainerProps = {
  brandColor: string;
};

interface PERMStage {
  badge: string;
  title: string;
  description: string;
  color: string;
  meta: Array<{ text: string }>;
}

const STAGES: PERMStage[] = [
  {
    badge: "1",
    title: "PWD Request",
    description:
      "Submit prevailing wage determination to the DOL. Processing takes 4-6 months. Valid for 1 year.",
    color: "#0066FF",
    meta: [{ text: "4-6 months" }, { text: "Valid 1 year" }],
  },
  {
    badge: "2",
    title: "Recruitment",
    description:
      "Conduct required recruitment: Sunday newspaper ads, job orders, and additional methods for professional roles.",
    color: "#9333ea",
    meta: [{ text: "2 Sunday ads" }, { text: "30+ day job order" }],
  },
  {
    badge: "3",
    title: "ETA 9089 Filing",
    description:
      "File the PERM application 30-180 days after recruitment ends. Must file before PWD expires.",
    color: "#D97706",
    meta: [{ text: "30-180 day window" }, { text: "6-12 months review" }],
  },
  {
    badge: "4",
    title: "I-140 Filing",
    description:
      "File I-140 petition within 180 days of PERM certification. Premium processing available.",
    color: "#059669",
    meta: [{ text: "180 day deadline" }, { text: "Premium: 15 days" }],
  },
  {
    badge: "✓",
    title: "Approved!",
    description:
      "Case approved. Priority date secured. The green card journey continues from here.",
    color: "#2ECC40",
    meta: [{ text: "Priority date locked" }, { text: "Case complete" }],
  },
];

/* ---------- Scene: Intro ---------- */
const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();

  const bgShift = interpolate(frame, [0, 90], [0, 8], {
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
      {/* Dot grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(46,204,64,0.12) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          transform: `translateY(${bgShift}px)`,
        }}
      />

      <AnimatedText
        text="The PERM Process"
        fontSize={80}
        fontWeight={800}
        color="#ffffff"
        delay={5}
        mode="word-reveal"
        textAlign="center"
      />

      <div style={{ marginTop: 20 }}>
        <AnimatedText
          text="4 stages to green card approval"
          fontSize={30}
          fontFamily="'Inter', system-ui, sans-serif"
          fontWeight={400}
          color="rgba(255,255,255,0.6)"
          delay={25}
          mode="fade-up"
          textAlign="center"
        />
      </div>

      {/* Stage color dots preview */}
      <Sequence from={35} layout="none" >
        <StageDotsPreview />
      </Sequence>
    </div>
  );
};

const StageDotsPreview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        marginTop: 48,
        alignItems: "center",
      }}
    >
      {STAGES.map((s, i) => {
        const dotSpring = spring({
          frame,
          fps,
          delay: i * 4,
          config: { damping: 8, stiffness: 200 },
        });
        const scale = interpolate(dotSpring, [0, 1], [0, 1]);

        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 16,
                height: 16,
                backgroundColor: s.color,
                border: "2px solid rgba(255,255,255,0.2)",
                transform: `scale(${scale})`,
              }}
            />
            {i < STAGES.length - 1 && (
              <div
                style={{
                  width: 40,
                  height: 2,
                  backgroundColor: "rgba(255,255,255,0.15)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ---------- Scene: Stage Detail ---------- */
const StageScene: React.FC<{
  stageIndex: number;
  brandColor: string;
}> = ({ stageIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stage = STAGES[stageIndex]!;

  // Animated timeline connector
  const lineProgress = interpolate(frame, [0, fps * 1], [0, 100], {
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
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Left: Stage number large background */}
      <div
        style={{
          position: "absolute",
          top: -40,
          left: 40,
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          fontSize: 400,
          fontWeight: 900,
          color: `${stage.color}10`,
          lineHeight: 1,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {stage.badge}
      </div>

      {/* Timeline on left */}
      <div
        style={{
          width: 80,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 60,
        }}
      >
        {/* Vertical line progress */}
        <div
          style={{
            width: 3,
            height: "70%",
            backgroundColor: "rgba(255,255,255,0.08)",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "100%",
              height: `${lineProgress}%`,
              backgroundColor: stage.color,
            }}
          />
        </div>

        {/* Stage dots */}
        {STAGES.map((s, i) => {
          const isActive = i === stageIndex;
          const isPast = i < stageIndex;
          const dotSpring = spring({
            frame,
            fps,
            delay: 5 + i * 3,
            config: { damping: 200 },
          });
          const dotScale = interpolate(dotSpring, [0, 1], [0, 1]);

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: `${15 + i * 15}%`,
                width: isActive ? 20 : 12,
                height: isActive ? 20 : 12,
                backgroundColor: isPast || isActive ? s.color : "rgba(255,255,255,0.15)",
                border: isActive ? "3px solid #fff" : "2px solid rgba(255,255,255,0.1)",
                transform: `scale(${dotScale})`,
              }}
            />
          );
        })}
      </div>

      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 80px 60px 40px",
        }}
      >
        {/* Stage label */}
        <Sequence from={0} layout="none">
          <div
            style={{
              backgroundColor: stage.color,
              border: "2px solid #1a1a1a",
              padding: "4px 16px",
              display: "inline-block",
              marginBottom: 20,
              width: "fit-content",
            }}
          >
            <AnimatedText
              text={`STAGE ${stage.badge}`}
              fontSize={14}
              fontWeight={700}
              color="#000000"
              delay={3}
            />
          </div>
        </Sequence>

        <StageCard
          badge={stage.badge}
          title={stage.title}
          description={stage.description}
          stageColor={stage.color}
          delay={8}
          meta={stage.meta}
        />
      </div>

      {/* Right side: decorative element */}
      <div
        style={{
          position: "absolute",
          right: 60,
          top: "50%",
          transform: "translateY(-50%)",
          width: 300,
          height: 300,
          border: `3px solid ${stage.color}30`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 200,
            height: 200,
            backgroundColor: `${stage.color}12`,
            border: `2px solid ${stage.color}25`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: 100,
              fontWeight: 900,
              color: `${stage.color}40`,
            }}
          >
            {stage.badge}
          </span>
        </div>
      </div>
    </div>
  );
};

/* ---------- Scene: Approval / CTA ---------- */
const ApprovalScene: React.FC<{ brandColor: string }> = ({ brandColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Celebration particles
  const particles = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * Math.PI * 2;
    const particleSpring = spring({
      frame,
      fps,
      delay: 15 + i * 2,
      config: { damping: 15, stiffness: 100 },
    });
    const distance = interpolate(particleSpring, [0, 1], [0, 200 + i * 15]);
    const opacity = interpolate(particleSpring, [0, 0.7, 1], [0, 1, 0.3]);
    const size = 8 + (i % 3) * 4;

    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      opacity,
      size,
      color: STAGES[i % STAGES.length]!.color,
    };
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
      {/* Celebration particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            opacity: p.opacity,
            transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px))`,
          }}
        />
      ))}

      {/* Checkmark */}
      <Sequence from={5} layout="none" >
        <CheckmarkAnimation brandColor={brandColor} />
      </Sequence>

      <div style={{ marginTop: 32 }}>
        <AnimatedText
          text="Case Approved!"
          fontSize={72}
          fontWeight={800}
          color="#ffffff"
          delay={20}
          mode="fade-up"
          textAlign="center"
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <AnimatedText
          text="Track every stage with PERM Tracker"
          fontSize={28}
          fontFamily="'Inter', system-ui, sans-serif"
          fontWeight={400}
          color="rgba(255,255,255,0.6)"
          delay={30}
          mode="fade-up"
          textAlign="center"
        />
      </div>

      {/* CTA */}
      <Sequence from={40} layout="none" >
        <div
          style={{
            marginTop: 40,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <CTAButton brandColor={brandColor} />
          <AnimatedText
            text="permtracker.app"
            fontSize={18}
            fontFamily="'Inter', system-ui, sans-serif"
            fontWeight={500}
            color="rgba(255,255,255,0.4)"
            delay={10}
            mode="fade-up"
            textAlign="center"
          />
        </div>
      </Sequence>
    </div>
  );
};

const CheckmarkAnimation: React.FC<{ brandColor: string }> = ({
  brandColor,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 180 },
  });
  const scaleVal = interpolate(scale, [0, 1], [0, 1]);

  return (
    <div
      style={{
        width: 120,
        height: 120,
        backgroundColor: brandColor,
        border: "4px solid #1a1a1a",
        boxShadow: "8px 8px 0 #1a1a1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${scaleVal})`,
      }}
    >
      <span
        style={{
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          fontSize: 64,
          fontWeight: 900,
          color: "#000",
        }}
      >
        ✓
      </span>
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
  const scaleVal = interpolate(entrance, [0, 1], [0.8, 1]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]);

  return (
    <div style={{ transform: `scale(${scaleVal})`, opacity }}>
      <div
        style={{
          backgroundColor: brandColor,
          border: "3px solid #1a1a1a",
          boxShadow: "6px 6px 0 #1a1a1a",
          padding: "14px 40px",
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          fontSize: 20,
          fontWeight: 700,
          color: "#000",
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        Start Tracking Now
      </div>
    </div>
  );
};

/* ---------- Main Composition ---------- */
export const PERMExplainer: React.FC<PERMExplainerProps> = ({ brandColor }) => {
  return (
    <TransitionSeries>
      {/* Intro */}
      <TransitionSeries.Sequence durationInFrames={90}>
        <IntroScene />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 12 })}
      />

      {/* Stage 1: PWD */}
      <TransitionSeries.Sequence durationInFrames={90}>
        <StageScene stageIndex={0} brandColor={brandColor} />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: 12 })}
      />

      {/* Stage 2: Recruitment */}
      <TransitionSeries.Sequence durationInFrames={90}>
        <StageScene stageIndex={1} brandColor={brandColor} />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: 12 })}
      />

      {/* Stage 3: ETA 9089 */}
      <TransitionSeries.Sequence durationInFrames={90}>
        <StageScene stageIndex={2} brandColor={brandColor} />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={slide({ direction: "from-right" })}
        timing={linearTiming({ durationInFrames: 12 })}
      />

      {/* Stage 4: I-140 */}
      <TransitionSeries.Sequence durationInFrames={90}>
        <StageScene stageIndex={3} brandColor={brandColor} />
      </TransitionSeries.Sequence>

      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 15 })}
      />

      {/* Approval + CTA */}
      <TransitionSeries.Sequence durationInFrames={150}>
        <ApprovalScene brandColor={brandColor} />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
