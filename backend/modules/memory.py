"""
JARVIS Memory System - Persistent Storage
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Any, Optional
from collections import defaultdict

class MemorySystem:
    def __init__(self, storage_path: str = "/tmp/jarvis_memory"):
        self.storage_path = storage_path
        os.makedirs(storage_path, exist_ok=True)
        self.memories = self._load_memories()
    
    def _get_file_path(self, filename: str) -> str:
        return os.path.join(self.storage_path, filename)
    
    def _load_memories(self) -> Dict:
        """Load memories from storage"""
        try:
            filepath = self._get_file_path("memories.json")
            if os.path.exists(filepath):
                with open(filepath, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Memory load error: {e}")
        return {}
    
    def _save_memories(self):
        """Save memories to storage"""
        try:
            filepath = self._get_file_path("memories.json")
            with open(filepath, 'w') as f:
                json.dump(self.memories, f, indent=2, default=str)
        except Exception as e:
            print(f"Memory save error: {e}")
    
    def save_interaction(self, user_id: str, message: str, response: str):
        """Save a conversation interaction"""
        
        if user_id not in self.memories:
            self.memories[user_id] = {
                "interactions": [],
                "facts": [],
                "preferences": {},
                "created_at": datetime.now().isoformat()
            }
        
        interaction = {
            "timestamp": datetime.now().isoformat(),
            "message": message,
            "response": response
        }
        
        self.memories[user_id]["interactions"].append(interaction)
        
        # Keep last 200 interactions
        if len(self.memories[user_id]["interactions"]) > 200:
            self.memories[user_id]["interactions"] = \
                self.memories[user_id]["interactions"][-200:]
        
        self._save_memories()
    
    def get_user_context(self, user_id: str, limit: int = 10) -> List[Dict]:
        """Get recent context for user"""
        
        if user_id not in self.memories:
            return []
        
        interactions = self.memories[user_id].get("interactions", [])
        return interactions[-limit:]
    
    def search_memories(self, user_id: str, topic: str, limit: int = 10) -> List[Dict]:
        """Search memories by topic"""
        
        if user_id not in self.memories:
            return []
        
        interactions = self.memories[user_id].get("interactions", [])
        topic_lower = topic.lower()
        
        matching = [
            i for i in interactions
            if topic_lower in i.get("message", "").lower() or
               topic_lower in i.get("response", "").lower()
        ]
        
        return matching[-limit:]
    
    def save_fact(self, user_id: str, fact: str):
        """Save a fact about user"""
        
        if user_id not in self.memories:
            self.memories[user_id] = {
                "interactions": [],
                "facts": [],
                "preferences": {},
                "created_at": datetime.now().isoformat()
            }
        
        self.memories[user_id]["facts"].append({
            "fact": fact,
            "timestamp": datetime.now().isoformat()
        })
        
        # Keep last 50 facts
        if len(self.memories[user_id]["facts"]) > 50:
            self.memories[user_id]["facts"] = \
                self.memories[user_id]["facts"][-50:]
        
        self._save_memories()
    
    def get_facts(self, user_id: str) -> List[Dict]:
        """Get facts about user"""
        
        if user_id not in self.memories:
            return []
        
        return self.memories[user_id].get("facts", [])
    
    def clear_user(self, user_id: str):
        """Clear all memory for user"""
        
        if user_id in self.memories:
            del self.memories[user_id]
            self._save_memories()
    
    def clear_session(self, user_id: str):
        """Clear only recent session"""
        
        if user_id in self.memories:
            # Keep only older interactions
            interactions = self.memories[user_id].get("interactions", [])
            if len(interactions) > 20:
                self.memories[user_id]["interactions"] = interactions[:-20]
            else:
                self.memories[user_id]["interactions"] = []
            self._save_memories()
    
    def get_stats(self) -> Dict:
        """Get memory statistics"""
        
        total_interactions = sum(
            len(u.get("interactions", []))
            for u in self.memories.values()
        )
        
        total_facts = sum(
            len(u.get("facts", []))
            for u in self.memories.values()
        )
        
        return {
            "users": len(self.memories),
            "total_interactions": total_interactions,
            "total_facts": total_facts
        }