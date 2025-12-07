"""
Service for loading and querying MITRE ATT&CK framework data
"""
import json
import httpx
from typing import List, Dict, Optional
from app import db
from app.models.mitre import MitreTactic, MitreTechnique


class MitreService:
    """Service for managing MITRE ATT&CK framework data"""
    
    # MITRE ATT&CK STIX data URL
    ATTACK_STIX_URL = "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json"
    
    @staticmethod
    async def load_attack_data(force_refresh: bool = False) -> Dict[str, int]:
        """
        Load MITRE ATT&CK data from official STIX repository
        
        Args:
            force_refresh: If True, reload even if data exists
            
        Returns:
            Dict with counts of loaded tactics and techniques
        """
        # Check if data already exists
        if not force_refresh:
            existing_tactics = MitreTactic.query.count()
            if existing_tactics > 0:
                return {
                    'tactics': existing_tactics,
                    'techniques': MitreTechnique.query.count(),
                    'status': 'already_loaded'
                }
        
        # Fetch STIX data
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(MitreService.ATTACK_STIX_URL)
            response.raise_for_status()
            stix_data = response.json()
        
        tactics_count = 0
        techniques_count = 0
        
        # Parse tactics
        tactics_map = {}
        for obj in stix_data.get('objects', []):
            if obj.get('type') == 'x-mitre-tactic':
                tactic_id = obj['external_references'][0]['external_id']
                tactic = MitreTactic.query.get(tactic_id)
                
                if not tactic:
                    tactic = MitreTactic(id=tactic_id)
                
                tactic.name = obj.get('name')
                tactic.description = obj.get('description')
                tactic.url = obj['external_references'][0].get('url')
                
                db.session.merge(tactic)
                tactics_map[obj['id']] = tactic_id
                tactics_count += 1
        
        db.session.commit()
        
        # Parse techniques and sub-techniques
        # Collect all techniques first, then separate parent techniques from sub-techniques
        parent_techniques = []
        sub_techniques = []
        
        for obj in stix_data.get('objects', []):
            if obj.get('type') == 'attack-pattern':
                # Get technique ID
                tech_id = None
                for ref in obj.get('external_references', []):
                    if ref.get('source_name') == 'mitre-attack':
                        tech_id = ref.get('external_id')
                        break
                
                if not tech_id:
                    continue
                
                # Check if it's a sub-technique (contains a dot)
                is_subtechnique = '.' in tech_id
                
                if is_subtechnique:
                    sub_techniques.append((tech_id, obj))
                else:
                    parent_techniques.append((tech_id, obj))
        
        # Process parent techniques first
        for tech_id, obj in parent_techniques:
            # Get associated tactic
            tactic_id = None
            kill_chain_phases = obj.get('kill_chain_phases', [])
            for phase in kill_chain_phases:
                if phase.get('kill_chain_name') == 'mitre-attack':
                    phase_name = phase.get('phase_name')
                    # Find tactic by phase name
                    for stix_id, tid in tactics_map.items():
                        tactic = MitreTactic.query.get(tid)
                        if tactic and tactic.name.lower().replace(' ', '-') == phase_name:
                            tactic_id = tid
                            break
                    if tactic_id:
                        break
            
            # Create or update technique
            technique = MitreTechnique.query.get(tech_id)
            if not technique:
                technique = MitreTechnique(id=tech_id)
            
            technique.tactic_id = tactic_id
            technique.name = obj.get('name')
            technique.description = obj.get('description')
            technique.is_subtechnique = False
            technique.parent_technique_id = None
            
            # Extract platforms and data sources
            technique.platforms = obj.get('x_mitre_platforms', [])
            technique.data_sources = obj.get('x_mitre_data_sources', [])
            
            # Get URL
            for ref in obj.get('external_references', []):
                if ref.get('source_name') == 'mitre-attack':
                    technique.url = ref.get('url')
                    break
            
            # Extract detection info
            technique.detection = obj.get('x_mitre_detection')
            
            db.session.merge(technique)
            techniques_count += 1
        
        # Commit parent techniques
        db.session.commit()
        
        # Now process sub-techniques
        for tech_id, obj in sub_techniques:
            parent_id = tech_id.split('.')[0]
            
            # Get associated tactic
            tactic_id = None
            kill_chain_phases = obj.get('kill_chain_phases', [])
            for phase in kill_chain_phases:
                if phase.get('kill_chain_name') == 'mitre-attack':
                    phase_name = phase.get('phase_name')
                    # Find tactic by phase name
                    for stix_id, tid in tactics_map.items():
                        tactic = MitreTactic.query.get(tid)
                        if tactic and tactic.name.lower().replace(' ', '-') == phase_name:
                            tactic_id = tid
                            break
                    if tactic_id:
                        break
            
            # Create or update sub-technique
            technique = MitreTechnique.query.get(tech_id)
            if not technique:
                technique = MitreTechnique(id=tech_id)
            
            technique.tactic_id = tactic_id
            technique.name = obj.get('name')
            technique.description = obj.get('description')
            technique.is_subtechnique = True
            technique.parent_technique_id = parent_id
            
            # Extract platforms and data sources
            technique.platforms = obj.get('x_mitre_platforms', [])
            technique.data_sources = obj.get('x_mitre_data_sources', [])
            
            # Get URL
            for ref in obj.get('external_references', []):
                if ref.get('source_name') == 'mitre-attack':
                    technique.url = ref.get('url')
                    break
            
            # Extract detection info
            technique.detection = obj.get('x_mitre_detection')
            
            db.session.merge(technique)
            techniques_count += 1
        
        db.session.commit()
        
        return {
            'tactics': tactics_count,
            'techniques': techniques_count,
            'status': 'loaded'
        }
    
    @staticmethod
    def get_all_tactics() -> List[MitreTactic]:
        """Get all MITRE ATT&CK tactics"""
        return MitreTactic.query.order_by(MitreTactic.id).all()
    
    @staticmethod
    def get_tactic(tactic_id: str) -> Optional[MitreTactic]:
        """Get a specific tactic by ID"""
        return MitreTactic.query.get(tactic_id)
    
    @staticmethod
    def get_techniques_by_tactic(tactic_id: str, include_subtechniques: bool = True) -> List[MitreTechnique]:
        """Get all techniques for a specific tactic"""
        query = MitreTechnique.query.filter_by(tactic_id=tactic_id)
        
        if not include_subtechniques:
            query = query.filter_by(is_subtechnique=False)
        
        return query.order_by(MitreTechnique.id).all()
    
    @staticmethod
    def get_technique(technique_id: str) -> Optional[MitreTechnique]:
        """Get a specific technique by ID"""
        return MitreTechnique.query.get(technique_id)
    
    @staticmethod
    def search_techniques(query: str, limit: int = 20) -> List[MitreTechnique]:
        """
        Search techniques by name or description
        
        Args:
            query: Search query string
            limit: Maximum number of results
            
        Returns:
            List of matching techniques
        """
        search_pattern = f"%{query}%"
        return MitreTechnique.query.filter(
            db.or_(
                MitreTechnique.name.ilike(search_pattern),
                MitreTechnique.description.ilike(search_pattern)
            )
        ).limit(limit).all()
    
    @staticmethod
    def get_technique_by_name(name: str) -> Optional[MitreTechnique]:
        """Get a technique by exact name match"""
        return MitreTechnique.query.filter(
            MitreTechnique.name.ilike(name)
        ).first()
    
    @staticmethod
    def get_subtechniques(parent_technique_id: str) -> List[MitreTechnique]:
        """Get all sub-techniques for a parent technique"""
        return MitreTechnique.query.filter_by(
            parent_technique_id=parent_technique_id,
            is_subtechnique=True
        ).order_by(MitreTechnique.id).all()
    
    @staticmethod
    def get_techniques_by_platform(platform: str) -> List[MitreTechnique]:
        """Get techniques applicable to a specific platform"""
        return MitreTechnique.query.filter(
            MitreTechnique.platforms.contains([platform])
        ).all()
    
    @staticmethod
    def get_techniques_by_data_source(data_source: str) -> List[MitreTechnique]:
        """Get techniques detectable via a specific data source"""
        return MitreTechnique.query.filter(
            MitreTechnique.data_sources.contains([data_source])
        ).all()
    
    @staticmethod
    def get_framework_stats() -> Dict[str, int]:
        """Get statistics about loaded ATT&CK framework data"""
        return {
            'total_tactics': MitreTactic.query.count(),
            'total_techniques': MitreTechnique.query.filter_by(is_subtechnique=False).count(),
            'total_subtechniques': MitreTechnique.query.filter_by(is_subtechnique=True).count(),
            'techniques_with_detection': MitreTechnique.query.filter(
                MitreTechnique.detection.isnot(None)
            ).count()
        }
