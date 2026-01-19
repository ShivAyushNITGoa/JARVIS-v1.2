"""
JARVIS Device Manager - IoT Control
"""

import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from collections import defaultdict

class DeviceManager:
    def __init__(self):
        # Device states
        self.devices = {
            "light_living": {"state": False, "type": "light", "name": "Living Room Light", "brightness": 0},
            "light_bedroom": {"state": False, "type": "light", "name": "Bedroom Light", "brightness": 0},
            "light_kitchen": {"state": False, "type": "light", "name": "Kitchen Light", "brightness": 0},
            "fan_main": {"state": False, "type": "fan", "name": "Main Fan", "speed": 0},
            "fan_bedroom": {"state": False, "type": "fan", "name": "Bedroom Fan", "speed": 0},
            "ac_main": {"state": False, "type": "ac", "name": "Air Conditioner", "temperature": 24, "mode": "cool"},
            "thermostat": {"state": True, "type": "thermostat", "name": "Thermostat", "temperature": 22, "mode": "auto"},
            "tv_living": {"state": False, "type": "tv", "name": "Living Room TV", "channel": 1},
            "door_front": {"state": True, "type": "lock", "name": "Front Door", "locked": True},
            "curtain_living": {"state": False, "type": "curtain", "name": "Living Room Curtain", "position": 0},
        }
        
        # Sensor data
        self.sensors = {
            "temperature": 25.0,
            "humidity": 50.0,
            "light_level": 500,
            "motion": False,
            "gas_level": 0,
            "door_open": False
        }
        
        # Alert thresholds
        self.alert_thresholds = {
            "temperature_high": 35,
            "temperature_low": 15,
            "humidity_high": 80,
            "humidity_low": 20,
            "gas_level": 500
        }
        
        # Pending commands for ESP32
        self.pending_commands: List[Dict] = []
        
        # Command history
        self.command_history: List[Dict] = []
        
        # Device aliases
        self.aliases = {
            "living room light": "light_living",
            "bedroom light": "light_bedroom",
            "kitchen light": "light_kitchen",
            "main light": "light_living",
            "light": "light_living",
            "lights": "light_living",
            "fan": "fan_main",
            "main fan": "fan_main",
            "bedroom fan": "fan_bedroom",
            "ac": "ac_main",
            "air conditioner": "ac_main",
            "thermostat": "thermostat",
            "tv": "tv_living",
            "television": "tv_living",
            "front door": "door_front",
            "door": "door_front",
            "curtain": "curtain_living",
            "curtains": "curtain_living"
        }
    
    def resolve_device(self, device_name: str) -> Optional[str]:
        """Resolve device name to ID"""
        
        device_lower = device_name.lower().strip()
        
        # Check aliases
        if device_lower in self.aliases:
            return self.aliases[device_lower]
        
        # Check direct match
        if device_lower in self.devices:
            return device_lower
        
        # Partial match
        for device_id, device in self.devices.items():
            if device_lower in device.get("name", "").lower():
                return device_id
            if device_lower in device_id.lower():
                return device_id
        
        return None
    
    def control(self, device_name: str, action: str, value: Any = None) -> Dict:
        """Control a device"""
        
        device_id = self.resolve_device(device_name)
        
        if not device_id:
            return {
                "success": False,
                "message": f"Device '{device_name}' not found. Available devices: {', '.join(self.devices.keys())}"
            }
        
        device = self.devices[device_id]
        device_type = device.get("type", "")
        
        # Handle actions
        if action in ["on", "open", "unlock"]:
            device["state"] = True
            if device_type == "light":
                device["brightness"] = value if value else 100
            elif device_type == "fan":
                device["speed"] = value if value else 3
            elif device_type == "lock":
                device["locked"] = False
            elif device_type == "curtain":
                device["position"] = 100
                
        elif action in ["off", "close", "lock"]:
            device["state"] = False
            if device_type == "light":
                device["brightness"] = 0
            elif device_type == "fan":
                device["speed"] = 0
            elif device_type == "lock":
                device["locked"] = True
            elif device_type == "curtain":
                device["position"] = 0
                
        elif action == "toggle":
            device["state"] = not device["state"]
            if device_type == "light":
                device["brightness"] = 100 if device["state"] else 0
            elif device_type == "fan":
                device["speed"] = 3 if device["state"] else 0
                
        elif action == "set":
            if value is not None:
                if device_type in ["ac", "thermostat"]:
                    device["temperature"] = value
                    device["state"] = True
                elif device_type == "light":
                    device["brightness"] = min(100, max(0, value))
                    device["state"] = value > 0
                elif device_type == "fan":
                    device["speed"] = min(5, max(0, value))
                    device["state"] = value > 0
                elif device_type == "curtain":
                    device["position"] = min(100, max(0, value))
                    device["state"] = value > 0
                    
        elif action == "increase":
            if device_type == "light":
                device["brightness"] = min(100, device.get("brightness", 0) + 20)
                device["state"] = device["brightness"] > 0
            elif device_type == "fan":
                device["speed"] = min(5, device.get("speed", 0) + 1)
                device["state"] = device["speed"] > 0
            elif device_type in ["ac", "thermostat"]:
                device["temperature"] = device.get("temperature", 24) + 1
                
        elif action == "decrease":
            if device_type == "light":
                device["brightness"] = max(0, device.get("brightness", 100) - 20)
                device["state"] = device["brightness"] > 0
            elif device_type == "fan":
                device["speed"] = max(0, device.get("speed", 3) - 1)
                device["state"] = device["speed"] > 0
            elif device_type in ["ac", "thermostat"]:
                device["temperature"] = device.get("temperature", 24) - 1
        
        # Add to pending commands for ESP32
        command = {
            "device_id": device_id,
            "device_type": device_type,
            "action": action,
            "value": value,
            "state": device.copy(),
            "timestamp": datetime.now().isoformat()
        }
        
        self.pending_commands.append(command)
        self.command_history.append(command)
        
        # Keep history manageable
        if len(self.pending_commands) > 50:
            self.pending_commands = self.pending_commands[-50:]
        if len(self.command_history) > 200:
            self.command_history = self.command_history[-200:]
        
        # Generate message
        status = "on" if device["state"] else "off"
        message = f"{device['name']} is now {status}"
        
        if device_type == "light" and device["state"]:
            message += f" at {device['brightness']}% brightness"
        elif device_type == "fan" and device["state"]:
            message += f" at speed {device['speed']}"
        elif device_type in ["ac", "thermostat"]:
            message += f", set to {device['temperature']}°C"
        
        return {
            "success": True,
            "message": message,
            "device_id": device_id,
            "state": device.copy()
        }
    
    def toggle(self, device_id: str) -> Dict:
        """Toggle device state"""
        return self.control(device_id, "toggle")
    
    def get_status(self, device_id: str) -> Optional[Dict]:
        """Get device status"""
        return self.devices.get(device_id)
    
    def get_all_status(self) -> Dict[str, bool]:
        """Get all device states"""
        return {
            device_id: device["state"]
            for device_id, device in self.devices.items()
        }
    
    def get_full_status(self) -> Dict[str, Dict]:
        """Get full device information"""
        return self.devices.copy()
    
    def get_pending_commands(self) -> List[Dict]:
        """Get and clear pending commands for ESP32"""
        commands = self.pending_commands.copy()
        self.pending_commands = []
        return commands
    
    def update_sensor_data(self, data: Dict):
        """Update sensor data from ESP32"""
        for key, value in data.items():
            if key in self.sensors:
                self.sensors[key] = value
            elif key == "custom":
                for k, v in value.items():
                    self.sensors[k] = v
    
    def get_sensor_data(self) -> Dict:
        """Get all sensor data"""
        return self.sensors.copy()
    
    def check_alerts(self, sensor_data: Dict) -> List[Dict]:
        """Check for sensor alerts"""
        alerts = []
        
        temp = sensor_data.get("temperature")
        if temp is not None:
            if temp > self.alert_thresholds["temperature_high"]:
                alerts.append({
                    "type": "temperature_high",
                    "message": f"High temperature alert: {temp}°C",
                    "value": temp,
                    "severity": "warning"
                })
            elif temp < self.alert_thresholds["temperature_low"]:
                alerts.append({
                    "type": "temperature_low",
                    "message": f"Low temperature alert: {temp}°C",
                    "value": temp,
                    "severity": "warning"
                })
        
        humidity = sensor_data.get("humidity")
        if humidity is not None:
            if humidity > self.alert_thresholds["humidity_high"]:
                alerts.append({
                    "type": "humidity_high",
                    "message": f"High humidity alert: {humidity}%",
                    "value": humidity,
                    "severity": "info"
                })
        
        gas = sensor_data.get("gas_level")
        if gas is not None:
            if gas > self.alert_thresholds["gas_level"]:
                alerts.append({
                    "type": "gas_detected",
                    "message": f"Gas level alert: {gas}",
                    "value": gas,
                    "severity": "critical"
                })
        
        return alerts
    
    def get_config(self) -> Dict:
        """Get device configuration"""
        return {
            "devices": self.devices,
            "sensors": self.sensors,
            "aliases": self.aliases,
            "thresholds": self.alert_thresholds
        }