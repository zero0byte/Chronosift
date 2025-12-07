from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from app.models.timeline import Timeline
from app.models.transform import Transform
from app.tasks.file_processing import process_file_upload
from celery.result import AsyncResult
import os

bp = Blueprint('uploads', __name__)

# Allowed file extensions
ALLOWED_EXTENSIONS = {'csv', 'json', 'xml', 'txt'}


def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@bp.route('/', methods=['POST'])
@jwt_required()
def upload_file():
    """
    Upload a file for processing.
    Expects multipart/form-data with:
    - file: The file to upload
    - timeline_id: ID of timeline to add entries to
    - transform_id: ID of transform to use for parsing
    """
    current_user_id = int(get_jwt_identity())
    
    # Check if file is present
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': f'File type not allowed. Allowed types: {ALLOWED_EXTENSIONS}'}), 400
    
    # Get timeline_id and transform_id from form data
    timeline_id = request.form.get('timeline_id', type=int)
    transform_id = request.form.get('transform_id', type=int)
    
    if not timeline_id:
        return jsonify({'error': 'timeline_id is required'}), 400
    if not transform_id:
        return jsonify({'error': 'transform_id is required'}), 400
    
    # Verify timeline exists and user has access
    timeline = Timeline.query.get_or_404(timeline_id)
    transform = Transform.query.get_or_404(transform_id)
    
    # Check if transform format matches file extension
    file_ext = file.filename.rsplit('.', 1)[1].lower()
    if file_ext == 'txt':
        file_ext = 'csv'  # Treat txt as csv
    
    if transform.input_format != file_ext:
        return jsonify({
            'error': f'Transform expects {transform.input_format} but file is {file_ext}'
        }), 400
    
    try:
        # Read file content
        file_content = file.read().decode('utf-8')
        
        # Queue processing task
        task = process_file_upload.delay(
            file_content,
            timeline_id,
            transform_id,
            current_user_id
        )
        
        return jsonify({
            'message': 'File uploaded and queued for processing',
            'task_id': task.id,
            'filename': secure_filename(file.filename)
        }), 202
    
    except UnicodeDecodeError:
        return jsonify({'error': 'File must be UTF-8 encoded text'}), 400
    except Exception as e:
        return jsonify({'error': f'Failed to process file: {str(e)}'}), 500


@bp.route('/process', methods=['POST'])
@jwt_required()
def process_inline():
    """
    Process file content directly without uploading a file.
    Expects JSON with:
    - content: File content as string
    - timeline_id: ID of timeline to add entries to
    - transform_id: ID of transform to use for parsing
    """
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    if 'content' not in data:
        return jsonify({'error': 'content is required'}), 400
    if 'timeline_id' not in data:
        return jsonify({'error': 'timeline_id is required'}), 400
    if 'transform_id' not in data:
        return jsonify({'error': 'transform_id is required'}), 400
    
    timeline_id = data['timeline_id']
    transform_id = data['transform_id']
    
    # Verify timeline and transform exist
    timeline = Timeline.query.get_or_404(timeline_id)
    transform = Transform.query.get_or_404(transform_id)
    
    try:
        # Queue processing task
        task = process_file_upload.delay(
            data['content'],
            timeline_id,
            transform_id,
            current_user_id
        )
        
        return jsonify({
            'message': 'Content queued for processing',
            'task_id': task.id
        }), 202
    
    except Exception as e:
        return jsonify({'error': f'Failed to process content: {str(e)}'}), 500


@bp.route('/status/<task_id>', methods=['GET'])
@jwt_required()
def get_task_status(task_id):
    """Get the status of a processing task."""
    task = AsyncResult(task_id)
    
    if task.state == 'PENDING':
        response = {
            'state': task.state,
            'status': 'Task is waiting to be processed...'
        }
    elif task.state == 'PROCESSING':
        response = {
            'state': task.state,
            'status': task.info.get('status', ''),
            'progress': task.info.get('progress', 0)
        }
    elif task.state == 'SUCCESS':
        response = {
            'state': task.state,
            'result': task.result
        }
    elif task.state == 'FAILURE':
        response = {
            'state': task.state,
            'error': str(task.info)
        }
    else:
        response = {
            'state': task.state,
            'status': str(task.info)
        }
    
    return jsonify(response), 200
