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
    tv_living: false,
    door_front: true,
    curtain_living: false,
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
    Open_Palm: { device: 'all', action: 'off' },
    Victory: { device: 'fan_main', action: 'toggle' },
    Pointing_Up: { device: 'tv_living', action: 'on' },
    Thumb_Up: { device: 'tv_living', action: 'on' },
    Thumb_Down: { device: 'tv_living', action: 'off' },
    Pinch: { device: 'light_bedroom', action: 'toggle' },
    Swipe_Left: { device: 'curtain_living', action: 'off' },
    Swipe_Right: { device: 'curtain_living', action: 'on' },
    Rotate_CW: { device: 'fan_main', action: 'on' },
    Rotate_CCW: { device: 'fan_main', action: 'off' },
    Zoom_In: { device: 'light_living', action: 'on' },
    Zoom_Out: { device: 'light_living', action: 'off' },
  },
  poseMappings: {
    hands_up: { device: 'light_living', action: 'on' },
    hands_down: { device: 'light_living', action: 'off' },
    arms_out: { device: 'all', action: 'off' },
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
      Pinch: 1500,
      Swipe_Left: 2000,
      Swipe_Right: 2000,
      Rotate_CW: 1500,
      Rotate_CCW: 1500,
      Zoom_In: 1500,
      Zoom_Out: 1500,
    },
    pose: {
      default: 5000,
      hands_up: 5000,
      hands_down: 5000,
      arms_out: 5000,
    },
  },
  visionSettings: {
    smoothingWindow: 5,
    confidenceThreshold: 0.65,
    pinchThreshold: 0.22,
    swipeThreshold: 70,
    rotateThreshold: 0.2,
    zoomThreshold: 0.1,
    rotateSensitivity: 0.015,
    zoomSensitivity: 0.015,
    poseConfidence: 0.35,
    poseArmsWidePx: 320,
  },
  hologramSettings: {
    minZoom: 4,
    maxZoom: 12,
    baseZoom: 7.5,
    autoRotate: true,
    autoRotateSpeed: 0.006,
    pulseIntensity: 0.7,
  },
  hologramControl: {
    rotateDelta: 0,
    zoomDelta: 0,
    pulse: 0,
    activeGesture: null,
    confidence: 0,
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
  setVisionSettings: (settings) => set({ visionSettings: settings }),
  setVisionSetting: (key, value) => set((state) => ({
    visionSettings: { ...state.visionSettings, [key]: value },
  })),
  setHologramSettings: (settings) => set({ hologramSettings: settings }),
  setHologramSetting: (key, value) => set((state) => ({
    hologramSettings: { ...state.hologramSettings, [key]: value },
  })),
  setHologramControl: (payload) => set((state) => ({
    hologramControl: { ...state.hologramControl, ...payload },
  })),
  
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