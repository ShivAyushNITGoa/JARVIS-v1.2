"""
JARVIS Brain - Advanced AI Logic
"""

from groq import Groq
import json
import re
from typing import Dict, List, Any, Optional

class JarvisBrain:
    def __init__(self, api_key: str):
        self.client = Groq(api_key=api_key)
        self.model = "llama-3.3-70b-versatile"
        
        self.system_prompt = """You are JARVIS (Just A Rather Very Intelligent System), 
an advanced AI assistant with extensive capabilities.

PERSONALITY:
- Highly intelligent and sophisticated
- Slight British wit and charm
- Professional yet personable
- Proactive and anticipatory
- Calm under pressure

CAPABILITIES:
1. DEVICE CONTROL: Smart home and IoT devices
2. SEARCH: Real-time internet search
3. WEATHER: Current and forecast weather
4. PROBLEM SOLVING: Step-by-step solutions
5. MEMORY: Remember conversations and preferences
6. LEARNING: Adapt to user patterns
7. ANALYSIS: Data analysis and insights

RESPONSE STYLE:
- Concise but thorough (2-4 sentences usually)
- Confirm actions taken
- Offer relevant suggestions
- Be conversational and engaging

You have access to:
- Real-time sensor data
- Device control systems
- Internet search
- User history and preferences"""

    def detect_intent(self, message: str) -> Dict[str, Any]:
        """Detect user intent with advanced NLU"""
        
        message_lower = message.lower()
        
        # Device control patterns
        device_keywords = {
            "light": ["light", "lamp", "bulb", "lights", "lighting"],
            "fan": ["fan", "ventilator", "ceiling fan"],
            "ac": ["ac", "air conditioner", "aircon", "cooling", "air conditioning"],
            "thermostat": ["thermostat", "temperature", "heating", "heat"],
            "tv": ["tv", "television", "screen"],
            "door": ["door", "lock", "unlock", "entrance"],
            "curtain": ["curtain", "blind", "shade", "drape"],
            "camera": ["camera", "security camera", "cctv"],
            "speaker": ["speaker", "music", "sound"]
        }
        
        action_keywords = {
            "on": ["on", "turn on", "switch on", "start", "enable", "activate", "open"],
            "off": ["off", "turn off", "switch off", "stop", "disable", "deactivate", "close"],
            "toggle": ["toggle", "switch"],
            "set": ["set", "change", "adjust", "make it", "put it at"],
            "increase": ["increase", "raise", "higher", "more", "up"],
            "decrease": ["decrease", "lower", "less", "down", "reduce"]
        }
        
        # Check for device control
        for device, keywords in device_keywords.items():
            if any(kw in message_lower for kw in keywords):
                action = "toggle"
                value = None
                
                for act, act_kw in action_keywords.items():
                    if any(kw in message_lower for kw in act_kw):
                        action = act
                        break
                
                # Extract numeric value
                numbers = re.findall(r'\d+', message)
                if numbers:
                    value = int(numbers[0])
                
                return {
                    "type": "device_control",
                    "device": device,
                    "action": action,
                    "value": value,
                    "confidence": 0.95
                }
        
        # Search patterns
        search_keywords = ["search", "find", "look up", "google", "what is", "who is",
                          "latest", "news", "current", "today's", "tell me about",
                          "information about", "learn about"]
        if any(kw in message_lower for kw in search_keywords):
            query = message
            for kw in ["search for", "search", "find", "look up", "tell me about"]:
                query = query.lower().replace(kw, "").strip()
            
            return {
                "type": "search",
                "query": query,
                "confidence": 0.9
            }
        
        # Weather patterns
        weather_keywords = ["weather", "temperature outside", "rain", "sunny", 
                           "forecast", "climate", "hot outside", "cold outside"]
        if any(kw in message_lower for kw in weather_keywords):
            location = "auto"
            if " in " in message_lower:
                location = message_lower.split(" in ")[-1].strip().rstrip("?")
            
            return {
                "type": "weather",
                "location": location,
                "confidence": 0.95
            }
        
        # Problem solving patterns
        problem_keywords = ["solve", "help me", "how do i", "how to", "can you help",
                           "figure out", "calculate", "explain how", "step by step",
                           "debug", "fix", "troubleshoot"]
        if any(kw in message_lower for kw in problem_keywords):
            return {
                "type": "problem_solving",
                "problem": message,
                "confidence": 0.85
            }
        
        # Memory patterns
        memory_keywords = ["remember", "recall", "yesterday", "last time", "before",
                          "you said", "we talked", "my preference", "what did"]
        if any(kw in message_lower for kw in memory_keywords):
            return {
                "type": "memory_query",
                "query_type": "recall",
                "topic": message,
                "confidence": 0.9
            }
        
        # Learning patterns
        learning_keywords = ["remember that", "note that", "i prefer", "i like",
                            "don't forget", "keep in mind"]
        if any(kw in message_lower for kw in learning_keywords):
            return {
                "type": "learning",
                "content": message,
                "confidence": 0.9
            }
        
        # Status patterns
        status_keywords = ["status", "all devices", "system", "what's running",
                          "how are things", "report"]
        if any(kw in message_lower for kw in status_keywords):
            return {
                "type": "status",
                "confidence": 0.95
            }
        
        # Default: general conversation
        return {
            "type": "general",
            "confidence": 0.7
        }

    def chat(self, message: str, context: Optional[List] = None, 
             preferences: Optional[Dict] = None) -> str:
        """Generate response using LLM"""
        
        messages = [{"role": "system", "content": self.system_prompt}]
        
        # Add context
        if context:
            context_str = "Recent conversation:\n"
            for item in context[-5:]:
                context_str += f"User: {item.get('message', '')}\n"
                context_str += f"JARVIS: {item.get('response', '')}\n"
            messages.append({"role": "system", "content": context_str})
        
        # Add preferences
        if preferences:
            pref_str = f"User preferences: {json.dumps(preferences)}"
            messages.append({"role": "system", "content": pref_str})
        
        messages.append({"role": "user", "content": message})
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=500,
                temperature=0.7
            )
            return response.choices[0].message.content
        except Exception as e:
            return f"I'm experiencing a temporary issue: {str(e)}"

    def summarize_search(self, query: str, results: List[Dict]) -> str:
        """Summarize search results"""
        
        if not results:
            return f"I couldn't find any results for '{query}'."
        
        results_text = "\n".join([
            f"- {r.get('title', '')}: {r.get('body', '')[:200]}"
            for r in results[:5]
        ])
        
        prompt = f"""Based on this search for "{query}", provide a helpful summary:

{results_text}

Give a concise, informative response (2-3 sentences)."""

        messages = [
            {"role": "system", "content": "Summarize search results helpfully and concisely."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=200,
                temperature=0.5
            )
            return response.choices[0].message.content
        except:
            return f"Here's what I found about {query}: {results[0].get('body', '')[:200]}"

    def format_weather(self, data: Dict) -> str:
        """Format weather data naturally"""
        
        location = data.get('location', 'your area')
        temp = data.get('temperature', 'N/A')
        feels = data.get('feels_like', temp)
        condition = data.get('condition', 'N/A')
        humidity = data.get('humidity', 'N/A')
        
        response = f"Currently in {location}: {temp}°C"
        
        if feels != temp:
            response += f" (feels like {feels}°C)"
        
        response += f", {condition}. Humidity is {humidity}%."
        
        # Add suggestion based on conditions
        if isinstance(temp, (int, float)):
            if temp > 30:
                response += " It's quite hot - stay hydrated!"
            elif temp < 10:
                response += " It's cold - dress warmly!"
        
        return response

    def format_status(self, status: Dict) -> str:
        """Format system status"""
        
        devices = status.get('devices', {})
        sensors = status.get('sensors', {})
        connections = status.get('active_connections', 0)
        
        # Count active devices
        active = sum(1 for v in devices.values() if v)
        total = len(devices)
        
        response = f"System Status: {active}/{total} devices active. "
        
        # Sensor info
        if sensors:
            temp = sensors.get('temperature', 'N/A')
            humidity = sensors.get('humidity', 'N/A')
            response += f"Room: {temp}°C, {humidity}% humidity. "
        
        response += f"{connections} client(s) connected."
        
        return response

    def summarize_memories(self, memories: List[Dict]) -> str:
        """Summarize past memories"""
        
        if not memories:
            return "I don't have specific memories about that topic."
        
        memory_text = "\n".join([
            f"- You said: {m.get('message', '')}"
            for m in memories[:5]
        ])
        
        return f"I recall our previous discussions:\n{memory_text}"

    def describe_preferences(self, prefs: Dict) -> str:
        """Describe learned preferences"""
        
        if not prefs:
            return "I'm still learning your preferences. Keep interacting with me!"
        
        items = [f"{k}: {v}" for k, v in prefs.items()]
        return "Based on our interactions, I've learned:\n- " + "\n- ".join(items)