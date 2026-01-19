'use client';

import { useEffect, useState } from 'react';
import { useJarvisStore } from '../lib/store';
import { jarvisAPI } from '../lib/api';

const formatTimestamp = (value) => {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString();
};

export default function MemoryPanel() {
  const [userId, setUserId] = useState('default');
  const [memory, setMemory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMemory = async () => {
    setIsLoading(true);
    setError(null);

    const data = await jarvisAPI.getMemory(userId, 50);
    if (data.success) {
      setMemory(data.messages || []);
    } else {
      setMemory([]);
      setError(data.error || 'Unable to load memory.');
    }

    setIsLoading(false);
  };

  const handleClear = async () => {
    setIsLoading(true);
    setError(null);

    const result = await jarvisAPI.clearMemory(userId);
    if (result.success) {
      setMemory([]);
    } else {
      setError(result.error || 'Unable to clear memory.');
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchMemory();
  }, [userId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="glass p-6 rounded-2xl panel-card lg:col-span-1">
        <p className="panel-kicker">Recall</p>
        <h3 className="panel-title">Memory Archive</h3>
        <p className="panel-subtitle">Review and manage stored conversations.</p>

        <label className="block text-sm text-white/60 mt-6 mb-2">User ID</label>
        <input
          type="text"
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          className="w-full bg-black/30 border border-jarvis-blue/30 rounded-lg px-4 py-3 text-white"
        />

        <div className="mt-6 space-y-3">
          <button onClick={fetchMemory} className="btn-secondary w-full" disabled={isLoading}>
            {isLoading ? 'Refreshing...' : 'Refresh Memory'}
          </button>
          <button onClick={handleClear} className="btn-primary w-full" disabled={isLoading}>
            Clear Memory
          </button>
        </div>

        {error && <div className="mt-4 text-sm text-jarvis-red">{error}</div>}
      </div>

      <div className="glass p-6 rounded-2xl panel-card lg:col-span-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="panel-kicker">History</p>
            <h3 className="panel-title">Conversation Logs</h3>
          </div>
          <span className="status-chip chip-neutral">{memory.length} entries</span>
        </div>

        <div className="mt-6 space-y-4 memory-scroll">
          {memory.length === 0 && !isLoading && (
            <div className="text-white/50 text-sm">No memory entries available.</div>
          )}

          {memory.map((item, index) => (
            <div key={`${item.timestamp || 'entry'}-${index}`} className="memory-item">
              <div className="memory-meta">{formatTimestamp(item.timestamp)}</div>
              <div className="memory-message">User: {item.message}</div>
              <div className="memory-response">Jarvis: {item.response}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
