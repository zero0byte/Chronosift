"""Test script to verify AI report validation logic"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from app import create_app, db
from app.services.report_service import ReportService
from app.models import Project, Timeline

# Initialize Flask app
app = create_app()

with app.app_context():
    # Test with a project that has no analyzed events
    projects = Project.query.all()
    
    if not projects:
        print("No projects found in database")
        sys.exit(1)
    
    project = projects[0]
    print(f"\nTesting validation for project: {project.name} (ID: {project.id})")
    
    # Test validation without timeline
    print("\n=== Test 1: Validation without specific timeline ===")
    result = ReportService.validate_llm_report_data(project.id)
    print(f"Valid: {result['valid']}")
    print(f"Message: {result['message']}")
    print(f"Details: {result.get('details')}")
    
    # Test with specific timeline
    timelines = Timeline.query.filter_by(project_id=project.id).all()
    if timelines:
        timeline = timelines[0]
        print(f"\n=== Test 2: Validation with timeline: {timeline.name} (ID: {timeline.id}) ===")
        result = ReportService.validate_llm_report_data(project.id, timeline.id)
        print(f"Valid: {result['valid']}")
        print(f"Message: {result['message']}")
        print(f"Details: {result.get('details')}")
    else:
        print("\nNo timelines found in project")
    
    print("\n✓ Validation tests completed!")
