"""
JARVIS Search Engine - Web Search
"""

import requests
from typing import List, Dict, Optional

class SearchEngine:
    def __init__(self):
        pass
    
    def search(self, query: str, max_results: int = 5) -> List[Dict]:
        """Perform web search using Brave Search API"""
        
        try:
            url = "https://api.search.brave.com/res/v1/web/search"
            params = {
                'q': query,
                'count': max_results,
                'source': 'web'
            }
            response = requests.get(url, params=params)
            data = response.json()
            
            # Format results to match existing structure
            results = []
            if 'web' in data and 'results' in data['web']:
                for item in data['web']['results']:
                    results.append({
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "body": item.get("description", "")
                    })
            return results
        except Exception as e:
            print(f"Brave Search error: {e}")
            return []
    
    def search_news(self, query: str, max_results: int = 5) -> List[Dict]:
        """Search news using Brave Search API"""
        
        try:
            url = "https://api.search.brave.com/res/v1/news/search"
            params = {
                'q': query,
                'count': max_results,
                'freshness': 'pd' # past day
            }
            response = requests.get(url, params=params)
            data = response.json()
            
            # Format results to match existing structure
            results = []
            if 'results' in data:
                for item in data['results']:
                    results.append({
                        "title": item.get("title", ""),
                        "url": item.get("url", ""),
                        "source": item.get("source", ""),
                        "date": item.get("age", ""),
                        "body": item.get("description", "")
                    })
            return results
        except Exception as e:
            print(f"Brave News search error: {e}")
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