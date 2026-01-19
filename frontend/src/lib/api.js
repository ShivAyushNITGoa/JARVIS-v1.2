const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'https://mainhushivam-jarvis-api.hf.space';

const request = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
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

  async chat(message, context = {}) {
    try {
      const userId = context.user_id || 'default';
      const data = await request('/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message, user_id: userId }),
      });

      return { success: true, ...data };
    } catch (error) {
      console.error('Chat error:', error);
      return { success: false, error: error.message };
    }
  },

  async controlDevice(device, action, value = null) {
    try {
      const payload = { device, action };
      if (value !== null && value !== undefined) {
        payload.value = value;
      }

      const data = await request('/api/devices/control', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      return { success: Boolean(data?.success), ...data };
    } catch (error) {
      console.error('Device control error:', error);
      return { success: false, error: error.message };
    }
  },

  async getDeviceStatus() {
    try {
      const data = await request('/api/devices/status');
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

  async sendSensorData(sensorData) {
    try {
      const data = await request('/api/devices/sensors', {
        method: 'POST',
        body: JSON.stringify(sensorData),
      });

      return { success: true, ...data };
    } catch (error) {
      console.error('Sensor data error:', error);
      return { success: false, error: error.message };
    }
  },

  async search(query) {
    try {
      const params = new URLSearchParams({ q: query, max_results: '5' });
      const data = await request(`/api/search?${params.toString()}`);
      return { success: true, ...data };
    } catch (error) {
      console.error('Search error:', error);
      return { success: false, error: error.message };
    }
  },

  async getWeather(location = '') {
    try {
      const params = new URLSearchParams({ location });
      const data = await request(`/api/weather?${params.toString()}`);
      return { success: true, ...data };
    } catch (error) {
      console.error('Weather error:', error);
      return { success: false, error: error.message };
    }
  },

  async getMemory(userId = 'default', limit = 20) {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      const data = await request(`/api/memory/${userId}?${params.toString()}`);
      return { success: true, ...data };
    } catch (error) {
      console.error('Memory error:', error);
      return { success: false, error: error.message };
    }
  },

  async clearMemory(userId = 'default') {
    try {
      const data = await request(`/api/memory/${userId}`, { method: 'DELETE' });
      return { success: true, ...data };
    } catch (error) {
      console.error('Clear memory error:', error);
      return { success: false, error: error.message };
    }
  },

  async analyzeFile(file) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/files/analyze`, {
        method: 'POST',
        body: formData,
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

  async getAutomationSettings() {
    try {
      const data = await request('/api/automation/settings');
      return { success: true, ...data };
    } catch (error) {
      console.error('Automation settings error:', error);
      return { success: false, error: error.message };
    }
  },

  async updateAutomationSettings(payload) {
    try {
      const data = await request('/api/automation/settings', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return { success: true, ...data };
    } catch (error) {
      console.error('Automation update error:', error);
      return { success: false, error: error.message };
    }
  },

  async getAutomationTimeline(limit = 50) {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      const data = await request(`/api/automation/timeline?${params.toString()}`);
      return { success: true, ...data };
    } catch (error) {
      console.error('Automation timeline error:', error);
      return { success: false, error: error.message };
    }
  },

  async logAutomationEvent(event) {
    try {
      const data = await request('/api/automation/timeline', {
        method: 'POST',
        body: JSON.stringify(event),
      });
      return { success: true, ...data };
    } catch (error) {
      console.error('Automation event error:', error);
      return { success: false, error: error.message };
    }
  },

  async clearAutomationTimeline() {
    try {
      const data = await request('/api/automation/timeline', { method: 'DELETE' });
      return { success: true, ...data };
    } catch (error) {
      console.error('Automation timeline clear error:', error);
      return { success: false, error: error.message };
    }
  },
};