'use client';

import { useEffect, useRef, useState } from 'react';
import { useJarvisStore } from '../lib/store';
import { jarvisAPI } from '../lib/api';

const POSE_CONNECTIONS = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16],
];

const POSE_ACTION_LABELS = {
  hands_up: 'Hands Up',
  hands_down: 'Hands Down',
};

const buildActionLabel = (pose, mapping) => {
  const label = POSE_ACTION_LABELS[pose] || pose;
  if (!mapping) return label;
  const deviceLabel = mapping.device.replace(/_/g, ' ');
  return `${label}: ${deviceLabel} ${mapping.action}`;
};

export default function PoseDetection() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isActive, setIsActive] = useState(false);
  const [detector, setDetector] = useState(null);
  const [poseCount, setPoseCount] = useState(0);
  const [lastActionLabel, setLastActionLabel] = useState(null);
  const lastPoseRef = useRef(null);
  const lastActionRef = useRef(0);
  const {
    setPoseData,
    devices,
    updateDevice,
    poseMappings,
    cooldowns,
    addActivityEvent,
  } = useJarvisStore();

  const getCooldown = (pose) => {
    const poseCooldowns = cooldowns?.pose || {};
    return poseCooldowns[pose] ?? poseCooldowns.default ?? 5000;
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const tf = await import('@tensorflow/tfjs');
      const poseDetection = await import('@tensorflow-models/pose-detection');

      await tf.ready();

      const poseDetector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        {
          runtime: 'tfjs',
          modelType: 'Lightning',
        }
      );

      setDetector(poseDetector);
      setIsActive(true);
    } catch (error) {
      console.error('Pose detection error:', error);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
    setIsActive(false);
    setPoseCount(0);
    setPoseData(null);
    setLastActionLabel(null);
  };

  useEffect(() => {
    if (!isActive || !detector || !videoRef.current) return;

    let animationId;

    const detect = async () => {
      try {
        const poses = await detector.estimatePoses(videoRef.current);
        setPoseCount(poses.length);
        setPoseData(poses[0] || null);

        if (poses[0]) {
          const action = evaluatePoseAction(poses[0]);
          if (action && action !== lastPoseRef.current) {
            lastPoseRef.current = action;
            triggerPoseAction(action);
          }
        } else {
          lastPoseRef.current = null;
        }

        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          poses.forEach((pose) => {
            if (!pose.keypoints) return;

            ctx.fillStyle = '#00d4ff';
            pose.keypoints.forEach((point) => {
              if (point.score != null && point.score < 0.3) return;
              ctx.beginPath();
              ctx.arc(point.x, point.y, 4, 0, 2 * Math.PI);
              ctx.fill();
            });

            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 2;
            POSE_CONNECTIONS.forEach(([start, end]) => {
              const p1 = pose.keypoints[start];
              const p2 = pose.keypoints[end];
              if (!p1 || !p2) return;
              if ((p1.score ?? 1) < 0.3 || (p2.score ?? 1) < 0.3) return;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            });
          });
        }
      } catch (error) {
        console.error('Pose detection loop error:', error);
      }

      animationId = requestAnimationFrame(detect);
    };

    detect();

    return () => cancelAnimationFrame(animationId);
  }, [isActive, detector, setPoseData]);

  const isConfident = (point) => point && (point.score ?? 1) >= 0.3;

  const evaluatePoseAction = (pose) => {
    const { keypoints } = pose;
    if (!keypoints) return null;

    const leftWrist = keypoints[9];
    const rightWrist = keypoints[10];
    const leftShoulder = keypoints[5];
    const rightShoulder = keypoints[6];
    const leftHip = keypoints[11];
    const rightHip = keypoints[12];

    if (![leftWrist, rightWrist, leftShoulder, rightShoulder, leftHip, rightHip].every(isConfident)) {
      return null;
    }

    const wristsAboveShoulders =
      leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y;
    const wristsBelowHips = leftWrist.y > leftHip.y && rightWrist.y > rightHip.y;

    if (wristsAboveShoulders) {
      return 'hands_up';
    }

    if (wristsBelowHips) {
      return 'hands_down';
    }

    return null;
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

  const triggerPoseAction = async (action) => {
    const now = Date.now();
    const cooldown = getCooldown(action);
    if (now - lastActionRef.current < cooldown) {
      return;
    }

    const mapping = poseMappings?.[action];
    if (!mapping) return;

    await applyDeviceAction(mapping.device, mapping.action);
    lastActionRef.current = now;
    const label = buildActionLabel(action, mapping);
    setLastActionLabel(label);

    const event = {
      category: 'pose',
      label,
      device: mapping.device,
      action: mapping.action,
      source: 'vision',
      timestamp: new Date().toISOString(),
    };
    addActivityEvent(event);
    await jarvisAPI.logAutomationEvent(event);
  };

  return (
    <div className="glass p-6 rounded-2xl panel-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-jarvis-blue font-semibold flex items-center gap-2">
          🧍 Pose Detection
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
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          width={640}
          height={480}
        />

        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center text-white/40">
            Click Start to enable pose detection
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className={`status-badge ${poseCount > 0 ? 'online' : 'offline'}`}>
          <span className="status-dot" />
          {poseCount > 0 ? `${poseCount} Pose(s) Detected` : 'No Pose Detected'}
        </div>
        {lastActionLabel && (
          <div className="status-badge processing">
            <span className="status-dot" />
            {lastActionLabel}
          </div>
        )}
      </div>
    </div>
  );
}
