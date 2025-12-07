"""Enrichment API routes."""
import asyncio
import re
from flask import Blueprint, request, jsonify, g
from app import db
from app.models.entity import Entity, EnrichmentProvider, EnrichmentResult, UserAPIKey
from app.models.timeline import TimelineEntry
from app.auth import require_auth
from app.services.enrichment import (
    enrichment_service,
    GreyNoiseEnricher,
    AbuseIPDBEnricher,
    VirusTotalIPEnricher,
    IPInfoEnricher
)
from app.utils.crypto import encrypt_api_key, decrypt_api_key
import logging

logger = logging.getLogger(__name__)

bp = Blueprint('enrichment', __name__, url_prefix='/api/enrichment')


# Entity extraction patterns
IP_PATTERN = re.compile(r'\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b')
HASH_PATTERN = re.compile(r'\b[a-fA-F0-9]{32}\b|\b[a-fA-F0-9]{40}\b|\b[a-fA-F0-9]{64}\b')
DOMAIN_PATTERN = re.compile(r'\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b')
EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')


def extract_entities(text: str) -> dict:
    """Extract entities from text."""
    entities = {
        'ip': list(set(IP_PATTERN.findall(text))),
        'hash': list(set(HASH_PATTERN.findall(text))),
        'domain': list(set(DOMAIN_PATTERN.findall(text))),
        'email': list(set(EMAIL_PATTERN.findall(text)))
    }
    return entities


def get_user_api_keys(user_id: int) -> dict:
    """Get user's API keys for enrichment providers."""
    keys = {}
    user_keys = UserAPIKey.query.filter_by(user_id=user_id).all()
    logger.info(f"Found {len(user_keys)} API keys for user {user_id}")
    for uk in user_keys:
        provider = EnrichmentProvider.query.get(uk.provider_id)
        if provider:
            try:
                decrypted_key = decrypt_api_key(uk.encrypted_key)
                # Ensure the key is a string, not bytes
                if isinstance(decrypted_key, bytes):
                    decrypted_key = decrypted_key.decode('utf-8')
                keys[provider.name] = str(decrypted_key)
                logger.info(f"Loaded API key for provider '{provider.name}' (length: {len(keys[provider.name])})")
            except Exception as e:
                logger.error(f"Failed to decrypt key for provider {provider.name}: {e}")
    logger.info(f"API keys dictionary: {list(keys.keys())}")
    return keys


def initialize_enrichers(entity_type: str, api_keys: dict):
    """Initialize and register enrichers for an entity type."""
    if entity_type == 'ip':
        enrichers = [
            GreyNoiseEnricher(api_key=api_keys.get('greynoise')),
            AbuseIPDBEnricher(api_key=api_keys.get('abuseipdb')),
            VirusTotalIPEnricher(api_key=api_keys.get('virustotal_ip')),
            IPInfoEnricher(api_key=api_keys.get('ipinfo'))
        ]
        for enricher in enrichers:
            enrichment_service.register_enricher('ip', enricher)


@bp.route('/providers', methods=['GET'])
@require_auth
def list_providers():
    """List all enrichment providers."""
    entity_type = request.args.get('entity_type')
    
    query = EnrichmentProvider.query
    if entity_type:
        query = query.filter_by(entity_type=entity_type)
    
    providers = query.filter_by(is_enabled=True).all()
    
    # Check which providers user has keys for
    user_keys = UserAPIKey.query.filter_by(user_id=g.current_user.id).all()
    user_provider_ids = {uk.provider_id for uk in user_keys}
    
    result = []
    for provider in providers:
        provider_dict = provider.to_dict()
        provider_dict['has_key'] = provider.id in user_provider_ids
        result.append(provider_dict)
    
    return jsonify(result), 200


@bp.route('/api-keys', methods=['GET'])
@require_auth
def list_user_keys():
    """List user's API keys (without revealing actual keys)."""
    keys = UserAPIKey.query.filter_by(user_id=g.current_user.id).all()
    return jsonify([key.to_dict() for key in keys]), 200


@bp.route('/api-keys', methods=['POST'])
@require_auth
def add_api_key():
    """Add or update an API key for a provider."""
    data = request.get_json()
    
    provider_id = data.get('provider_id')
    api_key = data.get('api_key')
    key_name = data.get('key_name')
    
    if not provider_id or not api_key:
        return jsonify({'error': 'provider_id and api_key required'}), 400
    
    # Check if provider exists
    provider = EnrichmentProvider.query.get(provider_id)
    if not provider:
        return jsonify({'error': 'Provider not found'}), 404
    
    # Encrypt the API key
    try:
        encrypted_key = encrypt_api_key(api_key)
    except Exception as e:
        return jsonify({'error': f'Encryption failed: {str(e)}'}), 500
    
    # Check if key already exists for this user/provider
    existing_key = UserAPIKey.query.filter_by(
        user_id=g.current_user.id,
        provider_id=provider_id
    ).first()
    
    if existing_key:
        # Update existing key
        existing_key.encrypted_key = encrypted_key
        existing_key.key_name = key_name
    else:
        # Create new key
        new_key = UserAPIKey(
            user_id=g.current_user.id,
            provider_id=provider_id,
            encrypted_key=encrypted_key,
            key_name=key_name
        )
        db.session.add(new_key)
    
    db.session.commit()
    
    return jsonify({'message': 'API key saved successfully'}), 200


@bp.route('/api-keys/<int:key_id>', methods=['DELETE'])
@require_auth
def delete_api_key(key_id):
    """Delete an API key."""
    key = UserAPIKey.query.filter_by(
        id=key_id,
        user_id=g.current_user.id
    ).first()
    
    if not key:
        return jsonify({'error': 'API key not found'}), 404
    
    db.session.delete(key)
    db.session.commit()
    
    return jsonify({'message': 'API key deleted successfully'}), 200


@bp.route('/extract/<int:entry_id>', methods=['POST'])
@require_auth
def extract_entities_from_entry(entry_id):
    """Extract entities from a timeline entry."""
    entry = TimelineEntry.query.get(entry_id)
    if not entry:
        return jsonify({'error': 'Timeline entry not found'}), 404
    
    # Extract text from entry data
    text = ' '.join(str(v) for v in entry.data.values() if v)
    
    # Extract entities
    entities = extract_entities(text)
    
    # Store entities in database
    created_entities = []
    for entity_type, values in entities.items():
        for value in values:
            # Check if entity already exists
            existing = Entity.query.filter_by(
                timeline_entry_id=entry_id,
                entity_type=entity_type,
                value=value
            ).first()
            
            if not existing:
                entity = Entity(
                    timeline_entry_id=entry_id,
                    entity_type=entity_type,
                    value=value,
                    context={'field': 'auto-detected'}
                )
                db.session.add(entity)
                created_entities.append(entity)
    
    db.session.commit()
    
    return jsonify({
        'extracted': entities,
        'created': [e.to_dict() for e in created_entities]
    }), 200


@bp.route('/enrich', methods=['POST'])
@require_auth
def enrich_entity():
    """Enrich a single entity."""
    data = request.get_json()
    
    entity_type = data.get('entity_type')
    value = data.get('value')
    providers = data.get('providers')  # Optional: specific providers to use
    
    if not entity_type or not value:
        return jsonify({'error': 'entity_type and value required'}), 400
    
    # Get user's API keys
    api_keys = get_user_api_keys(g.current_user.id)
    logger.info(f"Enriching {entity_type} '{value}' with API keys: {list(api_keys.keys())}")
    
    # Initialize enrichers
    initialize_enrichers(entity_type, api_keys)
    
    # Run enrichment asynchronously
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            enrichment_service.enrich_value(entity_type, value, providers)
        )
        loop.close()
    except Exception as e:
        logger.error(f"Enrichment error: {e}")
        return jsonify({'error': str(e)}), 500
    
    return jsonify(result), 200


@bp.route('/enrich/<int:entity_id>', methods=['POST'])
@require_auth
def enrich_stored_entity(entity_id):
    """Enrich a stored entity and save results."""
    entity = Entity.query.get(entity_id)
    if not entity:
        return jsonify({'error': 'Entity not found'}), 404
    
    data = request.get_json() or {}
    providers = data.get('providers')
    
    # Get user's API keys
    api_keys = get_user_api_keys(g.current_user.id)
    logger.info(f"Enriching stored entity {entity_id} ({entity.entity_type}: {entity.value}) with API keys: {list(api_keys.keys())}")
    
    # Initialize enrichers
    initialize_enrichers(entity.entity_type, api_keys)
    
    # Run enrichment
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            enrichment_service.enrich_value(entity.entity_type, entity.value, providers)
        )
        loop.close()
    except Exception as e:
        logger.error(f"Enrichment error: {e}")
        return jsonify({'error': str(e)}), 500
    
    # Save results to database
    for enrichment in result.get('results', []):
        provider_name = enrichment.get('provider')
        logger.info(f"Enrichment provider name from service: {provider_name}")
        
        # Find provider in database
        search_name = provider_name.lower().replace('enricher', '')
        logger.info(f"Searching for provider with name: {search_name}")
        provider = EnrichmentProvider.query.filter_by(
            name=search_name
        ).first()
        
        if not provider:
            logger.warning(f"Provider not found in database: {provider_name} (searched as: {search_name})")
            continue
        
        logger.info(f"Found provider: {provider.name} (ID: {provider.id})")
        
        # Check if result already exists
        existing_result = EnrichmentResult.query.filter_by(
            entity_id=entity_id,
            provider_id=provider.id
        ).first()
        
        enrichment_data = enrichment.get('data', {})
        confidence = enrichment.get('confidence', 0.0)
        error = enrichment.get('error')
        
        if existing_result:
            # Update existing result
            existing_result.data = enrichment_data
            existing_result.confidence = confidence
            existing_result.error = error
        else:
            # Create new result
            new_result = EnrichmentResult(
                entity_id=entity_id,
                provider_id=provider.id,
                data=enrichment_data,
                confidence=confidence,
                error=error
            )
            db.session.add(new_result)
    
    db.session.commit()
    
    return jsonify(result), 200


@bp.route('/entities/<int:entry_id>', methods=['GET'])
@require_auth
def get_entry_entities(entry_id):
    """Get all entities for a timeline entry with their enrichment results."""
    entry = TimelineEntry.query.get(entry_id)
    if not entry:
        return jsonify({'error': 'Timeline entry not found'}), 404
    
    entities = Entity.query.filter_by(timeline_entry_id=entry_id).all()
    
    result = []
    for entity in entities:
        entity_dict = entity.to_dict()
        
        # Add enrichment results
        enrichments = EnrichmentResult.query.filter_by(entity_id=entity.id).all()
        entity_dict['enrichments'] = []
        
        for enrich in enrichments:
            enrich_dict = enrich.to_dict()
            provider = EnrichmentProvider.query.get(enrich.provider_id)
            enrich_dict['provider_name'] = provider.name if provider else 'Unknown'
            entity_dict['enrichments'].append(enrich_dict)
        
        result.append(entity_dict)
    
    return jsonify(result), 200
