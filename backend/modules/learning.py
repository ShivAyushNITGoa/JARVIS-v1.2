"""
JARVIS Learning System - User Adaptation
"""

import json
import os
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Any, Optional

class LearningSystem:
    def __init__(self, storage_path: str = "/tmp/jarvis_learning"):
        self.storage_path = storage_path
        os.makedirs(storage_path, exist_ok=True)
        self.user_data = self._load_data()
    
    def _get_file_path(self) -> str:
        return os.path.join(self.storage_path, "learning.json")
    
    def _load_data(self) -> Dict:
        """Load learning data"""
        try:
            filepath = self._get_file_path()
            if os.path.exists(filepath):
                with open(filepath, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Learning load error: {e}")
        return {}
    
    def _save_data(self):
        """Save learning data"""
        try:
            filepath = self._get_file_path()
            with open(filepath, 'w') as f:
                json.dump(self.user_data, f, indent=2, default=str)
        except Exception as e:
            print(f"Learning save error: {e}")
    
    def _ensure_user(self, user_id: str):
        """Ensure user exists in data"""
        if user_id not in self.user_data:
            self.user_data[user_id] = {
                "device_usage": {},
                "time_patterns": {},
                "query_types": {},
                "preferences": {},
                "routines": [],
                "created_at": datetime.now().isoformat()
            }
    
    def update_from_interaction(self, user_id: str, message: str, intent: Dict):
        """Learn from user interaction"""
        
        self._ensure_user(user_id)
        user = self.user_data[user_id]
        
        # Track query types
        intent_type = intent.get("type", "general")
        if intent_type not in user["query_types"]:
            user["query_types"][intent_type] = 0
        user["query_types"][intent_type] += 1
        
        # Track time patterns
        hour = datetime.now().hour
        hour_key = str(hour)
        if hour_key not in user["time_patterns"]:
            user["time_patterns"][hour_key] = {"count": 0, "intents": {}}
        user["time_patterns"][hour_key]["count"] += 1
        
        if intent_type not in user["time_patterns"][hour_key]["intents"]:
            user["time_patterns"][hour_key]["intents"][intent_type] = 0
        user["time_patterns"][hour_key]["intents"][intent_type] += 1
        
        self._save_data()
    
    def record_device_usage(self, user_id: str, device: str, action: str):
        """Record device usage pattern"""
        
        self._ensure_user(user_id)
        user = self.user_data[user_id]
        
        key = f"{device}_{action}"
        if key not in user["device_usage"]:
            user["device_usage"][key] = {
                "count": 0,
                "times": []
            }
        
        user["device_usage"][key]["count"] += 1
        user["device_usage"][key]["times"].append(datetime.now().hour)
        
        # Keep only last 50 times
        if len(user["device_usage"][key]["times"]) > 50:
            user["device_usage"][key]["times"] = \
                user["device_usage"][key]["times"][-50:]
        
        self._save_data()
    
    def get_preferences(self, user_id: str) -> Dict:
        """Get learned preferences for user"""
        
        self._ensure_user(user_id)
        user = self.user_data[user_id]
        
        preferences = user.get("preferences", {}).copy()
        
        # Derive preferences from usage patterns
        
        # Most used devices
        if user["device_usage"]:
            sorted_devices = sorted(
                user["device_usage"].items(),
                key=lambda x: x[1]["count"],
                reverse=True
            )
            preferences["favorite_devices"] = [
                d[0].split("_")[0] for d in sorted_devices[:3]
            ]
        
        # Most active hours
        if user["time_patterns"]:
            sorted_hours = sorted(
                user["time_patterns"].items(),
                key=lambda x: x[1]["count"],
                reverse=True
            )
            preferences["active_hours"] = [int(h[0]) for h in sorted_hours[:3]]
        
        # Most common query types
        if user["query_types"]:
            sorted_queries = sorted(
                user["query_types"].items(),
                key=lambda x: x[1],
                reverse=True
            )
            preferences["common_tasks"] = [q[0] for q in sorted_queries[:3]]
        
        return preferences
    
    def set_preference(self, user_id: str, key: str, value: Any):
        """Manually set user preference"""
        
        self._ensure_user(user_id)
        self.user_data[user_id]["preferences"][key] = value
        self._save_data()
    
    def add_routine(self, user_id: str, routine: Dict):
        """Add an automation routine"""
        
        self._ensure_user(user_id)
        routine["created_at"] = datetime.now().isoformat()
        self.user_data[user_id]["routines"].append(routine)
        self._save_data()
    
    def get_routines(self, user_id: str) -> List[Dict]:
        """Get user's routines"""
        
        self._ensure_user(user_id)
        return self.user_data[user_id].get("routines", [])
    
    def suggest_automation(self, user_id: str) -> List[Dict]:
        """Suggest automations based on patterns"""
        
        self._ensure_user(user_id)
        user = self.user_data[user_id]
        suggestions = []
        
        # Analyze device usage patterns
        for device_action, data in user["device_usage"].items():
            if data["count"] >= 5:  # Used at least 5 times
                times = data["times"]
                if len(times) >= 3:
                    # Calculate average time
                    avg_time = sum(times) / len(times)
                    
                    # Check if times are consistent (low variance)
                    variance = sum((t - avg_time) ** 2 for t in times) / len(times)
                    
                    if variance < 4:  # Within 2 hour variance
                        device, action = device_action.rsplit("_", 1)
                        suggestions.append({
                            "type": "scheduled_action",
                            "device": device,
                            "action": action,
                            "suggested_time": f"{int(avg_time):02d}:00",
                            "confidence": min(0.9, data["count"] / 20),
                            "reason": f"You often {action} {device} around this time"
                        })
        
        # Suggest based on patterns
        if user["time_patterns"]:
            # Find most active hour
            sorted_hours = sorted(
                user["time_patterns"].items(),
                key=lambda x: x[1]["count"],
                reverse=True
            )
            if sorted_hours:
                peak_hour = int(sorted_hours[0][0])
                suggestions.append({
                    "type": "activity_insight",
                    "message": f"You're most active around {peak_hour}:00",
                    "hour": peak_hour
                })
        
        return suggestions
    
    def clear_user(self, user_id: str):
        """Clear learning data for user"""
        
        if user_id in self.user_data:
            del self.user_data[user_id]
            self._save_data()