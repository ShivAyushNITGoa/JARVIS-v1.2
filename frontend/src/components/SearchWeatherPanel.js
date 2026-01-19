'use client';

import { useState } from 'react';
import { jarvisAPI } from '@/lib/api';

export default function SearchWeatherPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [location, setLocation] = useState('');
  const [weather, setWeather] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (event) => {
    event.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setError(null);

    const data = await jarvisAPI.search(query.trim());
    if (data.success) {
      setResults(data.results ?? data);
    } else {
      setResults(null);
      setError(data.error || 'Search failed.');
    }

    setIsSearching(false);
  };

  const handleWeather = async (event) => {
    event.preventDefault();
    setIsWeatherLoading(true);
    setError(null);

    const data = await jarvisAPI.getWeather(location.trim());
    if (data.success) {
      setWeather(data);
    } else {
      setWeather(null);
      setError(data.error || 'Weather lookup failed.');
    }

    setIsWeatherLoading(false);
  };

  const renderResults = () => {
    if (!results) return null;

    if (Array.isArray(results)) {
      return (
        <ul className="space-y-3">
          {results.map((item, index) => (
            <li key={`${item?.title || 'result'}-${index}`} className="result-card">
              <p className="result-title">{item?.title || 'Untitled'}</p>
              {item?.body && <p className="result-body">{item.body}</p>}
              {item?.url && (
                <a className="result-link" href={item.url} target="_blank" rel="noreferrer">
                  {item.url}
                </a>
              )}
            </li>
          ))}
        </ul>
      );
    }

    return <div className="result-body whitespace-pre-wrap">{String(results)}</div>;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="glass p-6 rounded-2xl panel-card">
        <p className="panel-kicker">Discovery</p>
        <h3 className="panel-title">Web Search</h3>
        <p className="panel-subtitle">Send queries to the Hugging Face Jarvis space.</p>

        <form onSubmit={handleSearch} className="mt-4 flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the web..."
            className="flex-1 bg-black/30 border border-jarvis-blue/30 rounded-full px-5 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-jarvis-blue"
          />
          <button type="submit" className="btn-primary" disabled={isSearching}>
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && <div className="mt-4 text-sm text-jarvis-red">{error}</div>}

        <div className="mt-6 space-y-4">
          {renderResults() || (
            <div className="text-white/50 text-sm">No results yet. Try a query.</div>
          )}
        </div>
      </div>

      <div className="glass p-6 rounded-2xl panel-card">
        <p className="panel-kicker">Environment</p>
        <h3 className="panel-title">Weather Feed</h3>
        <p className="panel-subtitle">Pull live weather data from the Space backend.</p>

        <form onSubmit={handleWeather} className="mt-4 flex gap-3">
          <input
            type="text"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Location (leave blank for auto)"
            className="flex-1 bg-black/30 border border-jarvis-blue/30 rounded-full px-5 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-jarvis-blue"
          />
          <button type="submit" className="btn-primary" disabled={isWeatherLoading}>
            {isWeatherLoading ? 'Loading...' : 'Get Weather'}
          </button>
        </form>

        {weather ? (
          <div className="mt-6 space-y-4">
            <div className="metric-card">
              <p className="metric-label">Current</p>
              <div className="metric-value">
                {weather.temperature}
                <span className="metric-unit">°C</span>
              </div>
              <p className="metric-footnote">Feels like {weather.feels_like}°C</p>
            </div>
            <div className="info-card">
              <p className="info-label">Condition</p>
              <p className="info-value">{weather.condition}</p>
            </div>
            <div className="info-card">
              <p className="info-label">Location</p>
              <p className="info-value">
                {weather.location}, {weather.country}
              </p>
            </div>
            <div className="info-card">
              <p className="info-label">Humidity / Wind</p>
              <p className="info-value">
                {weather.humidity}% / {weather.wind_kph} km/h
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 text-white/50 text-sm">No weather data yet.</div>
        )}
      </div>
    </div>
  );
}
