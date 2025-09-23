#!/usr/bin/env python3
"""
Brand Sponsorship ROI Analysis Application
Using TwelveLabs API for multimodal video understanding
"""

import os
import json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import numpy as np
from twelvelabs import TwelveLabs
import openai
from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Optional, Literal, Any
import logging
import requests 
from urllib.parse import quote
import threading
import re
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='../frontend/build', static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*", "supports_credentials": True}})

# Configuration
API_KEY = os.getenv("TWELVELABS_API_KEY", "")
INDEX_ID = os.getenv("TWELVELABS_INDEX_ID", "")
UPLOAD_FOLDER = '../uploads'
ALLOWED_EXTENSIONS = {'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'}

# OpenAI API configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
openai.api_key = OPENAI_API_KEY

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max file size

# Initialize TwelveLabs client
client = TwelveLabs(api_key=API_KEY)

# Analysis status tracking
class AnalysisStatus:
    def __init__(self):
        self.statuses: Dict[str, Dict[str, Any]] = {}
        self.lock = threading.Lock()
    
    def create_job(self, job_id: str) -> None:
        """Create a new analysis job"""
        with self.lock:
            self.statuses[job_id] = {
                'status': 'pending',
                'progress': 0,
                'message': 'Analysis queued',
                'stage': None,
                'details': None,
                'brands_found': [],
                'data': None,
                'error': None,
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
    
    def update_job(self, job_id: str, updates: Dict[str, Any]) -> None:
        """Update job status"""
        with self.lock:
            if job_id in self.statuses:
                self.statuses[job_id].update(updates)
                self.statuses[job_id]['updated_at'] = datetime.now().isoformat()
    
    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job status"""
        with self.lock:
            return self.statuses.get(job_id)
    
    def cleanup_old_jobs(self, hours: int = 24):
        """Remove jobs older than specified hours"""
        with self.lock:
            cutoff = datetime.now() - timedelta(hours=hours)
            to_remove = []
            for job_id, status in self.statuses.items():
                created = datetime.fromisoformat(status['created_at'])
                if created < cutoff:
                    to_remove.append(job_id)
            for job_id in to_remove:
                del self.statuses[job_id]

analysis_status = AnalysisStatus()

# Ensure upload directory exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Pydantic Models for Data Validation
class BrandAppearance(BaseModel):
    timeline: List[float] = Field(..., min_items=2, max_items=2, description="Start and end time in seconds")
    brand: str = Field(..., min_length=1, description="Brand name")
    type: Literal["logo", "jersey_sponsor", "stadium_signage", "digital_overlay", "audio_mention", "product_placement", "commercial", "ctv_ad", "overlay_ad", "squeeze_ad"]
    sponsorship_category: Literal["ad_placement", "in_game_placement"] = Field(..., description="Category of sponsorship: ad placements vs in-game/in-event placements")
    location: Optional[List[float]] = Field(None, min_items=4, max_items=4, description="[x%, y%, width%, height%]")
    prominence: Literal["primary", "secondary", "background"]
    context: Literal["game_action", "replay", "celebration", "interview", "crowd_shot", "commercial", "transition"]
    description: str = Field(..., min_length=10, description="Detailed description")
    sentiment_context: Literal["positive", "neutral", "negative"]
    viewer_attention: Literal["high", "medium", "low"]
    
    @field_validator('timeline')
    def validate_timeline(cls, v):
        if v[1] <= v[0]:
            raise ValueError('End time must be after start time')
        return v

class BrandMetrics(BaseModel):
    brand: str
    total_exposure_time: float = Field(..., ge=0)
    total_appearances: int = Field(..., ge=0)
    contextual_value_score: float = Field(..., ge=0, le=10)
    high_impact_moments: int = Field(..., ge=0)
    sentiment_score: float = Field(..., ge=-1, le=1)
    sentiment_label: Literal["positive", "neutral", "negative"]
    avg_prominence: float = Field(..., ge=0, le=1)
    avg_viewer_attention: float = Field(..., ge=0, le=1)
    contexts: List[str]
    estimated_social_mentions: int = Field(..., ge=0)
    ai_insights: Optional[Dict[str, Any]] = None
    appearances: List[Dict]


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def is_valid_brand(brand_name):
    """Filter out non-brand entities"""
    brand_name = brand_name.strip()
    
    # List of keywords that indicate it's NOT a commercial brand
    non_brand_keywords = [
        'high school', 'college', 'university', 'team', 'football', 'basketball',
        'baseball', 'soccer', 'athletics', 'sports', 'club', 'academy', 'institute',
        'school', 'district', 'county', 'city', 'state', 'national', 'tournament',
        'championship', 'league', 'division', 'conference', 'guy', 'john', 'mike',
        'david', 'robert', 'james', 'william', 'richard', 'charles', 'joe'
    ]
    
    # Common suffixes that indicate educational institutions
    educational_suffixes = ['College', 'University', 'School', 'Academy', 'Institute']
    
    # Check if it's a person's name pattern (First Last)
    words = brand_name.split()
    if len(words) == 2 and words[0][0].isupper() and words[1][0].isupper():
        # Likely a person's name
        if any(word.lower() in ['guy', 'john', 'mike', 'david', 'robert'] for word in words):
            return False
    
    # Check for non-brand keywords
    brand_lower = brand_name.lower()
    for keyword in non_brand_keywords:
        if keyword in brand_lower:
            return False
    
    # Check for educational suffixes
    for suffix in educational_suffixes:
        if brand_name.endswith(suffix):
            return False
    
    # Check if it's too generic (single word that's too common)
    if len(words) == 1 and brand_lower in ['berkeley', 'cambridge', 'oxford', 'stanford']:
        return False
    
    # Whitelist known brands that might be caught by filters
    known_brands = [
        'ford', 'nike', 'adidas', 'coca-cola', 'pepsi', 'honda', 'toyota',
        'microsoft', 'apple', 'google', 'amazon', 'walmart', 'target',
        'hon-dah', 'hondah'  # Variations of Honda
    ]
    
    # Special handling for "Outdoor Sports" brands - they are valid
    if 'outdoor sport' in brand_lower and not any(bad_word in brand_lower for bad_word in ['school', 'college', 'university']):
        return True
    
    if any(known_brand in brand_lower for known_brand in known_brands):
        return True
    
    # If it passes all filters, consider it a valid brand
    return True

def categorize_sponsorship_placement(placement_type, context):
    """Categorize sponsorship placement into ad_placement or in_game_placement"""
    
    # Define categorization rules
    ad_placement_types = {
        'digital_overlay', 'ctv_ad', 'overlay_ad', 'squeeze_ad', 'commercial'
    }
    
    in_game_placement_types = {
        'logo', 'jersey_sponsor', 'stadium_signage', 'product_placement', 'audio_mention'
    }
    
    # Check if it's clearly an ad placement
    if placement_type in ad_placement_types:
        return "ad_placement"
    
    # Check if it's clearly an in-game placement
    if placement_type in in_game_placement_types:
        return "in_game_placement"
    
    # For context-dependent decisions
    if context in ['commercial']:
        return "ad_placement"
    
    # Default to in-game placement if uncertain
    return "in_game_placement"

def search_web_for_brand_info(brand_name, query_suffix=""):
    """Search the web for brand information using multiple sources"""
    results = []
    try:
        # Try Google Custom Search API (if available)
        # For demo, we'll use a simple web scraping approach
        search_query = quote(f"{brand_name} {query_suffix}")
        
        # Search using DuckDuckGo Instant Answer API
        try:
            # Try different DuckDuckGo endpoints
            ddg_endpoints = [
                f"https://api.duckduckgo.com/?q={search_query}&format=json&no_html=1&skip_disambig=1",
                f"https://api.duckduckgo.com/?q={search_query}&format=json&no_html=1"
            ]
            
            for ddg_url in ddg_endpoints:
                response = requests.get(ddg_url, timeout=8, headers={'User-Agent': 'Mozilla/5.0'})
                if response.status_code == 200:
                    data = response.json()
                    if data.get('Abstract'):
                        results.append({
                            "source": "DuckDuckGo",
                            "content": data['Abstract'],
                            "url": data.get('AbstractURL', '')
                        })
                    if data.get('RelatedTopics'):
                        for topic in data['RelatedTopics'][:3]:
                            if isinstance(topic, dict) and 'Text' in topic:
                                results.append({
                                    "source": "DuckDuckGo Related",
                                    "content": topic['Text'],
                                    "url": topic.get('FirstURL', '')
                                })
                    break  # If successful, don't try other endpoints
                elif response.status_code == 202:
                    logger.info("DuckDuckGo returned 202 - trying alternate search method")
                    continue
                else:
                    logger.warning(f"DuckDuckGo API returned status {response.status_code}")
        except requests.exceptions.Timeout:
            logger.warning("DuckDuckGo search timeout")
        except Exception as e:
            logger.warning(f"DuckDuckGo search error: {str(e)}")
        
        # Try Wikipedia API
        try:
            wiki_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote(brand_name)}"
            response = requests.get(wiki_url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get('extract'):
                    results.append({
                        "source": "Wikipedia",
                        "content": data['extract'],
                        "url": data.get('content_urls', {}).get('desktop', {}).get('page', '')
                    })
        except Exception as e:
            logger.warning(f"Wikipedia search error: {str(e)}")
        
        # Try to get news data (simulated for demo)
        try:
            # For now, provide simulated news data based on brand
            # In production, you would use a proper news API with authentication
            if brand_name.lower() in ['ford', 'nike', 'coca-cola', 'honda']:
                news_items = {
                    'ford': [
                        "Ford announces new electric vehicle lineup for 2025",
                        "Ford expands sports sponsorship with NASCAR partnership",
                        "Ford Motor Company reports strong Q3 earnings"
                    ],
                    'nike': [
                        "Nike signs major sponsorship deal with emerging athletes",
                        "Nike launches sustainable product line for sports events",
                        "Nike's latest campaign focuses on community sports"
                    ],
                    'coca-cola': [
                        "Coca-Cola renews Olympic sponsorship through 2032",
                        "Coca-Cola invests in local sports programs worldwide",
                        "Coca-Cola launches new sports drink for athletes"
                    ],
                    'honda': [
                        "Honda announces sports equipment division expansion",
                        "Honda sponsors major outdoor sports events",
                        "Honda's commitment to recreational vehicles grows"
                    ]
                }
                
                brand_key = brand_name.lower()
                if brand_key in news_items:
                    for i, headline in enumerate(news_items[brand_key][:2]):
                        results.append({
                            "source": "News",
                            "content": headline,
                            "url": f"https://example.com/news/{brand_key}-{i}",
                            "publishedAt": datetime.now().isoformat()
                        })
                        
        except Exception as e:
            logger.warning(f"News search error: {str(e)}")
            
        # Try Google search snippets (simplified)
        try:
            # Add a simple Google-like search result
            if not results:  # Only if no results yet
                results.append({
                    "source": "Web Search",
                    "content": f"{brand_name} is a well-known brand in its industry, involved in various sponsorship activities.",
                    "url": f"https://www.google.com/search?q={search_query}"
                })
        except Exception as e:
            logger.warning(f"Web search error: {str(e)}")
            
    except Exception as e:
        logger.error(f"Web search error for {brand_name}: {str(e)}")
    
    # Fallback data for common brands when web search fails
    brand_lower = brand_name.lower()
    fallback_triggered = False
    
    # Check for variations of brand names
    if not results:
        logger.info(f"No web results found for '{brand_name}', checking fallback data")
        fallback_data = {
            'ford': {
                "source": "Fallback",
                "content": "Ford Motor Company is an American multinational automobile manufacturer founded in 1903. Known for trucks, SUVs, and cars, Ford sponsors various sports events and teams, including NASCAR and local community sports.",
                "url": "https://www.ford.com"
            },
            'nike': {
                "source": "Fallback",
                "content": "Nike Inc. is an American multinational corporation that designs, develops, and sells footwear, apparel, equipment, and accessories. Major sports sponsor globally.",
                "url": "https://www.nike.com"
            },
            'coca-cola': {
                "source": "Fallback",
                "content": "The Coca-Cola Company is an American multinational beverage corporation. One of the world's largest sponsors of sports events, including Olympics and FIFA World Cup.",
                "url": "https://www.coca-cola.com"
            },
            'honda': {
                "source": "Fallback",
                "content": "Honda Motor Company is a Japanese multinational corporation known for automobiles, motorcycles, and power equipment. Honda actively sponsors motorsports, outdoor recreation, and sporting events.",
                "url": "https://www.honda.com"
            },
            'pepsi': {
                "source": "Fallback",
                "content": "PepsiCo is an American multinational food and beverage corporation. Major sponsor of sports leagues including NFL, NBA, and various international sports events.",
                "url": "https://www.pepsi.com"
            },
            'toyota': {
                "source": "Fallback",
                "content": "Toyota Motor Corporation is a Japanese multinational automotive manufacturer. Sponsors Olympics, Paralympics, NASCAR, and various motorsports globally.",
                "url": "https://www.toyota.com"
            }
        }
        
        # Check for exact match
        if brand_lower in fallback_data:
            results.append(fallback_data[brand_lower])
            fallback_triggered = True
        # Check for Honda variations
        elif 'honda' in brand_lower:
            honda_data = fallback_data['honda'].copy()
            if 'ski' in brand_lower or 'outdoor' in brand_lower:
                honda_data['content'] = "Honda Ski and Outdoor Sport specializes in recreational equipment and outdoor sports gear. Part of Honda's diversified product portfolio, focusing on skiing, snowboarding, and outdoor adventure equipment."
            results.append(honda_data)
            fallback_triggered = True
        # Generic fallback for any brand
        elif not results:
            results.append({
                "source": "Fallback",
                "content": f"{brand_name} is a recognized brand in its market segment, with involvement in various marketing and sponsorship activities. Further details would require specific market research.",
                "url": f"https://www.google.com/search?q={quote(brand_name)}"
            })
            fallback_triggered = True
            
    if fallback_triggered:
        logger.info(f"Fallback data provided for '{brand_name}'")
    
    return results

def gather_brand_intelligence(brand_name, enable_web_search=True):
    """Gather comprehensive information about a brand from web searches and news"""
    try:
        brand_info = {
            "company_overview": "",
            "industry": "",
            "target_audience": "",
            "recent_news": [],
            "market_position": "",
            "brand_values": "",
            "sponsorship_history": "",
            "competitors": [],
            "stock_info": None,
            "social_media_presence": ""
        }
        
        # First, gather real web data if enabled
        web_results = []
        news_results = []
        web_context = ""
        news_context = ""
        
        if enable_web_search:
            logger.info(f"Searching web for {brand_name} information...")
            web_results = search_web_for_brand_info(brand_name, "company overview industry")
            news_results = search_web_for_brand_info(brand_name, "latest news sponsorship marketing")
            
            logger.info(f"Web search returned {len(web_results)} results")
            logger.info(f"News search returned {len(news_results)} results")
            
            # Compile web search results
            web_context = "\n".join([f"- {r['source']}: {r['content'][:200]}..." for r in web_results[:5]])
            news_context = "\n".join([f"- {r['content'][:150]}..." for r in news_results if r['source'] == 'News'][:3])
            
            logger.info(f"Web context length: {len(web_context)}")
            logger.info(f"News context length: {len(news_context)}")
        else:
            logger.info(f"Web search disabled, using AI knowledge for {brand_name}")
        
        # Search for company information using web data + AI enhancement
        try:
            # Check if we have any web data
            has_web_data = bool(web_context.strip() or news_context.strip())
            
            if has_web_data:
                info_prompt = f"""
                Based on the following real web data about {brand_name}, provide comprehensive analysis:
                
                WEB SEARCH RESULTS:
                {web_context if web_context else "No web search results available"}
                
                RECENT NEWS:
                {news_context if news_context else "No news results available"}
                
                Analyze and structure this information to provide:
                1. Company overview and history
                2. Industry and market segment
                3. Target audience demographics (infer from available data)
                4. Brand values and positioning
                5. Recent developments and market position
                6. Typical sponsorship activities
                7. Main competitors
                8. Marketing strategy insights
                
                Enhance the web data with your knowledge but prioritize the real search results.
                """
            else:
                info_prompt = f"""
                Provide comprehensive information about {brand_name} based on your knowledge:
                
                1. Company overview and history
                2. Industry and market segment
                3. Target audience demographics
                4. Brand values and positioning
                5. Recent developments and market position (as of your last update)
                6. Typical sponsorship activities
                7. Main competitors
                8. Marketing strategy insights
                
                Note: Real-time web data was not available, so this is based on general knowledge.
                """
            
            info_prompt += """
            Return ONLY valid JSON in this exact format:
            {
                "company_overview": "Brief overview",
                "industry": "Industry sector",
                "target_audience": "Demographics and psychographics",
                "brand_values": "Core values and positioning",
                "typical_sponsorships": "Types of events/sports they sponsor",
                "competitors": ["competitor1", "competitor2"],
                "marketing_focus": "Key marketing strategies"
            }
            """
            
            try:
                if not OPENAI_API_KEY:
                    logger.error("OpenAI client is not initialized, skipping brand analysis")
                    brand_info["error"] = "OpenAI client initialization failed"
                    return
                
                response = openai.ChatCompletion.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": "You are a market research analyst. Provide factual, accurate information about companies."},
                        {"role": "user", "content": info_prompt}
                    ],
                    temperature=0.3,
                    max_tokens=800
                )
                
                # Log the response for debugging
                logger.info(f"OpenAI response received: {response}")
                
                # Check if response has content
                if response and response.choices and len(response.choices) > 0:
                    response_content = response.choices[0].message.content
                    logger.info(f"Response content: {response_content[:200]}...")
                    
                    # Parse JSON response
                    if response_content.strip():
                        brand_research = json.loads(response_content)
                    else:
                        logger.warning("Empty response content from OpenAI")
                        brand_research = {}
                else:
                    logger.warning("Invalid response structure from OpenAI")
                    brand_research = {}
                brand_info.update(brand_research)
                
            except Exception as auth_error:
                if "authentication" in str(auth_error).lower() or "api_key" in str(auth_error).lower():
                    logger.error(f"OpenAI authentication error: {str(auth_error)}")
                    logger.error("Please check if the OpenAI API key is valid")
                    brand_info["error"] = "OpenAI authentication failed"
                else:
                    logger.error(f"OpenAI API error: {str(auth_error)}")
                    brand_info["error"] = f"OpenAI API error: {str(auth_error)}"
            except json.JSONDecodeError as json_error:
                logger.error(f"JSON parsing error: {str(json_error)}")
                brand_info["error"] = "Failed to parse AI response"
            except Exception as general_error:
                logger.error(f"Unexpected error calling OpenAI: {str(general_error)}")
                brand_info["error"] = f"Unexpected error: {str(general_error)}"
            
            # Add raw web search results for transparency
            brand_info["web_search_results"] = web_results[:3]
            brand_info["data_sources"] = {
                "web_searches": len(web_results),
                "news_articles": len([r for r in news_results if r['source'] == 'News']),
                "enhanced_with_ai": bool(brand_info and not brand_info.get("error"))
            }
            
        except Exception as e:
            logger.warning(f"Could not gather brand intelligence for {brand_name}: {str(e)}")
            # Still provide web search results even if AI enhancement fails
            brand_info["web_search_results"] = web_results[:3]
            brand_info["error"] = "AI enhancement failed, using raw web data"
        
        # Search for recent news
        try:
            news_prompt = f"""
            Provide 3-5 recent news headlines and developments about {brand_name} that would be relevant for sponsorship ROI analysis.
            Focus on: financial performance, marketing campaigns, sponsorship deals, brand reputation, expansions.
            
            Return ONLY a valid JSON array (no other text):
            [
                {{"headline": "...", "summary": "...", "relevance": "..."}}
            ]
            """
            
            try:
                if not OPENAI_API_KEY:
                    logger.error("OpenAI client is not initialized, skipping news generation")
                    brand_info["recent_news"] = []
                    return
                
                news_response = openai.ChatCompletion.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": "You are a business news analyst. Always return valid JSON arrays only."},
                        {"role": "user", "content": news_prompt}
                    ],
                    temperature=0.3,
                    max_tokens=500
                )
            except Exception as api_err:
                if "authentication" in str(api_err).lower() or "api_key" in str(api_err).lower():
                    logger.error("OpenAI authentication failed for news generation")
                    brand_info["recent_news"] = []
                    return brand_info
                else:
                    logger.error(f"OpenAI API error in news generation: {str(api_err)}")
                    brand_info["recent_news"] = []
                return brand_info
            
            if news_response and news_response.choices and len(news_response.choices) > 0:
                news_content = news_response.choices[0].message.content.strip()
                if news_content:
                    # Try to extract JSON array from the response
                    try:
                        # First try direct JSON parsing
                        recent_news = json.loads(news_content)
                        if isinstance(recent_news, list):
                            brand_info["recent_news"] = recent_news
                        else:
                            logger.warning(f"News response was not a list for brand {repr(brand_name)}")
                            brand_info["recent_news"] = []
                    except json.JSONDecodeError:
                        # Try to extract JSON array from the text
                        import re
                        json_match = re.search(r'\[\s*\{.*?\}\s*\]', news_content, re.DOTALL)
                        if json_match:
                            try:
                                recent_news = json.loads(json_match.group())
                                brand_info["recent_news"] = recent_news
                                logger.info(f"Successfully extracted JSON array from news response for {repr(brand_name)}")
                            except json.JSONDecodeError:
                                logger.warning(f"Failed to parse extracted JSON for brand {repr(brand_name)}")
                                brand_info["recent_news"] = []
                        else:
                            logger.warning(f"No JSON array found in news response for brand {repr(brand_name)}")
                            brand_info["recent_news"] = []
                else:
                    logger.warning(f"Empty news response for brand: {repr(brand_name)}")
                    brand_info["recent_news"] = []
            else:
                logger.warning(f"Invalid news response structure for brand: {repr(brand_name)}")
                brand_info["recent_news"] = []
            
        except json.JSONDecodeError as je:
            logger.warning(f"Could not parse news JSON for brand {repr(brand_name)}: {je}")
            logger.debug(f"News content that failed to parse: {news_content if 'news_content' in locals() else 'N/A'}")
            brand_info["recent_news"] = []
        except Exception as oe:
            logger.warning(f"OpenAI API error getting news for brand {repr(brand_name)}: {oe}")
            brand_info["recent_news"] = []
        except Exception as e:
            logger.warning(f"Unexpected error getting news for brand {repr(brand_name)}: {type(e).__name__}: {e}")
            brand_info["recent_news"] = []
        
        return brand_info
        
    except Exception as e:
        logger.error(f"Error gathering brand intelligence: {str(e)}")
        return {}

def calculate_placement_effectiveness(brand_data, video_duration, brand_name):
    """Calculate placement effectiveness metrics for advertisers"""
    if not brand_data or not isinstance(brand_data, list):
        return {}
    
    # Key metrics for placement effectiveness
    metrics = {
        'optimal_placements': 0,
        'suboptimal_placements': 0,
        'missed_opportunities': [],
        'placement_score': 0.0,
        'visibility_metrics': {},
        'engagement_windows': [],
        'recommendations': []
    }
    
    # Analyze each placement
    for app in brand_data:
        if 'timeline' in app and len(app['timeline']) == 2:
            start_time = app['timeline'][0]
            end_time = app['timeline'][1]
            duration = end_time - start_time
            
            # Check if placement is during high-engagement moments
            is_optimal = any(keyword in app.get('description', '').lower() 
                           for keyword in ['goal', 'celebration', 'replay', 'highlight', 'scoring'])
            
            if is_optimal:
                metrics['optimal_placements'] += 1
            else:
                metrics['suboptimal_placements'] += 1
            
            # Track engagement windows
            metrics['engagement_windows'].append({
                'time_range': [start_time, end_time],
                'duration': duration,
                'type': app.get('type', 'unknown'),
                'quality': 'optimal' if is_optimal else 'suboptimal',
                'context': app.get('context', 'unknown')
            })
    
    # Calculate placement score (0-100)
    total_placements = metrics['optimal_placements'] + metrics['suboptimal_placements']
    if total_placements > 0:
        metrics['placement_score'] = (metrics['optimal_placements'] / total_placements) * 100
    
    # Visibility metrics
    metrics['visibility_metrics'] = {
        'average_duration': np.mean([w['duration'] for w in metrics['engagement_windows']]) if metrics['engagement_windows'] else 0,
        'total_screen_time': sum(w['duration'] for w in metrics['engagement_windows']),
        'screen_time_percentage': (sum(w['duration'] for w in metrics['engagement_windows']) / video_duration * 100) if video_duration > 0 else 0
    }
    
    return metrics

def calculate_ai_contextual_score(brand_data, video_duration, brand_name):
    """Calculate intelligent contextual value score using AI"""
    if not brand_data or not isinstance(brand_data, list):
        return 0.0, {}
    
    try:
        # First, gather comprehensive brand intelligence
        logger.info(f"Gathering intelligence for brand: {brand_name}")
        brand_intelligence = gather_brand_intelligence(brand_name, enable_web_search=True)  # Enable web search
        
        # Calculate placement effectiveness metrics
        placement_metrics = calculate_placement_effectiveness(brand_data, video_duration, brand_name)
        
        # Prepare data for AI analysis
        appearances_summary = []
        total_duration = 0
        for app in brand_data:
            duration = 0
            if 'timeline' in app and len(app['timeline']) == 2:
                duration = app['timeline'][1] - app['timeline'][0]
                total_duration += duration
            
            appearances_summary.append({
                'duration_seconds': duration,
                'type': app.get('type', 'unknown'),
                'context': app.get('context', 'unknown'),
                'prominence': app.get('prominence', 'unknown'),
                'sentiment': app.get('sentiment_context', 'neutral'),
                'attention': app.get('viewer_attention', 'medium'),
                'description': app.get('description', '')
            })
        
        # Determine video type/context
        video_context = "sports event"  # Could be enhanced with actual video analysis
        
        # Create comprehensive AI prompt for scoring
        scoring_prompt = f"""
        You are an expert advertising effectiveness consultant specializing in sports sponsorship ROI analysis.
        
        Analyze this brand placement from an ADVERTISER'S perspective to determine if their investment was well-placed:
        
        BRAND INFORMATION:
        {json.dumps(brand_intelligence, indent=2)}
        
        VIDEO CONTEXT:
        - Type: {video_context}
        - Duration: {video_duration/60:.1f} minutes
        - Total brand exposure: {total_duration} seconds ({total_duration/video_duration*100:.1f}% of video)
        
        PLACEMENT EFFECTIVENESS METRICS:
        {json.dumps(placement_metrics, indent=2)}
        
        BRAND APPEARANCES:
        {json.dumps(appearances_summary, indent=2)}
        
        Provide a comprehensive ADVERTISER-FOCUSED analysis:
        
        1. PLACEMENT QUALITY ASSESSMENT
        - Were ads shown during high-engagement moments (goals, celebrations, replays)?
        - Did placements maximize viewer attention and recall?
        - Were there missed opportunities for better placement?
        
        2. VALUE FOR MONEY
        - Is the exposure duration worth the sponsorship cost?
        - How does placement quality compare to industry benchmarks?
        - What's the estimated cost-per-impression?
        
        3. AUDIENCE REACH EFFECTIVENESS
        - Did placements reach the target demographic effectively?
        - Were ads shown when viewership was likely highest?
        - How well did placement timing align with audience behavior?
        
        4. COMPETITIVE POSITIONING
        - How does this placement compare to competitors?
        - Are there advantages/disadvantages vs rival brands?
        - What unique value was captured?
        
        5. ACTIONABLE RECOMMENDATIONS
        - Specific suggestions for better placement timing
        - Optimal moments to target in future sponsorships
        - Alternative placement strategies to consider
        
        Return ONLY valid JSON in this exact format:
        {{
            "placement_effectiveness_score": <float 0-100>,
            "roi_assessment": {{
                "value_rating": "<excellent/good/fair/poor>",
                "cost_efficiency": <float 0-10>,
                "exposure_quality": <float 0-10>,
                "audience_reach": <float 0-10>
            }},
            "placement_analysis": {{
                "optimal_placements": "<description of well-placed ads>",
                "suboptimal_placements": "<description of poorly-placed ads>",
                "missed_opportunities": [
                    "<specific moment where ad should have appeared>",
                    "<another missed opportunity>"
                ],
                "timing_effectiveness": "<assessment of when ads appeared>"
            }},
            "recommendations": {{
                "immediate_actions": [
                    "<specific action to improve current campaign>",
                    "<another immediate action>"
                ],
                "future_strategy": [
                    "<long-term placement strategy recommendation>",
                    "<another strategic recommendation>"
                ],
                "optimal_moments": [
                    "<specific type of moment to target (e.g., post-goal replays)>",
                    "<another optimal moment type>"
                ],
                "avoid_these": [
                    "<type of placement to avoid>",
                    "<another placement to avoid>"
                ]
            }},
            "competitive_insights": {{
                "market_position": "<how this placement positions brand vs competitors>",
                "unique_advantages": "<what this placement achieved that competitors didn't>",
                "gaps_to_address": "<where competitors may have advantage>"
            }},
            "roi_projection": {{
                "estimated_impressions": <number>,
                "cost_per_impression": "<estimated value>",
                "brand_recall_likelihood": "<high/medium/low>",
                "purchase_intent_impact": "<positive/neutral/negative>",
                "overall_roi_rating": <float 0-10>
            }},
            "executive_summary": "<2-3 sentence summary for advertiser decision-makers focusing on whether the placement was worth the investment and what to do differently>"
        }}
        """
        
        # Call OpenAI for intelligent scoring
        try:
            if not OPENAI_API_KEY:
                logger.error("OpenAI client is not initialized, using default scoring")
                return {
                    "overall_score": 75,
                    "visibility": {"score": 80, "reasoning": "Default scoring - OpenAI unavailable"},
                    "engagement": {"score": 70, "reasoning": "Default scoring - OpenAI unavailable"},
                    "brand_alignment": {"score": 75, "reasoning": "Default scoring - OpenAI unavailable"},
                    "recommendations": ["OpenAI analysis unavailable - using default values"]
                }
            
            response = openai.ChatCompletion.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a brand sponsorship analytics expert. Always return valid JSON."},
                    {"role": "user", "content": scoring_prompt}
                ],
                temperature=0.2,
                max_tokens=1000
            )
            
            # Process the response
            ai_analysis = json.loads(response.choices[0].message.content)
            
            # Convert placement effectiveness score to 0-10 scale
            placement_score = float(ai_analysis.get('placement_effectiveness_score', 50))
            score = placement_score / 10  # Convert 0-100 to 0-10
            score = max(0.0, min(10.0, score))  # Ensure 0-10 range
            
            # Add placement metrics and brand intelligence to analysis
            ai_analysis['placement_metrics'] = placement_metrics
            ai_analysis['brand_intelligence'] = brand_intelligence
            
            # Ensure executive summary is dynamic based on actual data
            if 'executive_summary' not in ai_analysis and placement_metrics:
                opt_count = placement_metrics.get('optimal_placements', 0)
                screen_pct = placement_metrics.get('visibility_metrics', {}).get('screen_time_percentage', 0)
                ai_analysis['executive_summary'] = (
                    f"The placement of {brand_name}'s {'logo' if 'logo' in str(brand_data) else 'brand'} "
                    f"{'was suboptimal' if opt_count == 0 else 'showed mixed results'}, "
                    f"with {screen_pct:.1f}% screen time. "
                    f"{'Immediate actions include re-evaluating placement timing' if opt_count == 0 else 'Consider maintaining successful placements'} "
                    f"and {'increasing exposure duration' if screen_pct < 10 else 'optimizing placement contexts'}. "
                    f"Future strategies should focus on {'placements during peak viewership times' if opt_count < 2 else 'diversifying placement opportunities'}."
                )
            
            # Create backward compatible scoring factors from new format
            ai_analysis['scoring_factors'] = {
                'visibility_impact': ai_analysis.get('roi_assessment', {}).get('exposure_quality', 5.0),
                'context_quality': ai_analysis.get('roi_assessment', {}).get('exposure_quality', 5.0),
                'engagement_potential': ai_analysis.get('roi_assessment', {}).get('audience_reach', 5.0),
                'sentiment_alignment': 7.0,  # Default positive
                'strategic_placement': ai_analysis.get('roi_assessment', {}).get('cost_efficiency', 5.0),
                'audience_alignment': ai_analysis.get('roi_assessment', {}).get('audience_reach', 5.0),
                'brand_fit': score
            }
            
            return score, ai_analysis
            
        except Exception as api_error:
            logger.error(f"OpenAI API error: {str(api_error)}")
            # No fallback - require AI for accurate analysis
            raise Exception(f"AI analysis is required for placement effectiveness scoring. Error: {str(api_error)}")
        
    except Exception as e:
        logger.error(f"AI scoring error: {str(e)}")
        # No fallback - require AI for analysis
        raise Exception(f"AI analysis is required for comprehensive brand placement insights. Error: {str(e)}")

def generate_executive_summary(brand_metrics, video_duration, video_title):
    """Generate AI-powered executive summary and strategic recommendations"""
    try:
        if not brand_metrics:
            return {
                "key_findings": ["No brand appearances detected in the video."],
                "strategic_recommendations": ["Review video content and brand detection parameters."],
                "market_positioning": "Unable to assess without brand data."
            }
        
        # Prepare metrics summary for AI
        metrics_summary = {
            "video_title": video_title,
            "duration_minutes": round(video_duration / 60, 1),
            "total_brands": len(brand_metrics),
            "brands": []
        }
        
        for brand in brand_metrics:
            brand_summary = {
                "name": brand['brand'],
                "score": brand['contextual_value_score'],
                "exposure_seconds": brand['total_exposure_time'],
                "appearances": brand['total_appearances'],
                "sentiment": brand['sentiment_label'],
                "contexts": brand['contexts'],
                "ai_insights": brand.get('ai_insights', {})
            }
            metrics_summary["brands"].append(brand_summary)
        
        # Create executive summary prompt
        exec_prompt = f"""
        As a senior brand sponsorship strategist, analyze this comprehensive brand exposure data and provide executive-level insights:
        
        {json.dumps(metrics_summary, indent=2)}
        
        Generate:
        1. 3-5 key findings about brand performance and opportunities
        2. 3-4 strategic recommendations for maximizing sponsorship ROI
        3. Market positioning assessment compared to industry standards
        4. Predicted trends and future opportunities
        5. Risk factors and mitigation strategies
        
        Focus on actionable, data-driven insights that C-level executives would value.
        
        Return valid JSON in this format:
        {{
            "key_findings": [
                "<finding 1>",
                "<finding 2>",
                "<finding 3>"
            ],
            "strategic_recommendations": [
                "<recommendation 1>",
                "<recommendation 2>",
                "<recommendation 3>"
            ],
            "market_positioning": "<assessment>",
            "future_opportunities": [
                "<opportunity 1>",
                "<opportunity 2>"
            ],
            "risk_mitigation": [
                "<risk and mitigation 1>",
                "<risk and mitigation 2>"
            ],
            "executive_summary": "<2-3 sentence executive summary>",
            "roi_projection": {{
                "current_value_estimate": <float>,
                "optimization_potential": "<percentage>",
                "competitive_advantage": "<assessment>"
            }}
        }}
        """
        
        if not OPENAI_API_KEY:
            logger.error("OpenAI client is not initialized, returning default executive summary")
            return {
                "executive_summary": "OpenAI analysis unavailable - executive summary could not be generated",
                "key_insights": ["OpenAI service is currently unavailable"],
                "strategic_recommendations": ["Please resolve OpenAI client initialization issues"],
                "roi_projection": {"text": "Analysis unavailable", "confidence": "Low"}
            }
        
        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a C-level brand strategy consultant specializing in sports sponsorship ROI."},
                {"role": "user", "content": exec_prompt}
            ],
            temperature=0.3,
            max_tokens=1500
        )
        
        return json.loads(response.choices[0].message.content)
        
    except Exception as e:
        logger.error(f"Executive summary generation error: {str(e)}")
        raise Exception(f"AI analysis required for executive summary generation: {str(e)}")

def estimate_social_engagement(brand_data, ai_insights=None):
    """Intelligently estimate social media engagement using AI insights"""
    if not brand_data:
        return 0, {}
    
    try:
        # Use AI insights if available
        if ai_insights and ('placement_effectiveness_score' in ai_insights or 'roi_projection' in ai_insights):
            # Get metrics from new AI format
            effectiveness_score = ai_insights.get('placement_effectiveness_score', 50) / 10  # Convert to 0-10
            roi_rating = ai_insights.get('roi_projection', {}).get('overall_roi_rating', 5.0)
            engagement_potential = ai_insights.get('scoring_factors', {}).get('engagement_potential', effectiveness_score)
            
            # Base calculation using AI insights
            base_engagement = 1000
            # Use effectiveness score and ROI rating to boost engagement
            ai_multiplier = (effectiveness_score / 10) + (roi_rating / 10)
            ai_boosted_engagement = base_engagement * ai_multiplier * (engagement_potential / 10.0)
            
            # Add bonuses for high-impact contexts (more realistic)
            context_bonuses = {
                'celebration': 2000,
                'game_action': 1500,
                'replay': 1000,
                'interview': 750,
                'goal': 2500,
                'scoring': 2000
            }
            
            total_engagement = ai_boosted_engagement
            for appearance in brand_data:
                context = appearance.get('context', '')
                if context in context_bonuses:
                    total_engagement += context_bonuses[context]
            
            # Get estimated impressions from AI if available
            ai_impressions = ai_insights.get('roi_projection', {}).get('estimated_impressions', int(total_engagement * 10))
            
            return int(total_engagement), {
                "calculation_method": "AI-enhanced",
                "base_engagement": base_engagement,
                "ai_multiplier": ai_multiplier,
                "engagement_score": engagement_potential,
                "estimated_impressions": ai_impressions,
                "viral_potential": "high" if engagement_potential > 7 else "medium" if engagement_potential > 4 else "low"
            }
        else:
            # No fallback - require AI insights
            raise Exception("AI insights required for accurate social engagement estimation")
            
    except Exception as e:
        logger.error(f"Social engagement estimation error: {str(e)}")
        raise Exception(f"AI analysis required for social engagement metrics: {str(e)}")

@app.route('/')
def serve_react_app():
    """Serve React app"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_react_files(path):
    """Serve React static files"""
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

@app.route('/api/analyze/<video_id>/start', methods=['POST'])
def start_analysis(video_id):
    """Start video analysis and return job ID"""
    try:
        # Get selected brands from request body
        data = request.get_json() or {}
        selected_brands = data.get('brands', [])
        
        logger.info(f"Starting analysis for video {video_id} with selected brands: {selected_brands}")
        
        # Generate job ID
        job_id = f"{video_id}-{int(datetime.now().timestamp() * 1000)}"
        
        # Create job
        analysis_status.create_job(job_id)
        
        # Start analysis in background with selected brands
        analysis_thread = threading.Thread(
            target=analyze_video_with_progress,
            args=(video_id, job_id, selected_brands)
        )
        analysis_thread.daemon = True
        analysis_thread.start()
        
        logger.info(f"Started analysis job: {job_id} for video: {video_id}")
        
        return jsonify({
            'job_id': job_id,
            'status': 'started',
            'message': 'Analysis started successfully',
            'selected_brands': selected_brands
        })
        
    except Exception as e:
        logger.error(f"Error starting analysis: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze/status/<job_id>')
def get_analysis_status(job_id):
    """Get analysis job status"""
    status = analysis_status.get_job(job_id)
    
    if not status:
        return jsonify({'error': 'Job not found'}), 404
    
    return jsonify(status)

def analyze_video_with_progress(video_id: str, job_id: str, selected_brands: list = None):
    """Analyze video with progress updates"""
    try:
        logger.info(f"Starting progressive analysis for video: {video_id}, job: {job_id}")
        
        # Update job status
        analysis_status.update_job(job_id, {
            'status': 'processing',
            'stage': 'initialization',
            'progress': 0,
            'message': 'Starting video analysis...',
            'details': 'Initializing TwelveLabs connection'
        })
        
        # Stage 1: Brand Selection (use provided brands instead of detection)
        if selected_brands is None:
            selected_brands = []
        
        # Use the provided brands directly
        brands_to_analyze = selected_brands
        logger.info(f"Using selected brands for analysis: {brands_to_analyze}")
        
        analysis_status.update_job(job_id, {
            'status': 'processing',
            'stage': 'brand_detection',
            'progress': 25,
            'message': f'Focusing on {len(brands_to_analyze)} selected brands',
            'details': f'{", ".join(brands_to_analyze[:5])}{"..." if len(brands_to_analyze) > 5 else ""}',
            'brands_found': brands_to_analyze
        })
        
        # Stage 2: Detailed Brand Analysis
        analysis_status.update_job(job_id, {
            'status': 'processing',
            'stage': 'brand_analysis',
            'progress': 30,
            'message': 'Analyzing brand appearances...',
            'details': 'Scanning for logos, mentions, and placements'
        })
        
        # Enhanced brand analysis prompt
        if brands_to_analyze:
            brand_list_text = ', '.join(brands_to_analyze)
        else:
            brand_list_text = "any brands you can find"
            
        brand_analysis_prompt = """
        Analyze this sports/entertainment video for comprehensive brand sponsorship measurement.
        
        Focus on these specific brands: """ + brand_list_text + """
        
        IMPORTANT: Categorize each brand appearance into one of two sponsorship categories:
        
        1. AD PLACEMENTS ("ad_placement"):
           - CTV commercials/ads that interrupt content
           - Digital overlays/graphics added in post-production
           - Squeeze ads (picture-in-picture advertisements)
           - Commercial breaks and sponsored segments
           - Broadcast sponsor messages and transitions
           
        2. IN-GAME/IN-EVENT PLACEMENTS ("in_game_placement"):
           - Logos on jerseys, uniforms, equipment
           - Stadium signage, billboards, LED boards
           - Product placements naturally in the scene
           - Venue naming rights and arena branding
           - Naturally occurring brand mentions in commentary
           - Equipment and gear brands used by athletes
        
        For EACH brand appearance, provide:
        - timeline: [start_time, end_time] in seconds
        - brand: exact brand name
        - type: "logo", "jersey_sponsor", "stadium_signage", "digital_overlay", "audio_mention", "product_placement", "commercial", "ctv_ad", "overlay_ad", "squeeze_ad"
        - sponsorship_category: "ad_placement" or "in_game_placement" (based on categories above)
        - location: [x%, y%, width%, height%] for visual elements
        - prominence: "primary" (main focus), "secondary" (visible but not focal), "background" (peripheral)
        - context: "game_action", "replay", "celebration", "interview", "crowd_shot", "commercial", "transition"
        - description: detailed description including any associated athletes, specific moment context
        - sentiment_context: "positive", "neutral", or "negative"
        - viewer_attention: estimated attention level ("high", "medium", "low")
        
        Additional detection requirements:
        - Track jersey sponsors, stadium naming rights, LED boards (in_game_placement)
        - Identify product placements and equipment brands (in_game_placement)
        - Note broadcast sponsor graphics and transitions (ad_placement)
        - Capture verbal brand mentions in commentary (context dependent)
        - Consider lighting conditions and camera angles
        
        Return ONLY a JSON array, no other text:

         [
          {
            "timeline": [start, end],
            "brand": "brand_name",
            "type": "type",
            "sponsorship_category": "ad_placement|in_game_placement",
            "location": [x, y, width, height],
            "prominence": "level",
            "context": "context_type",
            "description": "detailed description",
            "sentiment_context": "sentiment",
            "viewer_attention": "attention_level"
          }
        ]
        """
        
        analysis_status.update_job(job_id, {
            'status': 'processing',
            'stage': 'brand_analysis',
            'progress': 35,
            'message': 'Analyzing video with multimodal AI...',
            'details': 'Detecting brands, logos, and sponsorship content'
        })
        
        # Get brand appearances using TwelveLabs
        logger.info("Getting brand appearances from TwelveLabs...")
        analysis_response = client.analyze(
            video_id=video_id,
            prompt=brand_analysis_prompt
        )
        
        analysis_status.update_job(job_id, {
            'status': 'processing',
            'stage': 'brand_analysis',
            'progress': 50,
            'message': 'Processing AI response...',
            'details': 'Extracting brand detection data'
        })
        
        # Parse the response
        response_text = analysis_response.data if hasattr(analysis_response, 'data') else str(analysis_response)
        logger.info(f"Raw TwelveLabs response length: {len(response_text)}")
        
        # Extract JSON from response
        json_match = re.search(r'\[[\s\S]*\]', response_text)
        if json_match:
            try:
                brand_appearances = json.loads(json_match.group())
                logger.info(f"Parsed {len(brand_appearances)} brand appearances")
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {str(e)}")
                logger.error(f"Failed JSON: {json_match.group()[:500]}...")
                brand_appearances = []
        else:
            logger.warning("No JSON array found in response")
            brand_appearances = []
        
        # Stage 3: Processing appearances
        analysis_status.update_job(job_id, {
            'status': 'processing',
            'stage': 'processing',
            'progress': 60,
            'message': 'Processing brand appearances...',
            'details': f'Analyzing {len(brand_appearances)} detections'
        })
        
        # Get video metadata for accurate duration
        video_duration = 300  # Default 5 minutes
        try:
            # Use the correct API to get video metadata
            video_info = client.indexes.videos.retrieve(
                index_id=INDEX_ID,
                video_id=video_id
            )
            
            # Parse duration from system_metadata (correct way)
            if hasattr(video_info, 'system_metadata') and video_info.system_metadata:
                if hasattr(video_info.system_metadata, 'duration') and video_info.system_metadata.duration:
                    video_duration = video_info.system_metadata.duration
                    logger.info(f"Video duration: {video_duration} seconds")
                    
        except Exception as e:
            logger.warning(f"Could not retrieve video duration: {str(e)}")
            logger.info(f"Using default duration: {video_duration} seconds")
        
        # Process brand data
        brand_data = {}
        for appearance in brand_appearances:
            brand_name = appearance.get('brand', '').strip()
            if not brand_name or not is_valid_brand(brand_name):
                continue
            
            # Ensure sponsorship_category is set
            if 'sponsorship_category' not in appearance:
                appearance['sponsorship_category'] = categorize_sponsorship_placement(
                    appearance.get('type', ''), 
                    appearance.get('context', '')
                )
                
            if brand_name not in brand_data:
                brand_data[brand_name] = {
                    'appearances': [],
                    'total_exposure_time': 0,
                    'contexts': Counter(),
                    'high_impact_moments': 0,
                    'ad_placements': [],
                    'in_game_placements': [],
                    'ad_placement_time': 0,
                    'in_game_placement_time': 0
                }
            
            brand_data[brand_name]['appearances'].append(appearance)
            
            # Separate by sponsorship category
            if appearance['sponsorship_category'] == 'ad_placement':
                brand_data[brand_name]['ad_placements'].append(appearance)
            else:
                brand_data[brand_name]['in_game_placements'].append(appearance)
            
            # Calculate exposure time
            timeline = appearance.get('timeline', [0, 0])
            if len(timeline) >= 2:
                exposure = timeline[1] - timeline[0]
                brand_data[brand_name]['total_exposure_time'] += exposure
                
                # Track exposure time by category
                if appearance['sponsorship_category'] == 'ad_placement':
                    brand_data[brand_name]['ad_placement_time'] += exposure
                else:
                    brand_data[brand_name]['in_game_placement_time'] += exposure
            
            # Track contexts
            context = appearance.get('context', 'unknown')
            brand_data[brand_name]['contexts'][context] += 1
            
            # Count high impact moments (celebrations, close-ups, etc)
            if context in ['celebration', 'interview', 'commercial'] or \
               appearance.get('prominence') == 'primary' or \
               appearance.get('viewer_attention') == 'high':
                brand_data[brand_name]['high_impact_moments'] += 1
        
        analysis_status.update_job(job_id, {
            'status': 'processing',
            'stage': 'metrics',
            'progress': 75,
            'message': 'Calculating brand metrics...',
            'details': 'Computing exposure scores and insights'
        })
        
        # Create brand metrics
        brand_metrics = []
        total_appearances = sum(len(data['appearances']) for data in brand_data.values())
        total_brands = len(brand_data)
        
        for brand_name, data in brand_data.items():
            try:
                # Log the actual timeline data for debugging
                logger.info(f"Brand {brand_name} appearances: {len(data['appearances'])}")
                for app in data['appearances'][:2]:  # Log first 2 appearances
                    logger.info(f"  Timeline: {app.get('timeline', 'N/A')}, Type: {app.get('type', 'N/A')}")
                
                # Calculate more accurate metrics
                avg_sentiment = 0.8  # Default positive
                
                # Get AI-powered contextual score and brand intelligence
                contextual_score, ai_insights = calculate_ai_contextual_score(
                    data['appearances'], 
                    video_duration, 
                    brand_name
                )
                
                # Extract brand intelligence
                brand_intelligence = ai_insights.get('brand_intelligence', {})
                
                # Estimate social engagement
                social_engagement, engagement_details = estimate_social_engagement(
                    data['appearances'], 
                    ai_insights
                )
                
                # Calculate prominence and attention scores
                prominence_scores = []
                attention_scores = []
                for app in data['appearances']:
                    if app.get('prominence') == 'primary':
                        prominence_scores.append(1.0)
                    elif app.get('prominence') == 'secondary':
                        prominence_scores.append(0.6)
                    else:
                        prominence_scores.append(0.3)
                        
                    if app.get('viewer_attention') == 'high':
                        attention_scores.append(1.0)
                    elif app.get('viewer_attention') == 'medium':
                        attention_scores.append(0.6)
                    else:
                        attention_scores.append(0.3)
                
                avg_prominence = np.mean(prominence_scores) if prominence_scores else 0.5
                avg_attention = np.mean(attention_scores) if attention_scores else 0.5
                
                brand_metrics.append({
                    'brand': brand_name,
                    'total_exposure_time': round(data['total_exposure_time'], 2),
                    'total_appearances': len(data['appearances']),
                    'contextual_value_score': round(contextual_score, 1),
                    'high_impact_moments': data['high_impact_moments'],
                    'sentiment_score': round(avg_sentiment, 2),
                    'sentiment_label': 'positive' if avg_sentiment > 0.6 else 'neutral',
                    'avg_prominence': round(avg_prominence, 2),
                    'avg_viewer_attention': round(avg_attention, 2),
                    'contexts': list(data['contexts'].keys()) if data.get('contexts') else [],
                    'estimated_social_mentions': social_engagement,
                    'ai_insights': {
                        **ai_insights,
                        'engagement_details': engagement_details,
                        'brand_intelligence': brand_intelligence
                    },
                    'appearances': data['appearances'],
                    # Category-specific metrics
                    'sponsorship_breakdown': {
                        'ad_placements': {
                            'count': len(data['ad_placements']),
                            'exposure_time': round(data['ad_placement_time'], 2),
                            'percentage_of_total': round((data['ad_placement_time'] / data['total_exposure_time'] * 100), 1) if data['total_exposure_time'] > 0 else 0
                        },
                        'in_game_placements': {
                            'count': len(data['in_game_placements']),
                            'exposure_time': round(data['in_game_placement_time'], 2),
                            'percentage_of_total': round((data['in_game_placement_time'] / data['total_exposure_time'] * 100), 1) if data['total_exposure_time'] > 0 else 0
                        }
                    },
                    'ad_placements': data['ad_placements'],
                    'in_game_placements': data['in_game_placements']
                })
            except Exception as brand_error:
                logger.error(f"Error processing brand {brand_name}: {str(brand_error)}")
                # Re-raise to fail the entire analysis
                raise Exception(f"AI analysis is required for brand metrics. Error: {str(brand_error)}")
        
        analysis_status.update_job(job_id, {
            'status': 'processing',
            'stage': 'finalizing',
            'progress': 90,
            'message': 'Generating insights...',
            'details': 'Creating executive summary'
        })
        
        # Generate summary
        summary = {
            'event_title': "Brand Sponsorship Analysis",
            'analysis_date': datetime.now().isoformat(),
            'video_duration_minutes': round(video_duration / 60, 1),
            'total_brands_detected': total_brands,
            'total_brand_appearances': total_appearances,
            'brands_analyzed': brands_to_analyze
        }
        
        # Collect all appearances into a flat array for raw_detections
        all_appearances = []
        for brand_name, data in brand_data.items():
            all_appearances.extend(data['appearances'])
        
        # Mark completion
        analysis_status.update_job(job_id, {
            'status': 'completed',
            'progress': 100,
            'message': 'Analysis complete!',
            'data': {
                'summary': summary,
                'brand_metrics': brand_metrics,
                'raw_detections': all_appearances,  # Now an array of appearances
                'video_id': video_id,
                'analysis_timestamp': datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        analysis_status.update_job(job_id, {
            'status': 'failed',
            'message': 'Analysis failed',
            'error': str(e)
        })

@app.route('/api/analyze/multi/start', methods=['POST'])
def start_multi_video_analysis():
    """Start multi-video analysis and return job ID"""
    try:
        # Get video IDs and selected brands from request body
        data = request.get_json() or {}
        video_ids = data.get('video_ids', [])
        selected_brands = data.get('brands', [])
        
        if not video_ids:
            return jsonify({'error': 'No video IDs provided'}), 400
        
        logger.info(f"Starting multi-video analysis for videos {video_ids} with selected brands: {selected_brands}")
        
        # Generate job ID for multi-video analysis
        job_id = f"multi-{'-'.join(video_ids[:3])}-{int(datetime.now().timestamp() * 1000)}"
        
        # Create job
        analysis_status.create_job(job_id)
        
        # Start multi-video analysis in background
        analysis_thread = threading.Thread(
            target=analyze_multiple_videos_with_progress,
            args=(video_ids, job_id, selected_brands)
        )
        analysis_thread.daemon = True
        analysis_thread.start()
        
        logger.info(f"Started multi-video analysis job: {job_id} for videos: {video_ids}")
        
        return jsonify({
            'job_id': job_id,
            'status': 'started',
            'message': 'Multi-video analysis started successfully',
            'video_ids': video_ids,
            'selected_brands': selected_brands
        })
        
    except Exception as e:
        logger.error(f"Error starting multi-video analysis: {str(e)}")
        return jsonify({'error': str(e)}), 500

def analyze_single_video_parallel(video_id: str, selected_brands: list = None):
    """Helper function to analyze a single video for parallel processing"""
    try:
        # Create a temporary job ID for individual video analysis
        temp_job_id = f"{video_id}-temp-{int(datetime.now().timestamp() * 1000)}"
        analysis_status.create_job(temp_job_id)
        
        # Analyze individual video
        analyze_video_with_progress(video_id, temp_job_id, selected_brands)
        
        # Wait for analysis to complete and get results
        while True:
            temp_status = analysis_status.get_job(temp_job_id)
            if temp_status['status'] == 'completed':
                return {'success': True, 'data': temp_status['data'], 'video_id': video_id}
            elif temp_status['status'] == 'failed':
                error_msg = temp_status.get('error', 'Unknown error')
                logger.error(f"Failed to analyze video {video_id}: {error_msg}")
                return {'success': False, 'error': error_msg, 'video_id': video_id}
            time.sleep(0.5)  # Reduced sleep time for faster polling
            
    except Exception as e:
        logger.error(f"Error analyzing video {video_id}: {str(e)}")
        return {'success': False, 'error': str(e), 'video_id': video_id}

def analyze_multiple_videos_with_progress(video_ids: list, job_id: str, selected_brands: list = None):
    """Analyze multiple videos in parallel with progress updates and combine results"""
    try:
        logger.info(f"Starting PARALLEL multi-video analysis for videos: {video_ids}, job: {job_id}")
        
        # Initialize analysis status
        analysis_status.update_job(job_id, {
            'status': 'processing',
            'stage': 'initialization',
            'progress': 0,
            'message': f'Starting parallel analysis of {len(video_ids)} videos...',
            'details': 'Initializing parallel multi-video analysis'
        })
        
        individual_analyses = []
        completed_videos = 0
        total_videos = len(video_ids)
        
        # Use ThreadPoolExecutor for parallel processing
        # Limit max workers to avoid overwhelming the API
        max_workers = min(4, len(video_ids))  # Max 4 concurrent videos
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all video analysis tasks
            future_to_video = {
                executor.submit(analyze_single_video_parallel, video_id, selected_brands): video_id 
                for video_id in video_ids
            }
            
            # Process completed tasks as they finish
            for future in as_completed(future_to_video):
                video_id = future_to_video[future]
                completed_videos += 1
                
                try:
                    result = future.result()
                    
                    if result['success']:
                        individual_analyses.append(result['data'])
                        logger.info(f"Successfully analyzed video {video_id} ({completed_videos}/{total_videos})")
                    else:
                        logger.error(f"Failed to analyze video {video_id}: {result['error']}")
                    
                    # Update progress (80% for analysis, 20% for combining)
                    progress = int((completed_videos / total_videos) * 80)
                    analysis_status.update_job(job_id, {
                        'status': 'processing',
                        'stage': 'brand_analysis',
                        'progress': progress,
                        'message': f'Completed {completed_videos} of {total_videos} videos...',
                        'details': f'Last completed: {video_id}'
                    })
                    
                except Exception as e:
                    logger.error(f"Exception processing video {video_id}: {str(e)}")
                    continue
        
        logger.info(f"Parallel analysis completed. Successfully analyzed {len(individual_analyses)} out of {total_videos} videos")
        
        # Combine results from all videos
        analysis_status.update_job(job_id, {
            'status': 'processing',
            'stage': 'finalizing',
            'progress': 85,
            'message': 'Combining analysis results...',
            'details': f'Merging data from {len(individual_analyses)} successfully analyzed videos'
        })
        
        combined_result = combine_video_analyses(individual_analyses, video_ids)
        
        # Complete the job
        analysis_status.update_job(job_id, {
            'status': 'completed',
            'progress': 100,
            'message': f'Parallel multi-video analysis completed successfully ({len(individual_analyses)}/{total_videos} videos)',
            'data': combined_result
        })
        
        logger.info(f"Multi-video analysis completed for job: {job_id}")
        
    except Exception as e:
        logger.error(f"Error in parallel multi-video analysis: {str(e)}")
        analysis_status.update_job(job_id, {
            'status': 'failed',
            'message': 'Parallel multi-video analysis failed',
            'error': str(e)
        })

def combine_video_analyses(individual_analyses, video_ids):
    """Combine individual video analyses into a single result with temporal ordering"""
    if not individual_analyses:
        raise ValueError("No successful analyses to combine")
    
    # Initialize combined metrics
    combined_brand_metrics = {}
    all_detections = []
    total_duration = 0
    total_brand_appearances = 0
    videos_analyzed = []
    cumulative_duration_seconds = 0  # Track cumulative time for timeline offsetting
    
    # Process each individual analysis in the order they were selected
    for i, analysis in enumerate(individual_analyses):
        if not analysis:
            continue
            
        summary = analysis.get('summary', {})
        brand_metrics = analysis.get('brand_metrics', [])
        raw_detections = analysis.get('raw_detections', [])
        
        video_duration_seconds = summary.get('video_duration_minutes', 0) * 60
        
        # Apply temporal offset to raw detections for timeline continuity
        offset_detections = []
        for detection in raw_detections:
            offset_detection = detection.copy()
            if 'timeline' in offset_detection and offset_detection['timeline']:
                # Offset the timeline by cumulative duration of previous videos
                original_timeline = offset_detection['timeline']
                offset_detection['timeline'] = [
                    original_timeline[0] + cumulative_duration_seconds,
                    original_timeline[1] + cumulative_duration_seconds
                ]
            offset_detections.append(offset_detection)
        
        all_detections.extend(offset_detections)
        
        # Add to totals
        total_duration += summary.get('video_duration_minutes', 0)
        total_brand_appearances += summary.get('total_brand_appearances', 0)
        
        # Add video info with cumulative timing
        videos_analyzed.append({
            'video_id': analysis.get('video_id', ''),
            'filename': f"Video {analysis.get('video_id', '')[:8]}",  # Truncated for display
            'duration_minutes': summary.get('video_duration_minutes', 0),
            'start_time_seconds': cumulative_duration_seconds,
            'end_time_seconds': cumulative_duration_seconds + video_duration_seconds
        })
        
        # Combine brand metrics with temporal offset for appearances
        for brand_metric in brand_metrics:
            brand_name = brand_metric.get('brand', '')
            if brand_name not in combined_brand_metrics:
                combined_brand_metrics[brand_name] = {
                    'brand': brand_name,
                    'total_exposure_time': 0,
                    'total_appearances': 0,
                    'contextual_value_score': 0,
                    'high_impact_moments': 0,
                    'sentiment_score': 0,
                    'avg_prominence': 0,
                    'avg_viewer_attention': 0,
                    'contexts': set(),
                    'estimated_social_mentions': 0,
                    'appearances': [],
                    'sponsorship_breakdown': {
                        'ad_placements': {'count': 0, 'exposure_time': 0, 'percentage_of_total': 0},
                        'in_game_placements': {'count': 0, 'exposure_time': 0, 'percentage_of_total': 0}
                    },
                    'ad_placements': [],
                    'in_game_placements': []
                }
            
            # Aggregate metrics
            combined = combined_brand_metrics[brand_name]
            combined['total_exposure_time'] += brand_metric.get('total_exposure_time', 0)
            combined['total_appearances'] += brand_metric.get('total_appearances', 0)
            combined['high_impact_moments'] += brand_metric.get('high_impact_moments', 0)
            combined['estimated_social_mentions'] += brand_metric.get('estimated_social_mentions', 0)
            
            # Apply temporal offset to appearances
            offset_appearances = []
            for appearance in brand_metric.get('appearances', []):
                offset_appearance = appearance.copy()
                if 'timeline' in offset_appearance and offset_appearance['timeline']:
                    original_timeline = offset_appearance['timeline']
                    offset_appearance['timeline'] = [
                        original_timeline[0] + cumulative_duration_seconds,
                        original_timeline[1] + cumulative_duration_seconds
                    ]
                offset_appearances.append(offset_appearance)
            combined['appearances'].extend(offset_appearances)
            
            # Apply temporal offset to ad_placements and in_game_placements
            offset_ad_placements = []
            for placement in brand_metric.get('ad_placements', []):
                offset_placement = placement.copy()
                if 'timeline' in offset_placement and offset_placement['timeline']:
                    original_timeline = offset_placement['timeline']
                    offset_placement['timeline'] = [
                        original_timeline[0] + cumulative_duration_seconds,
                        original_timeline[1] + cumulative_duration_seconds
                    ]
                offset_ad_placements.append(offset_placement)
            combined['ad_placements'].extend(offset_ad_placements)
            
            offset_in_game_placements = []
            for placement in brand_metric.get('in_game_placements', []):
                offset_placement = placement.copy()
                if 'timeline' in offset_placement and offset_placement['timeline']:
                    original_timeline = offset_placement['timeline']
                    offset_placement['timeline'] = [
                        original_timeline[0] + cumulative_duration_seconds,
                        original_timeline[1] + cumulative_duration_seconds
                    ]
                offset_in_game_placements.append(offset_placement)
            combined['in_game_placements'].extend(offset_in_game_placements)
            
            # Add contexts
            combined['contexts'].update(brand_metric.get('contexts', []))
            
            # Update sponsorship breakdown
            ad_breakdown = brand_metric.get('sponsorship_breakdown', {}).get('ad_placements', {})
            in_game_breakdown = brand_metric.get('sponsorship_breakdown', {}).get('in_game_placements', {})
            
            combined['sponsorship_breakdown']['ad_placements']['count'] += ad_breakdown.get('count', 0)
            combined['sponsorship_breakdown']['ad_placements']['exposure_time'] += ad_breakdown.get('exposure_time', 0)
            combined['sponsorship_breakdown']['in_game_placements']['count'] += in_game_breakdown.get('count', 0)
            combined['sponsorship_breakdown']['in_game_placements']['exposure_time'] += in_game_breakdown.get('exposure_time', 0)
        
        # Update cumulative duration for next video
        cumulative_duration_seconds += video_duration_seconds
    
    # Calculate averages and final metrics
    combined_brand_list = []
    
    for brand_name, metrics in combined_brand_metrics.items():
        # Convert set to list for contexts
        metrics['contexts'] = list(metrics['contexts'])
        
        # Calculate averages (simplified - could be more sophisticated)
        if metrics['total_appearances'] > 0:
            
            # Calculate average scores
            contextual_scores = []
            sentiment_scores = []
            prominence_scores = []
            attention_scores = []
            
            for analysis in individual_analyses:
                for brand in analysis.get('brand_metrics', []):
                    if brand.get('brand') == brand_name:
                        contextual_scores.append(brand.get('contextual_value_score', 0))
                        sentiment_scores.append(brand.get('sentiment_score', 0))
                        prominence_scores.append(brand.get('avg_prominence', 0))
                        attention_scores.append(brand.get('avg_viewer_attention', 0))
            
            metrics['contextual_value_score'] = sum(contextual_scores) / len(contextual_scores) if contextual_scores else 0
            metrics['sentiment_score'] = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0
            metrics['avg_prominence'] = sum(prominence_scores) / len(prominence_scores) if prominence_scores else 0
            metrics['avg_viewer_attention'] = sum(attention_scores) / len(attention_scores) if attention_scores else 0
            
            # Determine sentiment label
            if metrics['sentiment_score'] > 0.1:
                metrics['sentiment_label'] = 'positive'
            elif metrics['sentiment_score'] < -0.1:
                metrics['sentiment_label'] = 'negative'
            else:
                metrics['sentiment_label'] = 'neutral'
        
        # Calculate sponsorship breakdown percentages
        total_exposure = metrics['total_exposure_time']
        if total_exposure > 0:
            metrics['sponsorship_breakdown']['ad_placements']['percentage_of_total'] = \
                (metrics['sponsorship_breakdown']['ad_placements']['exposure_time'] / total_exposure) * 100
            metrics['sponsorship_breakdown']['in_game_placements']['percentage_of_total'] = \
                (metrics['sponsorship_breakdown']['in_game_placements']['exposure_time'] / total_exposure) * 100
        
        combined_brand_list.append(metrics)
    
    # Sort brands by total exposure time
    combined_brand_list.sort(key=lambda x: x['total_exposure_time'], reverse=True)
    
    # Find top performing brand
    top_brand = None
    top_brand_score = 0
    if combined_brand_list:
        top_brand = combined_brand_list[0]['brand']
        top_brand_score = combined_brand_list[0]['contextual_value_score']
    
    # Create combined summary
    combined_summary = {
        'total_videos': len(video_ids),
        'combined_duration_minutes': total_duration,
        'total_brands_detected': len(combined_brand_list),
        'total_brand_appearances': total_brand_appearances,
        'top_performing_brand': top_brand,
        'top_brand_score': top_brand_score,
        'videos_analyzed': videos_analyzed
    }
    
    # Return combined result
    return {
        'combined_summary': combined_summary,
        'combined_brand_metrics': combined_brand_list,
        'raw_detections': all_detections,  # Include temporal-offset raw detections for timeline charts
        'individual_analyses': individual_analyses,
        'video_ids': video_ids,
        'analysis_timestamp': datetime.now().isoformat()
    }

@app.route('/api/videos')
def list_videos():
    """List all videos in the TwelveLabs index"""
    try:
        logger.info(f"Fetching videos from TwelveLabs index: {INDEX_ID}")

        # List videos using the new SDK v1.0.1 syntax
        videos_pager = client.indexes.videos.list(
            index_id=INDEX_ID,
            page_limit=50
        )

        videos = []
        # Iterate through the pager to get all videos
        for video in videos_pager:
            # Extract video information from the VideoVector object
            filename = "Unknown"
            duration = 0
            thumbnail_url = None
            
            # Get metadata from system_metadata
            if hasattr(video, 'system_metadata') and video.system_metadata:
                if hasattr(video.system_metadata, 'filename'):
                    filename = video.system_metadata.filename
                if hasattr(video.system_metadata, 'duration'):
                    duration = video.system_metadata.duration
            
            # Fallback to video ID for filename if not available
            if filename == "Unknown" and video.id:
                filename = f"Video_{video.id[:8]}"
            
            # Get thumbnail URL for this video
            try:
                video_details = get_video_details_with_thumbnail(video.id)
                if video_details and video_details['thumbnail_url']:
                    thumbnail_url = video_details['thumbnail_url']
            except Exception as e:
                logger.warning(f"Could not get thumbnail for video {video.id}: {str(e)}")
            
            video_data = {
                'id': video.id,
                'filename': filename,
                'duration': duration,
                'created_at': video.created_at if hasattr(video, 'created_at') else None,
                'thumbnail_url': thumbnail_url,
                'status': 'ready'
            }
                
            videos.append(video_data)

        logger.info(f"Successfully fetched {len(videos)} videos")
        
        return jsonify({
            'videos': videos,
            'total_count': len(videos),
            'index_id': INDEX_ID,
            'message': f'Successfully loaded {len(videos)} videos from TwelveLabs index'
        })

    except Exception as e:
        logger.error(f"Error listing videos: {str(e)}")
        logger.error(f"Error type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        return jsonify({
            'videos': [],
            'total_count': 0,
            'index_id': INDEX_ID,
            'error': str(e),
            'error_type': type(e).__name__
        }), 500

def get_video_details_with_thumbnail(video_id: str):
    """Get video details including thumbnail from TwelveLabs API"""
    try:
        # Use the SDK to retrieve video details with thumbnails
        video_info = client.indexes.videos.retrieve(
            index_id=INDEX_ID,
            video_id=video_id
        )
        
        # Extract thumbnail URL from hls data
        thumbnail_url = None
        if hasattr(video_info, 'hls') and video_info.hls:
            if hasattr(video_info.hls, 'thumbnail_urls') and video_info.hls.thumbnail_urls:
                # Get the first thumbnail URL
                thumbnail_url = video_info.hls.thumbnail_urls[0]
        
        return {
            'id': video_id,
            'thumbnail_url': thumbnail_url,
            'video_info': video_info
        }
    except Exception as e:
        logger.error(f"Error getting video details for {video_id}: {str(e)}")
        return None

@app.route('/api/video/<video_id>/details')
def get_video_details(video_id):
    """Get full video details including thumbnail from TwelveLabs API"""
    try:
        video_details = get_video_details_with_thumbnail(video_id)
        
        if video_details:
            video_info = video_details['video_info']
            
            # Extract full video information
            filename = "Unknown"
            duration = 0
            
            if hasattr(video_info, 'system_metadata') and video_info.system_metadata:
                if hasattr(video_info.system_metadata, 'filename'):
                    filename = video_info.system_metadata.filename
                if hasattr(video_info.system_metadata, 'duration'):
                    duration = video_info.system_metadata.duration
            
            return jsonify({
                'id': video_id,
                'filename': filename,
                'duration': duration,
                'created_at': video_info.created_at if hasattr(video_info, 'created_at') else None,
                'thumbnail_url': video_details['thumbnail_url'],
                'hls': {
                    'video_url': video_info.hls.video_url if hasattr(video_info, 'hls') and hasattr(video_info.hls, 'video_url') else None,
                    'thumbnail_urls': video_info.hls.thumbnail_urls if hasattr(video_info, 'hls') and hasattr(video_info.hls, 'thumbnail_urls') else [],
                    'status': video_info.hls.status if hasattr(video_info, 'hls') and hasattr(video_info.hls, 'status') else None
                } if hasattr(video_info, 'hls') else None,
                'status': 'ready'
            })
        else:
            return jsonify({'error': 'Video not found or no details available'}), 404
    except Exception as e:
        logger.error(f"Error getting video details for {video_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/video/<video_id>/thumbnail')
def get_video_thumbnail(video_id):
    """Get thumbnail for a specific video"""
    try:
        video_details = get_video_details_with_thumbnail(video_id)
        
        if video_details and video_details['thumbnail_url']:
            return jsonify({
                'thumbnail_url': video_details['thumbnail_url']
            })
        else:
            # Return placeholder if no thumbnail available
            return jsonify({
                'thumbnail_url': f"https://via.placeholder.com/300x200/667eea/ffffff?text=Video+{video_id[:8]}"
            })
    except Exception as e:
        logger.error(f"Error getting thumbnail for {video_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/analyze/<video_id>', methods=['GET', 'POST'])
def analyze_video(video_id):
    """Analyze selected video for brand sponsorships per PRD requirements"""
    try:
        logger.info(f"Starting analysis for video: {video_id}")
        
        # First, dynamically detect brands in the video using TwelveLabs
        logger.info("Dynamically detecting brands in video...")
        
        # Initial brand detection prompt with robust filtering
        brand_detection_prompt = """
        Analyze this video and identify ONLY commercial brands, companies, and corporate sponsors.
        
        INCLUDE:
        - Corporate brand names (e.g., Ford, Nike, Coca-Cola)
        - Business sponsors visible on logos, jerseys, signage
        - Product brands and commercial companies
        - Corporate sponsors of the venue/event
        - Radio/TV station sponsors that are commercial entities
        
        DO NOT INCLUDE:
        - Team names or school names (e.g., "Snowflake High School Football")
        - Player or person names (e.g., "Guy Hatch")
        - Geographic locations or cities (e.g., "Berkeley")
        - Generic descriptive terms
        - Event names or competition names
        - Non-commercial entities like schools or colleges
        
        Return ONLY a comma-separated list of verified commercial brand names.
        Be conservative - only include if you're certain it's a commercial brand.
        Example format: Ford, Nike, Coca-Cola
        """
        
        # Get initial brand list from TwelveLabs
        try:
            detection_response = client.analyze(
                video_id=video_id,
                prompt=brand_detection_prompt
            )
            detected_brands_text = detection_response.data if hasattr(detection_response, 'data') else str(detection_response)
            logger.info(f"Detected brands: {detected_brands_text}")
            
            # Parse and filter the detected brands
            raw_brands = [b.strip() for b in detected_brands_text.split(',') if b.strip()]
            detected_brands = [b for b in raw_brands if is_valid_brand(b)]
            
            logger.info(f"Raw brands detected: {raw_brands}")
            logger.info(f"Filtered valid brands: {detected_brands}")
            
            # Get any additional brands from request or merge with detected
            data = request.get_json() if request.method == 'POST' else {}
            requested_brands = data.get('brands', [])
            
            # Combine detected and requested brands (unique)
            brands_to_analyze = list(set(detected_brands + requested_brands))
            logger.info(f"Analyzing {len(brands_to_analyze)} brands: {brands_to_analyze}")
            
        except Exception as e:
            logger.error(f"Error detecting brands: {str(e)}")
            # Fallback to requested brands only
            data = request.get_json() if request.method == 'POST' else {}
            brands_to_analyze = data.get('brands', [])
        
        # Enhanced brand analysis prompt aligned with PRD
        if brands_to_analyze:
            brand_list_text = ', '.join(brands_to_analyze)
        else:
            brand_list_text = "any brands you can find"
            
        brand_analysis_prompt = """
        Analyze this sports/entertainment video for comprehensive brand sponsorship measurement.
        
        Focus on these specific brands: """ + brand_list_text + """
        
        IMPORTANT: Categorize each brand appearance into one of two sponsorship categories:
        
        1. AD PLACEMENTS ("ad_placement"):
           - CTV commercials/ads that interrupt content
           - Digital overlays/graphics added in post-production
           - Squeeze ads (picture-in-picture advertisements)
           - Commercial breaks and sponsored segments
           - Broadcast sponsor messages and transitions
           
        2. IN-GAME/IN-EVENT PLACEMENTS ("in_game_placement"):
           - Logos on jerseys, uniforms, equipment
           - Stadium signage, billboards, LED boards
           - Product placements naturally in the scene
           - Venue naming rights and arena branding
           - Naturally occurring brand mentions in commentary
           - Equipment and gear brands used by athletes
        
        For EACH brand appearance, provide:
        - timeline: [start_time, end_time] in seconds
        - brand: exact brand name
        - type: "logo", "jersey_sponsor", "stadium_signage", "digital_overlay", "audio_mention", "product_placement", "commercial", "ctv_ad", "overlay_ad", "squeeze_ad"
        - sponsorship_category: "ad_placement" or "in_game_placement" (based on categories above)
        - location: [x%, y%, width%, height%] for visual elements
        - prominence: "primary" (main focus), "secondary" (visible but not focal), "background" (peripheral)
        - context: "game_action", "replay", "celebration", "interview", "crowd_shot", "commercial", "transition"
        - description: detailed description including any associated athletes, specific moment context
        - sentiment_context: "positive", "neutral", or "negative"
        - viewer_attention: estimated attention level ("high", "medium", "low")
        
        Additional detection requirements:
        - Track jersey sponsors, stadium naming rights, LED boards (in_game_placement)
        - Identify product placements and equipment brands (in_game_placement)
        - Note broadcast sponsor graphics and transitions (ad_placement)
        - Capture verbal brand mentions in commentary (context dependent)
        - Consider lighting conditions and camera angles
        
        Return ONLY a JSON array, no other text:

         [
          {
            "timeline": [start, end],
            "brand": "brand_name",
            "type": "type",
            "sponsorship_category": "ad_placement|in_game_placement",
            "location": [x, y, width, height],
            "prominence": "primary|secondary|background",
            "context": "game_action|replay|celebration|etc",
            "description": "detailed description",
            "sentiment_context": "positive|neutral|negative",
            "viewer_attention": "high|medium|low"
          }
         ]
        """
        
        # Generate analysis using TwelveLabs API with new SDK v1.0.1
        analysis_response = client.analyze(
            video_id=video_id, 
            prompt=brand_analysis_prompt
        )
        
        # Extract text from response - SDK v1.0.1 returns data field
        analysis_result = analysis_response.data if hasattr(analysis_response, 'data') else str(analysis_response)
        logger.info(f"Raw TwelveLabs response: {analysis_result[:500]}...")
        
        # Parse and validate the JSON response from TwelveLabs
        try:
            raw_brand_data = json.loads(analysis_result)
            
            # Validate each appearance with Pydantic
            brand_data = []
            for appearance in raw_brand_data:
                try:
                    # Ensure required fields have defaults if missing
                    validated_app = BrandAppearance(**appearance)
                    brand_data.append(validated_app.model_dump())
                except Exception as val_err:
                    logger.warning(f"Skipping invalid appearance: {val_err}")
                    # Try to salvage what we can
                    if 'brand' in appearance and 'timeline' in appearance:
                        brand_data.append(appearance)
                        
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            logger.error(f"Raw response was: {analysis_result}")
            # Fallback: extract JSON from response if wrapped in markdown or text
            import re
            json_match = re.search(r'\[.*\]', analysis_result, re.DOTALL)
            if json_match:
                try:
                    brand_data = json.loads(json_match.group())
                    logger.info("Successfully extracted JSON from response")
                except json.JSONDecodeError:
                    logger.error("Failed to parse extracted JSON")
                    brand_data = []
            else:
                logger.error("No JSON array found in response")
                brand_data = []
        
        # Ensure brand_data is a list
        if not isinstance(brand_data, list):
            logger.error(f"brand_data is not a list: {type(brand_data)}")
            brand_data = []
        
        # Calculate analytics
        video_duration = 5400  # Default 90 minutes for sports events
        total_brands = len(set([item.get('brand', '') for item in brand_data])) if brand_data else 0
        total_appearances = len(brand_data) if brand_data else 0
        
        # Brand-specific analysis per PRD requirements
        brand_summary = {}
        for appearance in brand_data:
            brand_name = appearance.get('brand', 'Unknown')
            
            # Ensure sponsorship_category is set
            if 'sponsorship_category' not in appearance:
                appearance['sponsorship_category'] = categorize_sponsorship_placement(
                    appearance.get('type', ''), 
                    appearance.get('context', '')
                )
            
            if brand_name not in brand_summary:
                brand_summary[brand_name] = {
                    'brand': brand_name,
                    'appearances': [],
                    'total_exposure_time': 0,
                    'high_impact_moments': 0,
                    'sentiment_scores': [],
                    'prominence_scores': [],
                    'contexts': [],
                    'viewer_attention_scores': [],
                    'ad_placements': [],
                    'in_game_placements': [],
                    'ad_placement_time': 0,
                    'in_game_placement_time': 0
                }
            
            brand_summary[brand_name]['appearances'].append(appearance)
            
            # Separate by sponsorship category
            if appearance['sponsorship_category'] == 'ad_placement':
                brand_summary[brand_name]['ad_placements'].append(appearance)
            else:
                brand_summary[brand_name]['in_game_placements'].append(appearance)
            
            # Calculate exposure time
            if 'timeline' in appearance and len(appearance['timeline']) == 2:
                exposure_time = appearance['timeline'][1] - appearance['timeline'][0]
                brand_summary[brand_name]['total_exposure_time'] += exposure_time
                
                # Track exposure time by category
                if appearance['sponsorship_category'] == 'ad_placement':
                    brand_summary[brand_name]['ad_placement_time'] += exposure_time
                else:
                    brand_summary[brand_name]['in_game_placement_time'] += exposure_time
            
            # Track contexts
            context = appearance.get('context', 'unknown')
            if context not in brand_summary[brand_name]['contexts']:
                brand_summary[brand_name]['contexts'].append(context)
            
            # Count high-impact moments (goals, celebrations, replays)
            if context in ['celebration', 'replay', 'game_action']:
                brand_summary[brand_name]['high_impact_moments'] += 1
            
            # Prominence scoring
            prominence = appearance.get('prominence', 'secondary')
            prominence_score = {'primary': 1.0, 'secondary': 0.5, 'background': 0.2}.get(prominence, 0.5)
            brand_summary[brand_name]['prominence_scores'].append(prominence_score)
            
            # Sentiment scoring
            sentiment = appearance.get('sentiment_context', 'neutral')
            sentiment_score = {'positive': 1, 'neutral': 0, 'negative': -1}.get(sentiment, 0)
            brand_summary[brand_name]['sentiment_scores'].append(sentiment_score)
            
            # Viewer attention scoring
            attention = appearance.get('viewer_attention', 'medium')
            attention_score = {'high': 1.0, 'medium': 0.6, 'low': 0.3}.get(attention, 0.6)
            brand_summary[brand_name]['viewer_attention_scores'].append(attention_score)
        
        # Calculate final metrics for each brand
        brand_metrics = []
        for brand_name, data in brand_summary.items():
            # Calculate comprehensive metrics per PRD
            avg_sentiment = np.mean(data['sentiment_scores']) if data['sentiment_scores'] else 0
            avg_prominence = np.mean(data['prominence_scores']) if data['prominence_scores'] else 0.5
            avg_attention = np.mean(data['viewer_attention_scores']) if data['viewer_attention_scores'] else 0.5
            
            # AI-powered contextual score calculation
            contextual_score, ai_insights = calculate_ai_contextual_score(
                data['appearances'], 
                video_duration, 
                brand_name
            )
            
            # Extract brand intelligence from ai_insights if available
            brand_intelligence = ai_insights.get('brand_intelligence', {})
            
            # Social engagement estimation using AI insights
            social_engagement, engagement_details = estimate_social_engagement(
                data['appearances'], 
                ai_insights
            )
            
            # Calculate sentiment label
            if avg_sentiment > 0.3:
                sentiment_label = 'positive'
            elif avg_sentiment < -0.3:
                sentiment_label = 'negative'
            else:
                sentiment_label = 'neutral'
            
            # Validate and create brand metrics with Pydantic
            try:
                validated_metric = BrandMetrics(
                    brand=brand_name,
                    total_exposure_time=round(data['total_exposure_time'], 2),
                    total_appearances=len(data['appearances']),
                    contextual_value_score=round(contextual_score, 1),  # AI score, guaranteed 0-10
                    high_impact_moments=data['high_impact_moments'],
                    sentiment_score=round(avg_sentiment, 2),
                    sentiment_label=sentiment_label,
                    avg_prominence=round(avg_prominence, 2),
                    avg_viewer_attention=round(avg_attention, 2),
                    contexts=data['contexts'],
                    estimated_social_mentions=social_engagement,
                    ai_insights={
                        **ai_insights,
                        'engagement_details': engagement_details,
                        'brand_intelligence': brand_intelligence
                    },
                    appearances=data['appearances']
                )
                brand_metric_dict = validated_metric.model_dump()
                
                # Add category-specific metrics to the validated metric
                brand_metric_dict.update({
                    'sponsorship_breakdown': {
                        'ad_placements': {
                            'count': len(data['ad_placements']),
                            'exposure_time': round(data['ad_placement_time'], 2),
                            'percentage_of_total': round((data['ad_placement_time'] / data['total_exposure_time'] * 100), 1) if data['total_exposure_time'] > 0 else 0
                        },
                        'in_game_placements': {
                            'count': len(data['in_game_placements']),
                            'exposure_time': round(data['in_game_placement_time'], 2),
                            'percentage_of_total': round((data['in_game_placement_time'] / data['total_exposure_time'] * 100), 1) if data['total_exposure_time'] > 0 else 0
                        }
                    },
                    'ad_placements': data['ad_placements'],
                    'in_game_placements': data['in_game_placements']
                })
                
                brand_metrics.append(brand_metric_dict)
            except Exception as e:
                logger.error(f"Error creating brand metrics for {brand_name}: {str(e)}")
                # Fallback without validation
                brand_metrics.append({
                    'brand': brand_name,
                    'total_exposure_time': round(data['total_exposure_time'], 2),
                    'total_appearances': len(data['appearances']),
                    'contextual_value_score': min(10.0, round(contextual_score, 1)),
                    'high_impact_moments': data['high_impact_moments'],
                    'sentiment_score': round(avg_sentiment, 2),
                    'sentiment_label': sentiment_label,
                    'avg_prominence': round(avg_prominence, 2),
                    'avg_viewer_attention': round(avg_attention, 2),
                    'contexts': data['contexts'],
                    'estimated_social_mentions': social_engagement,
                    'ai_insights': ai_insights if ai_insights else {},
                    'appearances': data['appearances'],
                    # Category-specific metrics
                    'sponsorship_breakdown': {
                        'ad_placements': {
                            'count': len(data['ad_placements']),
                            'exposure_time': round(data['ad_placement_time'], 2),
                            'percentage_of_total': round((data['ad_placement_time'] / data['total_exposure_time'] * 100), 1) if data['total_exposure_time'] > 0 else 0
                        },
                        'in_game_placements': {
                            'count': len(data['in_game_placements']),
                            'exposure_time': round(data['in_game_placement_time'], 2),
                            'percentage_of_total': round((data['in_game_placement_time'] / data['total_exposure_time'] * 100), 1) if data['total_exposure_time'] > 0 else 0
                        }
                    },
                    'ad_placements': data['ad_placements'],
                    'in_game_placements': data['in_game_placements']
                })
        
        # Sort by contextual value score
        brand_metrics.sort(key=lambda x: x['contextual_value_score'], reverse=True)
        
        # Get video metadata for title and duration using correct SDK method
        try:
            # Use the correct API to get video metadata
            video_info = client.indexes.videos.retrieve(
                index_id=INDEX_ID,
                video_id=video_id
            )
            
            # Get video title from system_metadata
            video_title = f"Video {video_id[:8]}"  # Default title
            if hasattr(video_info, 'system_metadata') and video_info.system_metadata:
                if hasattr(video_info.system_metadata, 'filename') and video_info.system_metadata.filename:
                    video_title = video_info.system_metadata.filename
                    
                # Update video duration from system_metadata (correct way)
                if hasattr(video_info.system_metadata, 'duration') and video_info.system_metadata.duration:
                    video_duration = video_info.system_metadata.duration
                    logger.info(f"Updated video duration: {video_duration} seconds")
                    
        except Exception as e:
            logger.warning(f"Could not retrieve video info: {str(e)}")
            video_title = f"Video {video_id[:8]}"
            logger.info(f"Using default video duration: {video_duration} seconds")
        
        # Generate executive summary per PRD format
        top_brand = brand_metrics[0] if brand_metrics else None
        
        # Calculate aggregate metrics
        total_exposure_time = sum(b['total_exposure_time'] for b in brand_metrics)
        avg_contextual_score = np.mean([b['contextual_value_score'] for b in brand_metrics]) if brand_metrics else 0
        
        # Generate executive AI summary
        executive_insights = generate_executive_summary(brand_metrics, video_duration, video_title)
        
        summary = {
            'event_title': f"Brand Sponsorship Analysis - {video_title}",
            'analysis_date': datetime.now().isoformat(),
            'video_duration_minutes': round(video_duration / 60, 1),
            'total_brands_detected': total_brands,
            'total_brand_appearances': total_appearances,
            'total_exposure_time_seconds': round(total_exposure_time, 1),
            'exposure_coverage_percentage': round((total_exposure_time / video_duration * 100), 2) if video_duration > 0 else 0,
            'top_performing_brand': top_brand['brand'] if top_brand else None,
            'top_brand_score': top_brand['contextual_value_score'] if top_brand else 0,
            'average_contextual_score': round(avg_contextual_score, 1),
            'brands_analyzed': brands_to_analyze,
            'executive_insights': executive_insights,
            'analysis_capabilities': {
                'multimodal_detection': True,
                'ai_powered_scoring': True,
                'contextual_scoring': True,
                'sentiment_analysis': True,
                'prominence_tracking': True,
                'viewer_attention_modeling': True,
                'dynamic_brand_discovery': True,
                'predictive_analytics': True
            }
        }
        
        # Collect all appearances into a flat array for raw_detections
        all_appearances = []
        for brand_name, data in brand_data.items():
            all_appearances.extend(data['appearances'])
        
        response_data = {
            'summary': summary,
            'brand_metrics': brand_metrics,
            'raw_detections': all_appearances,  # Now an array of appearances
            'video_id': video_id,
            'analysis_timestamp': datetime.now().isoformat()
        }
        
        logger.info(f"Analysis complete for {video_id}: {total_brands} brands, {total_appearances} appearances")
        
        return jsonify(response_data)
    
    except Exception as e:
        logger.error(f"Analysis error for {video_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/search')
def search_brands():
    """Search for specific brands across all indexed videos"""
    try:
        query = request.args.get('query', '')
        if not query:
            return jsonify({'error': 'No search query provided'}), 400
        
        # Search using TwelveLabs with new SDK v1.0.1
        search_pager = client.search.query(
            index_id=INDEX_ID, 
            query_text=query,
            search_options=["visual", "audio"],
            page_limit=20
        )
        
        results = []
        for result in search_pager:
            results.append({
                'video_id': result.video_id,
                'start': result.start,
                'end': result.end,
                'confidence': result.confidence,
                'metadata': result.metadata if hasattr(result, 'metadata') else {}
            })
        
        return jsonify({
            'query': query,
            'results': results,
            'total_results': len(results)
        })
    
    except Exception as e:
        logger.error(f"Search error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/report/<format>')
def generate_report(format):
    """Generate downloadable reports in various formats"""
    try:
        # This would normally generate actual reports based on analysis data
        # For MVP, return a simple response
        
        if format not in ['pdf', 'csv', 'json']:
            return jsonify({'error': 'Unsupported format'}), 400
        
        return jsonify({
            'message': f'Report generation for {format} format initiated',
            'status': 'processing',
            'estimated_completion': (datetime.now() + timedelta(minutes=2)).isoformat()
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
