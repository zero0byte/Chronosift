"""IP address enrichment providers."""
import asyncio
import logging
from typing import Dict, Any, Optional
from .base import EnricherBase

logger = logging.getLogger(__name__)


class GreyNoiseEnricher(EnricherBase):
    """GreyNoise IP enricher - identifies scanners and internet noise."""
    
    def __init__(self, api_key: Optional[str] = None, cache_ttl: int = 3600):
        super().__init__(api_key, cache_ttl)
        self.base_url = str("https://api.greynoise.io/v3/community")
    
    async def enrich(self, ip: str) -> Dict[str, Any]:
        """Enrich IP using GreyNoise Community API."""
        # Ensure IP is a string
        ip = str(ip) if not isinstance(ip, str) else ip
        cache_key = self.get_cache_key(ip)
        
        # Check cache
        cached = await self.get_cached(cache_key)
        if cached:
            return cached
        
        # Make API request - ensure URL is a string
        url = str(f"{self.base_url}/{ip}")
        headers = {}
        if self.api_key:
            # Ensure API key is a string
            api_key_str = self.api_key.decode('utf-8') if isinstance(self.api_key, bytes) else str(self.api_key)
            headers["key"] = api_key_str
        
        try:
            # Use sync requests in thread pool to avoid eventlet DNS issues
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, lambda: self.http_client.get(url, headers=headers, timeout=30))
            response.raise_for_status()
            data = response.json()
            
            # Cache result
            await self.set_cache(cache_key, data)
            return data
        except Exception as e:
            logger.exception(f"GreyNoise error for {ip}: {e}")
            return {"error": str(e), "ip": ip}
    
    def calculate_confidence(self, result: Dict) -> float:
        """Calculate confidence score based on GreyNoise data."""
        if "error" in result:
            return 0.0
        
        # GreyNoise provides clear classification
        if result.get("classification") == "malicious":
            return 0.9
        elif result.get("classification") == "benign":
            return 0.7
        elif result.get("riot"):  # Known good IP
            return 0.8
        elif result.get("noise"):  # Scanner/noise
            return 0.8
        return 0.5


class AbuseIPDBEnricher(EnricherBase):
    """AbuseIPDB enricher - IP abuse reports and reputation."""
    
    def __init__(self, api_key: Optional[str] = None, cache_ttl: int = 3600):
        super().__init__(api_key, cache_ttl)
        self.base_url = str("https://api.abuseipdb.com/api/v2/check")
    
    async def enrich(self, ip: str) -> Dict[str, Any]:
        """Enrich IP using AbuseIPDB API."""
        # Ensure IP is a string
        ip = str(ip) if not isinstance(ip, str) else ip
        cache_key = self.get_cache_key(ip)
        
        # Check cache
        cached = await self.get_cached(cache_key)
        if cached:
            return cached
        
        if not self.api_key:
            return {"error": "API key required", "ip": ip}
        
        # Make API request
        # Ensure API key is a string
        api_key_str = self.api_key.decode('utf-8') if isinstance(self.api_key, bytes) else str(self.api_key)
        headers = {"Key": api_key_str, "Accept": "application/json"}
        params = {"ipAddress": ip, "maxAgeInDays": 90, "verbose": ""}
        
        try:
            # Use sync requests in thread pool to avoid eventlet DNS issues
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, lambda: self.http_client.get(
                self.base_url,
                headers=headers,
                params=params,
                timeout=30
            ))
            response.raise_for_status()
            data = response.json()
            
            # Cache result
            await self.set_cache(cache_key, data)
            return data
        except Exception as e:
            logger.exception(f"AbuseIPDB error for {ip}: {e}")
            return {"error": str(e), "ip": ip}
    
    def calculate_confidence(self, result: Dict) -> float:
        """Calculate confidence score based on AbuseIPDB data."""
        if "error" in result:
            return 0.0
        
        data = result.get("data", {})
        abuse_score = data.get("abuseConfidenceScore", 0)
        total_reports = data.get("totalReports", 0)
        
        # Higher abuse score = higher confidence in malicious classification
        confidence = (abuse_score / 100.0) * 0.9  # Max 0.9
        
        # Boost confidence with more reports
        if total_reports > 10:
            confidence = min(confidence + 0.1, 1.0)
        
        return confidence


class VirusTotalIPEnricher(EnricherBase):
    """VirusTotal IP enricher - IP reputation from multiple sources."""
    
    def __init__(self, api_key: Optional[str] = None, cache_ttl: int = 3600):
        super().__init__(api_key, cache_ttl)
        self.base_url = str("https://www.virustotal.com/api/v3/ip_addresses")
    
    async def enrich(self, ip: str) -> Dict[str, Any]:
        """Enrich IP using VirusTotal API."""
        # Ensure IP is a string
        ip = str(ip) if not isinstance(ip, str) else ip
        cache_key = self.get_cache_key(ip)
        
        # Check cache
        cached = await self.get_cached(cache_key)
        if cached:
            return cached
        
        if not self.api_key:
            return {"error": "API key required", "ip": ip}
        
        # Make API request - ensure URL is a string
        url = str(f"{self.base_url}/{ip}")
        # Ensure API key is a string
        api_key_str = self.api_key.decode('utf-8') if isinstance(self.api_key, bytes) else str(self.api_key)
        headers = {"x-apikey": api_key_str}
        
        try:
            # Use sync requests in thread pool to avoid eventlet DNS issues
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, lambda: self.http_client.get(url, headers=headers, timeout=30))
            response.raise_for_status()
            data = response.json()
            
            # Cache result
            await self.set_cache(cache_key, data)
            return data
        except Exception as e:
            logger.exception(f"VirusTotal error for {ip}: {e}")
            return {"error": str(e), "ip": ip}
    
    def calculate_confidence(self, result: Dict) -> float:
        """Calculate confidence score based on VirusTotal data."""
        if "error" in result:
            return 0.0
        
        attributes = result.get("data", {}).get("attributes", {})
        last_analysis_stats = attributes.get("last_analysis_stats", {})
        
        malicious = last_analysis_stats.get("malicious", 0)
        suspicious = last_analysis_stats.get("suspicious", 0)
        harmless = last_analysis_stats.get("harmless", 0)
        undetected = last_analysis_stats.get("undetected", 0)
        
        total = malicious + suspicious + harmless + undetected
        if total == 0:
            return 0.5
        
        # Malicious/suspicious ratio indicates confidence
        bad_ratio = (malicious + suspicious * 0.5) / total
        
        # High detection by multiple vendors = high confidence
        if malicious > 5:
            return min(0.9, 0.6 + bad_ratio * 0.4)
        elif malicious > 0:
            return 0.7
        
        return 0.5


class IPInfoEnricher(EnricherBase):
    """IPInfo enricher - IP geolocation and ASN information."""
    
    def __init__(self, api_key: Optional[str] = None, cache_ttl: int = 7200):
        super().__init__(api_key, cache_ttl)
        self.base_url = str("https://ipinfo.io")
    
    async def enrich(self, ip: str) -> Dict[str, Any]:
        """Enrich IP using IPInfo API."""
        # Ensure IP is a string
        ip = str(ip) if not isinstance(ip, str) else ip
        cache_key = self.get_cache_key(ip)
        
        # Check cache
        cached = await self.get_cached(cache_key)
        if cached:
            return cached
        
        # Make API request - ensure URL is a string
        url = str(f"{self.base_url}/{ip}/json")
        headers = {}
        if self.api_key:
            # Ensure API key is a string
            api_key_str = self.api_key.decode('utf-8') if isinstance(self.api_key, bytes) else str(self.api_key)
            headers["Authorization"] = f"Bearer {api_key_str}"
        
        try:
            # Use sync requests in thread pool to avoid eventlet DNS issues
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, lambda: self.http_client.get(url, headers=headers, timeout=30))
            response.raise_for_status()
            data = response.json()
            
            # Cache result
            await self.set_cache(cache_key, data)
            return data
        except Exception as e:
            logger.exception(f"IPInfo error for {ip}: {e}")
            return {"error": str(e), "ip": ip}
    
    def calculate_confidence(self, result: Dict) -> float:
        """Calculate confidence score based on IPInfo data."""
        if "error" in result:
            return 0.0
        
        # IPInfo provides informational data, not threat intel
        # Confidence is based on data completeness
        fields = ["city", "region", "country", "org", "postal", "timezone"]
        present_fields = sum(1 for field in fields if result.get(field))
        
        # More complete data = higher confidence
        confidence = 0.5 + (present_fields / len(fields)) * 0.3
        
        # Boost for privacy/hosting indicators
        if result.get("privacy"):
            confidence = min(confidence + 0.1, 0.9)
        
        return confidence
