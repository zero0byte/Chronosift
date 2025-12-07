"""
LLM integration service for timeline analysis
Supports OpenAI, Anthropic, and local models via OpenAI-compatible APIs
"""
import os
import json
import httpx
from typing import Dict, List, Optional, Any, Tuple
from enum import Enum


class LLMProvider(Enum):
    """Supported LLM providers"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    LOCAL = "local"  # For local models via OpenAI-compatible API (e.g., Ollama, LM Studio)


class LLMService:
    """Service for interacting with various LLM providers"""
    
    def __init__(self):
        # Load API keys from environment
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        self.anthropic_api_key = os.getenv('ANTHROPIC_API_KEY')
        self.local_api_base = os.getenv('LOCAL_LLM_BASE_URL', 'http://localhost:11434')
        
        # Default models
        self.default_models = {
            LLMProvider.OPENAI: os.getenv('OPENAI_MODEL', 'gpt-4-turbo-preview'),
            LLMProvider.ANTHROPIC: os.getenv('ANTHROPIC_MODEL', 'claude-3-opus-20240229'),
            LLMProvider.LOCAL: os.getenv('LOCAL_MODEL', 'llama2')
        }
        
        # Determine which provider to use (priority order)
        self.default_provider = self._determine_default_provider()
    
    def _determine_default_provider(self) -> LLMProvider:
        """Determine which LLM provider to use based on available API keys"""
        if self.openai_api_key:
            return LLMProvider.OPENAI
        elif self.anthropic_api_key:
            return LLMProvider.ANTHROPIC
        else:
            return LLMProvider.LOCAL
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        provider: Optional[LLMProvider] = None,
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        response_format: Optional[Dict[str, str]] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Send a chat completion request to the specified LLM provider
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            provider: LLM provider to use (defaults to configured default)
            model: Model name (defaults to provider's default)
            temperature: Sampling temperature
            max_tokens: Maximum tokens in response
            response_format: Optional response format specification (e.g., {"type": "json_object"})
            
        Returns:
            Tuple of (response_text, metadata_dict)
        """
        provider = provider or self.default_provider
        model = model or self.default_models[provider]
        
        if provider == LLMProvider.OPENAI:
            return await self._openai_chat(messages, model, temperature, max_tokens, response_format)
        elif provider == LLMProvider.ANTHROPIC:
            return await self._anthropic_chat(messages, model, temperature, max_tokens)
        elif provider == LLMProvider.LOCAL:
            return await self._local_chat(messages, model, temperature, max_tokens, response_format)
        else:
            raise ValueError(f"Unsupported provider: {provider}")
    
    async def _openai_chat(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float,
        max_tokens: int,
        response_format: Optional[Dict[str, str]] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """OpenAI chat completion"""
        if not self.openai_api_key:
            raise ValueError("OpenAI API key not configured")
        
        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        if response_format:
            payload["response_format"] = response_format
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()
        
        content = data['choices'][0]['message']['content']
        metadata = {
            'provider': 'openai',
            'model': model,
            'prompt_tokens': data['usage']['prompt_tokens'],
            'completion_tokens': data['usage']['completion_tokens'],
            'total_tokens': data['usage']['total_tokens']
        }
        
        return content, metadata
    
    async def _anthropic_chat(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float,
        max_tokens: int
    ) -> Tuple[str, Dict[str, Any]]:
        """Anthropic Claude chat completion"""
        if not self.anthropic_api_key:
            raise ValueError("Anthropic API key not configured")
        
        headers = {
            "x-api-key": self.anthropic_api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }
        
        # Anthropic uses a different message format
        system_message = None
        anthropic_messages = []
        
        for msg in messages:
            if msg['role'] == 'system':
                system_message = msg['content']
            else:
                anthropic_messages.append({
                    'role': msg['role'],
                    'content': msg['content']
                })
        
        payload = {
            "model": model,
            "messages": anthropic_messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        if system_message:
            payload["system"] = system_message
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()
        
        content = data['content'][0]['text']
        metadata = {
            'provider': 'anthropic',
            'model': model,
            'prompt_tokens': data['usage']['input_tokens'],
            'completion_tokens': data['usage']['output_tokens'],
            'total_tokens': data['usage']['input_tokens'] + data['usage']['output_tokens']
        }
        
        return content, metadata
    
    async def _local_chat(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float,
        max_tokens: int,
        response_format: Optional[Dict[str, str]] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """Local model chat completion via OpenAI-compatible API"""
        headers = {
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        # Add response format if specified (for JSON mode)
        if response_format:
            payload["format"] = response_format.get("type", "json")
        
        # Try OpenAI-compatible endpoint first (LM Studio, etc.)
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.local_api_base}/v1/chat/completions",
                    headers=headers,
                    json=payload
                )
                response.raise_for_status()
                data = response.json()
            
            content = data['choices'][0]['message']['content']
            usage = data.get('usage', {})
        except (httpx.HTTPError, KeyError):
            # Fallback to Ollama-style API
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Build Ollama-compatible payload
                ollama_payload = {
                    "model": model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": temperature,
                        "num_predict": max_tokens
                    }
                }
                
                # Enable JSON mode if requested
                if response_format:
                    fmt = response_format.get("type", "json")
                    if fmt in ("json_object", "json"):
                        ollama_payload["format"] = "json"
                
                response = await client.post(
                    f"{self.local_api_base}/api/chat",
                    headers=headers,
                    json=ollama_payload
                )
                response.raise_for_status()
                data = response.json()
            
            content = data['message']['content']
            usage = {}
        
        metadata = {
            'provider': 'local',
            'model': model,
            'prompt_tokens': usage.get('prompt_tokens', 0),
            'completion_tokens': usage.get('completion_tokens', 0),
            'total_tokens': usage.get('total_tokens', 0)
        }
        
        return content, metadata
    
    def is_configured(self, provider: Optional[LLMProvider] = None) -> bool:
        """Check if a specific provider is configured"""
        provider = provider or self.default_provider
        
        if provider == LLMProvider.OPENAI:
            return bool(self.openai_api_key)
        elif provider == LLMProvider.ANTHROPIC:
            return bool(self.anthropic_api_key)
        elif provider == LLMProvider.LOCAL:
            return True  # Local is always "configured" (may not work though)
        
        return False
    
    def get_available_providers(self) -> List[str]:
        """Get list of configured providers"""
        providers = []
        if self.openai_api_key:
            providers.append('openai')
        if self.anthropic_api_key:
            providers.append('anthropic')
        providers.append('local')  # Always include local option
        return providers
    
    async def check_availability(self, provider: Optional[LLMProvider] = None) -> Tuple[bool, str]:
        """
        Check if LLM provider is available and working
        
        Returns:
            Tuple of (is_available, message)
        """
        provider = provider or self.default_provider
        
        # Check if provider is configured
        if not self.is_configured(provider):
            if provider == LLMProvider.OPENAI:
                return False, "OpenAI API key not configured"
            elif provider == LLMProvider.ANTHROPIC:
                return False, "Anthropic API key not configured"
        
        # For local provider, try to ping the endpoint
        if provider == LLMProvider.LOCAL:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    # Try Ollama tags endpoint first
                    try:
                        response = await client.get(f"{self.local_api_base}/api/tags")
                        if response.status_code == 200:
                            data = response.json()
                            models = data.get('models', [])
                            if models:
                                return True, f"Local LLM available with {len(models)} model(s)"
                            else:
                                return False, "No models found in Ollama. Pull a model first (e.g., ollama pull mistral)"
                    except httpx.HTTPError:
                        # Try OpenAI-compatible endpoint
                        response = await client.get(f"{self.local_api_base}/v1/models")
                        if response.status_code == 200:
                            return True, "Local LLM (OpenAI-compatible) available"
                        else:
                            return False, f"Local LLM endpoint not responding (HTTP {response.status_code})"
            except Exception as e:
                return False, f"Cannot connect to local LLM at {self.local_api_base}: {str(e)}"
        
        # For cloud providers, assume they're available if API key is set
        # (We don't want to make actual API calls on every check)
        return True, f"{provider.value.title()} configured and available"
