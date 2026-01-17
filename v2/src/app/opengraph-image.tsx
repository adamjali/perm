import { ImageResponse } from 'next/og';

// Route segment config
export const runtime = 'edge';

// Image metadata
export const alt = 'PERM Tracker - Case Management for Immigration Attorneys';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

// Image generation
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fafaf9', // stone-50
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Background pattern - subtle grid */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              linear-gradient(to right, #e7e5e4 1px, transparent 1px),
              linear-gradient(to bottom, #e7e5e4 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            opacity: 0.5,
          }}
        />

        {/* Main container - neobrutalist card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 80px',
            backgroundColor: 'white',
            border: '4px solid #1c1917', // stone-900
            boxShadow: '12px 12px 0px 0px #1c1917',
            maxWidth: '900px',
          }}
        >
          {/* Logo/Icon area */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100px',
              height: '100px',
              backgroundColor: '#84cc16', // lime-500
              border: '3px solid #1c1917',
              marginBottom: '30px',
            }}
          >
            {/* Checkmark icon */}
            <svg
              width="60"
              height="60"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1c1917"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          {/* Title */}
          <div
            style={{
              display: 'flex',
              fontSize: '72px',
              fontWeight: 700,
              color: '#1c1917', // stone-900
              marginBottom: '16px',
              letterSpacing: '-2px',
            }}
          >
            PERM Tracker
          </div>

          {/* Accent line */}
          <div
            style={{
              display: 'flex',
              width: '200px',
              height: '8px',
              backgroundColor: '#84cc16', // lime-500
              marginBottom: '24px',
            }}
          />

          {/* Tagline */}
          <div
            style={{
              display: 'flex',
              fontSize: '28px',
              fontWeight: 500,
              color: '#57534e', // stone-600
              textAlign: 'center',
              maxWidth: '700px',
              lineHeight: 1.4,
            }}
          >
            Free PERM Case Tracking for Immigration Attorneys
          </div>

          {/* Feature pills */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              marginTop: '32px',
            }}
          >
            {['Deadlines', 'Validation', 'Free to Use'].map((feature) => (
              <div
                key={feature}
                style={{
                  display: 'flex',
                  padding: '10px 20px',
                  backgroundColor: '#ecfccb', // lime-100
                  border: '2px solid #1c1917',
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#1c1917',
                }}
              >
                {feature}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom accent bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '12px',
            backgroundColor: '#84cc16', // lime-500
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  );
}
