import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zero Council — Multi-Agent BYOK AI Workspace',
    short_name: 'Zero Council',
    description:
      'Convene multiple AI advisors and custom bots with your own API keys in one structured workspace.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0c0c12',
    theme_color: '#6d5efc',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
