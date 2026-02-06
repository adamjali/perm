/**
 * TimelineSVG - Horizontal progress timeline with milestones
 * Used in: journey section, how-it-works, timeline page empty state
 * Style: Neobrutalist - bold strokes, lime green accents, stage colors
 */

interface TimelineSVGProps {
  className?: string;
  size?: number;
}

export function TimelineSVG({ className = "", size = 200 }: TimelineSVGProps) {
  const stageColors = ["#0066FF", "#9333ea", "#D97706", "#059669", "#2ECC40"];

  return (
    <svg
      width={size}
      height={size * 0.5}
      viewBox="0 0 400 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Background track */}
      <line x1="30" y1="50" x2="370" y2="50" stroke="currentColor" strokeWidth="3" opacity="0.15" />

      {/* Progress fill */}
      <line x1="30" y1="50" x2="280" y2="50" stroke="#2ECC40" strokeWidth="4" />

      {/* Milestone nodes */}
      {stageColors.map((color, i) => {
        const x = 30 + i * 85;
        const isCompleted = i < 3;
        const isCurrent = i === 3;

        return (
          <g key={i}>
            {/* Connector segment (colored) */}
            {i > 0 && i <= 3 && (
              <line
                x1={x - 85}
                y1="50"
                x2={x}
                y2="50"
                stroke={stageColors[i - 1]}
                strokeWidth="4"
              />
            )}

            {/* Node circle */}
            <circle
              cx={x}
              cy="50"
              r={isCurrent ? "16" : "14"}
              fill={isCompleted || isCurrent ? color : "white"}
              stroke="currentColor"
              strokeWidth="3"
            />

            {/* Checkmark for completed */}
            {isCompleted && (
              <path
                d={`M${x - 6} 50 L${x - 2} 55 L${x + 6} 45`}
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="square"
              />
            )}

            {/* Current pulse ring */}
            {isCurrent && (
              <circle
                cx={x}
                cy="50"
                r="22"
                fill="none"
                stroke={color}
                strokeWidth="2"
                opacity="0.3"
              />
            )}

            {/* Step number for incomplete */}
            {!isCompleted && !isCurrent && (
              <text
                x={x}
                y="55"
                textAnchor="middle"
                fill="currentColor"
                fontSize="12"
                fontWeight="900"
                fontFamily="var(--font-heading), system-ui"
                opacity="0.4"
              >
                {i + 1}
              </text>
            )}

            {/* Current step number */}
            {isCurrent && (
              <text
                x={x}
                y="55"
                textAnchor="middle"
                fill="white"
                fontSize="12"
                fontWeight="900"
                fontFamily="var(--font-heading), system-ui"
              >
                {i + 1}
              </text>
            )}

            {/* Label */}
            <text
              x={x}
              y={i % 2 === 0 ? 22 : 82}
              textAnchor="middle"
              fill="currentColor"
              fontSize="9"
              fontWeight="700"
              fontFamily="var(--font-heading), system-ui"
              opacity={isCompleted || isCurrent ? 1 : 0.4}
            >
              {["PWD", "RECRUIT", "ETA 9089", "I-140", "DONE"][i]}
            </text>
          </g>
        );
      })}

      {/* Flag at end */}
      <g transform="translate(370, 35)">
        <line x1="0" y1="0" x2="0" y2="30" stroke="currentColor" strokeWidth="2" />
        <path d="M0 0 L18 5 L0 12 Z" fill="#2ECC40" stroke="currentColor" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
