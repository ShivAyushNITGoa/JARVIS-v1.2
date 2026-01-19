"""
🤖 JARVIS ULTIMATE - Backend Server
===================================
Features:
- AI Brain (LLaMA 3.3 70B)
- Internet Search
- Device Control (ESP32-S3)
- Memory System
- Learning System
- Problem Solving
- Real-time WebSocket
- REST API
===================================
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Optional, Dict, Any, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Import modules
from modules.brain import JarvisBrain
from modules.memory import MemorySystem
from modules.search import SearchEngine
from modules.devices import DeviceManager
from modules.learning import LearningSystem
from modules.weather import WeatherService
from modules.problem_solver import ProblemSolver

# ============================================
# CONFIGURATION
# ============================================

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

# ============================================
# INITIALIZE SYSTEMS
# ============================================

brain = JarvisBrain(GROQ_API_KEY)
memory = MemorySystem()
search = SearchEngine()
devices = DeviceManager()
learning = LearningSystem()
weather = WeatherService()
problem_solver = ProblemSolver(brain)

# WebSocket connections
active_connections: Dict[str, WebSocket] = {}

# ============================================
# LIFESPAN
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🤖 JARVIS Backend Starting...")
    yield
    print("🤖 JARVIS Backend Shutting Down...")

# ============================================
# FASTAPI APP
# ============================================

app = FastAPI(
    title="JARVIS Ultimate API",
    description="Advanced AI Assistant with IoT Integration",
    version="2.0.0",
    lifespan=lifespan
)

# CORS for Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update with your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# PYDANTIC MODELS
# ============================================

class ChatRequest(BaseModel):
    message: str
    user_id: str = "default"
    include_context: bool = True

class ChatResponse(BaseModel):
    response: str
    intent: Dict[str, Any]
    actions_taken: List[Dict[str, Any]]
    timestamp: str

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
    custom: Optional[Dict[str, Any]] = None

class ProblemRequest(BaseModel):
    problem: str
    context: Optional[str] = None
    user_id: str = "default"

# ============================================
# MAIN CHAT ENDPOINT
# ============================================

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Process chat message with all JARVIS capabilities"""
    
    try:
        message = request.message.strip()
        user_id = request.user_id
        
        if not message:
            raise HTTPException(status_code=400, detail="Empty message")
        
        # Get user context
        user_context = memory.get_user_context(user_id) if request.include_context else []
        user_prefs = learning.get_preferences(user_id)
        
        # Detect intent
        intent = brain.detect_intent(message)
        actions_taken = []
        
        # Handle different intents
        if intent["type"] == "device_control":
            result = handle_device_command(intent, user_id)
            response = result["response"]
            actions_taken.append({"type": "device_control", "result": result})
            
        elif intent["type"] == "search":
            result = await handle_search(intent, message)
            response = result
            actions_taken.append({"type": "search", "query": intent.get("query", "")})
            
        elif intent["type"] == "weather":
            result = handle_weather(intent)
            response = result
            actions_taken.append({"type": "weather", "location": intent.get("location", "")})
            
        elif intent["type"] == "problem_solving":
            result = await problem_solver.solve(message, user_context)
            response = result["solution"]
            actions_taken.append({"type": "problem_solving", "approach": result.get("approach", "")})
            
        elif intent["type"] == "memory_query":
            response = handle_memory_query(intent, user_id)
            actions_taken.append({"type": "memory_query"})
            
        elif intent["type"] == "learning":
            response = handle_learning_command(intent, message, user_id)
            actions_taken.append({"type": "learning"})
            
        elif intent["type"] == "status":
            response = handle_status_query()
            actions_taken.append({"type": "status"})
            
        else:
            # General conversation
            response = brain.chat(
                message=message,
                context=user_context,
                preferences=user_prefs
            )
        
        # Save to memory
        memory.save_interaction(user_id, message, response)
        
        # Update learning
        learning.update_from_interaction(user_id, message, intent)
        
        # Broadcast to WebSocket clients
        await broadcast_update({
            "type": "chat",
            "user_id": user_id,
            "message": message,
            "response": response
        })
        
        return ChatResponse(
            response=response,
            intent=intent,
            actions_taken=actions_taken,
            timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# DEVICE ENDPOINTS
# ============================================

@app.post("/api/devices/control")
async def control_device(command: DeviceCommand):
    """Control a device"""
    
    result = devices.control(command.device, command.action, command.value)
    
    # Broadcast update
    await broadcast_update({
        "type": "device_update",
        "device": command.device,
        "state": result
    })
    
    return result


@app.get("/api/devices/status")
async def get_devices_status():
    """Get all device statuses"""
    return {
        "devices": devices.get_all_status(),
        "sensors": devices.get_sensor_data(),
        "timestamp": datetime.now().isoformat()
    }


@app.post("/api/devices/sensors")
async def update_sensors(data: SensorData):
    """Receive sensor data from ESP32"""
    
    sensor_dict = data.dict(exclude_none=True)
    devices.update_sensor_data(sensor_dict)
    
    # Check for alerts
    alerts = devices.check_alerts(sensor_dict)
    
    # Broadcast update
    await broadcast_update({
        "type": "sensor_update",
        "data": sensor_dict,
        "alerts": alerts
    })
    
    return {"success": True, "alerts": alerts}


@app.get("/api/devices/commands")
async def get_pending_commands():
    """Get pending commands for ESP32"""
    
    commands = devices.get_pending_commands()
    return {"commands": commands}


# ============================================
# SEARCH & WEATHER ENDPOINTS
# ============================================

@app.get("/api/search")
async def search_web(q: str, max_results: int = 5):
    """Search the web"""
    
    results = search.search(q, max_results)
    summary = brain.summarize_search(q, results)
    
    return {
        "query": q,
        "results": results,
        "summary": summary
    }


@app.get("/api/weather")
async def get_weather(location: str = "auto"):
    """Get weather information"""
    
    data = weather.get_weather(location)
    forecast = weather.get_forecast(location)
    
    return {
        "current": data,
        "forecast": forecast
    }


# ============================================
# PROBLEM SOLVING ENDPOINT
# ============================================

@app.post("/api/solve")
async def solve_problem(request: ProblemRequest):
    """Solve complex problems with step-by-step approach"""
    
    context = memory.get_user_context(request.user_id)
    result = await problem_solver.solve(request.problem, context)
    
    # Save to memory
    memory.save_interaction(request.user_id, request.problem, result["solution"])
    
    return result


# ============================================
# MEMORY ENDPOINTS
# ============================================

@app.get("/api/memory/{user_id}")
async def get_memory(user_id: str, limit: int = 20):
    """Get user's conversation history"""
    
    return {
        "context": memory.get_user_context(user_id, limit),
        "facts": memory.get_facts(user_id),
        "preferences": learning.get_preferences(user_id)
    }


@app.delete("/api/memory/{user_id}")
async def clear_memory(user_id: str):
    """Clear user's memory"""
    
    memory.clear_user(user_id)
    learning.clear_user(user_id)
    
    return {"success": True, "message": "Memory cleared"}


# ============================================
# LEARNING ENDPOINTS
# ============================================

@app.post("/api/learn")
async def learn_preference(user_id: str, key: str, value: str):
    """Teach JARVIS a preference"""
    
    learning.set_preference(user_id, key, value)
    memory.save_fact(user_id, f"User prefers {key}: {value}")
    
    return {"success": True, "message": f"I'll remember that you prefer {key}: {value}"}


@app.get("/api/suggestions/{user_id}")
async def get_suggestions(user_id: str):
    """Get personalized suggestions based on learned patterns"""
    
    suggestions = learning.suggest_automation(user_id)
    return {"suggestions": suggestions}


# ============================================
# WEBSOCKET FOR REAL-TIME UPDATES
# ============================================

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket for real-time updates"""
    
    await websocket.accept()
    active_connections[client_id] = websocket
    
    print(f"✅ Client connected: {client_id}")
    
    try:
        # Send initial status
        await websocket.send_json({
            "type": "connected",
            "client_id": client_id,
            "devices": devices.get_all_status(),
            "sensors": devices.get_sensor_data()
        })
        
        while True:
            # Receive messages
            data = await websocket.receive_json()
            
            # Process based on type
            if data.get("type") == "chat":
                # Handle chat via WebSocket
                response = await process_ws_chat(data, client_id)
                await websocket.send_json(response)
                
            elif data.get("type") == "device_control":
                # Handle device control
                result = devices.control(
                    data.get("device", ""),
                    data.get("action", ""),
                    data.get("value")
                )
                await websocket.send_json({
                    "type": "device_result",
                    "result": result
                })
                
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                
    except WebSocketDisconnect:
        del active_connections[client_id]
        print(f"❌ Client disconnected: {client_id}")


async def broadcast_update(data: dict):
    """Broadcast update to all connected clients"""
    
    disconnected = []
    
    for client_id, websocket in active_connections.items():
        try:
            await websocket.send_json(data)
        except:
            disconnected.append(client_id)
    
    # Remove disconnected clients
    for client_id in disconnected:
        del active_connections[client_id]


async def process_ws_chat(data: dict, client_id: str) -> dict:
    """Process chat message from WebSocket"""
    
    message = data.get("message", "")
    user_id = data.get("user_id", client_id)
    
    # Similar to REST endpoint
    user_context = memory.get_user_context(user_id)
    intent = brain.detect_intent(message)
    
    if intent["type"] == "device_control":
        result = handle_device_command(intent, user_id)
        response = result["response"]
    else:
        response = brain.chat(message, user_context)
    
    memory.save_interaction(user_id, message, response)
    
    return {
        "type": "chat_response",
        "response": response,
        "intent": intent
    }


# ============================================
# HELPER FUNCTIONS
# ============================================

def handle_device_command(intent: dict, user_id: str) -> dict:
    """Handle device control command"""
    
    device = intent.get("device", "")
    action = intent.get("action", "")
    value = intent.get("value")
    
    result = devices.control(device, action, value)
    
    if result["success"]:
        learning.record_device_usage(user_id, device, action)
    
    return {
        "success": result["success"],
        "response": result["message"],
        "device_state": result.get("state", {})
    }


async def handle_search(intent: dict, original_message: str) -> str:
    """Handle search request"""
    
    query = intent.get("query", original_message)
    results = search.search(query)
    
    if results:
        summary = brain.summarize_search(query, results)
        return summary
    else:
        return "I couldn't find information about that."


def handle_weather(intent: dict) -> str:
    """Handle weather request"""
    
    location = intent.get("location", "auto")
    data = weather.get_weather(location)
    
    if data.get("success"):
        return brain.format_weather(data)
    else:
        return "I couldn't get weather information right now."


def handle_memory_query(intent: dict, user_id: str) -> str:
    """Handle memory query"""
    
    query_type = intent.get("query_type", "")
    topic = intent.get("topic", "")
    
    if query_type == "recall":
        memories = memory.search_memories(user_id, topic)
        return brain.summarize_memories(memories)
    
    elif query_type == "preferences":
        prefs = learning.get_preferences(user_id)
        return brain.describe_preferences(prefs)
    
    return "I don't have specific memories about that."


def handle_learning_command(intent: dict, message: str, user_id: str) -> str:
    """Handle learning commands"""
    
    # Extract what to learn
    if "remember" in message.lower():
        fact = message.lower().replace("remember", "").strip()
        memory.save_fact(user_id, fact)
        return f"I'll remember that: {fact}"
    
    elif "prefer" in message.lower():
        # Extract preference
        parts = message.lower().split("prefer")
        if len(parts) > 1:
            pref = parts[1].strip()
            learning.set_preference(user_id, "user_preference", pref)
            return f"Noted! You prefer {pref}"
    
    return "I'll keep that in mind."


def handle_status_query() -> str:
    """Handle status query"""
    
    status = {
        "devices": devices.get_all_status(),
        "sensors": devices.get_sensor_data(),
        "memory": memory.get_stats(),
        "active_connections": len(active_connections)
    }
    
    return brain.format_status(status)


# ============================================
# HEALTH CHECK
# ============================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    
    return {
        "status": "healthy",
        "service": "JARVIS Ultimate",
        "version": "2.0.0",
        "timestamp": datetime.now().isoformat(),
        "connections": len(active_connections)
    }


@app.get("/")
async def root():
    """Root endpoint"""
    
    return {
        "message": "🤖 JARVIS Ultimate API",
        "docs": "/docs",
        "health": "/health"
    }


# ============================================
# RUN SERVER
# ============================================

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)