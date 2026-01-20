'use client';

import { useEffect, useRef, useState } from 'react';
import { useJarvisStore } from '../lib/store';
import { jarvisAPI } from '../lib/api';

const GESTURES = {
  Closed_Fist: { action: 'toggle_light', label: 'Closed Fist' },
  Open_Palm: { action: 'stop', label: 'Open Palm' },
  Pointing_Up: { action: 'volume_up', label: 'Pointing Up' },
  Thumb_Up: { action: 'confirm', label: 'Thumb Up' },
  Thumb_Down: { action: 'cancel', label: 'Thumb Down' },
  Victory: { action: 'toggle_fan', label: 'Victory' },
  Pinch: { action: 'pulse', label: 'Pinch' },
  Swipe_Left: { action: 'swipe_left', label: 'Swipe Left' },
  Swipe_Right: { action: 'swipe_right', label: 'Swipe Right' },
  Rotate_CW: { action: 'rotate_cw', label: 'Rotate CW' },
  Rotate_CCW: { action: 'rotate_ccw', label: 'Rotate CCW' },
  Zoom_In: { action: 'zoom_in', label: 'Zoom In' },
  Zoom_Out: { action: 'zoom_out', label: 'Zoom Out' },
};

const buildActionLabel = (gesture, mapping) => {
  const label = GESTURES[gesture]?.label || gesture;
  if (!mapping || mapping.action === 'none') return label;
  const deviceLabel = mapping.device === 'all'
    ? 'all devices'
    : mapping.device.replace(/_/g, ' ');
  return `${label}: ${deviceLabel} ${mapping.action}`;
};

export default function GestureControl() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [detector, setDetector] = useState(null);
  const [currentGesture, setCurrentGesture] = useState(null);
  const [lastActionLabel, setLastActionLabel] = useState(null);
  const lastGestureRef = useRef(null);
  const lastActionRef = useRef(0);
  const gestureHistoryRef = useRef([]);
  const lastWristRef = useRef(null);
  const lastAngleRef = useRef(null);
  const lastTwoHandDistanceRef = useRef(null);
  const transientGestureRef = useRef(null);

  const {
    setGestureDetected,
    devices,
    updateDevice,
    gestureMappings,
    cooldowns,
    addActivityEvent,
    visionSettings,
    setHologramControl,
  } = useJarvisStore();

  const settingsRef = useRef(visionSettings);

  useEffect(() => {
    settingsRef.current = visionSettings;
  }, [visionSettings]);

  const getCooldown = (gesture) => {
    const gestureCooldowns = cooldowns?.gesture || {};
    return gestureCooldowns[gesture] ?? gestureCooldowns.default ?? 4000;
  };

  const applyDeviceAction = async (deviceId, action) => {
    if (!deviceId) return;
    if (deviceId === 'all') {
      const ids = Object.keys(devices).filter(
        (key) => key !== 'esp32_connected' && key !== 'thermostat'
      );
      await Promise.all(
        ids.map((id) => jarvisAPI.controlDevice(id, action === 'toggle'
          ? (devices[id] ? 'off' : 'on')
          : action))
      );
      ids.forEach((id) => updateDevice(id, action === 'toggle' ? !devices[id] : action === 'on'));
      return;
    }

    const nextAction = action === 'toggle' ? (devices[deviceId] ? 'off' : 'on') : action;
    await jarvisAPI.controlDevice(deviceId, nextAction);
    updateDevice(deviceId, nextAction === 'on');
  };

  const triggerDeviceAction = async (gesture) => {
    const now = Date.now();
    const cooldown = getCooldown(gesture);
    if (lastActionRef.current && now - lastActionRef.current < cooldown) {
      return;
    }

    const mapping = gestureMappings?.[gesture];
    if (!mapping || mapping.action === 'none') return;

    await applyDeviceAction(mapping.device, mapping.action);
    lastActionRef.current = now;
    const label = buildActionLabel(gesture, mapping);
    setLastActionLabel(label);

    const event = {
      category: 'gesture',
      label,
      device: mapping.device,
      action: mapping.action,
      source: 'vision',
      timestamp: new Date().toISOString(),
    };
    addActivityEvent(event);
    await jarvisAPI.logAutomationEvent(event);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Load Hand Pose Detection
      const tf = await import('@tensorflow/tfjs');
      const handPoseDetection = await import('@tensorflow-models/hand-pose-detection');

      await tf.ready();

      const model = await handPoseDetection.createDetector(
        handPoseDetection.SupportedModels.MediaPipeHands,
        {
          runtime: 'tfjs',
          modelType: 'full',
          maxHands: 2,
        }
      );

      setDetector(model);
      setIsActive(true);
    } catch (error) {
      console.error('Camera/Model error:', error);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setIsActive(false);
    setCurrentGesture(null);
    setGestureDetected(null);
    setLastActionLabel(null);
    setHologramControl({
      rotateDelta: 0,
      zoomDelta: 0,
      pulse: 0,
      activeGesture: null,
      confidence: 0,
    });
  };

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  const getHandSize = (keypoints) => distance(keypoints[0], keypoints[9]) || 1;

  const getConfidence = (keypoints) => keypoints.reduce(
    (sum, point) => sum + (point?.score ?? 1),
    0
  ) / keypoints.length;

  const smoothGesture = (gesture) => {
    const settings = settingsRef.current || {};
    const windowSize = Math.max(1, settings.smoothingWindow ?? 4);
    const history = gestureHistoryRef.current;
    history.push(gesture);
    if (history.length > windowSize) {
      history.shift();
    }

    const counts = {};
    let topGesture = null;
    let topCount = 0;
    history.forEach((entry) => {
      if (!entry) return;
      counts[entry] = (counts[entry] || 0) + 1;
      if (counts[entry] > topCount) {
        topCount = counts[entry];
        topGesture = entry;
      }
    });

    if (!topGesture) return null;
    return topGesture;
  };

  const detectStaticGesture = (keypoints) => {
    const thumbTip = keypoints[4];
    const indexTip = keypoints[8];
    const middleTip = keypoints[12];
    const ringTip = keypoints[16];
    const pinkyTip = keypoints[20];

    const thumbExtended = thumbTip.y < keypoints[3].y;
    const thumbDown = thumbTip.y > keypoints[3].y;
    const indexExtended = indexTip.y < keypoints[6].y;
    const middleExtended = middleTip.y < keypoints[10].y;
    const ringExtended = ringTip.y < keypoints[14].y;
    const pinkyExtended = pinkyTip.y < keypoints[18].y;

    if (!thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'Closed_Fist';
    }

    if (thumbExtended && indexExtended && middleExtended && ringExtended && pinkyExtended) {
      return 'Open_Palm';
    }

    if (thumbExtended && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'Thumb_Up';
    }

    if (thumbDown && !indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'Thumb_Down';
    }

    if (indexExtended && middleExtended && !ringExtended && !pinkyExtended) {
      return 'Victory';
    }

    if (indexExtended && !middleExtended && !ringExtended && !pinkyExtended) {
      return 'Pointing_Up';
    }

    return null;
  };

  const buildHologramPayload = (gesture, confidence = 0) => {
    const settings = settingsRef.current || {};
    const rotateStep = settings.rotateSensitivity ?? 0.02;
    const zoomStep = settings.zoomSensitivity ?? 0.02;

    if (!gesture) {
      return {
        rotateDelta: 0,
        zoomDelta: 0,
        pulse: 0,
        activeGesture: null,
        confidence: 0,
      };
    }

    switch (gesture) {
      case 'Rotate_CW':
        return { rotateDelta: rotateStep, zoomDelta: 0, pulse: 0, activeGesture: gesture, confidence };
      case 'Rotate_CCW':
        return { rotateDelta: -rotateStep, zoomDelta: 0, pulse: 0, activeGesture: gesture, confidence };
      case 'Swipe_Left':
        return { rotateDelta: -rotateStep * 3, zoomDelta: 0, pulse: 0, activeGesture: gesture, confidence };
      case 'Swipe_Right':
        return { rotateDelta: rotateStep * 3, zoomDelta: 0, pulse: 0, activeGesture: gesture, confidence };
      case 'Zoom_In':
        return { rotateDelta: 0, zoomDelta: -zoomStep * 3, pulse: 0, activeGesture: gesture, confidence };
      case 'Zoom_Out':
        return { rotateDelta: 0, zoomDelta: zoomStep * 3, pulse: 0, activeGesture: gesture, confidence };
      case 'Pinch':
        return { rotateDelta: 0, zoomDelta: 0, pulse: 1, activeGesture: gesture, confidence };
      default:
        return { rotateDelta: 0, zoomDelta: 0, pulse: 0, activeGesture: gesture, confidence };
    }
  };

  const resolveGesture = (hands) => {
    const settings = settingsRef.current || {};
    const now = performance.now();
    if (!hands || hands.length === 0) {
      gestureHistoryRef.current = [];
      lastWristRef.current = null;
      lastAngleRef.current = null;
      lastTwoHandDistanceRef.current = null;
      transientGestureRef.current = null;
      return { gesture: null, confidence: 0 };
    }

    const confidenceThreshold = settings.confidenceThreshold ?? 0.6;
    const handStates = hands.map((hand) => {
      const keypoints = hand.keypoints;
      const confidence = getConfidence(keypoints);
      const size = getHandSize(keypoints);
      const thumbTip = keypoints[4];
      const indexTip = keypoints[8];
      const wrist = keypoints[0];
      const pinchDistance = distance(thumbTip, indexTip) / size;
      const angle = Math.atan2(indexTip.y - thumbTip.y, indexTip.x - thumbTip.x);

      return {
        keypoints,
        confidence,
        size,
        wrist,
        angle,
        indexTip,
        pinchDistance,
        staticGesture: detectStaticGesture(keypoints),
      };
    }).filter((state) => state.confidence >= confidenceThreshold);

    if (handStates.length === 0) {
      return { gesture: null, confidence: 0 };
    }

    let gesture = null;
    let gestureConfidence = handStates[0].confidence;

    if (handStates.length >= 2) {
      const distanceNow = distance(handStates[0].indexTip, handStates[1].indexTip);
      const lastDistance = lastTwoHandDistanceRef.current;
      const averageSize = (handStates[0].size + handStates[1].size) / 2;
      if (lastDistance) {
        const delta = (distanceNow - lastDistance.distance) / averageSize;
        if (Math.abs(delta) > (settings.zoomThreshold ?? 0.12)) {
          gesture = delta > 0 ? 'Zoom_In' : 'Zoom_Out';
          gestureConfidence = Math.min(handStates[0].confidence, handStates[1].confidence);
        }
      }
      lastTwoHandDistanceRef.current = { distance: distanceNow, t: now };
    }

    if (!gesture) {
      const angleState = lastAngleRef.current;
      if (angleState) {
        const delta = handStates[0].angle - angleState.angle;
        const dt = now - angleState.t;
        if (dt < 400 && Math.abs(delta) > (settings.rotateThreshold ?? 0.25)) {
          gesture = delta > 0 ? 'Rotate_CCW' : 'Rotate_CW';
        }
      }
      lastAngleRef.current = { angle: handStates[0].angle, t: now };
    }

    if (!gesture) {
      const lastWrist = lastWristRef.current;
      if (lastWrist) {
        const dt = now - lastWrist.t;
        const dx = handStates[0].wrist.x - lastWrist.x;
        const dy = handStates[0].wrist.y - lastWrist.y;
        if (dt > 40 && dt < 400 && Math.abs(dx) > (settings.swipeThreshold ?? 80) && Math.abs(dx) > Math.abs(dy)) {
          gesture = dx > 0 ? 'Swipe_Right' : 'Swipe_Left';
        }
      }
      lastWristRef.current = { x: handStates[0].wrist.x, y: handStates[0].wrist.y, t: now };
    }

    if (!gesture && handStates[0].pinchDistance < (settings.pinchThreshold ?? 0.25)) {
      gesture = 'Pinch';
    }

    if (!gesture) {
      gesture = handStates[0].staticGesture;
    }

    const transient = transientGestureRef.current;
    if (gesture && ['Swipe_Left', 'Swipe_Right', 'Rotate_CW', 'Rotate_CCW', 'Zoom_In', 'Zoom_Out'].includes(gesture)) {
      transientGestureRef.current = { gesture, expiresAt: now + 300 };
    }

    if (transient && now < transient.expiresAt) {
      gesture = transient.gesture;
    }

    const smoothedGesture = smoothGesture(gesture);
    return { gesture: smoothedGesture, confidence: gestureConfidence };
  };

  // Detection loop
  useEffect(() => {
    if (!isActive || !detector || !videoRef.current) return;

    let animationId;

    const detect = async () => {
      try {
        const hands = await detector.estimateHands(videoRef.current);

        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

          hands.forEach((hand) => {
            // Draw keypoints
            hand.keypoints.forEach((point) => {
              ctx.fillStyle = hand.handedness === 'Left' ? '#00d4ff' : '#ffaa00';
              ctx.beginPath();
              ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
              ctx.fill();
            });

            // Draw connections
            const connections = [
              [0, 1], [1, 2], [2, 3], [3, 4],
              [0, 5], [5, 6], [6, 7], [7, 8],
              [0, 9], [9, 10], [10, 11], [11, 12],
              [0, 13], [13, 14], [14, 15], [15, 16],
              [0, 17], [17, 18], [18, 19], [19, 20],
              [5, 9], [9, 13], [13, 17],
            ];

            ctx.strokeStyle = hand.handedness === 'Left' ? '#00d4ff' : '#ffaa00';
            ctx.lineWidth = 2;

            connections.forEach(([i, j]) => {
              const p1 = hand.keypoints[i];
              const p2 = hand.keypoints[j];
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            });
          });
        }

        const { gesture, confidence } = resolveGesture(hands);

        if (gesture) {
          setCurrentGesture(gesture);
          setGestureDetected(gesture);

          if (gesture !== lastGestureRef.current) {
            lastGestureRef.current = gesture;
            triggerDeviceAction(gesture);
          }

          const payload = buildHologramPayload(gesture, confidence);
          setHologramControl(payload);

          if (ctx && canvasRef.current) {
            ctx.fillStyle = '#00ff88';
            ctx.font = '18px Arial';
            ctx.fillText(GESTURES[gesture]?.label || gesture, 10, 30);
          }
        } else {
          setCurrentGesture(null);
          setGestureDetected(null);
          lastGestureRef.current = null;
          setHologramControl(buildHologramPayload(null, 0));
        }
      } catch (error) {
        console.error('Detection error:', error);
      }

      animationId = requestAnimationFrame(detect);
    };
    
    detect();
    
    return () => cancelAnimationFrame(animationId);
  }, [isActive, detector]);

  return (
    <div className="glass p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-jarvis-blue font-semibold flex items-center gap-2">
          ✋ Gesture Control
        </h3>
        <button
          onClick={isActive ? stopCamera : startCamera}
          className={`px-4 py-2 rounded-lg ${
            isActive 
              ? 'bg-jarvis-red/20 text-jarvis-red border border-jarvis-red/30' 
              : 'bg-jarvis-green/20 text-jarvis-green border border-jarvis-green/30'
          }`}
        >
          {isActive ? 'Stop' : 'Start'}
        </button>
      </div>
      
      <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full transform -scale-x-100"
          width={640}
          height={480}
        />
        
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center text-white/40">
            Click Start to enable gesture control
          </div>
        )}
      </div>
      
      {/* Gesture Info */}
      <div className="mt-4">
        {currentGesture ? (
          <div className="status-badge processing">
            <span className="status-dot" />
            {GESTURES[currentGesture]?.label || currentGesture}
          </div>
        ) : (
          <div className="text-white/40 text-sm">Show a gesture to control</div>
        )}
      </div>
      
      {/* Gesture Guide */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        {Object.entries(GESTURES).map(([gesture, info]) => (
          <div 
            key={gesture}
            className={`p-2 rounded text-center ${
              currentGesture === gesture 
                ? 'bg-jarvis-green/20 text-jarvis-green' 
                : 'bg-black/20 text-white/60'
            }`}
          >
            {info.label}
          </div>
        ))}
      </div>
    </div>
  );
}