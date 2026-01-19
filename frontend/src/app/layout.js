import './globals.css';

export const metadata = {
  title: 'JARVIS - Advanced AI Assistant',
  description: 'AI Assistant with IoT Control, Face Recognition & 3D Interface',
  manifest: '/manifest.json',
  themeColor: '#00d4ff',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'JARVIS',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#00d4ff" />
      </head>
      <body className="bg-jarvis-dark text-white antialiased">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js')
                    .then((reg) => console.log('SW registered'))
                    .catch((err) => console.log('SW registration failed'));
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}