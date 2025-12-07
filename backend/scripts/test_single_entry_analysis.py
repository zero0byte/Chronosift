#!/usr/bin/env python
"""Test single entry analysis with automatic column creation"""
import sys
import asyncio
from pathlib import Path

# Add parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app import create_app, db
from app.models.timeline import Timeline, TimelineEntry
from app.services.timeline_analysis_service import TimelineAnalysisService

async def test_analysis():
    app = create_app()
    
    with app.app_context():
        timeline_id = int(sys.argv[1]) if len(sys.argv) > 1 else 4
        
        # Get timeline
        timeline = Timeline.query.get(timeline_id)
        if not timeline:
            print(f"[ERROR] Timeline {timeline_id} not found")
            return
        
        print(f"\n{'='*60}")
        print(f"Testing Single Entry Analysis")
        print(f"Timeline: {timeline.name} (ID: {timeline_id})")
        print(f"{'='*60}\n")
        
        # Check existing columns
        print("[STEP 1] Checking existing columns...")
        existing_cols = [col.name for col in timeline.columns]
        print(f"  Existing: {', '.join(existing_cols)}")
        
        # Get first entry
        entry = TimelineEntry.query.filter_by(timeline_id=timeline_id).first()
        if not entry:
            print(f"[ERROR] No entries found in timeline {timeline_id}")
            return
        
        print(f"\n[STEP 2] Analyzing entry {entry.id}...")
        event_type = entry.data.get('event_type', 'N/A')
        print(f"  Event: {event_type}")
        
        # Create service and analyze
        service = TimelineAnalysisService()
        
        # Analyze priority
        print(f"\n[STEP 3] Analyzing priority...")
        priority_result = await service.analyze_entry_priority(entry, user_id=1)
        print(f"  ✓ Priority: {entry.data.get('Priority', 'N/A')}")
        print(f"    Score: {priority_result.priority_score}")
        print(f"    Confidence: {priority_result.confidence_score}")
        
        # Analyze MITRE ATT&CK
        print(f"\n[STEP 4] Mapping to MITRE ATT&CK...")
        attack_result = await service.map_entry_to_attack(entry, user_id=1)
        print(f"  ✓ LLM Analysis: {entry.data.get('LLM Analysis', 'N/A')[:80]}...")
        print(f"    Technique: {attack_result.mitre_technique_id or 'None'}")
        print(f"    Tactic: {attack_result.mitre_tactic_id or 'None'}")
        print(f"    MITRE Column: {entry.data.get('MITRE ATT&CK', 'N/A')}")
        
        # Check columns after analysis
        print(f"\n[STEP 5] Checking columns after analysis...")
        db.session.expire(timeline)  # Refresh from DB
        timeline = Timeline.query.get(timeline_id)
        new_cols = [col.name for col in timeline.columns]
        print(f"  Columns: {', '.join(new_cols)}")
        
        added_cols = set(new_cols) - set(existing_cols)
        if added_cols:
            print(f"  ✓ Added: {', '.join(added_cols)}")
        else:
            print(f"  (No new columns - they already existed)")
        
        print(f"\n{'='*60}")
        print(f"SUCCESS! Entry analyzed and columns created.")
        print(f"{'='*60}\n")
        print("Now refresh the timeline in the UI to see the new columns!")

if __name__ == '__main__':
    asyncio.run(test_analysis())
