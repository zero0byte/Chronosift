"""API routes for report templates and report generation."""
from flask import Blueprint, request, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Report, ReportTemplate, Project, ProjectMember
from app.services.report_service import ReportService
from functools import wraps
import asyncio

bp = Blueprint('reports', __name__)


def check_project_access(permission='read'):
    """Decorator to check if user has access to a project."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_id = get_jwt_identity()
            project_id = kwargs.get('project_id') or request.json.get('project_id')
            
            if not project_id:
                return jsonify({'error': 'Project ID required'}), 400
            
            # Check project membership
            membership = ProjectMember.query.filter_by(
                user_id=user_id,
                project_id=project_id
            ).first()
            
            if not membership:
                return jsonify({'error': 'Access denied. You are not a member of this project.'}), 403
            
            # Check permission level
            permission_levels = {'read': 0, 'write': 1, 'admin': 2}
            user_level = permission_levels.get(membership.permissions, 0)
            required_level = permission_levels.get(permission, 0)
            
            if user_level < required_level:
                return jsonify({'error': f'Insufficient permissions. {permission} access required.'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# ==================== Report Templates ====================

@bp.route('/templates', methods=['POST'])
@jwt_required()
@check_project_access(permission='write')
def create_template():
    """Create a new report template."""
    data = request.json
    user_id = get_jwt_identity()
    
    # Validate required fields
    required = ['name', 'template_content', 'project_id']
    if not all(field in data for field in required):
        return jsonify({'error': 'Missing required fields'}), 400
    
    template = ReportTemplate(
        name=data['name'],
        description=data.get('description'),
        project_id=data['project_id'],
        created_by=user_id,
        template_content=data['template_content'],
        config=data.get('config', {}),
        is_public=data.get('is_public', False),
        category=data.get('category')
    )
    
    db.session.add(template)
    db.session.commit()
    
    return jsonify(template.to_dict()), 201


@bp.route('/templates/<int:template_id>', methods=['GET'])
@jwt_required()
def get_template(template_id):
    """Get a specific report template."""
    user_id = get_jwt_identity()
    template = ReportTemplate.query.get(template_id)
    
    if not template:
        return jsonify({'error': 'Template not found'}), 404
    
    # Check access - must be member of the project
    membership = ProjectMember.query.filter_by(
        user_id=user_id,
        project_id=template.project_id
    ).first()
    
    if not membership:
        return jsonify({'error': 'Access denied'}), 403
    
    # Check if user can access this template
    if not template.is_public and template.created_by != user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify(template.to_dict())


@bp.route('/projects/<int:project_id>/templates', methods=['GET'])
@jwt_required()
@check_project_access(permission='read')
def list_templates(project_id):
    """List all templates for a project."""
    user_id = get_jwt_identity()
    
    # Get public templates + user's own templates
    templates = ReportTemplate.query.filter(
        ReportTemplate.project_id == project_id
    ).filter(
        db.or_(
            ReportTemplate.is_public == True,
            ReportTemplate.created_by == user_id
        )
    ).order_by(ReportTemplate.created_at.desc()).all()
    
    return jsonify([t.to_dict() for t in templates])


@bp.route('/templates/<int:template_id>', methods=['PUT'])
@jwt_required()
def update_template(template_id):
    """Update a report template."""
    user_id = get_jwt_identity()
    template = ReportTemplate.query.get(template_id)
    
    if not template:
        return jsonify({'error': 'Template not found'}), 404
    
    # Check if user owns the template or is admin
    membership = ProjectMember.query.filter_by(
        user_id=user_id,
        project_id=template.project_id
    ).first()
    
    if not membership:
        return jsonify({'error': 'Access denied'}), 403
    
    if template.created_by != user_id and membership.permissions != 'admin':
        return jsonify({'error': 'Access denied. Only template creator or project admin can edit.'}), 403
    
    data = request.json
    
    # Update fields
    if 'name' in data:
        template.name = data['name']
    if 'description' in data:
        template.description = data['description']
    if 'template_content' in data:
        template.template_content = data['template_content']
    if 'config' in data:
        template.config = data['config']
    if 'is_public' in data:
        template.is_public = data['is_public']
    if 'category' in data:
        template.category = data['category']
    
    db.session.commit()
    
    return jsonify(template.to_dict())


@bp.route('/templates/<int:template_id>', methods=['DELETE'])
@jwt_required()
def delete_template(template_id):
    """Delete a report template."""
    user_id = get_jwt_identity()
    template = ReportTemplate.query.get(template_id)
    
    if not template:
        return jsonify({'error': 'Template not found'}), 404
    
    # Check if user owns the template or is admin
    membership = ProjectMember.query.filter_by(
        user_id=user_id,
        project_id=template.project_id
    ).first()
    
    if not membership:
        return jsonify({'error': 'Access denied'}), 403
    
    if template.created_by != user_id and membership.permissions != 'admin':
        return jsonify({'error': 'Access denied. Only template creator or project admin can delete.'}), 403
    
    db.session.delete(template)
    db.session.commit()
    
    return jsonify({'message': 'Template deleted successfully'})


# ==================== Report Generation ====================

@bp.route('/generate', methods=['POST'])
@jwt_required()
@check_project_access(permission='read')
def generate_report():
    """Generate a report from a template."""
    data = request.json
    user_id = get_jwt_identity()
    
    # Validate required fields
    if 'template_id' not in data or 'project_id' not in data:
        return jsonify({'error': 'template_id and project_id required'}), 400
    
    template_id = data['template_id']
    project_id = data['project_id']
    
    # Check if template exists and user has access
    template = ReportTemplate.query.get(template_id)
    if not template:
        return jsonify({'error': 'Template not found'}), 404
    
    if template.project_id != project_id:
        return jsonify({'error': 'Template does not belong to this project'}), 400
    
    # Check template access
    if not template.is_public and template.created_by != user_id:
        return jsonify({'error': 'Access denied to this template'}), 403
    
    # Extract parameters
    parameters = {
        'timeline_id': data.get('timeline_id'),
        'start_date': data.get('start_date'),
        'end_date': data.get('end_date'),
        'entry_limit': data.get('entry_limit', 1000),
        'filters': data.get('filters', {}),
        'name': data.get('name', f"Report - {template.name}"),
        'description': data.get('description'),
        'format': data.get('format', 'pdf')  # 'pdf' or 'docx'
    }
    
    try:
        # Generate report
        report_service = ReportService()
        report = report_service.generate_report(
            template_id=template_id,
            project_id=project_id,
            user_id=user_id,
            parameters=parameters
        )
        
        return jsonify(report.to_dict()), 201
    
    except Exception as e:
        current_app.logger.error(f"Error generating report: {str(e)}")
        return jsonify({'error': f'Failed to generate report: {str(e)}'}), 500


@bp.route('/generate-ai', methods=['POST'])
@jwt_required()
@check_project_access(permission='read')
def generate_ai_report():
    """Generate an AI-powered forensic report."""
    data = request.json
    user_id = get_jwt_identity()
    
    if 'project_id' not in data:
        return jsonify({'error': 'project_id required'}), 400
        
    project_id = data['project_id']
    timeline_id = data.get('timeline_id')
    
    # Validate that there are sufficient analyzed events before proceeding
    validation_result = ReportService.validate_llm_report_data(project_id, timeline_id)
    if not validation_result['valid']:
        return jsonify({
            'error': validation_result['message'],
            'details': validation_result.get('details')
        }), 400
    
    parameters = {
        'timeline_id': timeline_id,
        'name': data.get('name', 'AI Investigation Report'),
        'description': data.get('description'),
        'model_preference': data.get('model_preference')
    }
    
    try:
        report_service = ReportService()
        
        # Run async method in new event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            report = loop.run_until_complete(
                report_service.generate_llm_report(
                    project_id=project_id,
                    user_id=user_id,
                    parameters=parameters
                )
            )
        finally:
            loop.close()
        
        return jsonify(report.to_dict()), 201
        
    except Exception as e:
        current_app.logger.error(f"Error generating AI report: {str(e)}")
        return jsonify({'error': f'Failed to generate report: {str(e)}'}), 500


@bp.route('/projects/<int:project_id>/reports', methods=['GET'])
@jwt_required()
@check_project_access(permission='read')
def list_reports(project_id):
    """List all reports for a project."""
    user_id = get_jwt_identity()
    
    # Get all reports for the project
    reports = Report.query.filter_by(
        project_id=project_id
    ).order_by(Report.created_at.desc()).all()
    
    return jsonify([r.to_dict() for r in reports])


@bp.route('/reports/<int:report_id>', methods=['GET'])
@jwt_required()
def get_report(report_id):
    """Get a specific report."""
    user_id = get_jwt_identity()
    report = Report.query.get(report_id)
    
    if not report:
        return jsonify({'error': 'Report not found'}), 404
    
    # Check access
    membership = ProjectMember.query.filter_by(
        user_id=user_id,
        project_id=report.project_id
    ).first()
    
    if not membership:
        return jsonify({'error': 'Access denied'}), 403
    
    # Include HTML content if requested
    include_content = request.args.get('include_content', 'false').lower() == 'true'
    
    return jsonify(report.to_dict(include_content=include_content))


@bp.route('/reports/<int:report_id>/download', methods=['GET'])
@jwt_required()
def download_report(report_id):
    """Download a report as PDF or DOCX."""
    user_id = get_jwt_identity()
    report = Report.query.get(report_id)
    
    if not report:
        return jsonify({'error': 'Report not found'}), 404
    
    # Check access
    membership = ProjectMember.query.filter_by(
        user_id=user_id,
        project_id=report.project_id
    ).first()
    
    if not membership:
        return jsonify({'error': 'Access denied'}), 403
    
    # Get file path
    report_service = ReportService()
    file_path = report_service.get_pdf_path(report_id)  # Works for both PDF and DOCX
    
    if not file_path:
        return jsonify({'error': 'Report file not found'}), 404
    
    # Determine MIME type and extension based on report format
    report_format = report.format or 'pdf'
    if report_format == 'docx':
        mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        extension = 'docx'
    else:
        mimetype = 'application/pdf'
        extension = 'pdf'
    
    # Send file with explicit headers
    from flask import make_response
    import os
    
    with open(file_path, 'rb') as f:
        file_data = f.read()
    
    response = make_response(file_data)
    response.headers['Content-Type'] = mimetype
    response.headers['Content-Disposition'] = f'attachment; filename="{report.name}.{extension}"'
    response.headers['Content-Length'] = str(len(file_data))
    
    current_app.logger.info(f"Sending report {report_id}: format={report_format}, mimetype={mimetype}, filename={report.name}.{extension}, size={len(file_data)}")
    
    return response


@bp.route('/reports/<int:report_id>', methods=['DELETE'])
@jwt_required()
def delete_report(report_id):
    """Delete a report."""
    user_id = get_jwt_identity()
    report = Report.query.get(report_id)
    
    if not report:
        return jsonify({'error': 'Report not found'}), 404
    
    # Check access - user must be creator or project admin
    membership = ProjectMember.query.filter_by(
        user_id=user_id,
        project_id=report.project_id
    ).first()
    
    if not membership:
        return jsonify({'error': 'Access denied'}), 403
    
    if report.created_by != user_id and membership.permissions != 'admin':
        return jsonify({'error': 'Access denied. Only report creator or project admin can delete.'}), 403
    
    # Delete PDF file
    report_service = ReportService()
    report_service.delete_report_pdf(report_id)
    
    # Delete report record
    db.session.delete(report)
    db.session.commit()
    
    return jsonify({'message': 'Report deleted successfully'})
