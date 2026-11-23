import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #171728 0%, #0c0c12 100%)',
          borderRadius: 40,
        }}
      >
        <svg width="136" height="136" viewBox="0 0 64 64">
          <ellipse
            cx="32"
            cy="32"
            rx="24"
            ry="11"
            transform="rotate(-24 32 32)"
            fill="none"
            stroke="#8b7bff"
            strokeWidth="2.4"
          />
          <ellipse
            cx="32"
            cy="32"
            rx="24"
            ry="11"
            transform="rotate(36 32 32)"
            fill="none"
            stroke="#fbbf24"
            strokeWidth="2.1"
          />
          <circle cx="32" cy="32" r="11" fill="#6d5efc" />
          <circle cx="11" cy="23" r="4.8" fill="#ff80b0" />
          <circle cx="53" cy="41" r="4.8" fill="#34d399" />
          <circle cx="47" cy="15" r="4.5" fill="#fbbf24" />
          <circle cx="17" cy="49" r="4.5" fill="#7aa2ff" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
