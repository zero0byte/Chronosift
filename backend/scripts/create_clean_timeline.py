#!/usr/bin/env python
"""Create a clean copy of a timeline without LLM Analysis, Priority, or MITRE ATT&CK data"""
import sys
from pathlib import Path

# Add parent directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app import create_app, db
from app.models.timeline import Timeline, TimelineEntry, ColumnDefinition
from app.models.mitre import TimelineAnalysisResult
from sqlalchemy.orm.attributes import flag_modified

app = create_app()
with app.app_context():
    source_timeline_id = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    new_timeline_name = sys.argv[2] if len(sys.argv) > 2 else None
    
    # Get source timeline
    source_timeline = Timeline.query.get(source_timeline_id)
    if not source_timeline:
        print(f"[ERROR] Timeline {source_timeline_id} not found")
        sys.exit(1)
    
    # Create new timeline
    if not new_timeline_name:
        new_timeline_name = f"{source_timeline.name} (Clean for Testing)"
    
    new_timeline = Timeline(
        project_id=source_timeline.project_id,
        name=new_timeline_name,
        description=f"Clean copy of '{source_timeline.name}' for testing LLM analysis",
        created_by=source_timeline.created_by
    )
    db.session.add(new_timeline)
    db.session.flush()
    
    print(f"\n{'='*60}")
    print(f"Creating clean timeline: {new_timeline.name}")
    print(f"Source: Timeline {source_timeline_id}")
    print(f"{'='*60}\n")
    
    # Copy columns (excluding LLM Analysis, Priority, and MITRE ATT&CK)
    excluded_columns = {'LLM Analysis', 'Priority', 'MITRE ATT&CK'}
    columns_copied = 0
    column_mapping = {}  # old name -> new ColumnDefinition
    
    for col in source_timeline.columns:
        if col.name in excluded_columns:
            print(f"[SKIP] Excluding column: {col.name}")
            continue
        
        new_col = ColumnDefinition(
            timeline_id=new_timeline.id,
            name=col.name,
            column_type=col.column_type,
            order=col.order,
            is_required=col.is_required,
            is_searchable=col.is_searchable,
            config=col.config
        )
        db.session.add(new_col)
        column_mapping[col.name] = new_col
        columns_copied += 1
        print(f"[✓] Copied column: {col.name} ({col.column_type})")
    
    # Copy entries (clean data)
    entries = TimelineEntry.query.filter_by(timeline_id=source_timeline_id).all()
    entries_copied = 0
    
    print(f"\n[INFO] Copying {len(entries)} entries...\n")
    
    for entry in entries:
        # Create clean data dict (exclude analysis fields)
        clean_data = {}
        for key, value in entry.data.items():
            if key not in excluded_columns:
                clean_data[key] = value
        
        new_entry = TimelineEntry(
            timeline_id=new_timeline.id,
            data=clean_data,
            created_by=entry.created_by
        )
        db.session.add(new_entry)
        entries_copied += 1
        
        event_type = clean_data.get('event_type', 'N/A')
        print(f"[✓] Copied entry {entries_copied}/{len(entries)}: {event_type}")
    
    # Commit changes
    db.session.commit()
    
    print(f"\n{'='*60}")
    print(f"SUCCESS!")
    print(f"{'='*60}")
    print(f"New Timeline ID: {new_timeline.id}")
    print(f"Name: {new_timeline.name}")
    print(f"Columns copied: {columns_copied}")
    print(f"Entries copied: {entries_copied}")
    print(f"\nExcluded columns: {', '.join(excluded_columns)}")
    print(f"\nYou can now use the 'Analyze Timeline' button to test the improved LLM analysis!")
    print(f"{'='*60}\n")
