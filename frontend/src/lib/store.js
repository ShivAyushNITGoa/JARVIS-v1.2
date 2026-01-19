import { create } from 'zustand';

export const useJarvisStore = create((set, get) => ({
  // Status
  isListening: false,
  isSpeaking: false,
  isProcessing: false,
  isConnected: true,
  serverStatus: 'checking',
  serverVersion: null,
  lastSync: null,
  
  // Messages
  messages: [],
  
  // Devices
  devices: {
    esp32_connected: false,
    light_living: false,
    light_bedroom: false,
    light_kitchen: false,
    fan_main: false,
    fan_bedroom: false,
    ac_main: false,
    thermostat: 22,
  },
  
  // Sensor Data
  sensorData: {
    temperature: 25,
    humidity: 50,
    light_level: 500,
    motion: false,
    gas_level: 0,
  },
  
  // Recognition
  faceDetected: false,
  gestureDetected: null,
  poseData: null,
  gestureMappings: {
    Closed_Fist: { device: 'light_living', action: 'toggle' },
    Victory: { device: 'fan_main', action: 'toggle' },
    Open_Palm: { device: 'all', action: 'off' },
  },
  poseMappings: {
    hands_up: { device: 'light_living', action: 'on' },
    hands_down: { device: 'light_living', action: 'off' },
  },
  cooldowns: {
    gesture: {
      default: 4000,
      Closed_Fist: 4000,
      Open_Palm: 4000,
      Pointing_Up: 4000,
      Thumb_Up: 4000,
      Thumb_Down: 4000,
      Victory: 4000,
    },
    pose: {
      default: 5000,
      hands_up: 5000,
      hands_down: 5000,
    },
  },
  attachmentHistory: [],
  activityTimeline: [],
  
  // User
  user: {
    name: 'User',
    preferences: {},
  },
  
  // Actions
  setStatus: (status) => set(status),
  
  setServerStatus: (status) => set({ serverStatus: status }),
  setServerVersion: (version) => set({ serverVersion: version }),
  setLastSync: (timestamp) => set({ lastSync: timestamp }),
  
  setListening: (value) => set({ isListening: value }),
  setSpeaking: (value) => set({ isSpeaking: value }),
  setProcessing: (value) => set({ isProcessing: value }),
  
  addMessage: (sender, text) => set((state) => ({
    messages: [...state.messages, {
      id: Date.now(),
      sender,
      text,
      timestamp: new Date().toISOString(),
    }]
  })),
  
  clearMessages: () => set({ messages: [] }),
  
  updateDevice: (deviceId, value) => set((state) => ({
    devices: { ...state.devices, [deviceId]: value }
  })),
  
  updateSensorData: (data) => set((state) => ({
    sensorData: { ...state.sensorData, ...data }
  })),
  
  setFaceDetected: (value) => set({ faceDetected: value }),
  setGestureDetected: (value) => set({ gestureDetected: value }),
  setPoseData: (value) => set({ poseData: value }),
  
  setGestureMapping: (gesture, mapping) => set((state) => ({
    gestureMappings: { ...state.gestureMappings, [gesture]: mapping }
  })),
  setGestureMappings: (mappings) => set({ gestureMappings: mappings }),
  setPoseMapping: (pose, mapping) => set((state) => ({
    poseMappings: { ...state.poseMappings, [pose]: mapping }
  })),
  setPoseMappings: (mappings) => set({ poseMappings: mappings }),
  
  setCooldowns: (cooldowns) => set({ cooldowns }),
  setCooldown: (category, key, value) => set((state) => ({
    cooldowns: {
      ...state.cooldowns,
      [category]: {
        ...state.cooldowns[category],
        [key]: value,
      }
    }
  })),
  
  addAttachmentHistory: (entry) => set((state) => ({
    attachmentHistory: [entry, ...state.attachmentHistory].slice(0, 50),
  })),
  clearAttachmentHistory: () => set({ attachmentHistory: [] }),
  
  setActivityTimeline: (entries) => set({ activityTimeline: entries }),
  addActivityEvent: (entry) => set((state) => ({
    activityTimeline: [entry, ...state.activityTimeline].slice(0, 100),
  })),
  clearActivityTimeline: () => set({ activityTimeline: [] }),
  
  setUser: (user) => set({ user }),
}));