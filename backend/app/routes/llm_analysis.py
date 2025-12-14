"""
API routes for LLM-powered timeline analysis
"""
from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models.timeline import Timeline, TimelineEntry
from app.models.mitre import (
    MitreTactic, MitreTechnique, TimelineAnalysisResult,
    TrainingDataset, TrainingExample
)
from app.models.user import User
from app.models.analysis_prompt import AnalysisPrompt
from app.services.mitre_service import MitreService
from app.services.llm_service import LLMService
from app.services.timeline_analysis_service import TimelineAnalysisService
from app.services.training_dataset_service import TrainingDatasetService
import asyncio

bp = Blueprint('llm_analysis', __name__, url_prefix='/api/llm')


# LLM Status endpoint

@bp.route('/status', methods=['GET'])
@jwt_required()
def get_llm_status():
    """Get LLM service configuration and availability status"""
    llm_service = LLMService()
    
    # Check availability - use new_event_loop to avoid "asyncio.run() cannot be called from a running event loop" error
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        is_available, message = loop.run_until_complete(llm_service.check_availability())
    finally:
        loop.close()
    
    return jsonify({
        'providers': llm_service.get_available_providers(),
        'default_provider': llm_service.default_provider.value,
        'configured': llm_service.is_configured(),
        'available': is_available,
        'message': message
    }), 200


# MITRE ATT&CK endpoints

@bp.route('/mitre/load', methods=['POST'])
@jwt_required()
def load_mitre_data():
    """Load MITRE ATT&CK framework data"""
    force_refresh = request.json.get('force_refresh', False)
    
    mitre_service = MitreService()
    
    # Use new_event_loop to avoid "asyncio.run() cannot be called from a running event loop" error
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(mitre_service.load_attack_data(force_refresh=force_refresh))
    finally:
        loop.close()
    
    return jsonify(result), 200


@bp.route('/mitre/stats', methods=['GET'])
@jwt_required()
def get_mitre_stats():
    """Get MITRE ATT&CK framework statistics"""
    mitre_service = MitreService()
    stats = mitre_service.get_framework_stats()
    
    return jsonify(stats), 200


@bp.route('/mitre/tactics', methods=['GET'])
@jwt_required()
def get_tactics():
    """Get all MITRE ATT&CK tactics"""
    mitre_service = MitreService()
    tactics = mitre_service.get_all_tactics()
    
    return jsonify({
        'tactics': [t.to_dict() for t in tactics]
    }), 200


@bp.route('/mitre/tactics/<tactic_id>', methods=['GET'])
@jwt_required()
def get_tactic(tactic_id):
    """Get a specific tactic"""
    mitre_service = MitreService()
    tactic = mitre_service.get_tactic(tactic_id)
    
    if not tactic:
        return jsonify({'error': 'Tactic not found'}), 404
    
    return jsonify(tactic.to_dict()), 200


@bp.route('/mitre/tactics/<tactic_id>/techniques', methods=['GET'])
@jwt_required()
def get_tactic_techniques(tactic_id):
    """Get techniques for a tactic"""
    include_subtechniques = request.args.get('include_subtechniques', 'true').lower() == 'true'
    
    mitre_service = MitreService()
    techniques = mitre_service.get_techniques_by_tactic(tactic_id, include_subtechniques)
    
    return jsonify({
        'tactic_id': tactic_id,
        'techniques': [t.to_dict() for t in techniques]
    }), 200


@bp.route('/mitre/techniques/<technique_id>', methods=['GET'])
@jwt_required()
def get_technique(technique_id):
    """Get a specific technique"""
    include_subtechniques = request.args.get('include_subtechniques', 'true').lower() == 'true'
    
    mitre_service = MitreService()
    technique = mitre_service.get_technique(technique_id)
    
    if not technique:
        return jsonify({'error': 'Technique not found'}), 404
    
    return jsonify(technique.to_dict(include_subtechniques=include_subtechniques)), 200


@bp.route('/mitre/techniques/search', methods=['GET'])
@jwt_required()
def search_techniques():
    """Search techniques by name or description"""
    query = request.args.get('q', '')
    limit = int(request.args.get('limit', 20))
    
    if not query:
        return jsonify({'error': 'Query parameter required'}), 400
    
    mitre_service = MitreService()
    techniques = mitre_service.search_techniques(query, limit)
    
    return jsonify({
        'query': query,
        'results': [t.to_dict() for t in techniques]
    }), 200


# Timeline analysis endpoints



@bp.route('/analysis/entry/<int:entry_id>/priority', methods=['POST'])
@jwt_required()
def analyze_entry_priority(entry_id):
    """Analyze priority of a timeline entry"""
    current_user_id = int(get_jwt_identity())
    context = request.json.get('context') if request.json else None
    
    entry = TimelineEntry.query.get(entry_id)
    if not entry:
        return jsonify({'error': 'Entry not found'}), 404
    
    analysis_service = TimelineAnalysisService()
    
    try:
        # Use new_event_loop to avoid "asyncio.run() cannot be called from a running event loop" error
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                analysis_service.analyze_entry_priority(entry, context, current_user_id)
            )
            # Refresh entry to ensure we have latest data
            db.session.refresh(entry)
            return jsonify(result.to_dict()), 200
        finally:
            loop.close()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/analysis/entry/<int:entry_id>/attack', methods=['POST'])
@jwt_required()
def map_entry_to_attack(entry_id):
    """Map a timeline entry to MITRE ATT&CK"""
    current_user_id = int(get_jwt_identity())
    context = request.json.get('context') if request.json else None
    
    entry = TimelineEntry.query.get(entry_id)
    if not entry:
        return jsonify({'error': 'Entry not found'}), 404
    
    analysis_service = TimelineAnalysisService()
    
    try:
        # Use new_event_loop to avoid "asyncio.run() cannot be called from a running event loop" error
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                analysis_service.map_entry_to_attack(entry, context, current_user_id)
            )
            # Refresh entry to ensure we have latest data
            db.session.refresh(entry)
            return jsonify(result.to_dict()), 200
        finally:
            loop.close()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/analysis/timeline/<int:timeline_id>/chains', methods=['POST'])
@jwt_required()
def detect_attack_chains(timeline_id):
    """Detect attack chains in a timeline (detection only, no creation)"""
    current_user_id = int(get_jwt_identity())
    context = request.json.get('context') if request.json else None
    
    timeline = Timeline.query.get(timeline_id)
    if not timeline:
        return jsonify({'error': 'Timeline not found'}), 404
    
    analysis_service = TimelineAnalysisService()
    
    try:
        # Use new_event_loop to avoid "asyncio.run() cannot be called from a running event loop" error
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            chains = loop.run_until_complete(
                analysis_service.detect_attack_chains(timeline_id, context, current_user_id)
            )
            return jsonify({'chains': chains}), 200
        finally:
            loop.close()
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/analysis/timeline/<int:timeline_id>/detect-and-create-chains', methods=['POST'])
@jwt_required()
def detect_and_create_attack_chains(timeline_id):
    """
    Detect attack chains in a timeline and automatically create AttackChain objects
    
    Request body:
        - context: Optional investigation context
        - create_all: Boolean, if true creates chains for all detections (default: true)
        - min_confidence: Minimum confidence score to create chains (default: 0.5)
    
    Returns:
        - detected_chains: List of all detected chains
        - created_chains: List of AttackChain objects that were created
    """
    current_user_id = get_jwt_identity()
    data = request.get_json() or {}
    context = data.get('context')
    create_all = data.get('create_all', True)
    min_confidence = data.get('min_confidence', 0.5)
    
    timeline = Timeline.query.get(timeline_id)
    if not timeline:
        return jsonify({'error': 'Timeline not found'}), 404
    
    analysis_service = TimelineAnalysisService()
    
    try:
        # First, detect chains using LLM - use new_event_loop to avoid "asyncio.run() cannot be called from a running event loop" error
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            detected_chains = loop.run_until_complete(
                analysis_service.detect_attack_chains(timeline_id, context, current_user_id)
            )
        finally:
            loop.close()
        
        if not detected_chains:
            return jsonify({
                'message': 'No attack chains detected',
                'detected_chains': [],
                'created_chains': []
            }), 200
        
        # Filter by confidence and create AttackChain objects
        created_chains = []
        errors = []
        
        for chain_data in detected_chains:
            # Skip if below confidence threshold
            confidence = chain_data.get('confidence', 0.5)
            if confidence < min_confidence:
                continue
            
            # Skip if no events
            if not chain_data.get('events'):
                continue
            
            try:
                # Create the attack chain - use new_event_loop
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                try:
                    chain = loop.run_until_complete(
                        analysis_service.create_attack_chain_from_detection(
                            timeline_id,
                            chain_data,
                            current_user_id
                        )
                    )
                    created_chains.append(chain.to_dict_full())
                finally:
                    loop.close()
            except Exception as e:
                errors.append({
                    'chain_name': chain_data.get('chain_name', 'Unknown'),
                    'error': str(e)
                })
        
        return jsonify({
            'message': f'Created {len(created_chains)} attack chain(s) from {len(detected_chains)} detection(s)',
            'detected_chains': detected_chains,
            'created_chains': created_chains,
            'errors': errors if errors else None
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/analysis/timeline/<int:timeline_id>/detect-and-create-chains-async', methods=['POST'])
@jwt_required()
def detect_and_create_attack_chains_async(timeline_id):
    """
    Async version: Detect attack chains and create AttackChain objects via Celery task
    
    Request body:
        - context: Optional investigation context
        - min_confidence: Minimum confidence score to create chains (default: 0.5)
    
    Returns:
        - job: Job object for tracking progress
    """
    from app.models.job import Job
    from app.tasks.llm_analysis_tasks import detect_and_create_attack_chains_task
    
    current_user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    context = data.get('context')
    min_confidence = data.get('min_confidence', 0.5)
    
    timeline = Timeline.query.get(timeline_id)
    if not timeline:
        return jsonify({'error': 'Timeline not found'}), 404
    
    try:
        # Create Job record
        job = Job(
            task_id='',  # Will be set after task creation
            task_type='chain_detection',
            name=f'Detect Attack Chains: {timeline.name}',
            description='LLM-powered attack chain detection and creation',
            input_data={
                'context': context,
                'min_confidence': min_confidence
            },
            user_id=current_user_id,
            timeline_id=timeline_id,
            project_id=timeline.project_id
        )
        db.session.add(job)
        db.session.flush()  # Get the job ID
        
        # Dispatch Celery task
        task = detect_and_create_attack_chains_task.delay(
            timeline_id=timeline_id,
            job_id=job.id,
            context=context,
            user_id=current_user_id,
            min_confidence=min_confidence
        )
        
        # Update job with task ID
        job.task_id = task.id
        db.session.commit()
        
        return jsonify({
            'message': 'Chain detection job created',
            'job': job.to_dict()
        }), 202  # 202 Accepted
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/analysis/timeline/<int:timeline_id>/batch', methods=['POST'])
@jwt_required()
def analyze_timeline_batch(timeline_id):
    """Perform batch analysis on a timeline (async via Celery)"""
    from app.models.job import Job
    from app.tasks.llm_analysis_tasks import analyze_timeline_batch_task
    
    current_user_id = int(get_jwt_identity())
    
    data = request.json or {}
    analyze_priority = data.get('analyze_priority', True)
    analyze_attack = data.get('analyze_attack', True)
    detect_chains = data.get('detect_chains', True)
    context = data.get('context')
    entry_limit = data.get('entry_limit')
    
    timeline = Timeline.query.get(timeline_id)
    if not timeline:
        return jsonify({'error': 'Timeline not found'}), 404
    
    try:
        # Auto-create LLM Analysis and Priority columns if they don't exist
        from app.models.timeline import ColumnDefinition
        existing_columns = {col.name for col in timeline.columns}
        
        if 'LLM Analysis' not in existing_columns:
            max_order = max([col.order for col in timeline.columns], default=-1)
            llm_col = ColumnDefinition(
                timeline_id=timeline_id,
                name='LLM Analysis',
                column_type='text',
                order=max_order + 1,
                is_required=False,
                is_searchable=True,
                config={}
            )
            db.session.add(llm_col)
        
        if 'Priority' not in existing_columns:
            max_order = max([col.order for col in timeline.columns], default=-1)
            if 'LLM Analysis' not in existing_columns:
                max_order += 1  # Account for the LLM Analysis column we just added
            priority_col = ColumnDefinition(
                timeline_id=timeline_id,
                name='Priority',
                column_type='text',
                order=max_order + 1,
                is_required=False,
                is_searchable=True,
                config={}
            )
            db.session.add(priority_col)
        
        db.session.flush()  # Commit column additions
        
        # Create Job record
        job = Job(
            task_id='',  # Will be set after task creation
            task_type='llm_analysis',
            name=f'Analyze timeline: {timeline.name}',
            description='LLM-powered timeline analysis with MITRE ATT&CK mapping',
            input_data={
                'analyze_priority': analyze_priority,
                'analyze_attack': analyze_attack,
                'detect_chains': detect_chains,
                'context': context,
                'entry_limit': entry_limit
            },
            user_id=current_user_id,
            timeline_id=timeline_id,
            project_id=timeline.project_id
        )
        db.session.add(job)
        db.session.flush()  # Get the job ID
        
        # Dispatch Celery task
        task = analyze_timeline_batch_task.delay(
            timeline_id=timeline_id,
            job_id=job.id,
            analyze_priority=analyze_priority,
            analyze_attack=analyze_attack,
            detect_chains=detect_chains,
            context=context,
            user_id=current_user_id,
            entry_limit=entry_limit
        )
        
        # Update job with task ID
        job.task_id = task.id
        db.session.commit()
        
        return jsonify({
            'message': 'Analysis job created',
            'job': job.to_dict()
        }), 202  # 202 Accepted
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@bp.route('/analysis/timeline/<int:timeline_id>/results', methods=['GET'])
@jwt_required()
def get_timeline_analysis_results(timeline_id):
    """Get all analysis results for a timeline"""
    analysis_type = request.args.get('type')  # Optional filter
    
    query = TimelineAnalysisResult.query.filter_by(timeline_id=timeline_id)
    
    if analysis_type:
        query = query.filter_by(analysis_type=analysis_type)
    
    results = query.order_by(TimelineAnalysisResult.created_at.desc()).all()
    
    return jsonify({
        'timeline_id': timeline_id,
        'results': [r.to_dict() for r in results]
    }), 200


@bp.route('/analysis/entry/<int:entry_id>/results', methods=['GET'])
@jwt_required()
def get_entry_analysis_results(entry_id):
    """Get analysis results for a specific entry"""
    results = TimelineAnalysisResult.query.filter_by(entry_id=entry_id).all()
    
    return jsonify({
        'entry_id': entry_id,
        'results': [r.to_dict() for r in results]
    }), 200


# Training dataset endpoints

@bp.route('/datasets', methods=['GET'])
@jwt_required()
def list_datasets():
    """List all training datasets"""
    datasets = TrainingDataset.query.order_by(TrainingDataset.created_at.desc()).all()
    
    return jsonify({
        'datasets': [d.to_dict() for d in datasets]
    }), 200


@bp.route('/datasets', methods=['POST'])
@jwt_required()
def create_dataset():
    """Create a new training dataset"""
    current_user_id = get_jwt_identity()
    
    data = request.json
    name = data.get('name')
    description = data.get('description')
    timeline_ids = data.get('timeline_ids', [])
    version = data.get('version')
    dataset_format = data.get('format', 'jsonl')
    
    if not name:
        return jsonify({'error': 'Name is required'}), 400
    
    dataset_service = TrainingDatasetService()
    dataset = dataset_service.create_dataset(
        name=name,
        description=description,
        timeline_ids=timeline_ids,
        user_id=current_user_id,
        version=version,
        dataset_format=dataset_format
    )
    
    return jsonify(dataset.to_dict()), 201


@bp.route('/datasets/<int:dataset_id>', methods=['GET'])
@jwt_required()
def get_dataset(dataset_id):
    """Get a specific dataset"""
    include_examples = request.args.get('include_examples', 'false').lower() == 'true'
    
    dataset = TrainingDataset.query.get(dataset_id)
    if not dataset:
        return jsonify({'error': 'Dataset not found'}), 404
    
    return jsonify(dataset.to_dict(include_examples=include_examples)), 200


@bp.route('/datasets/<int:dataset_id>/build', methods=['POST'])
@jwt_required()
def build_dataset(dataset_id):
    """Build a dataset from timeline analyses"""
    data = request.json or {}
    
    timeline_ids = data.get('timeline_ids', [])
    include_priorities = data.get('include_priorities', True)
    include_attack_mappings = data.get('include_attack_mappings', True)
    min_confidence = data.get('min_confidence', 0.5)
    
    dataset = TrainingDataset.query.get(dataset_id)
    if not dataset:
        return jsonify({'error': 'Dataset not found'}), 404
    
    dataset_service = TrainingDatasetService()
    
    try:
        stats = dataset_service.build_dataset_from_timelines(
            dataset_id=dataset_id,
            timeline_ids=timeline_ids,
            include_priorities=include_priorities,
            include_attack_mappings=include_attack_mappings,
            min_confidence=min_confidence
        )
        return jsonify(stats), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/datasets/<int:dataset_id>/export', methods=['POST'])
@jwt_required()
def export_dataset(dataset_id):
    """Export a dataset to file"""
    data = request.json or {}
    export_format = data.get('format')
    openai_format = data.get('openai_format', False)
    system_prompt = data.get('system_prompt')
    
    dataset = TrainingDataset.query.get(dataset_id)
    if not dataset:
        return jsonify({'error': 'Dataset not found'}), 404
    
    dataset_service = TrainingDatasetService()
    
    try:
        if openai_format:
            file_path = dataset_service.export_for_openai_finetuning(
                dataset_id, system_prompt
            )
        else:
            file_path = dataset_service.export_dataset(
                dataset_id, export_format
            )
        
        # Return file download
        return send_file(
            file_path,
            as_attachment=True,
            download_name=file_path.split('/')[-1]
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/datasets/<int:dataset_id>/examples', methods=['GET'])
@jwt_required()
def get_dataset_examples(dataset_id):
    """Get examples from a dataset"""
    page = int(request.args.get('page', 1))
    per_page = int(request.args.get('per_page', 50))
    validated_only = request.args.get('validated_only', 'false').lower() == 'true'
    
    dataset = TrainingDataset.query.get(dataset_id)
    if not dataset:
        return jsonify({'error': 'Dataset not found'}), 404
    
    query = TrainingExample.query.filter_by(dataset_id=dataset_id)
    
    if validated_only:
        query = query.filter_by(is_validated=True)
    
    paginated = query.paginate(page=page, per_page=per_page, error_out=False)
    
    return jsonify({
        'examples': [e.to_dict() for e in paginated.items],
        'total': paginated.total,
        'page': page,
        'per_page': per_page,
        'pages': paginated.pages
    }), 200


@bp.route('/datasets/<int:dataset_id>/examples/<int:example_id>/validate', methods=['POST'])
@jwt_required()
def validate_example(dataset_id, example_id):
    """Validate or correct a training example"""
    current_user_id = get_jwt_identity()
    
    data = request.json
    is_valid = data.get('is_valid', True)
    notes = data.get('notes')
    corrected_technique_id = data.get('corrected_technique_id')
    corrected_priority = data.get('corrected_priority')
    
    example = TrainingExample.query.filter_by(
        id=example_id,
        dataset_id=dataset_id
    ).first()
    
    if not example:
        return jsonify({'error': 'Example not found'}), 404
    
    dataset_service = TrainingDatasetService()
    
    try:
        updated_example = dataset_service.validate_example(
            example_id=example_id,
            is_valid=is_valid,
            validated_by=current_user_id,
            notes=notes,
            corrected_technique_id=corrected_technique_id,
            corrected_priority=corrected_priority
        )
        return jsonify(updated_example.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/datasets/<int:dataset_id>', methods=['DELETE'])
@jwt_required()
def delete_dataset(dataset_id):
    """Delete a training dataset"""
    dataset = TrainingDataset.query.get(dataset_id)
    if not dataset:
        return jsonify({'error': 'Dataset not found'}), 404
    
    db.session.delete(dataset)
    db.session.commit()
    
    return jsonify({'message': 'Dataset deleted'}), 200


# Prompt management endpoints

@bp.route('/prompts', methods=['GET'])
@jwt_required()
def list_prompts():
    """List all analysis prompts"""
    prompt_type = request.args.get('type')  # Optional filter by type
    include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
    
    query = AnalysisPrompt.query
    
    if prompt_type:
        query = query.filter_by(prompt_type=prompt_type)
    
    if not include_inactive:
        query = query.filter_by(is_active=True)
    
    prompts = query.order_by(AnalysisPrompt.prompt_type, AnalysisPrompt.is_default.desc()).all()
    
    return jsonify({
        'prompts': [p.to_dict() for p in prompts]
    }), 200


@bp.route('/prompts/<int:prompt_id>', methods=['GET'])
@jwt_required()
def get_prompt(prompt_id):
    """Get a specific prompt"""
    prompt = AnalysisPrompt.query.get(prompt_id)
    if not prompt:
        return jsonify({'error': 'Prompt not found'}), 404
    
    return jsonify(prompt.to_dict()), 200


@bp.route('/prompts', methods=['POST'])
@jwt_required()
def create_prompt():
    """Create a new custom prompt"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    # Validation
    if 'prompt_type' not in data or data['prompt_type'] not in ['priority', 'attack', 'chains', 'report']:
        return jsonify({'error': 'Invalid prompt_type. Must be priority, attack, chains, or report'}), 400
    
    if 'name' not in data or not data['name'].strip():
        return jsonify({'error': 'Name is required'}), 400
    
    if 'system_prompt' not in data or not data['system_prompt'].strip():
        return jsonify({'error': 'System prompt is required'}), 400
    
    # Deactivate other non-default prompts of the same type if this one is being set as active
    if data.get('is_active', True):
        AnalysisPrompt.query.filter_by(
            prompt_type=data['prompt_type'],
            is_default=False
        ).update({'is_active': False})
    
    # Create new prompt
    prompt = AnalysisPrompt(
        prompt_type=data['prompt_type'],
        name=data['name'],
        description=data.get('description', ''),
        system_prompt=data['system_prompt'],
        user_prompt_template=data.get('user_prompt_template'),
        is_default=False,  # User-created prompts are never default
        is_active=data.get('is_active', True),
        created_by=current_user_id
    )
    
    db.session.add(prompt)
    db.session.commit()
    
    return jsonify(prompt.to_dict()), 201


@bp.route('/prompts/<int:prompt_id>', methods=['PUT'])
@jwt_required()
def update_prompt(prompt_id):
    """Update an existing prompt"""
    prompt = AnalysisPrompt.query.get(prompt_id)
    if not prompt:
        return jsonify({'error': 'Prompt not found'}), 404
    
    # Cannot edit default prompts
    if prompt.is_default:
        return jsonify({'error': 'Cannot edit default system prompts. Create a new custom prompt instead.'}), 403
    
    data = request.get_json()
    
    # Update fields
    if 'name' in data:
        prompt.name = data['name']
    
    if 'description' in data:
        prompt.description = data['description']
    
    if 'system_prompt' in data:
        prompt.system_prompt = data['system_prompt']
        prompt.version += 1  # Increment version on prompt content change
    
    if 'user_prompt_template' in data:
        prompt.user_prompt_template = data['user_prompt_template']
    
    if 'is_active' in data:
        # If activating this prompt, deactivate others of the same type
        if data['is_active']:
            AnalysisPrompt.query.filter(
                AnalysisPrompt.prompt_type == prompt.prompt_type,
                AnalysisPrompt.id != prompt.id,
                AnalysisPrompt.is_default == False
            ).update({'is_active': False})
        prompt.is_active = data['is_active']
    
    db.session.commit()
    
    return jsonify(prompt.to_dict()), 200


@bp.route('/prompts/<int:prompt_id>', methods=['DELETE'])
@jwt_required()
def delete_prompt(prompt_id):
    """Delete a custom prompt"""
    prompt = AnalysisPrompt.query.get(prompt_id)
    if not prompt:
        return jsonify({'error': 'Prompt not found'}), 404
    
    # Cannot delete default prompts
    if prompt.is_default:
        return jsonify({'error': 'Cannot delete default system prompts'}), 403
    
    db.session.delete(prompt)
    db.session.commit()
    
    return jsonify({'message': 'Prompt deleted'}), 200


@bp.route('/prompts/<int:prompt_id>/reset-to-default', methods=['POST'])
@jwt_required()
def reset_prompt_to_default(prompt_id):
    """
    Reset a custom prompt by deactivating it and activating the default prompt
    for the same type
    """
    prompt = AnalysisPrompt.query.get(prompt_id)
    if not prompt:
        return jsonify({'error': 'Prompt not found'}), 404
    
    # Deactivate this prompt
    prompt.is_active = False
    
    # Ensure the default prompt for this type is active
    default_prompt = AnalysisPrompt.get_default_prompt(prompt.prompt_type)
    if default_prompt:
        default_prompt.is_active = True
    
    db.session.commit()
    
    return jsonify({
        'message': f'Reset to default prompt for {prompt.prompt_type}',
        'default_prompt': default_prompt.to_dict() if default_prompt else None
    }), 200


@bp.route('/prompts/active/<prompt_type>', methods=['GET'])
@jwt_required()
def get_active_prompt(prompt_type):
    """Get the currently active prompt for a specific type"""
    if prompt_type not in ['priority', 'attack', 'chains']:
        return jsonify({'error': 'Invalid prompt_type'}), 400
    
    prompt = AnalysisPrompt.get_active_prompt(prompt_type)
    if not prompt:
        return jsonify({'error': f'No active prompt found for type {prompt_type}'}), 404
    
    return jsonify(prompt.to_dict()), 200
