import os
from app import create_app, socketio

app = create_app(os.getenv('FLASK_ENV', 'development'))

if __name__ == '__main__':
    socketio.run(
        app, 
        host='0.0.0.0', 
        port=5000, 
        debug=app.config['DEBUG'],
        allow_unsafe_werkzeug=True  # Only for development
    )
