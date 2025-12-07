"""
Timeline analysis service using LLM for event prioritization,
MITRE ATT&CK mapping, and attack chain detection
"""
import json
import re
from typing import List, Dict, Optional, Tuple, Any
from sqlalchemy.orm.attributes import flag_modified
from app import db
from app.models.timeline import Timeline, TimelineEntry, ColumnDefinition
from app.models.mitre import TimelineAnalysisResult, MitreTactic, MitreTechnique
from app.models.attack_chain import AttackChain, AttackChainNode, AttackChainEdge
from app.models.key_timestamp import KeyTimestamp
from app.models.analysis_prompt import AnalysisPrompt
from app.services.llm_service import LLMService, LLMProvider
from app.services.mitre_service import MitreService
from datetime import datetime
from dateutil import parser as date_parser


class TimelineAnalysisService:
    """Service for LLM-powered timeline analysis"""
    
    def __init__(self):
        self.llm_service = LLMService()
        self.mitre_service = MitreService()
    
    def _ensure_analysis_columns(self, timeline_id: int):
        """Ensure Priority, LLM Analysis, and MITRE ATT&CK columns exist"""
        timeline = Timeline.query.get(timeline_id)
        if not timeline:
            return
        
        existing_columns = {col.name for col in timeline.columns}
        max_order = max([col.order for col in timeline.columns], default=-1)
        
        columns_to_add = []
        
        # Priority column
        if 'Priority' not in existing_columns:
            columns_to_add.append(ColumnDefinition(
                timeline_id=timeline_id,
                name='Priority',
                column_type='text',
                order=max_order + 1,
                is_required=False,
                is_searchable=True,
                config={}
            ))
            max_order += 1
            print(f"[INFO] Adding 'Priority' column to timeline {timeline_id}")
        
        # LLM Analysis column
        if 'LLM Analysis' not in existing_columns:
            columns_to_add.append(ColumnDefinition(
                timeline_id=timeline_id,
                name='LLM Analysis',
                column_type='text',
                order=max_order + 1,
                is_required=False,
                is_searchable=True,
                config={}
            ))
            max_order += 1
            print(f"[INFO] Adding 'LLM Analysis' column to timeline {timeline_id}")
        
        # MITRE ATT&CK column
        if 'MITRE ATT&CK' not in existing_columns:
            columns_to_add.append(ColumnDefinition(
                timeline_id=timeline_id,
                name='MITRE ATT&CK',
                column_type='mitre_tactics',
                order=max_order + 1,
                is_required=False,
                is_searchable=True,
                config={}
            ))
            print(f"[INFO] Adding 'MITRE ATT&CK' column to timeline {timeline_id}")
        
        if columns_to_add:
            for col in columns_to_add:
                db.session.add(col)
            db.session.commit()
            print(f"[SUCCESS] Added {len(columns_to_add)} column(s) to timeline {timeline_id}")
    
    async def analyze_entry_priority(
        self,
        entry: TimelineEntry,
        context: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> TimelineAnalysisResult:
        """
        Analyze a timeline entry to determine its priority/relevance score
        
        Args:
            entry: Timeline entry to analyze
            context: Optional additional context about the investigation
            user_id: ID of user requesting analysis
            
        Returns:
            TimelineAnalysisResult with priority score
        """
        # Ensure analysis columns exist
        self._ensure_analysis_columns(entry.timeline_id)
        
        # Build prompt for LLM
        prompt = self._build_prioritization_prompt(entry, context)
        
        messages = [
            {"role": "system", "content": self._get_system_prompt_priority()},
            {"role": "user", "content": prompt}
        ]
        
        # Get LLM response with JSON format
        response, metadata = await self.llm_service.chat_completion(
            messages=messages,
            temperature=0.3,  # Lower temperature for more consistent scoring
            response_format={"type": "json_object"}  # Enable JSON mode for all providers
        )
        
        # Parse response
        result_data = None
        try:
            result_data = json.loads(response)
        except json.JSONDecodeError as e:
            # Try to extract JSON from markdown code blocks
            json_match = re.search(r'```(?:json)?\s*\n?(.*)```', response, re.DOTALL)
            if json_match:
                try:
                    result_data = json.loads(json_match.group(1).strip())
                except json.JSONDecodeError:
                    pass
            
            # If that didn't work, try to find the first complete JSON object
            if result_data is None:
                # Use JSONDecoder to parse just the first JSON object, ignoring trailing text
                decoder = json.JSONDecoder()
                try:
                    result_data, idx = decoder.raw_decode(response.lstrip())
                except json.JSONDecodeError:
                    # Last resort: extract using regex
                    json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response, re.DOTALL)
                    if json_match:
                        try:
                            result_data = json.loads(json_match.group())
                        except json.JSONDecodeError:
                            pass
            
            if result_data is None:
                print(f"[ERROR] Failed to parse LLM response (priority). Raw response:\n{response[:500]}...")
                raise ValueError(f"Could not parse LLM response as JSON. Response starts with: {response[:200]}")
        
        # Create analysis result
        analysis = TimelineAnalysisResult(
            timeline_id=entry.timeline_id,
            entry_id=entry.id,
            analysis_type='prioritization',
            priority_score=result_data.get('priority_score', 0.5),
            confidence_score=result_data.get('confidence_score', 0.5),
            explanation=result_data.get('explanation', ''),
            llm_provider=metadata['provider'],
            llm_model=metadata['model'],
            prompt_tokens=metadata.get('prompt_tokens', 0),
            completion_tokens=metadata.get('completion_tokens', 0),
            raw_response=result_data,
            analyzed_by=user_id
        )
        
        db.session.add(analysis)
        
        # Also store priority badge in the entry's data field for display
        priority_score = result_data.get('priority_score', 0.5)
        priority_label = 'Critical' if priority_score >= 0.8 else 'High' if priority_score >= 0.6 else 'Medium' if priority_score >= 0.4 else 'Low'
        
        entry.data['Priority'] = priority_label
        flag_modified(entry, 'data')  # Mark JSONB field as modified
        db.session.add(entry)
        
        db.session.commit()
        
        return analysis
    
    async def map_entry_to_attack(
        self,
        entry: TimelineEntry,
        context: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> TimelineAnalysisResult:
        """
        Map a timeline entry to MITRE ATT&CK tactics and techniques
        
        Args:
            entry: Timeline entry to analyze
            context: Optional additional context
            user_id: ID of user requesting analysis
            
        Returns:
            TimelineAnalysisResult with ATT&CK mapping
        """
        # Ensure analysis columns exist
        self._ensure_analysis_columns(entry.timeline_id)
        
        # Get available tactics and techniques for context
        tactics = self.mitre_service.get_all_tactics()
        tactics_context = "\n".join([f"- {t.id}: {t.name}" for t in tactics[:10]])
        
        # Build prompt
        prompt = self._build_attack_mapping_prompt(entry, context, tactics_context)
        
        messages = [
            {"role": "system", "content": self._get_system_prompt_attack()},
            {"role": "user", "content": prompt}
        ]
        
        # Get LLM response
        response, metadata = await self.llm_service.chat_completion(
            messages=messages,
            temperature=0.2,
            response_format={"type": "json_object"}  # Enable JSON mode for all providers
        )
        
        # Parse response
        result_data = None
        try:
            result_data = json.loads(response)
        except json.JSONDecodeError as e:
            # Try to extract JSON from markdown code blocks
            json_match = re.search(r'```(?:json)?\s*\n?(.*)```', response, re.DOTALL)
            if json_match:
                try:
                    result_data = json.loads(json_match.group(1).strip())
                except json.JSONDecodeError:
                    pass
            
            # If that didn't work, try to find the first complete JSON object
            if result_data is None:
                # Use JSONDecoder to parse just the first JSON object, ignoring trailing text
                decoder = json.JSONDecoder()
                try:
                    result_data, idx = decoder.raw_decode(response.lstrip())
                except json.JSONDecodeError:
                    # Last resort: extract using regex
                    json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response, re.DOTALL)
                    if json_match:
                        try:
                            result_data = json.loads(json_match.group())
                        except json.JSONDecodeError:
                            pass
            
            if result_data is None:
                print(f"[ERROR] Failed to parse LLM response (attack mapping). Raw response:\n{response[:500]}...")
                raise ValueError(f"Could not parse LLM response as JSON. Response starts with: {response[:200]}")
        
        # Validate and lookup technique with enhanced error handling
        technique_id = result_data.get('technique_id')
        technique = None
        
        # Validate technique_id format before lookup
        if technique_id:
            # Check if LLM mistakenly returned a tactic ID as technique_id
            if isinstance(technique_id, str) and technique_id.startswith('TA'):
                print(f"[WARNING] LLM returned tactic ID '{technique_id}' as technique_id. Explanation mentions: {result_data.get('explanation', '')}")
                # Try to extract technique ID from explanation
                explanation = result_data.get('explanation', '')
                tech_match = re.search(r'\b(T\d{4})(?:\.\d{3})?\b', explanation)
                if tech_match:
                    extracted_tech = tech_match.group(1)
                    print(f"[INFO] Extracted technique '{extracted_tech}' from explanation")
                    technique_id = extracted_tech
                else:
                    print(f"[WARNING] Could not extract valid technique from explanation, setting to null")
                    technique_id = None
            
            # Validate it's a proper technique ID format (T followed by 4 digits)
            if technique_id and not re.match(r'^T\d{4}$', technique_id):
                print(f"[WARNING] Invalid technique_id format: '{technique_id}'")
                technique_id = None
        
        if technique_id:
            technique = self.mitre_service.get_technique(technique_id)
            if not technique:
                print(f"[WARNING] Technique '{technique_id}' not found in database")
                # Try searching by name as fallback
                technique_name = result_data.get('technique_name')
                if technique_name:
                    technique = self.mitre_service.get_technique_by_name(technique_name)
                    if technique:
                        print(f"[INFO] Found technique by name: {technique.id}")
        
        # Get tactic with validation
        tactic_id = result_data.get('tactic_id')
        tactic = None
        if tactic_id:
            # Validate tactic_id format (TA followed by 4 digits)
            if not re.match(r'^TA\d{4}$', tactic_id):
                print(f"[WARNING] Invalid tactic_id format: '{tactic_id}'")
                tactic_id = None
            else:
                tactic = self.mitre_service.get_tactic(tactic_id)
                if not tactic:
                    print(f"[WARNING] Tactic '{tactic_id}' not found in database")
        
        # Create analysis result
        analysis = TimelineAnalysisResult(
            timeline_id=entry.timeline_id,
            entry_id=entry.id,
            analysis_type='attack_mapping',
            mitre_technique_id=technique.id if technique else None,
            mitre_tactic_id=tactic.id if tactic else None,
            confidence_score=result_data.get('confidence_score', 0.5),
            explanation=result_data.get('explanation', ''),
            llm_provider=metadata['provider'],
            llm_model=metadata['model'],
            prompt_tokens=metadata.get('prompt_tokens', 0),
            completion_tokens=metadata.get('completion_tokens', 0),
            raw_response=result_data,
            analyzed_by=user_id
        )
        
        db.session.add(analysis)
        
        # Also store MITRE data in the entry's data fields for display
        if technique:
            llm_analysis_text = f"{technique.id}: {technique.name}"
            if result_data.get('explanation'):
                llm_analysis_text += f" - {result_data.get('explanation')}"
            
            entry.data['LLM Analysis'] = llm_analysis_text
            flag_modified(entry, 'data')  # Mark JSONB field as modified
            db.session.add(entry)
        elif tactic:
            # If we have a tactic but no specific technique, still show the analysis
            llm_analysis_text = f"{tactic.id}: {tactic.name}"
            if result_data.get('explanation'):
                llm_analysis_text += f" - {result_data.get('explanation')}"
            
            entry.data['LLM Analysis'] = llm_analysis_text
            flag_modified(entry, 'data')  # Mark JSONB field as modified
            db.session.add(entry)
        
        # Populate MITRE ATT&CK column with tactic ID array
        if tactic:
            entry.data['MITRE ATT&CK'] = [tactic.id]
            flag_modified(entry, 'data')
            db.session.add(entry)
        
        db.session.commit()
        
        return analysis
    
    async def detect_attack_chains(
        self,
        timeline_id: int,
        context: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Analyze a timeline to detect potential attack chains
        
        Args:
            timeline_id: Timeline to analyze
            context: Optional investigation context
            user_id: ID of user requesting analysis
            
        Returns:
            List of detected attack chains with their events
        """
        timeline = Timeline.query.get(timeline_id)
        if not timeline:
            raise ValueError(f"Timeline {timeline_id} not found")
        
        # Get entries with existing ATT&CK mappings (or all entries if none mapped)
        entries_with_mapping = TimelineAnalysisResult.query.filter_by(
            timeline_id=timeline_id,
            analysis_type='attack_mapping'
        ).filter(
            TimelineAnalysisResult.mitre_technique_id.isnot(None)
        ).all()
        
        if not entries_with_mapping:
            return []
        
        # Build prompt with mapped entries
        prompt = self._build_chain_detection_prompt(timeline, entries_with_mapping, context)
        
        messages = [
            {"role": "system", "content": self._get_system_prompt_chains()},
            {"role": "user", "content": prompt}
        ]
        
        # Get LLM response
        response, metadata = await self.llm_service.chat_completion(
            messages=messages,
            temperature=0.4,
            max_tokens=16000,  # Increased further to avoid truncation
            response_format={"type": "json_object"}  # Enable JSON mode for all providers
        )
        
        # Parse response
        result_data = None
        try:
            result_data = json.loads(response)
        except json.JSONDecodeError as e:
            # Try to extract JSON from markdown code blocks
            json_match = re.search(r'```(?:json)?\s*\n?(.*)```', response, re.DOTALL)
            if json_match:
                try:
                    result_data = json.loads(json_match.group(1).strip())
                except json.JSONDecodeError:
                    pass
            
            # If that didn't work, try to find the first complete JSON object
            if result_data is None:
                # Use JSONDecoder to parse just the first JSON object, ignoring trailing text
                decoder = json.JSONDecoder()
                try:
                    result_data, idx = decoder.raw_decode(response.lstrip())
                except json.JSONDecodeError:
                    # Last resort: extract using regex
                    json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response, re.DOTALL)
                    if json_match:
                        try:
                            result_data = json.loads(json_match.group())
                        except json.JSONDecodeError:
                            pass
            
            if result_data is None:
                print(f"[ERROR] Failed to parse LLM response (chain detection). Raw response:\n{response[:500]}...")
                # Check if response looks like truncated JSON
                if response.strip().startswith('{') and not response.strip().endswith('}'):
                    print(f"[WARNING] Response appears truncated. Attempting to salvage partial data...")
                    # Try to close the JSON by adding closing brackets
                    try:
                        # Count unclosed braces and brackets
                        open_braces = response.count('{') - response.count('}')
                        open_brackets = response.count('[') - response.count(']')
                        completed = response.rstrip() + ']' * open_brackets + '}' * open_braces
                        result_data = json.loads(completed)
                        print(f"[INFO] Successfully salvaged truncated JSON with {open_braces} unclosed braces, {open_brackets} unclosed brackets")
                    except:
                        pass
                
                if result_data is None:
                    raise ValueError(f"Could not parse LLM response as JSON. Response starts with: {response[:200]}")
        
        # Validate response structure - handle both 'chains' and 'attack_chains' keys
        if 'chains' not in result_data and 'attack_chains' not in result_data:
            print(f"[WARNING] LLM response missing 'chains' key. Response keys: {list(result_data.keys())}")
            print(f"[WARNING] Full response: {json.dumps(result_data, indent=2)[:500]}")
            # If LLM returned wrong format, create empty chains response
            result_data = {
                'chains': [],
                'overall_confidence': 0.0,
                'summary': 'LLM returned unexpected response format'
            }
        
        # Extract chains - handle both 'chains' and 'attack_chains' keys
        detected_chains = result_data.get('chains') or result_data.get('attack_chains', [])
        print(f"[INFO] Detected {len(detected_chains)} attack chain(s) for timeline {timeline_id}")
        
        # Normalize chain data to expected format
        normalized_chains = []
        for chain in detected_chains:
            # Extract events - handle both array of IDs and array of objects
            # Also handle 'chain' key (some LLMs use this instead of 'events')
            events = chain.get('events') or chain.get('chain', [])
            if events and isinstance(events[0], dict):
                # If events are objects like {"event_id": 1}, extract just the IDs
                events = [e.get('event_id') or e.get('id') for e in events if isinstance(e, dict)]
            
            normalized = {
                'name': chain.get('name') or chain.get('tactic', 'Unknown Attack Chain'),
                'description': chain.get('description', ''),
                'confidence': chain.get('confidence', 0.7),  # Default to 0.7 instead of 0.5
                'severity': chain.get('severity', 'medium'),
                'events': events,
                'tactics_sequence': chain.get('tactics_sequence', []),
                'indicators': chain.get('indicators', [])
            }
            normalized_chains.append(normalized)
        
        detected_chains = normalized_chains
        
        # Store chain detection result
        analysis = TimelineAnalysisResult(
            timeline_id=timeline_id,
            analysis_type='chain_detection',
            confidence_score=result_data.get('overall_confidence', 0.5),
            explanation=result_data.get('summary', ''),
            llm_provider=metadata['provider'],
            llm_model=metadata['model'],
            prompt_tokens=metadata.get('prompt_tokens', 0),
            completion_tokens=metadata.get('completion_tokens', 0),
            raw_response=result_data,
            analyzed_by=user_id
        )
        
        db.session.add(analysis)
        db.session.commit()
        
        return detected_chains
    
    async def analyze_timeline_batch(
        self,
        timeline_id: int,
        analyze_priority: bool = True,
        analyze_attack: bool = True,
        detect_chains: bool = True,
        context: Optional[str] = None,
        user_id: Optional[int] = None,
        entry_limit: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Perform batch analysis on a timeline
        
        Args:
            timeline_id: Timeline to analyze
            analyze_priority: Whether to analyze event priorities
            analyze_attack: Whether to map events to ATT&CK
            detect_chains: Whether to detect attack chains
            context: Optional investigation context
            user_id: ID of user requesting analysis
            entry_limit: Maximum number of entries to analyze (for large timelines)
            
        Returns:
            Dict with analysis results and statistics
        """
        timeline = Timeline.query.get(timeline_id)
        if not timeline:
            raise ValueError(f"Timeline {timeline_id} not found")
        
        query = TimelineEntry.query.filter_by(timeline_id=timeline_id)
        if entry_limit:
            query = query.limit(entry_limit)
        
        entries = query.all()
        
        results = {
            'timeline_id': timeline_id,
            'total_entries': len(entries),
            'priority_analyses': 0,
            'attack_mappings': 0,
            'chains_detected': 0,
            'errors': []
        }
        
        # Analyze priorities
        if analyze_priority:
            for entry in entries:
                try:
                    await self.analyze_entry_priority(entry, context, user_id)
                    results['priority_analyses'] += 1
                except Exception as e:
                    results['errors'].append({
                        'entry_id': entry.id,
                        'error': str(e),
                        'type': 'priority'
                    })
        
        # Map to ATT&CK
        if analyze_attack:
            for entry in entries:
                try:
                    await self.map_entry_to_attack(entry, context, user_id)
                    results['attack_mappings'] += 1
                except Exception as e:
                    results['errors'].append({
                        'entry_id': entry.id,
                        'error': str(e),
                        'type': 'attack_mapping'
                    })
        
        # Detect chains
        if detect_chains:
            try:
                chains = await self.detect_attack_chains(timeline_id, context, user_id)
                results['chains_detected'] = len(chains)
                results['chains'] = chains
            except Exception as e:
                results['errors'].append({
                    'error': str(e),
                    'type': 'chain_detection'
                })
        
        return results
    
    async def create_attack_chain_from_detection(
        self,
        timeline_id: int,
        chain_data: Dict[str, Any],
        user_id: Optional[int] = None
    ) -> AttackChain:
        """
        Create AttackChain objects from LLM-detected chain data
        
        Args:
            timeline_id: Timeline the chain belongs to
            chain_data: Chain data from detect_attack_chains() containing:
                - name: Chain name
                - description: Chain description
                - events: List of entry IDs
                - severity: Chain severity (low/medium/high/critical)
                - confidence: Confidence score
            user_id: ID of user creating the chain
            
        Returns:
            Created AttackChain object with nodes and edges
        """
        timeline = Timeline.query.get(timeline_id)
        if not timeline:
            raise ValueError(f"Timeline {timeline_id} not found")
        
        # Create the attack chain
        chain = AttackChain(
            project_id=timeline.project_id,
            name=chain_data.get('name', 'LLM-Detected Attack Chain'),
            description=chain_data.get('description', ''),
            created_by=user_id
        )
        
        db.session.add(chain)
        db.session.flush()  # Get chain.id
        
        # Get the entries for this chain
        entry_ids = chain_data.get('events', [])
        if not entry_ids:
            raise ValueError("No events specified in chain data")
        
        entries = TimelineEntry.query.filter(
            TimelineEntry.id.in_(entry_ids)
        ).order_by(TimelineEntry.id).all()
        
        if not entries:
            raise ValueError("No valid entries found for chain")
        
        # Create nodes for each entry
        nodes = []
        node_map = {}  # entry_id -> node
        
        for idx, entry in enumerate(entries):
            # Get MITRE mapping for this entry if available
            analysis = TimelineAnalysisResult.query.filter_by(
                entry_id=entry.id,
                analysis_type='attack_mapping'
            ).first()
            
            # Get or create key timestamp for this entry
            key_timestamp = self._get_or_create_key_timestamp_for_entry(
                entry,
                timeline.project_id,
                user_id,
                analysis  # Pass analysis to use technique name in label
            )
            
            # Determine node severity - use per-node severity if available from chain data
            # Otherwise fall back to chain-level severity
            node_severity = chain_data.get('severity', 'medium')
            
            # Create descriptive notes
            notes_parts = [f"Auto-detected by LLM (confidence: {chain_data.get('confidence', 0.7)})"]
            if analysis and analysis.explanation:
                notes_parts.append(f"Mapping: {analysis.explanation}")
            notes = "\n".join(notes_parts)
            
            # Prepare MITRE fields
            mitre_tactic = analysis.mitre_tactic.name if analysis and analysis.mitre_tactic else None
            mitre_technique = f"{analysis.mitre_technique.id} - {analysis.mitre_technique.name}" if analysis and analysis.mitre_technique else None
            
            # Create the node
            node = AttackChainNode(
                chain_id=chain.id,
                key_timestamp_id=key_timestamp.id,
                order=idx,
                x_position=idx * 200,  # Spread horizontally
                y_position=100,  # Same row
                mitre_tactic=mitre_tactic,
                mitre_technique=mitre_technique,
                severity=node_severity,
                notes=notes
            )
            
            db.session.add(node)
            db.session.flush()  # Get node.id
            nodes.append(node)
            node_map[entry.id] = node
        
        # Create edges connecting sequential nodes
        for i in range(len(nodes) - 1):
            edge = AttackChainEdge(
                from_node_id=nodes[i].id,
                to_node_id=nodes[i + 1].id,
                relationship_type='leads_to',
                label='',
                confidence=chain_data.get('confidence', 'high') if isinstance(chain_data.get('confidence'), str) else ('high' if chain_data.get('confidence', 0.5) >= 0.7 else 'medium')
            )
            db.session.add(edge)
        
        db.session.commit()
        
        return chain
    
    def _get_or_create_key_timestamp_for_entry(
        self,
        entry: TimelineEntry,
        project_id: int,
        user_id: Optional[int],
        analysis: Optional[TimelineAnalysisResult] = None
    ) -> KeyTimestamp:
        """
        Get or create a KeyTimestamp for a timeline entry
        
        Tries to extract timestamp from entry data and create a descriptive label
        """
        # Try to extract timestamp from entry data
        timestamp = None
        timestamp_fields = ['Timestamp', 'timestamp', 'time', 'datetime', 'date']
        
        for field in timestamp_fields:
            if field in entry.data:
                try:
                    timestamp = date_parser.parse(str(entry.data[field]))
                    break
                except (ValueError, TypeError):
                    continue
        
        if not timestamp:
            timestamp = entry.created_at or datetime.utcnow()
        
        # Create descriptive label - prefer MITRE technique name if available
        label = None
        
        # First, try to use MITRE technique name for better context
        if analysis and analysis.mitre_technique:
            label = analysis.mitre_technique.name
        
        # Fall back to entry data fields
        if not label:
            label_fields = ['Event Name', 'event_name', 'Event ID', 'event_id', 'Type', 'type', 'Action', 'action']
            for field in label_fields:
                if field in entry.data and entry.data[field]:
                    label = str(entry.data[field])
                    break
        
        # Last resort fallback
        if not label:
            label = f"Entry {entry.id}"
        
        # Check if key timestamp already exists for this entry
        description = f"Auto-created from timeline entry {entry.id}"
        existing_kt = KeyTimestamp.query.filter_by(
            project_id=project_id,
            timestamp=timestamp,
            label=label
        ).first()
        
        if existing_kt:
            return existing_kt
        
        # Create new key timestamp
        key_timestamp = KeyTimestamp(
            project_id=project_id,
            timestamp=timestamp,
            label=label,
            description=description,
            color='#9333ea',  # Purple for LLM-created
            created_by=user_id
        )
        
        db.session.add(key_timestamp)
        db.session.flush()
        
        return key_timestamp
    
    # Prompt building methods
    
    def _get_system_prompt_priority(self) -> str:
        """Get priority analysis prompt from database, fallback to hardcoded"""
        try:
            prompt = AnalysisPrompt.get_active_prompt('priority')
            if prompt:
                return prompt.system_prompt
        except Exception as e:
            print(f"[WARNING] Failed to load priority prompt from database: {e}")
        
        # Fallback to hardcoded prompt
        return """You are a cybersecurity forensic analyst assistant. Your task is to analyze timeline events 
and assign priority scores based on their relevance and severity in a security investigation.

Priority scores should range from 0.0 to 1.0:
- 0.0-0.3: Low priority (routine events, unlikely to be related to security incident)
- 0.3-0.6: Medium priority (potentially relevant, warrants further review)
- 0.6-0.8: High priority (likely related to incident, suspicious activity)
- 0.8-1.0: Critical priority (clear indicators of compromise, immediate attention required)

CRITICAL: Your response must be ONLY valid JSON. Do not include ANY explanatory text, markdown formatting, or code blocks.
Respond with ONLY this JSON structure:
{
    "priority_score": 0.75,
    "confidence_score": 0.8,
    "explanation": "Brief explanation of why this event received this priority score"
}"""
    
    def _get_system_prompt_attack(self) -> str:
        """Get attack mapping prompt from database, fallback to hardcoded"""
        try:
            prompt = AnalysisPrompt.get_active_prompt('attack')
            if prompt:
                return prompt.system_prompt
        except Exception as e:
            print(f"[WARNING] Failed to load attack prompt from database: {e}")
        
        # Fallback to hardcoded prompt
        return """You are a MITRE ATT&CK framework expert assisting with threat classification. 
Your task is to analyze forensic timeline events and map them to the most appropriate MITRE ATT&CK tactics and techniques.

Consider:
- The specific actions described in the event
- Common adversary behaviors and TTPs
- The context of the event within the broader timeline

IMPORTANT FORMAT RULES:
1. technique_id MUST be a valid MITRE technique ID starting with "T" followed by 4 digits (e.g., "T1566", "T1078")
2. tactic_id MUST be a valid MITRE tactic ID starting with "TA" followed by 4 digits (e.g., "TA0001", "TA0006")
3. NEVER use a tactic_id (TA####) as a technique_id
4. NEVER make up technique IDs that don't exist
5. If uncertain about the exact technique, use null for technique_id

CRITICAL: Your response must be ONLY valid JSON. Do not include ANY explanatory text, markdown formatting, or code blocks.
Respond with ONLY this JSON structure:
{
    "technique_id": "T1566",
    "technique_name": "Phishing",
    "tactic_id": "TA0001",
    "tactic_name": "Initial Access",
    "confidence_score": 0.85,
    "explanation": "Brief explanation of why this ATT&CK mapping was chosen"
}

If no appropriate technique can be identified, set technique_id to null (not a tactic ID)."""
    
    def _get_system_prompt_chains(self) -> str:
        """Get chain detection prompt from database, fallback to hardcoded"""
        try:
            prompt = AnalysisPrompt.get_active_prompt('chains')
            if prompt:
                return prompt.system_prompt
        except Exception as e:
            print(f"[WARNING] Failed to load chains prompt from database: {e}")
        
        # Fallback to hardcoded prompt
        return """You are a threat hunting expert specialized in identifying attack chains and kill chains.
Your task is to analyze a collection of timeline events (already mapped to MITRE ATT&CK) and identify 
sequences of related events that form coherent attack chains.

An attack chain is a sequence of 2 or more events that:
1. Follow a logical progression (e.g., reconnaissance → initial access → execution → persistence)
2. Are temporally related (occurring in a reasonable timeframe)
3. Share common indicators or targets
4. Match known adversary TTPs

EXAMPLE - If you receive events like:
[{event_id: 1, technique: "Phishing"}, {event_id: 2, technique: "User Execution"}, {event_id: 3, technique: "Account Manipulation"}]

You might identify a chain:
{
  "chains": [{
    "name": "Phishing to Persistence",
    "description": "Attacker used phishing to gain initial access, executed malicious code, then established persistence",
    "confidence": 0.85,
    "severity": "high",
    "events": [1, 2, 3],
    "tactics_sequence": ["TA0001", "TA0002", "TA0003"],
    "indicators": ["Sequential progression through attack lifecycle"]
  }],
  "overall_confidence": 0.85,
  "summary": "Detected 1 attack chain showing initial access through persistence"
}

IMPORTANT: 
- Always provide a "confidence" score between 0.0 and 1.0 for each chain
- Use confidence > 0.7 for clear, well-supported chains
- Use confidence 0.5-0.7 for possible chains with some supporting evidence
- "events" must be an array of integer event IDs, like [1, 2, 3], NOT objects

If no chains are found, return: {"chains": [], "overall_confidence": 0.0, "summary": "No attack chains detected"}

CRITICAL: Your response must be ONLY valid JSON. Do not include ANY explanatory text before or after the JSON.
Do not use markdown code blocks. Do not add commentary. Output ONLY the raw JSON object.
Your entire response must match this exact structure:
{
    "chains": [
        {
            "name": "string",
            "description": "string",
            "confidence": 0.0-1.0,
            "severity": "low|medium|high|critical",
            "events": [integer array of event_ids],
            "tactics_sequence": ["TA0001", "TA0002"],
            "indicators": ["string array"]
        }
    ],
    "overall_confidence": 0.0-1.0,
    "summary": "string"
}"""
    
    def _build_prioritization_prompt(self, entry: TimelineEntry, context: Optional[str]) -> str:
        """Build prompt for priority analysis"""
        entry_data = entry.data or {}
        
        prompt = f"""Analyze this timeline event and assign a priority score:

Event Data:
{json.dumps(entry_data, indent=2)}

Event ID: {entry.id}
Timeline: {entry.timeline_id}
"""
        
        if context:
            prompt += f"\nInvestigation Context:\n{context}\n"
        
        prompt += "\nProvide your analysis in JSON format."
        
        return prompt
    
    def _build_attack_mapping_prompt(
        self,
        entry: TimelineEntry,
        context: Optional[str],
        tactics_context: str
    ) -> str:
        """Build prompt for ATT&CK mapping"""
        entry_data = entry.data or {}
        
        prompt = f"""Map this timeline event to the most appropriate MITRE ATT&CK technique:

Event Data:
{json.dumps(entry_data, indent=2)}

Event ID: {entry.id}

Available MITRE ATT&CK Tactics:
{tactics_context}

Key reminders:
- Technique IDs start with "T" followed by 4 digits (e.g., T1566, T1078, T1021)
- Tactic IDs start with "TA" followed by 4 digits (e.g., TA0001, TA0006, TA0008)
- NEVER confuse tactic IDs with technique IDs
- Common techniques: T1566 (Phishing), T1078 (Valid Accounts), T1021 (Remote Services), T1059 (Command and Scripting Interpreter)
"""
        
        if context:
            prompt += f"\nInvestigation Context:\n{context}\n"
        
        prompt += "\nProvide your ATT&CK mapping in the required JSON format."
        
        return prompt
    
    def _build_chain_detection_prompt(
        self,
        timeline: Timeline,
        entries_with_mapping: List[TimelineAnalysisResult],
        context: Optional[str]
    ) -> str:
        """Build prompt for attack chain detection"""
        events_summary = []
        
        for analysis in entries_with_mapping[:50]:  # Limit to avoid token limits
            entry = analysis.entry
            if entry and analysis.mitre_technique:
                # Extract only essential fields from event data to reduce token count
                essential_data = {}
                if entry.data:
                    # Include timestamp and description if available
                    for key in ['Timestamp', 'Description', 'timestamp', 'description', 'message']:
                        if key in entry.data:
                            essential_data[key] = entry.data[key]
                            break  # Only take first match
                
                events_summary.append({
                    'event_id': entry.id,
                    'technique_id': analysis.mitre_technique_id,
                    'technique_name': analysis.mitre_technique.name,
                    'tactic_id': analysis.mitre_tactic_id,
                    'description': essential_data.get('Description') or essential_data.get('description') or essential_data.get('message', '')[:200]  # Truncate long descriptions
                })
        
        prompt = f"""You are analyzing a timeline with {len(events_summary)} events that have been mapped to MITRE ATT&CK techniques.

Your task: Identify sequences of related events that form attack chains. Look across ALL {len(events_summary)} events below.

Timeline: "{timeline.name}"

Mapped Events (Total: {len(events_summary)}):
{json.dumps(events_summary, indent=2, default=str)}
"""
        
        if context:
            prompt += f"\nInvestigation Context:\n{context}\n"
        
        prompt += f"""\n\nAnalyze ALL {len(events_summary)} events above and identify attack chains.

IMPORTANT: 
- Look for patterns ACROSS MULTIPLE events
- Group related events into chains based on tactics progression, timing, and common indicators
- If you find chains, include them in the "chains" array
- If you don't find clear chains, return an empty "chains" array: []
- Respond with ONLY the JSON object matching the expected structure
"""
        
        return prompt
