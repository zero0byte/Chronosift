#!/usr/bin/env python
"""Load MITRE ATT&CK framework data into the database"""
import asyncio
import sys
from app import create_app
from app.services.mitre_service import MitreService

def load_mitre_data():
    """Load MITRE ATT&CK data"""
    print("Initializing Flask app...")
    app = create_app()
    
    with app.app_context():
        print("Loading MITRE ATT&CK framework data...")
        service = MitreService()
        
        try:
            result = asyncio.run(service.load_attack_data(force_refresh=False))
            print(f"✓ MITRE data loaded successfully!")
            print(f"  Tactics: {result.get('tactics_loaded', 0)}")
            print(f"  Techniques: {result.get('techniques_loaded', 0)}")
            return 0
        except Exception as e:
            print(f"✗ Failed to load MITRE data: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()
            return 1

if __name__ == '__main__':
    sys.exit(load_mitre_data())
