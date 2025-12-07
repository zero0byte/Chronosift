"""Celery tasks for asynchronous file processing."""
from app.celery_app import celery
from app import create_app, db
from app.models.timeline import Timeline, TimelineEntry, ColumnDefinition
from app.models.transform import Transform
from app.utils.transform_parser import parse_file


@celery.task(bind=True)
def process_file_upload(self, file_content, timeline_id, transform_id, user_id):
    """
    Process uploaded file and create timeline entries.
    
    Args:
        file_content: String content of the uploaded file
        timeline_id: ID of the timeline to add entries to
        transform_id: ID of the transform to use for parsing
        user_id: ID of the user who uploaded the file
    
    Returns:
        dict: Processing results with counts and errors
    """
    # Create Flask app context
    app = create_app()
    
    with app.app_context():
        try:
            # Update task state
            self.update_state(state='PROCESSING', meta={'status': 'Parsing file...'})
            
            # Get transform and timeline
            transform = Transform.query.get(transform_id)
            if not transform:
                raise ValueError(f"Transform {transform_id} not found")
            
            timeline = Timeline.query.get(timeline_id)
            if not timeline:
                raise ValueError(f"Timeline {timeline_id} not found")
            
            # Auto-create missing columns from transform
            existing_column_names = {col.name for col in timeline.columns}
            max_order = max([col.order for col in timeline.columns], default=-1)
            
            for field in transform.mapping.get('fields', []):
                target_col = field.get('target')
                if target_col and target_col not in existing_column_names:
                    # Determine column type
                    field_type = field.get('type', 'text')
                    
                    # Create the missing column
                    max_order += 1
                    new_column = ColumnDefinition(
                        timeline_id=timeline_id,
                        name=target_col,
                        column_type=field_type,
                        config={},
                        order=max_order,
                        is_required=False,
                        is_searchable=True
                    )
                    db.session.add(new_column)
                    existing_column_names.add(target_col)
            
            # Commit new columns before parsing
            if max_order > max([col.order for col in timeline.columns], default=-1):
                db.session.commit()
                # Refresh timeline to get new columns
                db.session.refresh(timeline)
            
            # Parse file using transform
            parsed_entries = parse_file(
                file_content,
                transform.input_format,
                transform.mapping
            )
            
            self.update_state(
                state='PROCESSING',
                meta={'status': f'Creating {len(parsed_entries)} entries...'}
            )
            
            # Create timeline entries
            created_count = 0
            error_count = 0
            errors = []
            
            for idx, entry_data in enumerate(parsed_entries):
                try:
                    entry = TimelineEntry(
                        timeline_id=timeline_id,
                        data=entry_data,
                        created_by=user_id
                    )
                    db.session.add(entry)
                    created_count += 1
                    
                    # Commit in batches of 100
                    if created_count % 100 == 0:
                        db.session.commit()
                        self.update_state(
                            state='PROCESSING',
                            meta={
                                'status': f'Created {created_count}/{len(parsed_entries)} entries...',
                                'progress': int((created_count / len(parsed_entries)) * 100)
                            }
                        )
                
                except Exception as e:
                    error_count += 1
                    errors.append(f"Row {idx + 1}: {str(e)}")
                    if error_count > 100:  # Limit error collection
                        errors.append("... (additional errors truncated)")
                        break
            
            # Final commit
            db.session.commit()
            
            return {
                'status': 'completed',
                'total_parsed': len(parsed_entries),
                'created_count': created_count,
                'error_count': error_count,
                'errors': errors[:20]  # Return first 20 errors
            }
        
        except Exception as e:
            db.session.rollback()
            return {
                'status': 'failed',
                'error': str(e)
            }
