/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // PWA Configuration
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL ||
      'https://mainhushivam-jarvis-api.hf.space',
    NEXT_PUBLIC_WS_URL:
      process.env.NEXT_PUBLIC_WS_URL ||
      'wss://mainhushivam-jarvis-api.hf.space',
  },
};

module.exports = nextConfig;