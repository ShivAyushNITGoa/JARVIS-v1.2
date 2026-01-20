const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://mainhushivam-jarvis-v1-2.hf.space';

const request = async (path, options = {}, token) => {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

const mapDeviceStates = (devices = {}) => {
  const mapped = {};

  Object.entries(devices).forEach(([deviceId, device]) => {
    if (!device || typeof device !== 'object') return;

    if (deviceId === 'thermostat' || device.type === 'thermostat') {
      mapped.thermostat = device.temperature ?? 22;
      return;
    }

    mapped[deviceId] = Boolean(device.state);
  });

  return mapped;
};

export const jarvisAPI = {
  async getStatus() {
    try {
      const data = await request('/');
      return {
        status: data?.status || 'online',
        version: data?.version,
      };
    } catch (error) {
      console.error('Status error:', error);
      return { status: 'offline', error: error.message };
    }
  },

  async chat(message, context = {}, token) {
    try {
      const userId = context.user_id || 'default';
      const data = await request('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message, user_id: userId }),
      }, token);

      return { success: true, ...data };
    } catch (error) {
      console.error('Chat error:', error);
      return { success: false, error: error.message };
    }
  },

  async controlDevice(device, action, value = null, token) {
    try {
      const payload = { device, action };
      if (value !== null && value !== undefined) {
        payload.value = value;
      }

      const data = await request('/api/devices/control', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, token);

      return { success: Boolean(data?.success), ...data };
    } catch (error) {
      console.error('Device control error:', error);
      return { success: false, error: error.message };
    }
  },

  async getDeviceStatus(token) {
    try {
      const data = await request('/api/devices/status', {}, token);
      return {
        success: true,
        devices: {
          esp32_connected: true,
          ...mapDeviceStates(data?.devices),
        },
        sensors: data?.sensors || {},
        timestamp: data?.timestamp,
      };
    } catch (error) {
      console.error('Get status error:', error);
      return { success: false, error: error.message };
    }
  },

  async sendSensorData(sensorData, token) {
    try {
      const data = await request('/api/devices/sensors', {
        method: 'POST',
        body: JSON.stringify(sensorData),
      }, token);

      return { success: true, ...data };
    } catch (error) {
      console.error('Sensor data error:', error);
      return { success: false, error: error.message };
    }
  },

  async search(query, token) {
    try {
      const params = new URLSearchParams({ q: query, max_results: '5' });
      const data = await request(`/api/search?${params.toString()}`, {}, token);
      return { success: true, ...data };
    } catch (error) {
      console.error('Search error:', error);
      return { success: false, error: error.message };
    }
  },

  async getWeather(location = '', token) {
    try {
      const params = new URLSearchParams({ location });
      const data = await request(`/api/weather?${params.toString()}`, {}, token);
      return { success: true, ...data };
    } catch (error) {
      console.error('Weather error:', error);
      return { success: false, error: error.message };
    }
  },

  async getMemory(userId = 'default', limit = 20, token) {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      const data = await request(`/api/memory/${userId}?${params.toString()}`, {}, token);
      return { success: true, ...data };
    } catch (error) {
      console.error('Memory error:', error);
      return { success: false, error: error.message };
    }
  },

  async clearMemory(userId = 'default', token) {
    try {
      const data = await request(`/api/memory/${userId}`, { method: 'DELETE' }, token);
      return { success: true, ...data };
    } catch (error) {
      console.error('Clear memory error:', error);
      return { success: false, error: error.message };
    }
  },

  async analyzeFile(file, token) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/files/analyze`, {
        method: 'POST',
        body: formData,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      return { success: true, ...data };
    } catch (error) {
      console.error('File analysis error:', error);
      return { success: false, error: error.message };
    }
  },

  async getAutomationSettings(token) {
    try {
      const data = await request('/api/automation/settings', {}, token);
      return { success: true, ...data };
    } catch (error) {
      console.error('Automation settings error:', error);
      // Return default settings if endpoint not found
      if (error.message.includes('Not Found') || error.message.includes('404')) {
        return { 
          success: true, 
          settings: {
            gesture_mappings: {},
            pose_mappings: {},
            cooldowns: { default: 4000 }
          }
        };
      }
      return { success: false, error: error.message };
    }
  },

  async updateAutomationSettings(payload, token) {
    try {
      const data = await request('/api/automation/settings', {
        method: 'POST',
        body: JSON.stringify(payload),
      }, token);
      return { success: true, ...data };
    } catch (error) {
      console.error('Automation update error:', error);
      return { success: false, error: error.message };
    }
  },

  async getAutomationTimeline(limit = 50, token) {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      const data = await request(`/api/automation/timeline?${params.toString()}`, {}, token);
      return { success: true, ...data };
    } catch (error) {
      console.error('Automation timeline error:', error);
      // Return empty timeline if endpoint not found
      if (error.message.includes('Not Found') || error.message.includes('404')) {
        return { 
          success: true, 
          events: [],
          total: 0
        };
      }
      return { success: false, error: error.message };
    }
  },

  async logAutomationEvent(event, token) {
    try {
      const data = await request('/api/automation/timeline', {
        method: 'POST',
        body: JSON.stringify(event),
      }, token);
      return { success: true, ...data };
    } catch (error) {
      console.error('Automation event error:', error);
      return { success: false, error: error.message };
    }
  },

  async clearAutomationTimeline(token) {
    try {
      const data = await request('/api/automation/timeline', { method: 'DELETE' }, token);
      return { success: true, ...data };
    } catch (error) {
      console.error('Automation timeline clear error:', error);
      return { success: false, error: error.message };
    }
  },
};
