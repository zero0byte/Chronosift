# Contributing to Chronosift

Thank you for your interest in contributing to Chronosift! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help create a welcoming environment for all contributors

## How to Contribute

### Reporting Bugs

If you find a bug:

1. **Check existing issues** - Search the issue tracker to see if it's already reported
2. **Create a detailed issue** - Include:
   - Clear description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (OS, browser, Docker version)
   - Screenshots or logs if applicable

### Suggesting Features

Feature requests are welcome! Please:

1. **Check existing feature requests** first
2. **Describe the use case** - Explain why this feature would be useful
3. **Provide examples** - Show how it would work
4. **Consider scope** - Keep features focused and manageable

### Contributing Code

#### Development Setup

1. **Fork the repository**

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/chronosift.git
   cd chronosift
   ```

3. **Start the development environment**
   ```bash
   docker-compose up -d
   ```

4. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

#### Code Guidelines

**Backend (Python/Flask)**
- Follow PEP 8 style guidelines
- Add docstrings to functions and classes
- Write type hints where appropriate
- Keep functions focused and single-purpose
- Add tests for new functionality

**Frontend (React/TypeScript)**
- Use TypeScript for type safety
- Follow existing component patterns
- Use functional components with hooks
- Keep components small and reusable
- Add inline comments for complex logic

**Database**
- Create migrations for schema changes
- Use descriptive table/column names
- Add indexes for frequently queried fields
- Document complex queries

#### Testing

Before submitting:

- Ensure all existing tests pass
- Add tests for new features
- Test manually in the UI
- Check for console errors
- Verify database migrations work on fresh install

#### Commit Messages

Use clear, descriptive commit messages:

```
Add feature: Save timeline queries

- Implement SavedQueries component
- Add backend API endpoints for CRUD operations
- Create database migration for saved_queries table
- Update documentation
```

Format:
- First line: Brief summary (50 chars or less)
- Blank line
- Detailed description with bullet points
- Reference issue numbers: `Fixes #123` or `Relates to #456`

#### Pull Request Process

1. **Update documentation** - Update README.md if needed
2. **Add to CHANGELOG** - Document your changes
3. **Test thoroughly** - Both automated and manual testing
4. **Keep PR focused** - One feature/fix per PR
5. **Describe changes** - Explain what and why in PR description
6. **Reference issues** - Link related issues

**PR Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How has this been tested?

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] All tests pass
```

### Contributing Documentation

Documentation improvements are highly valued:

- Fix typos or unclear explanations
- Add examples or tutorials
- Improve API documentation
- Create troubleshooting guides
- Translate documentation

### Contributing Transforms

Transforms are the heart of Chronosift - they map forensic tool outputs to timeline entries. We welcome new parsers for any forensic tool!

#### Quick Start: Use Provided Scripts

We've included PowerShell scripts to automatically create transforms for popular tools:

**For EZ Tools (MFTECmd, EVTXCmd, JLECmd, LnkCmd, RECmd):**

```powershell
.\create_transforms.ps1
```

This script:
- Prompts for your Chronosift credentials
- Scans `C:\Users\<user>\Documents\EZ Tools` for tool output folders
- Creates transforms for any tools with CSV output
- Automatically names them with date suffix (e.g., `mftecmd-091125`)

**Configuration:**
Edit the script to change the base path:
```powershell
$BasePath = "C:\Path\To\Your\Tools"
```

**For Chainsaw (Threat Hunting):**

```powershell
.\create_chainsaw_transform.ps1
```

This creates a JSON parser for Chainsaw's EVTX analysis output. Update credentials in the script:
```powershell
$email = "your@email.com"
$password = "YourPassword"
```

#### Supported Tools

The provided scripts create transforms for:

**EZ Tools Suite:**
- **MFTECmd** - NTFS Master File Table analysis
  - Extracts: Created times, filenames, paths, sizes, directory flags
- **EVTXCmd** - Windows Event Log parsing
  - Extracts: Timestamps, providers, event IDs, levels, payloads
- **JLECmd** - Jump List analysis
  - Extracts: File access times, paths, interaction counts, machine IDs
- **LnkCmd** - LNK shortcut file parsing
  - Extracts: Target paths, modified times, arguments, file sizes
- **RECmd** - Windows Registry parsing
  - Extracts: Registry keys, values, timestamps, categories

**Threat Hunting:**
- **Chainsaw** - Sigma-rule based EVTX threat hunting
  - Extracts: Detection timestamps, rule names, severity levels, IOCs
  - Supports nested JSON paths for EventData extraction

#### Creating Custom Transforms

**Option 1: Via Web UI**

1. Navigate to **Dashboard → Transforms → Create Transform**
2. Choose input format (CSV, JSON, or XML)
3. Configure field mappings:
   - **Source**: Field name in tool output
   - **Target**: Column name in timeline
   - **Type**: timestamp, text, number, boolean, or tags
4. Test with sample data
5. Save and mark as public to share with team

**Option 2: Via API Script**

Create a PowerShell or Python script:

```powershell
# PowerShell Example
$mapping = @{
  csv = @{ delimiter = ","; has_header = $true }
  fields = @(
    @{ source = "Timestamp"; target = "Timestamp"; type = "timestamp" }
    @{ source = "Message"; target = "Description"; type = "text" }
  )
}

$transform = @{
  name = "mytool-parser"
  input_format = "csv"
  mapping = $mapping
  description = "Parser for MyTool output"
  is_public = $true
} | ConvertTo-Json -Depth 8

Invoke-RestMethod -Method POST -Uri "http://localhost:5000/api/transforms" `
  -Headers @{ Authorization = "Bearer $TOKEN" } `
  -Body $transform -ContentType "application/json"
```

#### Transform Field Types

- **timestamp** - Dates/times (ISO 8601, Unix epoch, or common formats)
- **text** - Strings, descriptions, file paths
- **number** - Integers or floats (file sizes, counts, IDs)
- **boolean** - True/false flags
- **tags** - Comma-separated or array values

#### Best Practices

1. **Naming Convention**: Use `toolname-DDMMYY` format
2. **Always Include**:
   - Timestamp field (required for timelines)
   - Description/summary field
   - Source file path (for traceability)
3. **Test Thoroughly**: Use real tool output, not synthetic data
4. **Document Format**: Note tool version and command-line options used
5. **Handle Missing Fields**: Tools may omit fields in some cases
6. **Nested JSON**: Use dot notation (e.g., `document.data.Event.EventData.User`)

#### Testing Your Transform

1. Generate test data with your forensic tool
2. In Chronosift, go to **Transforms → Your Transform → Test**
3. Paste sample output (first 10-20 lines)
4. Verify field mappings and data types
5. Create a test timeline and upload full output
6. Check for:
   - Correct timestamp parsing
   - All expected columns populated
   - No data truncation or errors

#### Sharing Your Transform

**Export Transform:**
```powershell
# Get transform JSON
$transform = Invoke-RestMethod -Uri "http://localhost:5000/api/transforms/123" `
  -Headers @{ Authorization = "Bearer $TOKEN" }

# Save to file
$transform | ConvertTo-Json -Depth 10 | Out-File "mytool-transform.json"
```

**Share via:**
- GitHub Issue with transform JSON
- Pull Request adding to `transforms/` folder
- Community discussion with use cases

#### Example: Adding a New Tool

Let's add support for "Plaso" (log2timeline):

1. Run Plaso with CSV output:
   ```bash
   psort.py -o l2tcsv evidence.plaso -w plaso_output.csv
   ```

2. Examine the CSV columns (first row)

3. Create the transform via API or UI:
   ```powershell
   $mapping = @{
     csv = @{ delimiter = ","; has_header = $true }
     fields = @(
       @{ source = "datetime"; target = "Timestamp"; type = "timestamp" }
       @{ source = "message"; target = "Description"; type = "text" }
       @{ source = "source"; target = "Source"; type = "text" }
       @{ source = "filename"; target = "Filename"; type = "text" }
       @{ source = "parser"; target = "Parser"; type = "text" }
     )
   }
   ```

4. Test with real output

5. Share with the community!

#### Getting Help with Transforms

- **Check existing transforms** - Many forensic tools output similar formats
- **Open an issue** - Request help with a specific tool
- **Share sample data** - Redact sensitive info, share first 10 lines
- **Consult tool docs** - Check tool's output format documentation

## Project Structure

```
chronosift/
├── backend/
│   ├── app/
│   │   ├── routes/          # API endpoints
│   │   ├── models/          # Database models
│   │   ├── services/        # Business logic
│   │   └── utils/           # Helper functions
│   ├── migrations/          # Database migrations
│   └── tests/               # Backend tests
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/           # Page components
│   │   ├── lib/             # API client & utilities
│   │   └── types/           # TypeScript types
│   └── public/              # Static assets
└── docs/                    # Additional documentation
```

## Development Tips

### Backend Development

```bash
# Run backend tests
docker-compose exec backend pytest

# Create new migration
docker-compose exec backend flask db migrate -m "Description"

# Apply migrations
docker-compose exec backend flask db upgrade

# Access Python shell with app context
docker-compose exec backend flask shell
```

### Frontend Development

```bash
# Install dependencies
cd frontend && npm install

# Run with hot reload
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check
```

### Database

```bash
# Access PostgreSQL
docker-compose exec postgres psql -U chronosift -d chronosift_db

# View logs
docker-compose logs -f postgres
```

## Getting Help

- **Issues** - Ask questions by creating an issue
- **Discussions** - Use GitHub Discussions for general questions
- **Documentation** - Check README.md and existing docs

## License

By contributing to Chronosift, you agree that your contributions will be licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). This ensures your contributions remain free and open source.

## Recognition

Contributors will be acknowledged in:
- GitHub contributors list
- Release notes for significant contributions
- Project documentation

Thank you for contributing to Chronosift! 🎉
