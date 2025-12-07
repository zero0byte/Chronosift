from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_socketio import SocketIO
from flask_swagger_ui import get_swaggerui_blueprint
from config import config

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
socketio = SocketIO()


def create_app(config_name='default'):
    """Application factory pattern."""
    app = Flask(__name__)
    
    # Disable strict slashes to prevent 308 redirects that break CORS
    app.url_map.strict_slashes = False
    
    # Load configuration
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    
    # CORS configuration - allow all origins in development
    cors_origins = app.config['CORS_ORIGINS']
    if cors_origins == ['*']:
        CORS(app, origins="*", supports_credentials=True)
        socketio.init_app(app, cors_allowed_origins="*")
    else:
        CORS(app, origins=cors_origins, supports_credentials=True)
        socketio.init_app(app, cors_allowed_origins=cors_origins)
    
    # Register blueprints
    from app.routes import auth, users, teams, projects, timelines, transforms, uploads, views, enrichment, saved_queries, comments, activities, reports, iocs, key_timestamps, attack_chains, entry_links, llm_analysis, jobs
    
    app.register_blueprint(auth.bp, url_prefix='/api/auth')
    app.register_blueprint(users.bp, url_prefix='/api/users')
    app.register_blueprint(teams.bp, url_prefix='/api/teams')
    app.register_blueprint(projects.bp, url_prefix='/api/projects')
    app.register_blueprint(timelines.bp, url_prefix='/api/timelines')
    app.register_blueprint(transforms.bp, url_prefix='/api/transforms')
    app.register_blueprint(uploads.bp, url_prefix='/api/upload')
    app.register_blueprint(views.bp, url_prefix='/api/views')
    app.register_blueprint(enrichment.bp)
    app.register_blueprint(saved_queries.bp)
    app.register_blueprint(comments.bp, url_prefix='/api/comments')
    app.register_blueprint(activities.bp, url_prefix='/api/activities')
    app.register_blueprint(reports.bp, url_prefix='/api/reports')
    app.register_blueprint(iocs.bp, url_prefix='/api/iocs')
    app.register_blueprint(key_timestamps.bp, url_prefix='/api')
    app.register_blueprint(attack_chains.bp, url_prefix='/api')
    app.register_blueprint(entry_links.bp, url_prefix='/api')
    app.register_blueprint(llm_analysis.bp)
    app.register_blueprint(jobs.bp)
    
    # Import socket events to register handlers
    # Must use 'from . import' to avoid shadowing with local 'app' variable
    from . import socket_events
    
    # Swagger UI for API documentation
    SWAGGER_URL = '/api/docs'
    API_URL = '/static/swagger.json'
    swaggerui_blueprint = get_swaggerui_blueprint(
        SWAGGER_URL,
        API_URL,
        config={
            'app_name': "ChronoSift API",
            'docExpansion': 'list',
            'defaultModelsExpandDepth': 3
        }
    )
    app.register_blueprint(swaggerui_blueprint, url_prefix=SWAGGER_URL)
    
    # Health check endpoint
    @app.route('/health')
    def health():
        return {'status': 'healthy'}, 200
    
    return app
