"""
JARVIS Search Engine - Web Search
"""

from duckduckgo_search import DDGS
import requests
from typing import List, Dict, Optional

class SearchEngine:
    def __init__(self):
        pass
    
    def search(self, query: str, max_results: int = 5) -> List[Dict]:
        """Perform web search"""
        
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=max_results))
                return [
                    {
                        "title": r.get("title", ""),
                        "url": r.get("href", ""),
                        "body": r.get("body", "")
                    }
                    for r in results
                ]
        except Exception as e:
            print(f"Search error: {e}")
            return []
    
    def search_news(self, query: str, max_results: int = 5) -> List[Dict]:
        """Search news"""
        
        try:
            with DDGS() as ddgs:
                results = list(ddgs.news(query, max_results=max_results))
                return [
                    {
                        "title": r.get("title", ""),
                        "url": r.get("url", ""),
                        "source": r.get("source", ""),
                        "date": r.get("date", ""),
                        "body": r.get("body", "")
                    }
                    for r in results
                ]
        except Exception as e:
            print(f"News search error: {e}")
            return []
    
    def search_images(self, query: str, max_results: int = 5) -> List[Dict]:
        """Search images"""
        
        try:
            with DDGS() as ddgs:
                results = list(ddgs.images(query, max_results=max_results))
                return [
                    {
                        "title": r.get("title", ""),
                        "url": r.get("image", ""),
                        "thumbnail": r.get("thumbnail", ""),
                        "source": r.get("source", "")
                    }
                    for r in results
                ]
        except Exception as e:
            print(f"Image search error: {e}")
            return []
    
    def instant_answer(self, query: str) -> Optional[Dict]:
        """Get instant answer"""
        
        try:
            response = requests.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_html": 1},
                timeout=10
            )
            data = response.json()
            
            if data.get("AbstractText"):
                return {
                    "answer": data["AbstractText"],
                    "source": data.get("AbstractSource", ""),
                    "url": data.get("AbstractURL", "")
                }
            
            # Check for answer box
            if data.get("Answer"):
                return {
                    "answer": data["Answer"],
                    "type": data.get("AnswerType", "")
                }
            
            return None
        except Exception as e:
            print(f"Instant answer error: {e}")
            return None