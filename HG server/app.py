"""
🤖 JARVIS API - Complete Single-File Version
=============================================
All features in one file - no external modules needed
=============================================
"""

import os
import json
from datetime import datetime
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from duckduckgo_search import DDGS
import requests

# ============================================
# CONFIGURATION
# ============================================

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
HF_API_TOKEN = os.environ.get("HF_API_TOKEN", "")
HF_IMAGE_CAPTION_MODEL = os.environ.get(
    "HF_IMAGE_CAPTION_MODEL",
    "Salesforce/blip-image-captioning-base",
)
HF_OCR_MODEL = os.environ.get(
    "HF_OCR_MODEL",
    "microsoft/trocr-base-printed",
)
HF_ASR_MODEL = os.environ.get(
    "HF_ASR_MODEL",
    "openai/whisper-small",
)
MEMORY_STORAGE_PATH = os.environ.get("JARVIS_MEMORY_PATH", "/data/jarvis_memory.json")
AUTOMATION_STORAGE_PATH = os.environ.get("JARVIS_AUTOMATION_PATH", "/data/jarvis_automation.json")

# ============================================
# FASTAPI APP
# ============================================

app = FastAPI(
    title="JARVIS API",
    description="Advanced AI Assistant with IoT Integration",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# GROQ CLIENT
# ============================================

client = None
if GROQ_API_KEY:
    client = Groq(api_key=GROQ_API_KEY)

# ============================================
# IN-MEMORY STORAGE
# ============================================

# User memory storage
memory_storage: Dict[str, List[Dict]] = {}

# Automation settings
DEFAULT_AUTOMATION_SETTINGS: Dict[str, Any] = {
    "gesture_mappings": {
        "Closed_Fist": {"device": "light_living", "action": "toggle"},
        "Victory": {"device": "fan_main", "action": "toggle"},
        "Open_Palm": {"device": "all", "action": "off"},
    },
    "pose_mappings": {
        "hands_up": {"device": "light_living", "action": "on"},
        "hands_down": {"device": "light_living", "action": "off"},
    },
    "cooldowns": {
        "gesture": {
            "default": 4000,
        },
        "pose": {
            "default": 5000,
        },
    },
}
automation_settings: Dict[str, Any] = json.loads(json.dumps(DEFAULT_AUTOMATION_SETTINGS))

activity_timeline: List[Dict[str, Any]] = []

memory_loaded = False
automation_loaded = False


def load_json_file(path: str, default: Any) -> Any:
    try:
        if not os.path.exists(path):
            return default
        with open(path, "r", encoding="utf-8") as file:
            return json.load(file)
    except Exception:
        return default


def save_json_file(path: str, data: Any) -> None:
    try:
        directory = os.path.dirname(path)
        if directory and not os.path.exists(directory):
            os.makedirs(directory, exist_ok=True)
        with open(path, "w", encoding="utf-8") as file:
            json.dump(data, file)
    except Exception:
        pass


def ensure_memory_loaded() -> None:
    global memory_loaded, memory_storage
    if memory_loaded:
        return
    storage = load_json_file(MEMORY_STORAGE_PATH, {})
    memory_storage = storage if isinstance(storage, dict) else {}
    memory_loaded = True


def persist_memory_storage() -> None:
    save_json_file(MEMORY_STORAGE_PATH, memory_storage)


def ensure_automation_loaded() -> None:
    global automation_loaded, automation_settings, activity_timeline
    if automation_loaded:
        return
    payload = load_json_file(AUTOMATION_STORAGE_PATH, {})
    if isinstance(payload, dict):
        settings = payload.get("settings")
        if isinstance(settings, dict):
            automation_settings = normalize_automation_settings(settings)
        timeline = payload.get("timeline")
        if isinstance(timeline, list):
            activity_timeline = timeline
    automation_loaded = True


def persist_automation_settings() -> None:
    save_json_file(
        AUTOMATION_STORAGE_PATH,
        {
            "settings": automation_settings,
            "timeline": activity_timeline,
        },
    )


def normalize_automation_settings(settings: Any) -> Dict[str, Any]:
    merged = json.loads(json.dumps(DEFAULT_AUTOMATION_SETTINGS))
    if not isinstance(settings, dict):
        return merged

    if isinstance(settings.get("gesture_mappings"), dict):
        merged["gesture_mappings"] = settings["gesture_mappings"]
    if isinstance(settings.get("pose_mappings"), dict):
        merged["pose_mappings"] = settings["pose_mappings"]

    cooldowns = settings.get("cooldowns")
    if isinstance(cooldowns, dict):
        gesture_cooldowns = cooldowns.get("gesture")
        if isinstance(gesture_cooldowns, dict):
            merged["cooldowns"]["gesture"].update(gesture_cooldowns)
        pose_cooldowns = cooldowns.get("pose")
        if isinstance(pose_cooldowns, dict):
            merged["cooldowns"]["pose"].update(pose_cooldowns)

    return merged


ALLOWED_AUTOMATION_ACTIONS = {"on", "off", "toggle"}


def validate_automation_settings(settings: Dict[str, Any]) -> None:
    if not isinstance(settings, dict):
        raise HTTPException(status_code=400, detail="Invalid automation payload")

    gesture_mappings = settings.get("gesture_mappings")
    if not isinstance(gesture_mappings, dict):
        raise HTTPException(status_code=400, detail="Invalid gesture mappings")
    for key, mapping in gesture_mappings.items():
        if not isinstance(mapping, dict):
            raise HTTPException(status_code=400, detail=f"Invalid mapping for {key}")
        device = mapping.get("device")
        action = mapping.get("action")
        if not isinstance(device, str) or not device:
            raise HTTPException(status_code=400, detail=f"Invalid device for {key}")
        if device != "all" and device not in devices:
            raise HTTPException(status_code=400, detail=f"Unknown device {device}")
        if action not in ALLOWED_AUTOMATION_ACTIONS:
            raise HTTPException(status_code=400, detail=f"Invalid action {action}")

    pose_mappings = settings.get("pose_mappings")
    if not isinstance(pose_mappings, dict):
        raise HTTPException(status_code=400, detail="Invalid pose mappings")
    for key, mapping in pose_mappings.items():
        if not isinstance(mapping, dict):
            raise HTTPException(status_code=400, detail=f"Invalid mapping for {key}")
        device = mapping.get("device")
        action = mapping.get("action")
        if not isinstance(device, str) or not device:
            raise HTTPException(status_code=400, detail=f"Invalid device for {key}")
        if device != "all" and device not in devices:
            raise HTTPException(status_code=400, detail=f"Unknown device {device}")
        if action not in ALLOWED_AUTOMATION_ACTIONS:
            raise HTTPException(status_code=400, detail=f"Invalid action {action}")

    cooldowns = settings.get("cooldowns")
    if not isinstance(cooldowns, dict):
        raise HTTPException(status_code=400, detail="Invalid cooldowns")
    for category, values in cooldowns.items():
        if not isinstance(values, dict):
            raise HTTPException(status_code=400, detail=f"Invalid cooldowns for {category}")
        for key, value in values.items():
            if not isinstance(value, int) or value < 0:
                raise HTTPException(status_code=400, detail=f"Invalid cooldown for {key}")

# Device states
devices = {
    "light_living": {"state": False, "type": "light", "name": "Living Room Light", "brightness": 0},
    "light_bedroom": {"state": False, "type": "light", "name": "Bedroom Light", "brightness": 0},
    "light_kitchen": {"state": False, "type": "light", "name": "Kitchen Light", "brightness": 0},
    "fan_main": {"state": False, "type": "fan", "name": "Main Fan", "speed": 0},
    "fan_bedroom": {"state": False, "type": "fan", "name": "Bedroom Fan", "speed": 0},
    "ac_main": {"state": False, "type": "ac", "name": "Air Conditioner", "temperature": 24},
    "thermostat": {"state": True, "type": "thermostat", "name": "Thermostat", "temperature": 22},
}

# Sensor data
sensors = {
    "temperature": 25.0,
    "humidity": 50.0,
    "light_level": 500,
    "motion": False,
    "gas_level": 0
}

# Pending commands for ESP32
pending_commands: List[Dict] = []

# Device aliases
device_aliases = {
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
}

# ============================================
# SYSTEM PROMPT
# ============================================

SYSTEM_PROMPT = """You are JARVIS (Just A Rather Very Intelligent System), 
an advanced AI assistant with IoT capabilities.

PERSONALITY:
- Intelligent, sophisticated, helpful
- Slight British wit and charm
- Professional yet personable
- Concise responses (2-3 sentences usually)

CAPABILITIES:
1. Control smart home devices (lights, fan, AC, thermostat)
2. Search the internet for information
3. Provide weather updates
4. Remember conversations
5. Solve problems step by step
6. Answer any questions

Always be helpful, accurate, and engaging."""

# ============================================
# PYDANTIC MODELS
# ============================================

class ChatRequest(BaseModel):
    message: str
    user_id: str = "default"

class ChatResponse(BaseModel):
    response: str
    intent: Optional[Dict] = None
    timestamp: str


class AutomationSettingsRequest(BaseModel):
    gesture_mappings: Optional[Dict[str, Dict[str, Any]]] = None
    pose_mappings: Optional[Dict[str, Dict[str, Any]]] = None
    cooldowns: Optional[Dict[str, Dict[str, int]]] = None


class TimelineEvent(BaseModel):
    category: str
    label: str
    device: Optional[str] = None
    action: Optional[str] = None
    source: Optional[str] = None
    timestamp: Optional[str] = None

class DeviceCommand(BaseModel):
    device: str
    action: str
    value: Optional[Any] = None

class SensorData(BaseModel):
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    light_level: Optional[int] = None
    motion: Optional[bool] = None
    gas_level: Optional[int] = None

# ============================================
# HELPER FUNCTIONS
# ============================================

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
TEXT_EXTENSIONS = {".txt", ".md", ".csv", ".json"}
TEXT_CONTENT_TYPES = {
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/json",
}
IMAGE_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
}
AUDIO_CONTENT_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp3",
    "audio/webm",
    "audio/ogg",
    "audio/mp4",
    "audio/x-m4a",
}
AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".webm", ".ogg"}

def detect_intent(message: str) -> Dict[str, Any]:
    """Detect user intent from message"""
    
    msg = message.lower().strip()
    
    # Device control patterns
    device_keywords = {
        "light": ["light", "lamp", "bulb", "lights"],
        "fan": ["fan", "ventilator"],
        "ac": ["ac", "air conditioner", "aircon", "cooling"],
        "thermostat": ["thermostat", "temperature setting", "heating"],
    }
    
    action_keywords = {
        "on": ["on", "turn on", "switch on", "start", "enable", "open"],
        "off": ["off", "turn off", "switch off", "stop", "disable", "close"],
        "toggle": ["toggle", "switch"],
    }
    
    # Check for device control
    for device, keywords in device_keywords.items():
        if any(kw in msg for kw in keywords):
            action = "toggle"
            for act, act_kw in action_keywords.items():
                if any(kw in msg for kw in act_kw):
                    action = act
                    break
            
            # Extract value if any
            value = None
            import re
            numbers = re.findall(r'\d+', msg)
            if numbers:
                value = int(numbers[0])
            
            return {
                "type": "device_control",
                "device": device,
                "action": action,
                "value": value
            }
    
    # Search patterns
    search_keywords = ["search", "find", "look up", "google", "what is", 
                       "who is", "tell me about", "latest", "news about"]
    if any(kw in msg for kw in search_keywords):
        query = msg
        for kw in ["search for", "search", "find", "look up", "tell me about"]:
            query = query.replace(kw, "").strip()
        return {"type": "search", "query": query}
    
    # Weather patterns
    weather_keywords = ["weather", "temperature outside", "rain", "forecast", 
                        "sunny", "cloudy", "hot outside", "cold outside"]
    if any(kw in msg for kw in weather_keywords):
        location = ""
        if " in " in msg:
            location = msg.split(" in ")[-1].strip().rstrip("?")
        return {"type": "weather", "location": location}
    
    # Status patterns
    status_keywords = ["status", "all devices", "device status", "sensors", 
                       "what's on", "system status"]
    if any(kw in msg for kw in status_keywords):
        return {"type": "status"}
    
    # Default: general conversation
    return {"type": "general"}


def get_ai_response(message: str, user_id: str, context: List[Dict] = None) -> str:
    """Get response from Groq LLM"""
    
    if not client:
        return "I'm having trouble connecting to my brain. Please check if GROQ_API_KEY is set."
    
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    
    # Add context
    if context:
        for ctx in context[-5:]:
            messages.append({"role": "user", "content": ctx.get("message", "")})
            messages.append({"role": "assistant", "content": ctx.get("response", "")})
    
    messages.append({"role": "user", "content": message})
    
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=500,
            temperature=0.7
        )
        return response.choices[0].message.content
    except Exception as e:
        return f"I encountered an error: {str(e)}"


def search_web(query: str, max_results: int = 3) -> str:
    """Search the web using DuckDuckGo"""
    
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
            
            if not results:
                return "I couldn't find any results for that search."
            
            summary = "Here's what I found:\n\n"
            for i, r in enumerate(results, 1):
                title = r.get("title", "No title")
                body = r.get("body", "")[:200]
                summary += f"{i}. **{title}**\n{body}...\n\n"
            
            return summary
    except Exception as e:
        return f"Search failed: {str(e)}"


def get_weather(location: str = "") -> Dict:
    """Get weather from wttr.in"""
    
    try:
        url = f"https://wttr.in/{location}"
        response = requests.get(url, params={"format": "j1"}, timeout=10)
        data = response.json()
        
        current = data["current_condition"][0]
        area = data["nearest_area"][0]
        
        return {
            "success": True,
            "location": area["areaName"][0]["value"],
            "country": area["country"][0]["value"],
            "temperature": int(current["temp_C"]),
            "feels_like": int(current["FeelsLikeC"]),
            "condition": current["weatherDesc"][0]["value"],
            "humidity": int(current["humidity"]),
            "wind_kph": int(current["windspeedKmph"]),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def summarize_text(content: str) -> Optional[str]:
    """Summarize file content with Groq if available"""

    if not client:
        return None

    trimmed = content[:2500]
    prompt = (
        "Summarize this file in 2-3 sentences and list key points.\n\n"
        f"{trimmed}"
    )

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You summarize files concisely."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=200,
            temperature=0.4
        )
        return response.choices[0].message.content
    except Exception:
        return None


def call_hf_image_model(model: str, image_bytes: bytes) -> Optional[str]:
    """Call a Hugging Face image-to-text model."""

    if not HF_API_TOKEN:
        return None

    url = f"https://api-inference.huggingface.co/models/{model}"
    headers = {
        "Authorization": f"Bearer {HF_API_TOKEN}",
    }

    try:
        response = requests.post(url, headers=headers, data=image_bytes, timeout=30)
        if response.status_code >= 400:
            return None

        payload = response.json()
        if isinstance(payload, list) and payload:
            text = payload[0].get("generated_text")
            return text
        if isinstance(payload, dict):
            return payload.get("generated_text")
    except Exception:
        return None

    return None


def analyze_image_content(image_bytes: bytes) -> Dict[str, Optional[str]]:
    """Return caption and OCR text for an image."""

    caption = call_hf_image_model(HF_IMAGE_CAPTION_MODEL, image_bytes)
    ocr_text = call_hf_image_model(HF_OCR_MODEL, image_bytes)

    return {
        "caption": caption,
        "ocr_text": ocr_text,
    }


def call_hf_audio_model(model: str, audio_bytes: bytes) -> Optional[str]:
    """Call a Hugging Face speech-to-text model."""

    if not HF_API_TOKEN:
        return None

    url = f"https://api-inference.huggingface.co/models/{model}"
    headers = {
        "Authorization": f"Bearer {HF_API_TOKEN}",
    }

    try:
        response = requests.post(url, headers=headers, data=audio_bytes, timeout=60)
        if response.status_code >= 400:
            return None

        payload = response.json()
        if isinstance(payload, dict):
            return payload.get("text") or payload.get("generated_text")
        if isinstance(payload, list) and payload:
            first = payload[0]
            if isinstance(first, dict):
                return first.get("text") or first.get("generated_text")
    except Exception:
        return None

    return None


def build_file_preview(filename: Optional[str], content_type: Optional[str], size: int) -> str:
    """Build a lightweight preview string for non-text attachments."""

    safe_name = filename or "unknown"
    safe_type = content_type or "application/octet-stream"
    size_kb = round(size / 1024, 1)
    return f"{safe_name} ({safe_type}, {size_kb} KB)"


def resolve_device(device_name: str) -> Optional[str]:
    """Resolve device name to device ID"""
    
    name = device_name.lower().strip()
    
    # Check aliases
    if name in device_aliases:
        return device_aliases[name]
    
    # Check direct match
    if name in devices:
        return name
    
    # Partial match
    for device_id, device in devices.items():
        if name in device_id or name in device["name"].lower():
            return device_id
    
    return None


def control_device(device_name: str, action: str, value: Any = None) -> Dict:
    """Control a device"""
    
    device_id = resolve_device(device_name)
    
    if not device_id:
        return {
            "success": False,
            "message": f"Device '{device_name}' not found. Available: {', '.join(devices.keys())}"
        }
    
    device = devices[device_id]
    
    # Apply action
    if action == "on":
        device["state"] = True
        if device["type"] == "light":
            device["brightness"] = value if value else 100
        elif device["type"] == "fan":
            device["speed"] = value if value else 3
            
    elif action == "off":
        device["state"] = False
        if device["type"] == "light":
            device["brightness"] = 0
        elif device["type"] == "fan":
            device["speed"] = 0
            
    elif action == "toggle":
        device["state"] = not device["state"]
        
    elif action == "set" and value is not None:
        if device["type"] in ["ac", "thermostat"]:
            device["temperature"] = value
            device["state"] = True
        elif device["type"] == "light":
            device["brightness"] = min(100, max(0, value))
            device["state"] = value > 0
        elif device["type"] == "fan":
            device["speed"] = min(5, max(0, value))
            device["state"] = value > 0
    
    # Add to pending commands for ESP32
    pending_commands.append({
        "device": device_id,
        "action": action,
        "value": value,
        "state": device.copy(),
        "timestamp": datetime.now().isoformat()
    })
    
    # Keep only last 50 commands
    if len(pending_commands) > 50:
        pending_commands.pop(0)
    
    status = "on" if device["state"] else "off"
    message = f"{device['name']} is now {status}"
    
    if device["type"] == "light" and device["state"]:
        message += f" at {device['brightness']}% brightness"
    elif device["type"] == "fan" and device["state"]:
        message += f" at speed {device['speed']}"
    elif device["type"] in ["ac", "thermostat"]:
        message += f", set to {device['temperature']}°C"
    
    return {
        "success": True,
        "message": message,
        "device_id": device_id,
        "state": device
    }


def save_to_memory(user_id: str, message: str, response: str):
    """Save interaction to memory"""
    ensure_memory_loaded()
    if user_id not in memory_storage:
        memory_storage[user_id] = []
    
    memory_storage[user_id].append({
        "message": message,
        "response": response,
        "timestamp": datetime.now().isoformat()
    })
    
    # Keep last 100 messages per user
    if len(memory_storage[user_id]) > 100:
        memory_storage[user_id] = memory_storage[user_id][-100:]

    persist_memory_storage()


def get_user_context(user_id: str, limit: int = 10) -> List[Dict]:
    """Get user's conversation context"""
    ensure_memory_loaded()
    if user_id not in memory_storage:
        return []
    
    return memory_storage[user_id][-limit:]


# ============================================
# API ENDPOINTS
# ============================================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "🤖 JARVIS API",
        "version": "2.0.0",
        "status": "online",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
async def health():
    """Health check"""
    return {
        "status": "healthy",
        "groq_configured": bool(GROQ_API_KEY),
        "timestamp": datetime.now().isoformat()
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Main chat endpoint"""
    
    message = request.message.strip()
    user_id = request.user_id
    
    if not message:
        raise HTTPException(status_code=400, detail="Empty message")
    
    # Detect intent
    intent = detect_intent(message)
    response = ""
    
    # Handle based on intent
    if intent["type"] == "device_control":
        result = control_device(
            intent["device"],
            intent["action"],
            intent.get("value")
        )
        response = result["message"] if result["success"] else f"Sorry, {result['message']}"
        
    elif intent["type"] == "search":
        query = intent.get("query", message)
        search_results = search_web(query)
        
        # Summarize with AI if available
        if client:
            summary_prompt = f"Summarize this search result in 2-3 sentences:\n\n{search_results}"
            response = get_ai_response(summary_prompt, user_id)
        else:
            response = search_results
            
    elif intent["type"] == "weather":
        location = intent.get("location", "")
        weather_data = get_weather(location)
        
        if weather_data["success"]:
            response = (
                f"Weather in {weather_data['location']}, {weather_data['country']}: "
                f"{weather_data['temperature']}°C (feels like {weather_data['feels_like']}°C), "
                f"{weather_data['condition']}. "
                f"Humidity: {weather_data['humidity']}%, Wind: {weather_data['wind_kph']} km/h."
            )
        else:
            response = "I couldn't get weather information right now. Please try again later."
            
    elif intent["type"] == "status":
        # Build status response
        device_list = []
        for did, d in devices.items():
            status = "ON" if d["state"] else "OFF"
            device_list.append(f"{d['name']}: {status}")
        
        response = (
            f"System Status:\n"
            f"Devices: {', '.join(device_list)}\n"
            f"Sensors: Temp {sensors['temperature']}°C, "
            f"Humidity {sensors['humidity']}%, "
            f"Light {sensors['light_level']}, "
            f"Motion: {'Yes' if sensors['motion'] else 'No'}"
        )
        
    else:
        # General conversation - use AI
        context = get_user_context(user_id)
        response = get_ai_response(message, user_id, context)
    
    # Save to memory
    save_to_memory(user_id, message, response)
    
    return ChatResponse(
        response=response,
        intent=intent,
        timestamp=datetime.now().isoformat()
    )


@app.get("/api/devices/status")
async def get_devices_status():
    """Get all device statuses"""
    return {
        "devices": devices,
        "sensors": sensors,
        "pending_commands": len(pending_commands),
        "timestamp": datetime.now().isoformat()
    }


@app.get("/api/automation/settings")
async def get_automation_settings():
    """Get automation mappings and cooldowns."""
    ensure_automation_loaded()
    return {
        "success": True,
        "settings": automation_settings,
    }


@app.post("/api/automation/settings")
async def update_automation_settings(payload: AutomationSettingsRequest):
    """Update automation mappings and cooldowns."""
    ensure_automation_loaded()

    updated = {
        "gesture_mappings": payload.gesture_mappings or automation_settings.get("gesture_mappings"),
        "pose_mappings": payload.pose_mappings or automation_settings.get("pose_mappings"),
        "cooldowns": payload.cooldowns or automation_settings.get("cooldowns"),
    }
    validate_automation_settings(updated)
    automation_settings.update(normalize_automation_settings(updated))
    persist_automation_settings()
    return {
        "success": True,
        "settings": automation_settings,
    }


@app.get("/api/automation/timeline")
async def get_activity_timeline(limit: int = 50):
    """Get automation activity timeline."""
    ensure_automation_loaded()
    return {
        "success": True,
        "events": activity_timeline[-limit:][::-1],
    }


@app.post("/api/automation/timeline")
async def add_activity_event(event: TimelineEvent):
    """Log an automation activity event."""
    ensure_automation_loaded()
    payload = event.model_dump()
    payload["timestamp"] = payload.get("timestamp") or datetime.now().isoformat()
    activity_timeline.append(payload)
    if len(activity_timeline) > 200:
        activity_timeline.pop(0)
    persist_automation_settings()
    return {"success": True, "event": payload}


@app.delete("/api/automation/timeline")
async def clear_activity_timeline():
    """Clear automation activity timeline."""
    ensure_automation_loaded()
    activity_timeline.clear()
    persist_automation_settings()
    return {"success": True}


@app.post("/api/devices/control")
async def device_control(command: DeviceCommand):
    """Control a device"""
    
    result = control_device(command.device, command.action, command.value)
    return result


@app.post("/api/devices/sensors")
async def update_sensors(data: SensorData):
    """Update sensor data from ESP32"""
    
    if data.temperature is not None:
        sensors["temperature"] = data.temperature
    if data.humidity is not None:
        sensors["humidity"] = data.humidity
    if data.light_level is not None:
        sensors["light_level"] = data.light_level
    if data.motion is not None:
        sensors["motion"] = data.motion
    if data.gas_level is not None:
        sensors["gas_level"] = data.gas_level
    
    # Check for alerts
    alerts = []
    if sensors["temperature"] > 35:
        alerts.append({
            "type": "high_temperature",
            "message": f"High temperature: {sensors['temperature']}°C",
            "severity": "warning"
        })
    if sensors["gas_level"] > 500:
        alerts.append({
            "type": "gas_detected",
            "message": f"Gas level high: {sensors['gas_level']}",
            "severity": "critical"
        })
    
    return {
        "success": True,
        "sensors": sensors,
        "alerts": alerts
    }


@app.get("/api/devices/commands")
async def get_pending_commands():
    """Get pending commands for ESP32"""
    global pending_commands
    
    commands = pending_commands.copy()
    pending_commands = []
    
    return {"commands": commands}


@app.get("/api/search")
async def search_endpoint(q: str, max_results: int = 5):
    """Search the web"""
    
    results = search_web(q, max_results)
    return {
        "query": q,
        "results": results
    }


@app.get("/api/weather")
async def weather_endpoint(location: str = ""):
    """Get weather information"""
    
    return get_weather(location)


@app.get("/api/memory/{user_id}")
async def get_memory(user_id: str, limit: int = 20):
    """Get user's conversation history"""
    ensure_memory_loaded()
    
    if user_id not in memory_storage:
        return {"messages": []}
    
    return {
        "user_id": user_id,
        "message_count": len(memory_storage[user_id]),
        "messages": memory_storage[user_id][-limit:]
    }


@app.delete("/api/memory/{user_id}")
async def clear_memory(user_id: str):
    """Clear user's memory"""
    ensure_memory_loaded()
    if user_id in memory_storage:
        del memory_storage[user_id]
        persist_memory_storage()
    
    return {
        "success": True,
        "message": f"Memory cleared for user: {user_id}"
    }


@app.post("/api/files/analyze")
async def analyze_file(file: UploadFile = File(...)):
    """Analyze an uploaded file and return a summary/preview."""

    contents = await file.read()

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 5MB limit")

    filename = file.filename or "unknown"
    _, ext = os.path.splitext(filename.lower())
    content_type = file.content_type or "application/octet-stream"

    response: Dict[str, Any] = {
        "success": True,
        "filename": filename,
        "content_type": content_type,
        "size": len(contents),
    }

    if content_type in TEXT_CONTENT_TYPES or ext in TEXT_EXTENSIONS:
        decoded = contents.decode("utf-8", errors="replace")
        preview = decoded[:1000]
        response["preview"] = preview

        summary = summarize_text(decoded)
        if summary:
            response["ai_summary"] = summary
    elif content_type in IMAGE_CONTENT_TYPES:
        analysis = analyze_image_content(contents)
        caption = analysis.get("caption")
        ocr_text = analysis.get("ocr_text")

        response["caption"] = caption
        response["ocr_text"] = ocr_text
        response["preview"] = build_file_preview(filename, content_type, len(contents))

        summary_parts = []
        if caption:
            summary_parts.append(f"Caption: {caption}")
        if ocr_text:
            summary_parts.append(f"OCR: {ocr_text}")
        if summary_parts:
            response["ai_summary"] = "\n".join(summary_parts)
    elif content_type in AUDIO_CONTENT_TYPES or ext in AUDIO_EXTENSIONS:
        transcript = call_hf_audio_model(HF_ASR_MODEL, contents)
        response["transcript"] = transcript
        response["preview"] = build_file_preview(filename, content_type, len(contents))

        if transcript:
            transcript_summary = summarize_text(transcript)
            if transcript_summary:
                response["ai_summary"] = f"Transcript summary: {transcript_summary}"
            else:
                response["ai_summary"] = f"Transcript: {transcript}"
    else:
        response["preview"] = build_file_preview(filename, content_type, len(contents))

    return response


# ============================================
# RUN SERVER (for local testing)
# ============================================

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)