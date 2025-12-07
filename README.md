# Chronosift

**Chronosift** is a forensic timeline analysis web application built with Flask (Python) backend and React (TypeScript) frontend. It allows teams to collaboratively analyze forensic data from various tools, create customized timelines, and manage investigations.

## Help Docs

[Chronosift Docs](https://chronosift-docs.netlify.app/)

## Features

### Core Functionality
- **Multi-User & Team Management**: Create teams, invite users, assign roles
- **Project Organization**: Organize investigations into projects with granular access control
- **Dynamic Timelines**: Create timelines with customizable columns (timestamps, text, numbers, tags, booleans)
- **Data Transforms**: Build reusable parsers for CSV/JSON/XML tool outputs
- **File Upload**: Drag-and-drop file processing with async background tasks
- **Advanced Search**: Full-text search across timeline entries with field-specific filtering
- **Master Timeline**: Promote important events from detailed timelines into a consolidated master view

### Analysis Features
- **LLM-Powered Analysis**: Automatic priority scoring and MITRE ATT&CK mapping using OpenAI or local LLM (Ollama)
- **Attack Chain Detection**: AI-powered detection of multi-stage attacks across timeline events
- **Interactive Table View**: Inline editing, multi-select, bulk operations, resizable columns
- **Multiple View Modes**: Switch between Table, Chart, Gantt, Event Clusters, and Activity Heatmap views
- **Maximize View**: Focus mode that hides auxiliary panels for maximum screen real estate
- **Expandable Rows**: View complete source data for each event
- **Advanced Filters**: Filter by date ranges, numeric ranges, tags, text, and boolean values
- **Project-Wide Search**: Search across all timelines in a project with modal interface
- **Saved Views**: Save and restore column configurations, filters, and layout preferences
- **Saved Queries**: Create, save, and share complex search queries with your team
- **CSV Export**: Export timeline data for further analysis
- **Column Management**: Add/remove/reorder timeline columns on the fly
- **Keyboard Shortcuts**: Efficient navigation with keyboard shortcuts (Ctrl+F, Ctrl+M, Ctrl+1-5, etc.)

### Collaboration Features
- **Comments on Entries**: Add comments to timeline entries with threaded discussions
- **@Mentions**: Tag team members in comments to notify them
- **Activity Feed**: Track all project activities and changes in real-time
- **Notifications**: Get notified when mentioned in comments
- **Real-time Updates**: WebSocket-based live updates across all users

### Reporting Features
- **Custom Report Templates**: Create reusable HTML/Jinja2 templates for reports
- **PDF Export**: Generate professional PDF reports from timeline data
- **Template Variables**: Access project, timeline, entry, and statistics data
- **Configurable Layout**: Choose page size (A4/Letter/Legal) and orientation
- **Report Library**: Save and manage generated reports
- **Template Sharing**: Make templates public for team use

### IOC Management
- **Indicator Tracking**: Manage Indicators of Compromise (IOCs) across projects
- **Automatic Extraction**: Extract IOCs from timeline entries (IPs, domains, URLs, hashes, CVEs, emails)
- **Smart Filtering**: Automatically filters private IPs and common false positives
- **Supported IOC Types**:
  - IPv4/IPv6 addresses
  - Domain names and URLs
  - File hashes (MD5, SHA1, SHA256)
  - Email addresses
  - CVE identifiers
- **IOC Attributes**:
  - Confidence levels (low, medium, high, confirmed)
  - Severity ratings (info, low, medium, high, critical)
  - Status tracking (active, investigating, resolved, false positive)
  - Tags and notes for context
  - First/last seen timestamps
- **Advanced Features**:
  - Bulk operations (update status, confidence, tags)
  - Search and filter by type, severity, status
  - Project-wide IOC dashboard with statistics
  - Timeline-specific IOC views
  - Enrichment data integration

### Data Enrichment
- **Threat Intelligence Integration**: Enrich IOCs with data from multiple providers
- **Supported Providers**:
  - **GreyNoise** - IP reputation and classification (scanners, noise, malicious)
  - **AbuseIPDB** - IP abuse reports and confidence scores
  - **VirusTotal** - Multi-vendor malware detection for IPs, domains, files, and hashes
  - **IPInfo** - IP geolocation, ASN, and organization data
- **Secure API Key Management**:
  - Store API keys encrypted in the database
  - Manage keys per-user through Settings UI
  - Keys are decrypted only when needed for enrichment
- **Automated Enrichment**:
  - Enrich extracted IOCs directly from the IOC dashboard
  - View enrichment results with confidence scores
  - Cache enrichment data to minimize API calls
- **Performance Optimized**:
  - Parallel enrichment across multiple providers
  - Async processing with proper DNS handling
  - Compatible with eventlet WSGI server

### Included Transforms
Pre-built parsers for popular forensic tools:
(run the provided scripts to create these)
- **MFTECmd** - NTFS MFT analysis
- **EVTXCmd** - Windows Event Log parsing
- **JLECmd** - Jump List analysis
- **LnkCmd** - LNK file parsing
- **RECmd** - Windows Registry parsing

## Quick Start

### Prerequisites
- **Docker Desktop** (Windows/Mac) or **Docker Engine + Docker Compose** (Linux)
- **Git** for version control
- At least **4GB RAM** and **10GB free disk space**
- **LLM Provider** (optional): OpenAI API key OR local Ollama installation for AI-powered analysis

### Installation

**Quick Start (Docker - Recommended):**

1. **Clone the repository**
   ```bash
   git clone https://github.com/zero0byte/chronosift.git
   cd chronosift
   ```

2. **Start all services**
   ```bash
   docker-compose up -d
   ```

   Docker will automatically:
   - Build the backend Python/Flask container
   - Build the frontend React/TypeScript container (installs npm dependencies)
   - Pull PostgreSQL and Redis containers
   - Create volumes for persistent data
   - Run database migrations

   **First run takes 5-10 minutes** to build containers and install dependencies.

3. **Verify services are running**
   ```bash
   docker-compose ps
   ```

   All services should show "Up" status:
   - `chronosift_frontend` - React app (port 3000)
   - `chronosift_backend` - Flask API (port 5000)
   - `chronosift_postgres` - Database (port 5432)
   - `chronosift_redis` - Cache/queue (port 6379)
   - `chronosift_celery` - Background worker

4. **Access the application**
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:5000/api

5. **Configure LLM for AI Analysis (Optional)**
   
   LLM configuration is set in `backend/.env` file:
   
   **Option A: OpenAI**
   ```bash
   # Add to backend/.env
   OPENAI_API_KEY=your-api-key-here
   ```
   
   **Option B: Local Ollama**
   ```bash
   # Add to backend/.env
   LOCAL_LLM_BASE_URL=http://host.docker.internal:11434
   LOCAL_MODEL=mistral:latest
   ```
   
   After updating `.env`, restart the backend:
   ```bash
   docker-compose restart backend celery_worker
   ```

6. **Create your first user**
   - Navigate to http://localhost:3000
   - Click "Register" to create an admin account
   - The first registered user automatically becomes an administrator

7. **Create a team and project**
   - After logging in, go to Settings → Teams → Create Team
   - Then create your first project and assign it to the team
   - You're ready to start importing and analyzing data!

**What Gets Installed:**
- Backend: Python packages (Flask, SQLAlchemy, Celery, etc.)
- Frontend: Node.js packages (React, TypeScript, Vite, etc.)
- Database: PostgreSQL with initial schema
- All dependencies are installed **inside Docker containers** - your host machine stays clean!

### Stopping the Application

```bash
# Stop services (keeps data)
docker-compose stop

# Stop and remove containers (keeps data)
docker-compose down

# Remove everything including data (CAREFUL!)
docker-compose down -v
```

### Local Network Access

Share Chronosift with others on your local network (e.g., office LAN, home WiFi).

**⚡ Quick Start - 3 Steps**

**Step 1: Find Your Local IP Address**

```powershell
# Windows (PowerShell)
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"} | Select-Object IPAddress, InterfaceAlias
```

```bash
# Linux/Mac
ip addr show | grep "inet " | grep -v 127.0.0.1
# or
ifconfig | grep "inet " | grep -v 127.0.0.1
```

Look for your WiFi/Ethernet IP (e.g., **192.168.X.XXX** or **10.0.0.XX**)

**Step 2: Configure Frontend for Network Access**

Create `frontend/.env` with your IP:

```bash
cd frontend
echo "VITE_API_URL=http://192.168.X.XXX:5000/api" > .env
# Replace 192.168.X.XXX with YOUR IP from Step 1
```

**Step 3: Start Services and Open Firewall**

```bash
# Start Chronosift
cd ..
docker-compose up -d --build
```

**Open Windows Firewall** (if others can't connect):

1. Press `Win + R`, type `wf.msc`, press Enter
2. Click "Inbound Rules" → "New Rule..."
3. Choose "Port" → Next
4. TCP, Specific local ports: `3000` → Next
5. Allow the connection → Next  
6. Check Private and Domain → Next
7. Name: "Chronosift Frontend" → Finish
8. **Repeat for port `5000`** (name: "Chronosift Backend")

OR use PowerShell as Administrator:

```powershell
New-NetFirewallRule -DisplayName "Chronosift Frontend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private,Domain
New-NetFirewallRule -DisplayName "Chronosift Backend" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow -Profile Private,Domain
```

**🎉 Done! Share These URLs:**

- Frontend: `http://192.168.X.XXX:3000` (replace with your IP)
- Anyone on the same WiFi/LAN can access

---

**Method 2: With Nginx (Single Port, Cleaner URLs)**

For production-like setup with one port:

1. **Start with nginx**:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.nginx.yml up -d
   ```

2. **Open firewall for port 80**:
   ```powershell
   New-NetFirewallRule -DisplayName "Chronosift Nginx" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow -Profile Private,Domain
   ```

3. **Share URL**: `http://192.168.X.XXX` (no port needed!)
   - Frontend: `http://192.168.X.XXX`
   - Backend API: `http://192.168.X.XXX/api`

---

**🔍 Troubleshooting**

**Can't connect from other devices?**

1. **Test from host machine first**:
   ```powershell
   curl http://192.168.X.XXX:3000
   curl http://192.168.X.XXX:5000/api/auth/login
   ```

2. **Verify services are running**:
   ```bash
   docker-compose ps
   # All should show "Up"
   ```

3. **Check firewall rules exist**:
   ```powershell
   Get-NetFirewallRule | Where-Object {$_.DisplayName -like "*Chronosift*"}
   ```

4. **Verify frontend .env file**:
   ```bash
   cat frontend/.env
   # Should show: VITE_API_URL=http://YOUR_IP:5000/api
   ```

5. **Restart frontend after creating .env**:
   ```bash
   docker-compose restart frontend
   ```

**Network Requirements**

- ✅ All devices on same subnet (e.g., 192.168.1.x or 10.0.0.x)
- ✅ No VPN isolation between devices
- ✅ Router allows local traffic (usually default)
- ⚠️ Corporate networks may block ports - check with IT
- ⚠️ Public WiFi (coffee shops, airports) often blocks device-to-device communication

**How Frontend Finds Backend**

The frontend automatically detects the backend URL in most cases:

| Access Method | Frontend URL | Backend URL |
|---------------|--------------|-------------|
| Localhost | `http://localhost:3000` | `http://localhost:5000/api` (auto) |
| Local IP | `http://192.168.X.XXX:3000` | Needs `frontend/.env` with IP |
| Nginx | `http://192.168.X.XXX` | `/api` (auto-relative) |

**Why you need `frontend/.env` for local IP access:**
- When accessing via `http://192.168.X.XXX:3000`, the frontend runs in the browser
- Browser tries to reach backend at `http://192.168.X.XXX:5000/api` by default
- But Docker binds to the IP, so we need to tell frontend the exact IP
- The `.env` file sets `VITE_API_URL` so browser knows where to find the backend

### Remote Access via Ngrok

To share your local Chronosift instance externally (for testing/demos):


**Quick Start:**

1. **Install ngrok**: https://ngrok.com/download

2. **Start ngrok tunnel for backend**:
   ```bash
   ngrok http 5000
   ```
   
   Note the URL (e.g., `https://abc123.ngrok.io`)

3. **Configure frontend to use ngrok URL**:
   ```bash
   # Create frontend/.env
   cd frontend
   echo "VITE_API_URL=https://abc123.ngrok.io/api" > .env
   ```

4. **Restart frontend container**:
   ```bash
   docker-compose restart frontend
   ```

5. **Start ngrok tunnel for frontend**:
   ```bash
   ngrok http 3000
   ```

6. **Share the frontend URL** with testers

**Alternative: Single ngrok tunnel with nginx (Recommended)**

For a cleaner setup with one URL for everything:

1. **Start services with nginx**:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.nginx.yml up -d
   ```

2. **Start single ngrok tunnel**:
   ```bash
   ngrok http 80
   ```

3. **Share the ngrok URL** (e.g., `https://abc123.ngrok.io`)
   - Frontend: `https://abc123.ngrok.io`
   - Backend API: `https://abc123.ngrok.io/api`
   - Everything works through one URL!

**How it works:**
- Nginx reverse proxy routes traffic:
  - `/` → Frontend (React app)
  - `/api` → Backend (Flask API)
- Frontend automatically uses relative URLs, so it "just works"
- No environment variables needed!

**Security Notes:**
- Ngrok tunnels are public unless you use authentication
- Free ngrok URLs change each restart
- For production, use a proper domain with HTTPS

## User Guide

📖 **Full documentation is available at:** `docs/user-guide/index.html`

Comprehensive HTML documentation includes:
- Quick Start Guide with screenshots
- Detailed feature documentation
- LLM Analysis and MITRE ATT&CK mapping
- Attack Chain Detection
- API Reference with examples
- Troubleshooting guides

### Quick Reference

### 1. User & Team Management

**Register Account** (First time)
1. Navigate to http://localhost:3000
2. Click "Register" to create an account
3. First user becomes administrator

**Create Teams**
1. Go to Settings → Teams
2. Click "+ Create Team"
3. Add members with roles (Admin/Member)

### 2. Projects & Timelines

**Create a Project**
1. Dashboard → "+ Create Project"
2. Enter project name and select team
3. Click "Manage Access" to add team members with permissions (Read/Write/Admin)

**Create a Timeline**
1. Open a project
2. Click "+ Create Timeline"
3. Default columns created: Timestamp, Description, Tags
4. Add more columns using "Column Manager"

### 3. Data Import

**Create a Transform**
1. Dashboard → Transforms → "+ Create Transform"
2. Choose format (CSV/JSON/XML)
3. Map source fields to target timeline columns
4. Test with sample data
5. Save transform (make it public for team use)

**Upload Data**
1. Open a timeline
2. Click "Upload File" in File Uploader section
3. Select a transform
4. Drag and drop file or click to browse
5. Monitor upload progress

### 4. Analysis

**LLM-Powered Analysis**
1. Configure LLM provider in `backend/.env` (see installation step 5)
2. Click "Analyze All" to batch analyze timeline entries
3. Choose Priority Analysis, MITRE ATT&CK mapping, or both
4. Results include priority scores (High/Medium/Low) and MITRE techniques
5. Click "Detect Attack Chains" to find multi-stage attack patterns

**Search & Filter**
- Use search bar for full-text search (Ctrl+F to focus)
- Click "🔍 Filters" to open advanced filtering
- Filter by date ranges, numeric ranges, tags, or text patterns
- All filters apply across all view modes (table, chart, gantt, clusters, heatmap)

**Saved Views**
1. Configure your ideal view (column widths, visible columns, filters)
2. Click "💾 Save Current View"
3. Give it a name and optional description
4. Load saved views instantly from the dropdown

**Saved Queries**
1. Build a complex query with filters and search terms
2. Click "💾 Save Query"
3. Share queries with team members (optional)
4. Pin frequently used queries for quick access

**View Modes**
- **Table** (Ctrl+1): Standard tabular view with inline editing
- **Chart** (Ctrl+2): Visual timeline representation
- **Gantt** (Ctrl+3): Project-style timeline visualization
- **Clusters** (Ctrl+4): Group and analyze related events
- **Heatmap** (Ctrl+5): Activity intensity over time
- **Maximize** (Ctrl+M): Toggle focus mode for any view

**Data Enrichment**
1. Go to Settings (⚙️) and add your API keys for enrichment providers
2. In timeline view, use search/filter to find IPs, domains, or hashes
3. Select entries and click enrichment provider buttons
4. Enriched data is added as new columns in your timeline

**Export Data**
- Click "📥 Export CSV" to download all visible entries

**Promote Events to Master Timeline**
1. Select important entries (use checkboxes)
2. Click "⭐ Promote"
3. Events copied to master timeline with link back to source

**View Raw Data**
- Click ▶ arrow on any row to expand and see all fields from original source

**Comments & Collaboration**
1. Click on any entry to open the comments sidebar
2. Add comments, @mention team members for notifications
3. Reply to comments for threaded discussions
4. View activity feed to see all project changes
5. Check notifications bell for @mentions

**Project-Wide Search**
1. Click "🔍 Search Project" in project view
2. Search across all timelines simultaneously
3. Filter by keywords, date range, and specific timelines
4. Click results to jump to entries (opens in new tab)
5. Results are highlighted with smooth scroll

**Custom Reports**
1. Click "📊 Reports" in project view
2. Create templates using HTML and Jinja2 syntax
3. Access entry fields: `{{ entry.data.FieldName }}` or `{{ entry.data["Field Name"] }}` for spaces
4. Configure page size, orientation, and styling
5. Generate reports with custom filters (timeline, date range, entry limit)
6. Download as professional PDF documents
7. Share public templates with team members

**IOC Management**
1. **View Project IOCs**: Click "🛡️ IOCs" in project view to see all indicators
2. **Extract from Timeline**: In timeline view, click "Extract IOCs" to automatically find:
   - IP addresses (filters out private ranges)
   - Domain names and URLs
   - File hashes (MD5, SHA1, SHA256)
   - Email addresses
   - CVE identifiers
3. **Filter & Search**: Use dropdowns to filter by type, severity, or status
4. **Bulk Operations**: Select multiple IOCs and update their status:
   - Mark as "Investigating" for active analysis
   - Mark as "Resolved" when addressed
   - Mark as "False Positive" to exclude from reporting
5. **IOC Details**: Click expand icon to see confidence, first/last seen, notes, and enrichment data
6. **Tags**: Add custom tags to organize and categorize IOCs
7. **Dashboard Stats**: View quick statistics by type, severity, and status
8. **Threat Intelligence Enrichment**:
   - Click "Enrich" button on any IOC to fetch threat intelligence
   - View results from GreyNoise, AbuseIPDB, VirusTotal, and IPInfo
   - Enrichment data includes reputation, geolocation, and threat classifications
   - Confidence scores help prioritize investigation efforts
   - Configure API keys in Settings → Enrichment Providers

**Keyboard Shortcuts**
- Press `?` to view all available shortcuts

## API Documentation

**Full interactive API documentation is available at http://localhost:5000/api/docs**

The API documentation is powered by Swagger UI and includes:
- All available endpoints organized by category
- Request/response schemas with examples
- "Try it out" functionality to test endpoints directly
- Authentication configuration
- Detailed parameter descriptions

### Authentication
All endpoints (except register/login) require JWT authentication:
```
Authorization: Bearer <access_token>
```

### Quick Reference - Key Endpoints

**Authentication**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT tokens
- `GET /api/auth/me` - Get current user info

**Projects & Timelines**
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project (requires `team_id`)
- `GET /api/projects/{id}/search` - Search across all timelines
- `POST /api/timelines` - Create timeline (requires `project_id`)
- `GET /api/timelines/{id}` - Get timeline details

**LLM Analysis**
- `POST /api/llm/analysis/timeline/{timeline_id}/batch` - Batch analyze all entries
- `POST /api/llm/analysis/entry/{entry_id}/priority` - Single entry priority analysis
- `POST /api/llm/analysis/entry/{entry_id}/attack` - MITRE ATT&CK mapping
- `POST /api/llm/analysis/timeline/{timeline_id}/detect-and-create-chains-async` - Detect attack chains
- `GET /api/jobs/{job_id}` - Check analysis job status

**Comments & Collaboration**
- `GET /api/comments/entry/{entry_id}` - Get comments for entry
- `POST /api/comments/entry/{entry_id}` - Add comment (supports @mentions)
- `GET /api/activities/project/{project_id}` - Get project activity feed

**Reports**
- `POST /api/reports/templates` - Create report template
- `GET /api/reports/projects/{project_id}/templates` - List templates
- `POST /api/reports/generate` - Generate PDF report
- `GET /api/reports/reports/{report_id}/download` - Download PDF

**IOC Management**
- `GET /api/iocs/projects/{project_id}/iocs` - List IOCs with filtering
- `POST /api/iocs/projects/{project_id}/iocs` - Create IOC
- `GET /api/iocs/iocs/{ioc_id}` - Get IOC details
- `PUT /api/iocs/iocs/{ioc_id}` - Update IOC
- `DELETE /api/iocs/iocs/{ioc_id}` - Delete IOC
- `POST /api/iocs/projects/{project_id}/iocs/extract` - Extract IOCs from entries
- `POST /api/iocs/projects/{project_id}/iocs/bulk` - Bulk update IOCs
- `GET /api/iocs/projects/{project_id}/iocs/stats` - Get IOC statistics

**Other Endpoints**
- `POST /api/upload` - Upload file for processing
- `GET /api/timelines/{id}/search` - Search timeline entries
- `POST /api/enrichment/enrich` - Enrich IOCs with threat intelligence

For complete documentation with request/response examples, visit http://localhost:5000/api/docs

## Architecture

### Stack
- **Backend**: Flask (Python), PostgreSQL, Redis, Celery
- **Frontend**: React (TypeScript), Vite
- **Infrastructure**: Docker, Docker Compose

### Services
- `postgres`: PostgreSQL 15 database
- `redis`: Redis for caching and task queue
- `backend`: Flask API server (port 5000)
- `celery_worker`: Background task processor
- `frontend`: React development server (port 3000)

## Troubleshooting

**Frontend can't connect**
- Ensure backend runs on port 5000
- Check `docker-compose ps`
- Verify CORS settings in backend/.env

**Database issues**
```bash
# Check database connection
docker-compose exec backend flask db upgrade

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
```

**Celery not processing**
```bash
# Check celery worker logs
docker-compose logs celery_worker

# Restart celery worker
docker-compose restart celery_worker
```

**Enrichment not working**
- Verify API keys are entered in Settings (⚙️) → Enrichment Providers
- Check backend logs for API errors: `docker-compose logs backend`
- Ensure IOCs are valid (public IPs, real domains, proper hash formats)
- Some providers require API keys (AbuseIPDB, VirusTotal)
- GreyNoise and IPInfo work without keys but have rate limits
- Check network connectivity from Docker containers
- Enrichment errors are logged with the IOC for troubleshooting

**LLM Analysis not working**
- Verify LLM configuration in `backend/.env`
- For OpenAI: Check `OPENAI_API_KEY` is set correctly
- For Ollama: Ensure Ollama is running and `LOCAL_LLM_BASE_URL` is accessible
- Restart backend after changing `.env`: `docker-compose restart backend celery_worker`
- Check backend logs: `docker-compose logs backend | grep -i llm`
- Verify Celery worker is processing jobs: `docker-compose logs celery_worker`
- Monitor job status in timeline view during analysis

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Production Deployment

### Environment Configuration

**1. Backend Configuration** (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and update:

```bash
# Generate strong random keys (32+ characters)
SECRET_KEY=your-production-secret-key-here
JWT_SECRET_KEY=your-production-jwt-secret-here

# Update database credentials
DATABASE_URL=postgresql://timeliner:STRONG_PASSWORD_HERE@postgres:5432/timeliner_db


# Update CORS for your production domain
CORS_ORIGINS=https://yourdomain.com
```

**2. Docker Compose** (`docker-compose.yml`)

Update database credentials:

```yaml
postgres:
  environment:
    POSTGRES_USER: chronosift_user
    POSTGRES_PASSWORD: STRONG_PASSWORD_HERE  # Change this!
    POSTGRES_DB: chronosift_db
```

Update backend environment variables to match:

```yaml
backend:
  environment:
    DATABASE_URL: DATABASE_URL=postgresql://timeliner:STRONG_PASSWORD_HERE@postgres:5432/timeliner_db
    SECRET_KEY: your-production-secret-key-here
    JWT_SECRET_KEY: your-production-jwt-secret-here
```

**3. Frontend Configuration** (`frontend/src/lib/api.ts`)

Update the API URL for your production domain:

```typescript
const API_URL = 'https://yourdomain.com/api';
```

### HTTPS Configuration

For production, run Chronosift behind a reverse proxy (nginx, Traefik, Caddy) with SSL/TLS:

**Example nginx configuration:**

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000/api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Security Checklist

Before deploying to production:

- [ ] Change `SECRET_KEY` to a strong random value (32+ characters)
- [ ] Change `JWT_SECRET_KEY` to a strong random value (32+ characters)
- [ ] Change database password from default `password`
- [ ] Update `CORS_ORIGINS` to your production domain
- [ ] Configure frontend API URL for production domain
- [ ] Enable HTTPS with valid SSL/TLS certificates
- [ ] Set up regular database backups
- [ ] Configure firewall rules (only expose ports 80/443)
- [ ] Regularly rotate enrichment provider API keys
- [ ] Keep dependencies updated (`docker-compose pull`)
- [ ] Review and limit user permissions
- [ ] Set up monitoring and logging

### Generating Strong Keys

```bash
# Generate random keys using OpenSSL
openssl rand -hex 32

# Or using Python
python -c "import secrets; print(secrets.token_hex(32))"
```

## Security

**Important Security Notes:**
- Never commit `.env` files or API keys to version control
- All default credentials in this repository are for development only
- Change ALL default passwords and secret keys before production deployment
- Store enrichment API keys securely via the Settings UI (encrypted at rest)
- Run behind HTTPS in production (use Let's Encrypt for free certificates)
- Regularly update dependencies and apply security patches
- Use strong, unique passwords for all user accounts
- Implement rate limiting on API endpoints for production
- Regular security audits and penetration testing recommended

## License

MIT
