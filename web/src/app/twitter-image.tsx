import { ImageResponse } from 'next/og';

export const alt = 'Zero Council — Multi-Agent BYOK AI Decision Council & Group Chat';

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = 'image/png';

const PROVIDERS = [
  'Anthropic',
  'OpenAI',
  'Gemini',
  'Groq',
  'xAI',
  'OpenRouter',
  'NVIDIA',
  'DeepSeek',
];

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '54px 64px',
          background: 'linear-gradient(135deg, #0c0c12 0%, #151427 58%, #1d1630 100%)',
          color: '#f4f4f7',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: '#19192b',
                border: '2px solid #353259',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="40" height="40" viewBox="0 0 64 64">
                <ellipse
                  cx="32"
                  cy="32"
                  rx="23"
                  ry="10"
                  transform="rotate(-24 32 32)"
                  fill="none"
                  stroke="#988cff"
                  strokeWidth="2.6"
                />
                <ellipse
                  cx="32"
                  cy="32"
                  rx="23"
                  ry="10"
                  transform="rotate(36 32 32)"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="2.2"
                />
                <circle cx="32" cy="32" r="10.5" fill="#6d5efc" />
                <circle cx="12" cy="23" r="4.5" fill="#ff80b0" />
                <circle cx="52" cy="41" r="4.5" fill="#34d399" />
                <circle cx="47" cy="16" r="4.2" fill="#fbbf24" />
                <circle cx="17" cy="48" r="4.2" fill="#7aa2ff" />
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#ffffff',
                }}
              >
                Zero Council
              </span>
              <span style={{ fontSize: '14px', color: '#b399ff', fontWeight: 600 }}>
                Multi-Agent BYOK AI Workspace · EN & VI
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 18px',
              borderRadius: '999px',
              background: 'rgba(109, 94, 252, 0.18)',
              border: '1.5px solid rgba(179, 153, 255, 0.4)',
              color: '#fbbf24',
              fontSize: '16px',
              fontWeight: 700,
            }}
          >
            <span>AES-256 BYOK · Zero Token Markup</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '980px' }}>
          <div
            style={{
              fontSize: '64px',
              fontWeight: 800,
              lineHeight: 1.06,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <span>See every angle.</span>
            <span style={{ color: '#b399ff' }}>Decide with clarity.</span>
          </div>
          <div
            style={{
              fontSize: '25px',
              lineHeight: 1.42,
              color: '#c7c7d9',
              maxWidth: '920px',
              display: 'flex',
            }}
          >
            Convene 2–8 AI advisors & custom bots in one group chat room. Structured Scenario, Six Thinking Hats & Decision Matrix frameworks on your own API keys.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            borderTop: '1px solid #2b2942',
            paddingTop: '22px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {PROVIDERS.map((provider) => (
                <div
                  key={provider}
                  style={{
                    display: 'flex',
                    padding: '7px 15px',
                    borderRadius: '999px',
                    background: '#1b1a2e',
                    border: '1px solid #32304f',
                    color: '#e6e6f0',
                    fontSize: '15px',
                    fontWeight: 600,
                  }}
                >
                  {provider}
                </div>
              ))}
              <div
                style={{
                  display: 'flex',
                  padding: '7px 15px',
                  borderRadius: '999px',
                  background: 'rgba(245, 158, 11, 0.14)',
                  border: '1px solid rgba(251, 191, 36, 0.45)',
                  color: '#fbbf24',
                  fontSize: '15px',
                  fontWeight: 700,
                }}
              >
                + Custom API
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
