'use client';

import { useState, useEffect, useMemo } from 'react';
import { useJarvisStore } from '@/lib/store';
import { jarvisAPI } from '@/lib/api';

const DEVICE_ICONS = {
  light_living: '💡',
  light_bedroom: '💡',
  light_kitchen: '💡',
  fan_main: '🌀',
  fan_bedroom: '🌀',
  ac_main: '❄️',
  thermostat: '🌡️',
  tv: '📺',
  door: '🚪',
};

export default function DevicePanel() {
  const {
    devices,
    sensorData,
    updateDevice,
    updateSensorData,
    setLastSync,
    lastSync,
  } = useJarvisStore();
  const [loading, setLoading] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);

  // Poll device status
  useEffect(() => {
    let mounted = true;

    const fetchStatus = async () => {
      setIsSyncing(true);
      const result = await jarvisAPI.getDeviceStatus();
      if (!mounted) return;

      if (result.success) {
        Object.entries(result.devices || {}).forEach(([key, value]) => {
          updateDevice(key, value);
        });
        if (result.sensors) {
          updateSensorData(result.sensors);
        }
        if (result.timestamp) {
          setLastSync(result.timestamp);
        }
      }
      setIsSyncing(false);
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 7000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const groupedDevices = useMemo(() => {
    const entries = Object.entries(devices).filter(
      ([key]) => key !== 'esp32_connected' && key !== 'thermostat'
    );

    return {
      lighting: entries.filter(([key]) => key.startsWith('light')),
      climate: entries.filter(([key]) => key.startsWith('fan') || key.startsWith('ac')),
      other: entries.filter(([key]) => !key.startsWith('light') && !key.startsWith('fan') && !key.startsWith('ac')),
    };
  }, [devices]);

  const toggleDevice = async (deviceId) => {
    setLoading(prev => ({ ...prev, [deviceId]: true }));

    const action = devices[deviceId] ? 'off' : 'on';
    const result = await jarvisAPI.controlDevice(deviceId, action);

    if (result.success) {
      updateDevice(deviceId, !devices[deviceId]);
    }

    setLoading(prev => ({ ...prev, [deviceId]: false }));
  };

  const setThermostat = async (value) => {
    const result = await jarvisAPI.controlDevice('thermostat', 'set', value);
    if (result.success) {
      updateDevice('thermostat', value);
    }
  };

  const turnAllLights = async (state) => {
    const lightIds = Object.keys(devices).filter((key) => key.startsWith('light'));
    await Promise.all(
      lightIds.map((deviceId) => jarvisAPI.controlDevice(deviceId, state ? 'on' : 'off'))
    );
    lightIds.forEach((deviceId) => updateDevice(deviceId, state));
  };

  const turnAllOff = async () => {
    const deviceIds = Object.keys(devices).filter(
      (key) => key !== 'esp32_connected' && key !== 'thermostat'
    );

    await Promise.all(
      deviceIds.map((deviceId) => jarvisAPI.controlDevice(deviceId, 'off'))
    );

    deviceIds.forEach((deviceId) => updateDevice(deviceId, false));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {/* Sensor Cards */}
      <div className="glass p-6 rounded-2xl panel-card">
        <div className="flex items-center justify-between">
          <h3 className="text-jarvis-blue font-semibold flex items-center gap-2">
            &#x1F4E1; Sensors
          </h3>
          <span className="status-chip chip-neutral">
            {isSyncing
              ? 'Syncing...'
              : `Last: ${lastSync ? new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}`}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-black/30 p-4 rounded-xl text-center">
            <div className="text-3xl text-jarvis-blue font-bold">
              {sensorData.temperature}&#x2103;
            </div>
            <div className="text-white/60 text-sm">Temperature</div>
          </div>
          <div className="bg-black/30 p-4 rounded-xl text-center">
            <div className="text-3xl text-jarvis-blue font-bold">
              {sensorData.humidity}%
            </div>
            <div className="text-white/60 text-sm">Humidity</div>
          </div>
          <div className="bg-black/30 p-4 rounded-xl text-center">
            <div className="text-3xl text-jarvis-blue font-bold">
              {sensorData.light_level}
            </div>
            <div className="text-white/60 text-sm">Light Level</div>
          </div>
          <div className="bg-black/30 p-4 rounded-xl text-center">
            <div className={`text-3xl font-bold ${sensorData.motion ? 'text-jarvis-green' : 'text-white/40'}`}>
              {sensorData.motion ? '🚶' : '—'}
            </div>
            <div className="text-white/60 text-sm">Motion</div>
          </div>
        </div>
      </div>

      {/* Lighting Group */}
      <div className="glass p-6 rounded-2xl panel-card">
        <div className="flex items-center justify-between">
          <h3 className="text-jarvis-blue font-semibold">💡 Lighting</h3>
          <span className="text-xs text-white/50">{groupedDevices.lighting.length} units</span>
        </div>
        <div className="mt-4 space-y-3">
          {groupedDevices.lighting.map(([deviceId, state]) => (
            <div key={deviceId} className={`device-row ${state ? 'active' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{DEVICE_ICONS[deviceId] || '📟'}</span>
                <div>
                  <div className="font-medium capitalize">
                    {deviceId.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-white/50">{state ? 'On' : 'Off'}</div>
                </div>
              </div>
              <button
                onClick={() => toggleDevice(deviceId)}
                disabled={loading[deviceId]}
                className={`device-toggle ${state ? 'active' : ''} ${loading[deviceId] ? 'opacity-50' : ''}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Climate Group */}
      <div className="glass p-6 rounded-2xl panel-card">
        <div className="flex items-center justify-between">
          <h3 className="text-jarvis-blue font-semibold">🌀 Climate</h3>
          <span className="text-xs text-white/50">{groupedDevices.climate.length} units</span>
        </div>
        <div className="mt-4 space-y-3">
          {groupedDevices.climate.map(([deviceId, state]) => (
            <div key={deviceId} className={`device-row ${state ? 'active' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{DEVICE_ICONS[deviceId] || '📟'}</span>
                <div>
                  <div className="font-medium capitalize">
                    {deviceId.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-white/50">{state ? 'On' : 'Off'}</div>
                </div>
              </div>
              <button
                onClick={() => toggleDevice(deviceId)}
                disabled={loading[deviceId]}
                className={`device-toggle ${state ? 'active' : ''} ${loading[deviceId] ? 'opacity-50' : ''}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Other Devices */}
      {groupedDevices.other.length > 0 && (
        <div className="glass p-6 rounded-2xl panel-card">
          <div className="flex items-center justify-between">
            <h3 className="text-jarvis-blue font-semibold">📦 Other Devices</h3>
            <span className="text-xs text-white/50">{groupedDevices.other.length} units</span>
          </div>
          <div className="mt-4 space-y-3">
            {groupedDevices.other.map(([deviceId, state]) => (
              <div key={deviceId} className={`device-row ${state ? 'active' : ''}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">{DEVICE_ICONS[deviceId] || '📟'}</span>
                  <div>
                    <div className="font-medium capitalize">
                      {deviceId.replace(/_/g, ' ')}
                    </div>
                    <div className="text-xs text-white/50">{state ? 'On' : 'Off'}</div>
                  </div>
                </div>
                <button
                  onClick={() => toggleDevice(deviceId)}
                  disabled={loading[deviceId]}
                  className={`device-toggle ${state ? 'active' : ''} ${loading[deviceId] ? 'opacity-50' : ''}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Thermostat */}
      <div className="glass p-6 rounded-2xl panel-card">
        <h3 className="text-jarvis-blue font-semibold mb-4 flex items-center gap-2">
          🌡️ Thermostat
        </h3>
        <div className="text-center">
          <div className="text-5xl font-bold text-jarvis-orange mb-4">
            {devices.thermostat}°C
          </div>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setThermostat(devices.thermostat - 1)}
              className="btn-icon"
            >
              −
            </button>
            <input
              type="range"
              min="16"
              max="30"
              value={devices.thermostat}
              onChange={(e) => setThermostat(parseInt(e.target.value))}
              className="w-full"
            />
            <button
              onClick={() => setThermostat(devices.thermostat + 1)}
              className="btn-icon"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass p-6 rounded-2xl panel-card">
        <h3 className="text-jarvis-blue font-semibold mb-4">⚡ Quick Actions</h3>
        <div className="space-y-3">
          <button onClick={() => turnAllLights(true)} className="btn-secondary w-full">
            Turn On All Lights
          </button>
          <button onClick={() => turnAllLights(false)} className="btn-secondary w-full">
            Turn Off All Lights
          </button>
          <button onClick={turnAllOff} className="btn-secondary w-full">
            All Devices Off
          </button>
        </div>
      </div>

      {/* ESP32 Status */}
      <div className="glass p-6 rounded-2xl panel-card">
        <h3 className="text-jarvis-blue font-semibold mb-4">📡 ESP32-S3 Status</h3>
        <div className={`flex items-center gap-3 ${devices.esp32_connected ? 'text-jarvis-green' : 'text-jarvis-red'}`}>
          <div className={`w-3 h-3 rounded-full ${devices.esp32_connected ? 'bg-jarvis-green' : 'bg-jarvis-red'} animate-pulse`} />
          <span>{devices.esp32_connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <div className="mt-4 text-sm text-white/60">
          <p>Last sync: {lastSync ? new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
          <p>Server: {devices.esp32_connected ? 'Live feed' : 'Awaiting link'}</p>
        </div>
      </div>
    </div>
  );
}