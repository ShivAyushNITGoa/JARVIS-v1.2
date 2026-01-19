'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useJarvisStore } from '@/lib/store';
import { jarvisAPI } from '@/lib/api';

const GESTURE_LABELS = {
  Closed_Fist: 'Closed Fist',
  Open_Palm: 'Open Palm',
  Pointing_Up: 'Pointing Up',
  Thumb_Up: 'Thumb Up',
  Thumb_Down: 'Thumb Down',
  Victory: 'Victory',
};

const POSE_LABELS = {
  hands_up: 'Hands Up',
  hands_down: 'Hands Down',
};

const ACTION_OPTIONS = [
  { value: 'toggle', label: 'Toggle' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
];

export default function ControlStudioPanel({ isActive = false }) {
  const {
    attachmentHistory,
    clearAttachmentHistory,
    gestureMappings,
    poseMappings,
    setGestureMapping,
    setPoseMapping,
    setGestureMappings,
    setPoseMappings,
    cooldowns,
    setCooldown,
    setCooldowns,
    activityTimeline,
    setActivityTimeline,
    clearActivityTimeline,
    devices,
  } = useJarvisStore();

  const [syncState, setSyncState] = useState('idle');
  const [syncError, setSyncError] = useState(null);
  const [importError, setImportError] = useState(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDevice, setFilterDevice] = useState('all');
  const importInputRef = useRef(null);

  const deviceOptions = useMemo(() => {
    const deviceKeys = Object.keys(devices).filter(
      (key) => key !== 'esp32_connected' && key !== 'thermostat'
    );
    return ['all', ...deviceKeys];
  }, [devices]);

  const filteredTimeline = useMemo(() => {
    return activityTimeline.filter((entry) => {
      const categoryMatch = filterCategory === 'all' || entry.category === filterCategory;
      const deviceMatch = filterDevice === 'all' || entry.device === filterDevice;
      return categoryMatch && deviceMatch;
    });
  }, [activityTimeline, filterCategory, filterDevice]);

  const formatExportTimestamp = () => {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  };

  const persistSettings = async (nextSettings) => {
    setSyncState('saving');
    setSyncError(null);
    const response = await jarvisAPI.updateAutomationSettings(nextSettings);
    if (!response.success) {
      setSyncError(response.error || 'Sync failed.');
    }
    setSyncState('ready');
  };

  const handleGestureChange = (gesture, mapping) => {
    const nextMappings = { ...gestureMappings, [gesture]: mapping };
    setGestureMapping(gesture, mapping);
    persistSettings({
      gesture_mappings: nextMappings,
      pose_mappings: poseMappings,
      cooldowns,
    });
  };

  const handlePoseChange = (pose, mapping) => {
    const nextMappings = { ...poseMappings, [pose]: mapping };
    setPoseMapping(pose, mapping);
    persistSettings({
      gesture_mappings: gestureMappings,
      pose_mappings: nextMappings,
      cooldowns,
    });
  };

  const handleCooldownChange = (category, key, value) => {
    const parsed = Math.max(0, Number(value) || 0);
    const nextCooldowns = {
      ...cooldowns,
      [category]: {
        ...cooldowns[category],
        [key]: parsed,
      },
    };
    setCooldown(category, key, parsed);
    persistSettings({
      gesture_mappings: gestureMappings,
      pose_mappings: poseMappings,
      cooldowns: nextCooldowns,
    });
  };

  const handleClearTimeline = async () => {
    await jarvisAPI.clearAutomationTimeline();
    clearActivityTimeline();
  };

  const handleExportTimeline = () => {
    const exportedAt = new Date().toISOString();
    const payload = {
      schema_version: 1,
      exported_at: exportedAt,
      filters: {
        category: filterCategory,
        device: filterDevice,
      },
      events: filteredTimeline,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jarvis-automation-timeline-${formatExportTimestamp()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSettings = () => {
    const exportedAt = new Date().toISOString();
    const payload = {
      schema_version: 1,
      exported_at: exportedAt,
      settings: {
        gesture_mappings: gestureMappings,
        pose_mappings: poseMappings,
        cooldowns,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jarvis-automation-settings-${formatExportTimestamp()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSettings = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setImportError(null);
      const text = await file.text();
      const payload = JSON.parse(text);
      const settingsPayload = payload.settings || payload;
      const nextGesture = settingsPayload.gesture_mappings || gestureMappings;
      const nextPose = settingsPayload.pose_mappings || poseMappings;
      const nextCooldowns = settingsPayload.cooldowns || cooldowns;

      setGestureMappings(nextGesture);
      setPoseMappings(nextPose);
      setCooldowns(nextCooldowns);

      const response = await jarvisAPI.updateAutomationSettings({
        gesture_mappings: nextGesture,
        pose_mappings: nextPose,
        cooldowns: nextCooldowns,
      });
      if (!response.success) {
        setImportError(response.error || 'Import rejected by server.');
      }
    } catch (error) {
      setImportError('Invalid settings file.');
    } finally {
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    let timelineInterval = null;
    let settingsInterval = null;

    const fetchAutomation = async () => {
      if (!isActive) return;
      setSyncState('loading');
      setSyncError(null);
      const settings = await jarvisAPI.getAutomationSettings();
      const timeline = await jarvisAPI.getAutomationTimeline(80);

      if (!mounted) return;

      if (settings.success && settings.settings) {
        setGestureMappings(settings.settings.gesture_mappings || gestureMappings);
        setPoseMappings(settings.settings.pose_mappings || poseMappings);
        if (settings.settings.cooldowns) {
          setCooldowns(settings.settings.cooldowns);
        }
      } else if (!settings.success) {
        setSyncError(settings.error || 'Unable to load automation settings.');
      }

      if (timeline.success) {
        setActivityTimeline(timeline.events || []);
      } else if (!timeline.success) {
        setSyncError(timeline.error || 'Unable to load timeline.');
      }

      setSyncState('ready');
    };

    const refreshTimeline = async () => {
      if (!isActive) return;
      const timeline = await jarvisAPI.getAutomationTimeline(80);
      if (!mounted) return;
      if (timeline.success) {
        setActivityTimeline(timeline.events || []);
      }
    };

    const refreshSettings = async () => {
      if (!isActive) return;
      const settings = await jarvisAPI.getAutomationSettings();
      if (!mounted) return;
      if (settings.success && settings.settings) {
        setGestureMappings(settings.settings.gesture_mappings || gestureMappings);
        setPoseMappings(settings.settings.pose_mappings || poseMappings);
        if (settings.settings.cooldowns) {
          setCooldowns(settings.settings.cooldowns);
        }
      }
    };

    fetchAutomation();
    if (isActive) {
      timelineInterval = setInterval(refreshTimeline, 15000);
      settingsInterval = setInterval(refreshSettings, 60000);
    }
    return () => {
      mounted = false;
      if (timelineInterval) {
        clearInterval(timelineInterval);
      }
      if (settingsInterval) {
        clearInterval(settingsInterval);
      }
    };
  }, [isActive]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="glass p-6 rounded-2xl panel-card lg:col-span-1">
        <div className="flex items-center justify-between">
          <div>
            <p className="panel-kicker">Archive</p>
            <h3 className="panel-title">Attachment Vault</h3>
          </div>
          <button onClick={clearAttachmentHistory} className="btn-secondary">
            Clear
          </button>
        </div>
        <p className="panel-subtitle">Latest analysis results from uploads.</p>

        <div className="mt-6 space-y-4 attachment-history">
          {attachmentHistory.length === 0 && (
            <div className="text-white/50 text-sm">No attachments processed yet.</div>
          )}
          {attachmentHistory.map((entry) => (
            <div key={entry.id} className="history-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="history-title">{entry.name}</div>
                  <div className="history-meta">
                    {entry.type} · {Math.round(entry.size / 1024)} KB
                  </div>
                </div>
                <span className={`status-chip ${entry.status === 'success' ? 'chip-online' : 'chip-offline'}`}>
                  {entry.status === 'success' ? 'OK' : 'Error'}
                </span>
              </div>
              {entry.summary && <div className="history-body">{entry.summary}</div>}
              {!entry.summary && entry.preview && (
                <div className="history-body">{entry.preview}</div>
              )}
              {entry.transcript && (
                <div className="history-body">Transcript: {entry.transcript}</div>
              )}
              {entry.caption && (
                <div className="history-body">Caption: {entry.caption}</div>
              )}
              {entry.ocrText && (
                <div className="history-body">OCR: {entry.ocrText}</div>
              )}
              {entry.error && <div className="history-error">{entry.error}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 space-y-6">
        <div className="glass p-6 rounded-2xl panel-card">
          <div className="flex items-start justify-between">
            <div>
              <p className="panel-kicker">Automation</p>
              <h3 className="panel-title">Gesture Mapping</h3>
              <p className="panel-subtitle">Assign gestures to device actions.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleExportSettings} className="btn-secondary">
                Export
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handleImportSettings}
              />
              <button
                onClick={() => importInputRef.current?.click()}
                className="btn-secondary"
              >
                Import
              </button>
              <span className="status-chip chip-neutral">
                {syncState === 'saving'
                  ? 'Saving'
                  : syncState === 'loading'
                  ? 'Loading'
                  : 'Synced'}
              </span>
            </div>
          </div>
          {syncError && <div className="history-error mt-4">{syncError}</div>}
          {importError && <div className="history-error mt-2">{importError}</div>}

          <div className="mt-6 space-y-4">
            {Object.entries(gestureMappings).map(([gesture, mapping]) => (
              <div key={gesture} className="mapping-row">
                <div className="mapping-label">{GESTURE_LABELS[gesture] || gesture}</div>
                <select
                  value={mapping.device}
                  onChange={(event) =>
                    handleGestureChange(gesture, { ...mapping, device: event.target.value })
                  }
                  className="mapping-select"
                >
                  {deviceOptions.map((device) => (
                    <option key={`${gesture}-${device}`} value={device}>
                      {device.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <select
                  value={mapping.action}
                  onChange={(event) =>
                    handleGestureChange(gesture, { ...mapping, action: event.target.value })
                  }
                  className="mapping-select"
                >
                  {ACTION_OPTIONS.map((option) => (
                    <option key={`${gesture}-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={cooldowns?.gesture?.[gesture] ?? cooldowns?.gesture?.default ?? 4000}
                  onChange={(event) => handleCooldownChange('gesture', gesture, event.target.value)}
                  className="mapping-input"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-6 rounded-2xl panel-card">
          <p className="panel-kicker">Automation</p>
          <h3 className="panel-title">Pose Mapping</h3>
          <p className="panel-subtitle">Assign poses to device actions.</p>

          <div className="mt-6 space-y-4">
            {Object.entries(poseMappings).map(([pose, mapping]) => (
              <div key={pose} className="mapping-row">
                <div className="mapping-label">{POSE_LABELS[pose] || pose}</div>
                <select
                  value={mapping.device}
                  onChange={(event) =>
                    handlePoseChange(pose, { ...mapping, device: event.target.value })
                  }
                  className="mapping-select"
                >
                  {deviceOptions.map((device) => (
                    <option key={`${pose}-${device}`} value={device}>
                      {device.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <select
                  value={mapping.action}
                  onChange={(event) =>
                    handlePoseChange(pose, { ...mapping, action: event.target.value })
                  }
                  className="mapping-select"
                >
                  {ACTION_OPTIONS.map((option) => (
                    <option key={`${pose}-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={cooldowns?.pose?.[pose] ?? cooldowns?.pose?.default ?? 5000}
                  onChange={(event) => handleCooldownChange('pose', pose, event.target.value)}
                  className="mapping-input"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-6 rounded-2xl panel-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="panel-kicker">Timeline</p>
              <h3 className="panel-title">Automation Activity</h3>
              <p className="panel-subtitle">Latest automation triggers.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleExportTimeline} className="btn-secondary">
                Export
              </button>
              <button onClick={handleClearTimeline} className="btn-secondary">
                Clear
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <select
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value)}
              className="filter-select"
            >
              <option value="all">All Categories</option>
              <option value="gesture">Gesture</option>
              <option value="pose">Pose</option>
            </select>
            <select
              value={filterDevice}
              onChange={(event) => setFilterDevice(event.target.value)}
              className="filter-select"
            >
              <option value="all">All Devices</option>
              {deviceOptions.map((device) => (
                <option key={`filter-${device}`} value={device}>
                  {device.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 space-y-3 timeline-list">
            {filteredTimeline.length === 0 && (
              <div className="text-white/50 text-sm">No automation events yet.</div>
            )}
            {filteredTimeline.map((entry, index) => (
              <div key={`${entry.timestamp}-${index}`} className="timeline-card">
                <div className="timeline-header">
                  <span className="timeline-label">{entry.label}</span>
                  <span className="timeline-time">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="timeline-meta">
                  {entry.category} · {entry.device || 'n/a'} · {entry.action || 'n/a'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
