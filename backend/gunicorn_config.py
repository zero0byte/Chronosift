"""Gunicorn configuration for Chronosift backend."""
import multiprocessing
import os

# Disable eventlet's greendns to avoid httpx DNS issues
os.environ['EVENTLET_NO_GREENDNS'] = 'yes'

# Server socket
bind = "0.0.0.0:5000"
backlog = 2048

# Worker processes
workers = 2  # Reduced for large uploads
worker_class = "eventlet"  # Required for Flask-SocketIO WebSocket support
worker_connections = 1000
timeout = 1800  # 30 minutes for large file uploads
keepalive = 5
graceful_timeout = 1800

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'

# Process naming
proc_name = "timeliner"

# Server mechanics
daemon = False
pidfile = None
umask = 0
user = None
group = None
tmp_upload_dir = None

# Limits
limit_request_line = 0
limit_request_fields = 100
limit_request_field_size = 0
