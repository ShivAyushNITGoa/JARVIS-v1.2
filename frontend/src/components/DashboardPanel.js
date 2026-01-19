'use client';

import { useEffect, useMemo } from 'react';
import { useJarvisStore } from '@/lib/store';
import { jarvisAPI } from '@/lib/api';

const formatTime = (timestamp) => {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatTemp = (value) => (typeof value === 'number' ? `${value}°C` : '—');

export default function DashboardPanel() {
  const {
    devices,
    sensorData,
    serverStatus,
    serverVersion,
    lastSync,
    updateDevice,
    updateSensorData,
    setLastSync,
  } = useJarvisStore();

  useEffect(() => {
    let mounted = true;

    const fetchStatus = async () => {
      const result = await jarvisAPI.getDeviceStatus();
      if (!mounted || !result.success) return;

      Object.entries(result.devices || {}).forEach(([key, value]) => {
        updateDevice(key, value);
      });
      if (result.sensors) {
        updateSensorData(result.sensors);
      }
      if (result.timestamp) {
        setLastSync(result.timestamp);
      }
    };

    fetchStatus();
    return () => {
      mounted = false;
    };
  }, []);

  const deviceStats = useMemo(() => {
    const deviceEntries = Object.entries(devices).filter(
      ([key]) => key !== 'esp32_connected' && key !== 'thermostat'
    );
    const active = deviceEntries.filter(([, value]) => Boolean(value)).length;

    return {
      total: deviceEntries.length,
      active,
    };
  }, [devices]);

  const motionStatus = sensorData.motion ? 'Active' : 'Idle';
  const lastSyncLabel = formatTime(lastSync);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="glass p-6 rounded-2xl panel-card lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="panel-kicker">Command Center</p>
            <h2 className="panel-title">System Dashboard</h2>
            <p className="panel-subtitle">Live overview of sensors, devices, and server health.</p>
          </div>
          <div className={`status-badge ${serverStatus === 'online' ? 'online' : 'offline'}`}>
            <span className="status-dot" />
            {serverStatus === 'online' ? 'ONLINE' : 'OFFLINE'}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="metric-card">
            <p className="metric-label">Active Devices</p>
            <div className="metric-value">
              {deviceStats.active}
              <span className="metric-unit">/{deviceStats.total}</span>
            </div>
            <p className="metric-footnote">Synced with HF Space</p>
          </div>
          <div className="metric-card">
            <p className="metric-label">Thermostat</p>
            <div className="metric-value">
              {devices.thermostat ?? 22}
              <span className="metric-unit">°C</span>
            </div>
            <p className="metric-footnote">Climate core</p>
          </div>
          <div className="metric-card">
            <p className="metric-label">Last Sync</p>
            <div className="metric-value">{lastSyncLabel}</div>
            <p className="metric-footnote">Auto-refresh active</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="info-card">
            <p className="info-label">Server Version</p>
            <p className="info-value">{serverVersion ? `v${serverVersion}` : 'Not reported'}</p>
          </div>
          <div className="info-card">
            <p className="info-label">Motion Status</p>
            <p className={`info-value ${sensorData.motion ? 'text-jarvis-green' : 'text-white/70'}`}>
              {motionStatus}
            </p>
          </div>
        </div>
      </div>

      <div className="glass p-6 rounded-2xl panel-card">
        <p className="panel-kicker">Environment</p>
        <h3 className="panel-title">Sensor Telemetry</h3>
        <div className="mt-6 space-y-4">
          <div className="sensor-row">
            <span className="sensor-label">Temperature</span>
            <span className="sensor-value">{formatTemp(sensorData.temperature)}</span>
          </div>
          <div className="sensor-row">
            <span className="sensor-label">Humidity</span>
            <span className="sensor-value">{sensorData.humidity ?? '—'}%</span>
          </div>
          <div className="sensor-row">
            <span className="sensor-label">Light Level</span>
            <span className="sensor-value">{sensorData.light_level ?? '—'}</span>
          </div>
          <div className="sensor-row">
            <span className="sensor-label">Gas Level</span>
            <span className="sensor-value">{sensorData.gas_level ?? '—'}</span>
          </div>
        </div>
      </div>

      <div className="glass p-6 rounded-2xl panel-card">
        <p className="panel-kicker">Live Insights</p>
        <h3 className="panel-title">Operational Snapshot</h3>
        <ul className="mt-6 space-y-3">
          <li className="info-row">
            <span>Connectivity</span>
            <span className={`status-chip ${serverStatus === 'online' ? 'chip-online' : 'chip-offline'}`}>
              {serverStatus === 'online' ? 'Stable' : 'Disconnected'}
            </span>
          </li>
          <li className="info-row">
            <span>ESP32 Link</span>
            <span className={`status-chip ${devices.esp32_connected ? 'chip-online' : 'chip-offline'}`}>
              {devices.esp32_connected ? 'Linked' : 'Unavailable'}
            </span>
          </li>
          <li className="info-row">
            <span>Voice Engine</span>
            <span className="status-chip chip-neutral">Ready</span>
          </li>
          <li className="info-row">
            <span>Vision Suite</span>
            <span className="status-chip chip-neutral">Standby</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
