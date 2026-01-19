"""
JARVIS Weather Service
"""

import requests
from typing import Dict, Optional, List

class WeatherService:
    def __init__(self):
        self.base_url = "https://wttr.in"
    
    def get_weather(self, location: str = "") -> Dict:
        """Get current weather"""
        
        try:
            response = requests.get(
                f"{self.base_url}/{location}",
                params={"format": "j1"},
                timeout=10
            )
            data = response.json()
            
            current = data["current_condition"][0]
            area = data["nearest_area"][0]
            
            return {
                "success": True,
                "location": area["areaName"][0]["value"],
                "region": area.get("region", [{}])[0].get("value", ""),
                "country": area["country"][0]["value"],
                "temperature": int(current["temp_C"]),
                "feels_like": int(current["FeelsLikeC"]),
                "condition": current["weatherDesc"][0]["value"],
                "humidity": int(current["humidity"]),
                "wind_kph": int(current["windspeedKmph"]),
                "wind_dir": current.get("winddir16Point", ""),
                "uv_index": current.get("uvIndex", "N/A"),
                "visibility": current.get("visibility", "N/A"),
                "pressure": current.get("pressure", "N/A"),
                "cloud_cover": current.get("cloudcover", "N/A")
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_forecast(self, location: str = "", days: int = 3) -> Dict:
        """Get weather forecast"""
        
        try:
            response = requests.get(
                f"{self.base_url}/{location}",
                params={"format": "j1"},
                timeout=10
            )
            data = response.json()
            
            forecast = []
            for day in data["weather"][:days]:
                hourly = day.get("hourly", [{}])
                noon = hourly[4] if len(hourly) > 4 else hourly[0] if hourly else {}
                
                forecast.append({
                    "date": day["date"],
                    "max_temp": int(day["maxtempC"]),
                    "min_temp": int(day["mintempC"]),
                    "avg_temp": int(day.get("avgtempC", 
                                    (int(day["maxtempC"]) + int(day["mintempC"])) // 2)),
                    "condition": noon.get("weatherDesc", [{}])[0].get("value", "N/A"),
                    "rain_chance": noon.get("chanceofrain", "0"),
                    "humidity": noon.get("humidity", "N/A"),
                    "sunrise": day.get("astronomy", [{}])[0].get("sunrise", ""),
                    "sunset": day.get("astronomy", [{}])[0].get("sunset", "")
                })
            
            return {
                "success": True,
                "forecast": forecast
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_astronomy(self, location: str = "") -> Dict:
        """Get astronomy data (sunrise, sunset, moon phase)"""
        
        try:
            response = requests.get(
                f"{self.base_url}/{location}",
                params={"format": "j1"},
                timeout=10
            )
            data = response.json()
            
            today = data["weather"][0]
            astronomy = today.get("astronomy", [{}])[0]
            
            return {
                "success": True,
                "sunrise": astronomy.get("sunrise", ""),
                "sunset": astronomy.get("sunset", ""),
                "moonrise": astronomy.get("moonrise", ""),
                "moonset": astronomy.get("moonset", ""),
                "moon_phase": astronomy.get("moon_phase", ""),
                "moon_illumination": astronomy.get("moon_illumination", "")
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }