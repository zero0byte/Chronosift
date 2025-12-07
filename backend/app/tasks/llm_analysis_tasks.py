"""
Celery tasks for asynchronous LLM timeline analysis
"""
from app.celery_app import celery
from app import db
from app.models.timeline import Timeline, TimelineEntry
from app.models.mitre import TimelineAnalysisResult
from app.models.job import Job
from app.services.timeline_analysis_service import TimelineAnalysisService
from app.services.training_dataset_service import TrainingDatasetService
import asyncio
import traceback


@celery.task(bind=True, name='tasks.analyze_timeline_batch')
def analyze_timeline_batch_task(
    self,
    timeline_id: int,
    job_id: int,
    analyze_priority: bool = True,
    analyze_attack: bool = True,
    detect_chains: bool = True,
    context: str = None,
    user_id: int = None,
    entry_limit: int = None
):
    """
    Async task to perform batch analysis on a timeline
    
    Args:
        timeline_id: Timeline to analyze
        job_id: Job ID for tracking
        analyze_priority: Whether to analyze event priorities
        analyze_attack: Whether to map events to ATT&CK
        detect_chains: Whether to detect attack chains
        context: Optional investigation context
        user_id: User requesting analysis
        entry_limit: Maximum number of entries to analyze
    """
    from app import create_app
    app = create_app()
    
    with app.app_context():
        job = Job.query.get(job_id)
        if not job:
            return {'error': f'Job {job_id} not found'}
        
        try:
            # Mark job as started
            job.mark_started()
            job.update_progress(0, 'Initializing analysis')
            
            timeline = Timeline.query.get(timeline_id)
            if not timeline:
                job.mark_failed(f'Timeline {timeline_id} not found')
                return {'error': f'Timeline {timeline_id} not found'}
            
            query = TimelineEntry.query.filter_by(timeline_id=timeline_id)
            if entry_limit:
                query = query.limit(entry_limit)
            
            entries = query.all()
            total_entries = len(entries)
            
            analysis_service = TimelineAnalysisService()
            
            results = {
                'timeline_id': timeline_id,
                'total_entries': total_entries,
                'priority_analyses': 0,
                'attack_mappings': 0,
                'chains_detected': 0,
                'errors': []
            }
            
            # Calculate total steps for progress tracking
            total_steps = 0
            if analyze_priority:
                total_steps += total_entries
            if analyze_attack:
                total_steps += total_entries
            if detect_chains:
                total_steps += 1
            
            job.total_steps = total_steps
            db.session.commit()
            current_step = 0
            
            # Analyze priorities
            if analyze_priority:
                job.update_progress((current_step / total_steps) * 100, f'Analyzing priorities (0/{total_entries})')
                
                for idx, entry in enumerate(entries):
                    try:
                        asyncio.run(
                            analysis_service.analyze_entry_priority(entry, context, user_id)
                        )
                        results['priority_analyses'] += 1
                        current_step += 1
                        
                        # Update progress
                        progress_pct = (current_step / total_steps) * 100
                        job.update_progress(progress_pct, f'Analyzing priorities ({idx + 1}/{total_entries})')
                    except Exception as e:
                        results['errors'].append({
                            'entry_id': entry.id,
                            'error': str(e),
                            'type': 'priority'
                        })
            
            # Map to ATT&CK
            if analyze_attack:
                job.update_progress((current_step / total_steps) * 100, f'Mapping to ATT&CK (0/{total_entries})')
                
                for idx, entry in enumerate(entries):
                    try:
                        asyncio.run(
                            analysis_service.map_entry_to_attack(entry, context, user_id)
                        )
                        results['attack_mappings'] += 1
                        current_step += 1
                        
                        # Update progress
                        progress_pct = (current_step / total_steps) * 100
                        job.update_progress(progress_pct, f'Mapping to ATT&CK ({idx + 1}/{total_entries})')
                    except Exception as e:
                        results['errors'].append({
                            'entry_id': entry.id,
                            'error': str(e),
                            'type': 'attack_mapping'
                        })
            
            # Detect chains
            if detect_chains:
                job.update_progress((current_step / total_steps) * 100, 'Detecting attack chains')
                
                try:
                    chains = asyncio.run(
                        analysis_service.detect_attack_chains(timeline_id, context, user_id)
                    )
                    results['chains_detected'] = len(chains)
                    results['chains'] = chains
                    current_step += 1
                except Exception as e:
                    results['errors'].append({
                        'error': str(e),
                        'type': 'chain_detection'
                    })
            
            # Mark job as complete
            job.mark_success(results)
            return results
            
        except Exception as e:
            error_trace = traceback.format_exc()
            job.mark_failed(str(e), error_trace)
            return {'error': str(e)}


@celery.task(bind=True, name='tasks.analyze_entry_priority')
def analyze_entry_priority_task(
    self,
    entry_id: int,
    context: str = None,
    user_id: int = None
):
    """
    Async task to analyze priority of a timeline entry
    
    Args:
        entry_id: Entry to analyze
        context: Optional context
        user_id: User requesting analysis
    """
    from app import create_app
    app = create_app()
    
    with app.app_context():
        try:
            entry = TimelineEntry.query.get(entry_id)
            if not entry:
                return {'error': f'Entry {entry_id} not found'}
            
            analysis_service = TimelineAnalysisService()
            result = asyncio.run(
                analysis_service.analyze_entry_priority(entry, context, user_id)
            )
            
            return result.to_dict()
            
        except Exception as e:
            return {'error': str(e)}


@celery.task(bind=True, name='tasks.map_entry_to_attack')
def map_entry_to_attack_task(
    self,
    entry_id: int,
    context: str = None,
    user_id: int = None
):
    """
    Async task to map a timeline entry to MITRE ATT&CK
    
    Args:
        entry_id: Entry to analyze
        context: Optional context
        user_id: User requesting analysis
    """
    from app import create_app
    app = create_app()
    
    with app.app_context():
        try:
            entry = TimelineEntry.query.get(entry_id)
            if not entry:
                return {'error': f'Entry {entry_id} not found'}
            
            analysis_service = TimelineAnalysisService()
            result = asyncio.run(
                analysis_service.map_entry_to_attack(entry, context, user_id)
            )
            
            return result.to_dict()
            
        except Exception as e:
            return {'error': str(e)}


@celery.task(bind=True, name='tasks.detect_attack_chains')
def detect_attack_chains_task(
    self,
    timeline_id: int,
    context: str = None,
    user_id: int = None
):
    """
    Async task to detect attack chains in a timeline (detection only)
    
    Args:
        timeline_id: Timeline to analyze
        context: Optional context
        user_id: User requesting analysis
    """
    from app import create_app
    app = create_app()
    
    with app.app_context():
        try:
            timeline = Timeline.query.get(timeline_id)
            if not timeline:
                return {'error': f'Timeline {timeline_id} not found'}
            
            analysis_service = TimelineAnalysisService()
            chains = asyncio.run(
                analysis_service.detect_attack_chains(timeline_id, context, user_id)
            )
            
            return {'chains': chains}
            
        except Exception as e:
            return {'error': str(e)}


@celery.task(bind=True, name='tasks.detect_and_create_attack_chains')
def detect_and_create_attack_chains_task(
    self,
    timeline_id: int,
    job_id: int,
    context: str = None,
    user_id: int = None,
    min_confidence: float = 0.5
):
    """
    Async task to detect attack chains and automatically create AttackChain objects
    
    Args:
        timeline_id: Timeline to analyze
        job_id: Job ID for tracking progress
        context: Optional investigation context
        user_id: User requesting analysis
        min_confidence: Minimum confidence score to create chains
    """
    from app import create_app
    app = create_app()
    
    with app.app_context():
        job = Job.query.get(job_id)
        if not job:
            return {'error': f'Job {job_id} not found'}
        
        try:
            # Mark job as started
            job.mark_started()
            job.update_progress(0, 'Detecting attack chains with LLM')
            
            timeline = Timeline.query.get(timeline_id)
            if not timeline:
                job.mark_failed(f'Timeline {timeline_id} not found')
                return {'error': f'Timeline {timeline_id} not found'}
            
            analysis_service = TimelineAnalysisService()
            
            # Step 1: Detect chains using LLM
            job.update_progress(20, 'Running LLM chain detection')
            detected_chains = asyncio.run(
                analysis_service.detect_attack_chains(timeline_id, context, user_id)
            )
            
            if not detected_chains:
                job.mark_success({
                    'message': 'No attack chains detected',
                    'detected_chains': [],
                    'created_chains': []
                })
                return {
                    'message': 'No attack chains detected',
                    'detected_chains': [],
                    'created_chains': []
                }
            
            # Step 2: Create AttackChain objects
            job.update_progress(40, f'Creating {len(detected_chains)} attack chain(s)')
            
            created_chains = []
            errors = []
            
            for idx, chain_data in enumerate(detected_chains):
                # Skip if below confidence threshold
                confidence = chain_data.get('confidence', 0.5)
                if confidence < min_confidence:
                    print(f"[INFO] Skipping chain '{chain_data.get('name')}' - confidence {confidence} below threshold {min_confidence}")
                    continue
                
                # Skip if no events
                if not chain_data.get('events'):
                    print(f"[WARNING] Skipping chain '{chain_data.get('name')}' - no events")
                    continue
                
                try:
                    progress = 40 + (idx / len(detected_chains)) * 50
                    job.update_progress(
                        progress,
                        f"Creating chain: {chain_data.get('name', 'Unknown')}"
                    )
                    
                    # Create the attack chain
                    chain = asyncio.run(
                        analysis_service.create_attack_chain_from_detection(
                            timeline_id,
                            chain_data,
                            user_id
                        )
                    )
                    created_chains.append(chain.to_dict_full())
                except Exception as e:
                    error_msg = f"{str(e)} | {traceback.format_exc()}"
                    print(f"[ERROR] Failed to create chain '{chain_data.get('name')}': {error_msg}")
                    errors.append({
                        'chain_name': chain_data.get('name', 'Unknown'),
                        'error': str(e),
                        'traceback': traceback.format_exc()
                    })
            
            # Complete the job
            result = {
                'message': f'Created {len(created_chains)} attack chain(s) from {len(detected_chains)} detection(s)',
                'detected_chains': detected_chains,
                'created_chains': created_chains,
                'errors': errors if errors else None
            }
            
            job.mark_success(result)
            return result
            
        except Exception as e:
            error_trace = traceback.format_exc()
            job.mark_failed(str(e), error_trace)
            return {'error': str(e)}


@celery.task(bind=True, name='tasks.build_training_dataset')
def build_training_dataset_task(
    self,
    dataset_id: int,
    timeline_ids: list,
    include_priorities: bool = True,
    include_attack_mappings: bool = True,
    min_confidence: float = 0.5
):
    """
    Async task to build a training dataset from timelines
    
    Args:
        dataset_id: Target dataset
        timeline_ids: Timelines to import from
        include_priorities: Include priority analyses
        include_attack_mappings: Include ATT&CK mappings
        min_confidence: Minimum confidence threshold
    """
    from app import create_app
    app = create_app()
    
    with app.app_context():
        try:
            self.update_state(state='PROCESSING', meta={
                'dataset_id': dataset_id,
                'stage': 'building',
                'timelines_processed': 0,
                'total_timelines': len(timeline_ids)
            })
            
            dataset_service = TrainingDatasetService()
            
            stats = dataset_service.build_dataset_from_timelines(
                dataset_id=dataset_id,
                timeline_ids=timeline_ids,
                include_priorities=include_priorities,
                include_attack_mappings=include_attack_mappings,
                min_confidence=min_confidence
            )
            
            return stats
            
        except Exception as e:
            return {'error': str(e)}


@celery.task(bind=True, name='tasks.export_training_dataset')
def export_training_dataset_task(
    self,
    dataset_id: int,
    export_format: str = 'jsonl',
    openai_format: bool = False,
    system_prompt: str = None
):
    """
    Async task to export a training dataset
    
    Args:
        dataset_id: Dataset to export
        export_format: Format (jsonl, csv)
        openai_format: Whether to use OpenAI format
        system_prompt: System prompt for OpenAI format
    """
    from app import create_app
    app = create_app()
    
    with app.app_context():
        try:
            dataset_service = TrainingDatasetService()
            
            if openai_format:
                file_path = dataset_service.export_for_openai_finetuning(
                    dataset_id, system_prompt
                )
            else:
                file_path = dataset_service.export_dataset(
                    dataset_id, export_format
                )
            
            return {'file_path': file_path}
            
        except Exception as e:
            return {'error': str(e)}
