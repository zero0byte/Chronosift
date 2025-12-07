#!/usr/bin/env python
"""Populate MITRE techniques on attack chain nodes from timeline entry analysis"""
import sys
from pathlib import Path

# Add parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app import create_app, db
from app.models.attack_chain import AttackChainNode
from app.models.timeline import TimelineEntry
from app.models.mitre import TimelineAnalysisResult, MitreTactic, MitreTechnique

app = create_app()
with app.app_context():
    chain_id = int(sys.argv[1]) if len(sys.argv) > 1 else None
    
    # Get all nodes (optionally filtered by chain)
    query = AttackChainNode.query
    if chain_id:
        query = query.filter_by(chain_id=chain_id)
    
    nodes = query.all()
    print(f"\n{'='*60}")
    print(f"Populating MITRE data for {len(nodes)} nodes")
    print(f"{'='*60}\n")
    
    updated = 0
    skipped = 0
    
    for node in nodes:
        # Find timeline entries near this key timestamp
        # Look for entries within 1 second of the key timestamp
        key_ts = node.key_timestamp.timestamp
        
        # Find entries in the project's timelines that match this timestamp
        entries = TimelineEntry.query.join(
            TimelineEntry.timeline
        ).filter(
            db.text("timeline_entries.data->>'timestamp' = :ts")
        ).params(ts=key_ts.strftime('%Y-%m-%d %H:%M:%S')).all()
        
        if not entries:
            print(f"Node {node.id} ({node.key_timestamp.label}): No matching timeline entry found")
            skipped += 1
            continue
        
        # Use the first matching entry
        entry = entries[0]
        
        # Get MITRE analysis for this entry
        analysis = TimelineAnalysisResult.query.filter_by(
            entry_id=entry.id,
            analysis_type='attack_mapping'
        ).first()
        
        if not analysis or not analysis.mitre_technique_id:
            print(f"Node {node.id} ({node.key_timestamp.label}): No MITRE analysis found")
            skipped += 1
            continue
        
        # Get tactic and technique details
        tactic = MitreTactic.query.get(analysis.mitre_tactic_id) if analysis.mitre_tactic_id else None
        technique = MitreTechnique.query.get(analysis.mitre_technique_id) if analysis.mitre_technique_id else None
        
        if not tactic or not technique:
            print(f"Node {node.id} ({node.key_timestamp.label}): Tactic/Technique not in database")
            skipped += 1
            continue
        
        # Update node
        node.mitre_tactic = tactic.name
        node.mitre_technique = technique.id
        
        db.session.add(node)
        print(f"✓ Node {node.id} ({node.key_timestamp.label}): {tactic.name} / {technique.id} - {technique.name}")
        updated += 1
    
    if updated > 0:
        db.session.commit()
        print(f"\n{'='*60}")
        print(f"Updated: {updated} nodes")
        print(f"Skipped: {skipped} nodes")
        print(f"{'='*60}\n")
    else:
        print(f"\nNo nodes updated")
