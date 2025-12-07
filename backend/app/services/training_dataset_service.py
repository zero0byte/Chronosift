"""
Service for building and managing training datasets from analyzed timelines
"""
import json
import os
from datetime import datetime
from typing import List, Dict, Optional, Any
from pathlib import Path
from app import db
from app.models.timeline import Timeline, TimelineEntry
from app.models.mitre import (
    TrainingDataset, TrainingExample, TimelineAnalysisResult,
    MitreTechnique, MitreTactic
)


class TrainingDatasetService:
    """Service for creating and managing training datasets"""
    
    def __init__(self):
        self.datasets_dir = os.getenv('TRAINING_DATASETS_DIR', 'training_datasets')
        Path(self.datasets_dir).mkdir(parents=True, exist_ok=True)
    
    def create_dataset(
        self,
        name: str,
        description: str,
        timeline_ids: List[int],
        user_id: int,
        version: Optional[str] = None,
        dataset_format: str = 'jsonl'
    ) -> TrainingDataset:
        """
        Create a new training dataset from analyzed timelines
        
        Args:
            name: Dataset name
            description: Dataset description
            timeline_ids: List of timeline IDs to include
            user_id: User creating the dataset
            version: Optional version string
            dataset_format: Format (jsonl, csv, parquet)
            
        Returns:
            Created TrainingDataset
        """
        version = version or datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        
        dataset = TrainingDataset(
            name=name,
            description=description,
            version=version,
            source_timelines=timeline_ids,
            dataset_format=dataset_format,
            created_by=user_id
        )
        
        db.session.add(dataset)
        db.session.commit()
        
        return dataset
    
    def add_example_from_analysis(
        self,
        dataset_id: int,
        analysis: TimelineAnalysisResult,
        is_validated: bool = False,
        validated_by: Optional[int] = None,
        validation_notes: Optional[str] = None
    ) -> TrainingExample:
        """
        Add a training example from an analysis result
        
        Args:
            dataset_id: Target dataset
            analysis: Analysis result to convert to training example
            is_validated: Whether this example has been validated
            validated_by: User who validated (if validated)
            validation_notes: Notes about validation
            
        Returns:
            Created TrainingExample
        """
        entry = analysis.entry
        if not entry:
            raise ValueError("Analysis must have an associated entry")
        
        # Build input text from entry data
        input_text = self._format_entry_as_input(entry)
        
        # Build output text based on analysis type
        if analysis.analysis_type == 'prioritization':
            output_text = self._format_priority_output(analysis)
        elif analysis.analysis_type == 'attack_mapping':
            output_text = self._format_attack_mapping_output(analysis)
        else:
            output_text = json.dumps({
                'analysis_type': analysis.analysis_type,
                'confidence': analysis.confidence_score,
                'explanation': analysis.explanation
            })
        
        example = TrainingExample(
            dataset_id=dataset_id,
            timeline_id=analysis.timeline_id,
            entry_id=analysis.entry_id,
            input_text=input_text,
            output_text=output_text,
            mitre_technique_id=analysis.mitre_technique_id,
            mitre_tactic_id=analysis.mitre_tactic_id,
            priority_score=analysis.priority_score,
            confidence_score=analysis.confidence_score,
            is_validated=is_validated,
            validated_by=validated_by,
            validation_notes=validation_notes
        )
        
        db.session.add(example)
        
        # Update dataset stats
        dataset = TrainingDataset.query.get(dataset_id)
        dataset.total_examples = TrainingExample.query.filter_by(dataset_id=dataset_id).count() + 1
        if is_validated:
            dataset.validated_examples = TrainingExample.query.filter_by(
                dataset_id=dataset_id,
                is_validated=True
            ).count() + 1
        
        db.session.commit()
        
        return example
    
    def build_dataset_from_timelines(
        self,
        dataset_id: int,
        timeline_ids: List[int],
        include_priorities: bool = True,
        include_attack_mappings: bool = True,
        only_validated: bool = False,
        min_confidence: float = 0.5
    ) -> Dict[str, int]:
        """
        Build a dataset by importing analyses from specified timelines
        
        Args:
            dataset_id: Target dataset
            timeline_ids: Timelines to import from
            include_priorities: Include priority analyses
            include_attack_mappings: Include ATT&CK mappings
            only_validated: Only include manually validated results
            min_confidence: Minimum confidence score threshold
            
        Returns:
            Dict with counts of added examples
        """
        stats = {
            'priority_examples': 0,
            'attack_mapping_examples': 0,
            'skipped': 0
        }
        
        for timeline_id in timeline_ids:
            # Get priority analyses
            if include_priorities:
                priority_analyses = TimelineAnalysisResult.query.filter_by(
                    timeline_id=timeline_id,
                    analysis_type='prioritization'
                ).filter(
                    TimelineAnalysisResult.confidence_score >= min_confidence
                ).all()
                
                for analysis in priority_analyses:
                    try:
                        self.add_example_from_analysis(dataset_id, analysis)
                        stats['priority_examples'] += 1
                    except Exception:
                        stats['skipped'] += 1
            
            # Get ATT&CK mappings
            if include_attack_mappings:
                mapping_analyses = TimelineAnalysisResult.query.filter_by(
                    timeline_id=timeline_id,
                    analysis_type='attack_mapping'
                ).filter(
                    TimelineAnalysisResult.confidence_score >= min_confidence,
                    TimelineAnalysisResult.mitre_technique_id.isnot(None)
                ).all()
                
                for analysis in mapping_analyses:
                    try:
                        self.add_example_from_analysis(dataset_id, analysis)
                        stats['attack_mapping_examples'] += 1
                    except Exception:
                        stats['skipped'] += 1
        
        # Update dataset stats
        dataset = TrainingDataset.query.get(dataset_id)
        all_examples = TrainingExample.query.filter_by(dataset_id=dataset_id).all()
        
        dataset.total_examples = len(all_examples)
        dataset.validated_examples = sum(1 for e in all_examples if e.is_validated)
        
        if all_examples:
            avg_conf = sum(e.confidence_score for e in all_examples if e.confidence_score) / len(all_examples)
            dataset.avg_confidence_score = avg_conf
        
        db.session.commit()
        
        return stats
    
    def export_dataset(
        self,
        dataset_id: int,
        export_format: Optional[str] = None
    ) -> str:
        """
        Export dataset to file
        
        Args:
            dataset_id: Dataset to export
            export_format: Format to export (uses dataset default if None)
            
        Returns:
            Path to exported file
        """
        dataset = TrainingDataset.query.get(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        export_format = export_format or dataset.dataset_format
        examples = dataset.examples.all()
        
        if not examples:
            raise ValueError("Dataset has no examples to export")
        
        # Generate filename
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f"{dataset.name}_{dataset.version}_{timestamp}.{export_format}"
        file_path = os.path.join(self.datasets_dir, filename)
        
        if export_format == 'jsonl':
            self._export_jsonl(examples, file_path)
        elif export_format == 'csv':
            self._export_csv(examples, file_path)
        else:
            raise ValueError(f"Unsupported export format: {export_format}")
        
        # Update dataset file path
        dataset.file_path = file_path
        db.session.commit()
        
        return file_path
    
    def export_for_openai_finetuning(
        self,
        dataset_id: int,
        system_prompt: Optional[str] = None
    ) -> str:
        """
        Export dataset in OpenAI fine-tuning format (JSONL)
        
        Args:
            dataset_id: Dataset to export
            system_prompt: System prompt to use (optional)
            
        Returns:
            Path to exported file
        """
        dataset = TrainingDataset.query.get(dataset_id)
        if not dataset:
            raise ValueError(f"Dataset {dataset_id} not found")
        
        examples = dataset.examples.all()
        
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f"{dataset.name}_openai_{timestamp}.jsonl"
        file_path = os.path.join(self.datasets_dir, filename)
        
        default_system = "You are an expert cybersecurity analyst specializing in forensic timeline analysis and MITRE ATT&CK framework."
        system_prompt = system_prompt or default_system
        
        with open(file_path, 'w', encoding='utf-8') as f:
            for example in examples:
                training_obj = {
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": example.input_text},
                        {"role": "assistant", "content": example.output_text}
                    ]
                }
                f.write(json.dumps(training_obj) + '\n')
        
        return file_path
    
    def validate_example(
        self,
        example_id: int,
        is_valid: bool,
        validated_by: int,
        notes: Optional[str] = None,
        corrected_technique_id: Optional[str] = None,
        corrected_priority: Optional[float] = None
    ) -> TrainingExample:
        """
        Manually validate or correct a training example
        
        Args:
            example_id: Example to validate
            is_valid: Whether the example is valid
            validated_by: User performing validation
            notes: Validation notes
            corrected_technique_id: Corrected MITRE technique (if applicable)
            corrected_priority: Corrected priority score (if applicable)
            
        Returns:
            Updated TrainingExample
        """
        example = TrainingExample.query.get(example_id)
        if not example:
            raise ValueError(f"Example {example_id} not found")
        
        example.is_validated = is_valid
        example.validated_by = validated_by
        example.validation_notes = notes
        
        if corrected_technique_id:
            example.mitre_technique_id = corrected_technique_id
            # Rebuild output text with correction
            example.output_text = self._rebuild_output_with_correction(
                example, corrected_technique_id, corrected_priority
            )
        
        if corrected_priority is not None:
            example.priority_score = corrected_priority
        
        # Update dataset stats
        dataset = example.dataset
        dataset.validated_examples = TrainingExample.query.filter_by(
            dataset_id=dataset.id,
            is_validated=True
        ).count()
        
        db.session.commit()
        
        return example
    
    # Helper methods for formatting
    
    def _format_entry_as_input(self, entry: TimelineEntry) -> str:
        """Format a timeline entry as input text"""
        data = entry.data or {}
        return json.dumps({
            'event_id': entry.id,
            'timeline_id': entry.timeline_id,
            'data': data
        }, indent=2)
    
    def _format_priority_output(self, analysis: TimelineAnalysisResult) -> str:
        """Format priority analysis as output text"""
        return json.dumps({
            'priority_score': analysis.priority_score,
            'confidence_score': analysis.confidence_score,
            'explanation': analysis.explanation
        }, indent=2)
    
    def _format_attack_mapping_output(self, analysis: TimelineAnalysisResult) -> str:
        """Format ATT&CK mapping as output text"""
        output = {
            'technique_id': analysis.mitre_technique_id,
            'tactic_id': analysis.mitre_tactic_id,
            'confidence_score': analysis.confidence_score,
            'explanation': analysis.explanation
        }
        
        if analysis.mitre_technique:
            output['technique_name'] = analysis.mitre_technique.name
        if analysis.mitre_tactic:
            output['tactic_name'] = analysis.mitre_tactic.name
        
        return json.dumps(output, indent=2)
    
    def _rebuild_output_with_correction(
        self,
        example: TrainingExample,
        corrected_technique_id: str,
        corrected_priority: Optional[float]
    ) -> str:
        """Rebuild output text with corrections"""
        try:
            output = json.loads(example.output_text)
        except:
            output = {}
        
        if corrected_technique_id:
            technique = MitreTechnique.query.get(corrected_technique_id)
            if technique:
                output['technique_id'] = corrected_technique_id
                output['technique_name'] = technique.name
                output['tactic_id'] = technique.tactic_id
                if technique.tactic:
                    output['tactic_name'] = technique.tactic.name
        
        if corrected_priority is not None:
            output['priority_score'] = corrected_priority
        
        return json.dumps(output, indent=2)
    
    def _export_jsonl(self, examples: List[TrainingExample], file_path: str):
        """Export as JSONL"""
        with open(file_path, 'w', encoding='utf-8') as f:
            for example in examples:
                obj = {
                    'id': example.id,
                    'input': example.input_text,
                    'output': example.output_text,
                    'technique_id': example.mitre_technique_id,
                    'tactic_id': example.mitre_tactic_id,
                    'priority_score': example.priority_score,
                    'confidence_score': example.confidence_score,
                    'is_validated': example.is_validated
                }
                f.write(json.dumps(obj) + '\n')
    
    def _export_csv(self, examples: List[TrainingExample], file_path: str):
        """Export as CSV"""
        import csv
        
        with open(file_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'id', 'input', 'output', 'technique_id', 'tactic_id',
                'priority_score', 'confidence_score', 'is_validated'
            ])
            
            for example in examples:
                writer.writerow([
                    example.id,
                    example.input_text,
                    example.output_text,
                    example.mitre_technique_id or '',
                    example.mitre_tactic_id or '',
                    example.priority_score or '',
                    example.confidence_score or '',
                    example.is_validated
                ])
