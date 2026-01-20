export const metadata = {
  title: 'Offline - JARVIS',
  description: 'You are currently offline.',
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-jarvis-dark text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-jarvis-blue mb-4">Offline</h1>
        <p className="text-white/70">
          It seems you've lost your connection. Please check your network and try again.
        </p>
      </div>
    </div>
  );
}
