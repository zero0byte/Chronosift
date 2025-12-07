"""Service for extracting IOCs (Indicators of Compromise) from text."""
import re
import ipaddress
from typing import List, Dict, Set, Tuple


class IOCExtractor:
    """Extract IOCs from text using regex patterns."""
    
    # Regex patterns for different IOC types
    PATTERNS = {
        'ipv4': r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b',
        'ipv6': r'\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b',
        'domain': r'\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b',
        'url': r'https?://[^\s<>"{}|\\^`\[\]]+',
        'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        'md5': r'\b[a-fA-F0-9]{32}\b',
        'sha1': r'\b[a-fA-F0-9]{40}\b',
        'sha256': r'\b[a-fA-F0-9]{64}\b',
        'cve': r'\bCVE-\d{4}-\d{4,7}\b',
    }
    
    # Private/reserved IP ranges to exclude
    PRIVATE_IP_RANGES = [
        ipaddress.ip_network('10.0.0.0/8'),
        ipaddress.ip_network('172.16.0.0/12'),
        ipaddress.ip_network('192.168.0.0/16'),
        ipaddress.ip_network('127.0.0.0/8'),
        ipaddress.ip_network('169.254.0.0/16'),
    ]
    
    # Common non-domain patterns to exclude
    DOMAIN_BLACKLIST = {
        'localhost', 'example.com', 'example.org', 'test.com',
        'local', 'localdomain', 'internal'
    }
    
    @classmethod
    def extract_from_text(cls, text: str, ioc_types: List[str] = None) -> Dict[str, Set[str]]:
        """
        Extract IOCs from text.
        
        Args:
            text: Text to extract IOCs from
            ioc_types: List of IOC types to extract (None = all types)
            
        Returns:
            Dictionary mapping IOC type to set of values
        """
        if not text:
            return {}
        
        if ioc_types is None:
            ioc_types = cls.PATTERNS.keys()
        
        results = {}
        
        for ioc_type in ioc_types:
            if ioc_type not in cls.PATTERNS:
                continue
            
            pattern = cls.PATTERNS[ioc_type]
            matches = set(re.findall(pattern, text, re.IGNORECASE))
            
            # Filter and validate matches
            if ioc_type == 'ipv4':
                matches = cls._filter_ipv4(matches)
            elif ioc_type == 'domain':
                matches = cls._filter_domains(matches, text)
            elif ioc_type == 'email':
                matches = {m.lower() for m in matches}
            
            if matches:
                results[ioc_type] = matches
        
        return results
    
    @classmethod
    def _filter_ipv4(cls, ips: Set[str]) -> Set[str]:
        """Filter out private/reserved IPs."""
        filtered = set()
        for ip_str in ips:
            try:
                ip = ipaddress.ip_address(ip_str)
                # Check if it's not in private ranges
                if not any(ip in network for network in cls.PRIVATE_IP_RANGES):
                    filtered.add(ip_str)
            except ValueError:
                pass
        return filtered
    
    @classmethod
    def _filter_domains(cls, domains: Set[str], original_text: str) -> Set[str]:
        """Filter out false positives from domain extraction."""
        filtered = set()
        for domain in domains:
            domain_lower = domain.lower()
            
            # Skip blacklisted domains
            if domain_lower in cls.DOMAIN_BLACKLIST:
                continue
            
            # Skip if it looks like a filename (has common extensions)
            if any(domain_lower.endswith(ext) for ext in ['.exe', '.dll', '.sys', '.log', '.txt', '.csv']):
                continue
            
            # Skip if it's part of an email (already extracted separately)
            if f'@{domain}' in original_text:
                continue
            
            # Must have at least one dot and valid TLD
            parts = domain_lower.split('.')
            if len(parts) >= 2 and len(parts[-1]) >= 2:
                filtered.add(domain_lower)
        
        return filtered
    
    @classmethod
    def extract_from_entry(cls, entry_data: dict) -> Dict[str, Set[str]]:
        """
        Extract IOCs from a timeline entry's data.
        
        Args:
            entry_data: Dictionary containing entry fields
            
        Returns:
            Dictionary mapping IOC type to set of values
        """
        # Collect all text from the entry
        text_parts = []
        
        # Common fields that might contain IOCs
        text_fields = [
            'Description', 'Message', 'CommandLine', 'FullPath',
            'TargetName', 'URL', 'Domain', 'IPAddress', 'Hash',
            'MD5', 'SHA1', 'SHA256', 'Email', 'User', 'Process',
            'FileName', 'FilePath', 'Network', 'Source', 'Destination'
        ]
        
        for field in text_fields:
            if field in entry_data and entry_data[field]:
                text_parts.append(str(entry_data[field]))
        
        # Also check any other string values
        for key, value in entry_data.items():
            if isinstance(value, str) and key not in text_fields and value:
                text_parts.append(value)
        
        combined_text = ' '.join(text_parts)
        return cls.extract_from_text(combined_text)
    
    @classmethod
    def categorize_hash(cls, hash_value: str) -> str:
        """Determine hash type based on length."""
        hash_len = len(hash_value)
        if hash_len == 32:
            return 'md5'
        elif hash_len == 40:
            return 'sha1'
        elif hash_len == 64:
            return 'sha256'
        return 'hash'
    
    @classmethod
    def extract_and_categorize(cls, text: str) -> List[Tuple[str, str]]:
        """
        Extract IOCs and return as list of (type, value) tuples.
        
        Args:
            text: Text to extract from
            
        Returns:
            List of (ioc_type, value) tuples
        """
        results = []
        iocs = cls.extract_from_text(text)
        
        for ioc_type, values in iocs.items():
            for value in values:
                results.append((ioc_type, value))
        
        return results
