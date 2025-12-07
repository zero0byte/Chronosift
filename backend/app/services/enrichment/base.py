"""Base enrichment service infrastructure."""
import asyncio
import httpx
import redis.asyncio as aioredis
from typing import Dict, List, Optional, Any
from abc import ABC, abstractmethod
import json
import logging
import os

logger = logging.getLogger(__name__)


class EnricherBase(ABC):
    """Base class for all enrichers."""
    
    def __init__(self, api_key: Optional[str] = None, cache_ttl: int = 3600):
        """
        Initialize enricher.
        
        Args:
            api_key: Optional API key for the service
            cache_ttl: Cache time-to-live in seconds (default 1 hour)
        """
        self.api_key = api_key
        self.cache_ttl = cache_ttl
        self.redis_client = None
        self.http_client = None
    
    async def initialize(self):
        """Initialize async resources (Redis, HTTP client)."""
        if not self.redis_client:
            try:
                redis_host = os.getenv('REDIS_HOST', 'redis')
                redis_port = int(os.getenv('REDIS_PORT', 6379))
                self.redis_client = await aioredis.from_url(
                    f"redis://{redis_host}:{redis_port}",
                    encoding="utf-8",
                    decode_responses=True
                )
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}")
                self.redis_client = None
        
        if not self.http_client:
            # Use synchronous httpx.Client to avoid eventlet greendns async path
            self.http_client = httpx.Client(
                timeout=30.0,
                follow_redirects=True,
                headers={"User-Agent": "ChronoSift/1.0"}
            )
    
    async def cleanup(self):
        """Cleanup async resources."""
        if self.http_client:
            try:
                self.http_client.close()
            except Exception:
                pass
        if self.redis_client:
            await self.redis_client.close()
    
    async def get_cached(self, cache_key: str) -> Optional[Dict]:
        """Get cached enrichment result."""
        if not self.redis_client:
            return None
        try:
            cached = await self.redis_client.get(cache_key)
            if cached:
                # Handle both bytes and string responses
                if isinstance(cached, bytes):
                    cached = cached.decode('utf-8')
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"Cache read error: {e}")
        return None
    
    async def set_cache(self, cache_key: str, data: Dict):
        """Set cached enrichment result."""
        if not self.redis_client:
            return
        try:
            await self.redis_client.setex(
                cache_key,
                self.cache_ttl,
                json.dumps(data)
            )
        except Exception as e:
            logger.warning(f"Cache write error: {e}")
    
    def get_cache_key(self, value: str) -> str:
        """Generate cache key for a value."""
        return f"{self.__class__.__name__.lower()}:{value}"
    
    @abstractmethod
    async def enrich(self, value: str) -> Dict[str, Any]:
        """
        Enrich a value.
        
        Args:
            value: The value to enrich (IP, hash, domain, etc.)
        
        Returns:
            Dict with enrichment data including 'confidence' score
        """
        pass
    
    @abstractmethod
    def calculate_confidence(self, result: Dict) -> float:
        """
        Calculate confidence score for enrichment result.
        
        Args:
            result: The enrichment result data
        
        Returns:
            Confidence score between 0.0 and 1.0
        """
        pass


class EnrichmentService:
    """Service for managing enrichment operations."""
    
    def __init__(self):
        """Initialize enrichment service."""
        self.enrichers: Dict[str, List[EnricherBase]] = {}
    
    def register_enricher(self, entity_type: str, enricher: EnricherBase):
        """Register an enricher for an entity type."""
        if entity_type not in self.enrichers:
            self.enrichers[entity_type] = []
        self.enrichers[entity_type].append(enricher)
    
    async def enrich_value(
        self,
        entity_type: str,
        value: str,
        providers: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Enrich a value using all registered enrichers for the entity type.
        
        Args:
            entity_type: Type of entity (ip, hash, domain, etc.)
            value: The value to enrich
            providers: Optional list of specific providers to use
        
        Returns:
            Dict with aggregated enrichment results
        """
        # Ensure value is a string, not bytes
        if isinstance(value, bytes):
            value = value.decode('utf-8')
        elif not isinstance(value, str):
            value = str(value)
        
        if entity_type not in self.enrichers:
            return {
                'error': f'No enrichers registered for entity type: {entity_type}',
                'results': [],
                'confidence': 0.0
            }
        
        enrichers = self.enrichers[entity_type]
        
        # Filter by providers if specified
        if providers:
            enrichers = [
                e for e in enrichers 
                if e.__class__.__name__.lower() in [p.lower() for p in providers]
            ]
        
        # Initialize all enrichers
        for enricher in enrichers:
            await enricher.initialize()
        
        # Run all enrichers in parallel
        tasks = [enricher.enrich(value) for enricher in enrichers]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        enrichment_data = []
        confidence_scores = []
        
        for enricher, result in zip(enrichers, results):
            if isinstance(result, Exception):
                logger.error(f"{enricher.__class__.__name__} error: {result}")
                enrichment_data.append({
                    'provider': enricher.__class__.__name__,
                    'error': str(result)
                })
            else:
                confidence = enricher.calculate_confidence(result)
                enrichment_data.append({
                    'provider': enricher.__class__.__name__,
                    'data': result,
                    'confidence': confidence
                })
                confidence_scores.append(confidence)
        
        # Cleanup enrichers
        for enricher in enrichers:
            await enricher.cleanup()
        
        # Calculate aggregate confidence
        aggregate_confidence = (
            sum(confidence_scores) / len(confidence_scores)
            if confidence_scores else 0.0
        )
        
        return {
            'value': value,
            'entity_type': entity_type,
            'results': enrichment_data,
            'confidence': aggregate_confidence
        }
    
    async def bulk_enrich(
        self,
        entity_type: str,
        values: List[str],
        providers: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Enrich multiple values in parallel.
        
        Args:
            entity_type: Type of entity
            values: List of values to enrich
            providers: Optional list of specific providers to use
        
        Returns:
            List of enrichment results
        """
        tasks = [
            self.enrich_value(entity_type, value, providers)
            for value in values
        ]
        return await asyncio.gather(*tasks)


# Global enrichment service instance
enrichment_service = EnrichmentService()
