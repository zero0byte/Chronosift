#!/usr/bin/env python3
"""
Create Chainsaw JSON Transform
Python version of create_chainsaw_transform.ps1
"""

import requests
import sys

# Config
API_URL = "http://localhost:5000/api/transforms"
LOGIN_URL = "http://localhost:5000/api/auth/login"
REGISTER_URL = "http://localhost:5000/api/auth/register"

# Change these based on your first (admin) user
EMAIL = "admin@chronosift.local"
PASSWORD = "SecurePass123!"

def get_auth_token():
    """Try to login, if that fails try to register"""
    
    # Try login first
    print("Attempting to login...")
    try:
        response = requests.post(
            LOGIN_URL,
            json={"email": EMAIL, "password": PASSWORD}
        )
        response.raise_for_status()
        login_data = response.json()
        print(f"Response: {login_data}")
        
        # Get token from response
        token = login_data.get("access_token") or login_data.get("token")
        
        if token:
            print("Login successful!")
            return token
        else:
            raise ValueError("No token in response")
            
    except Exception as e:
        print(f"Login failed, trying to register... ({e})")
        
        # Try registration
        try:
            response = requests.post(
                REGISTER_URL,
                json={
                    "email": EMAIL,
                    "password": PASSWORD,
                    "first_name": "Test",
                    "last_name": "User"
                }
            )
            response.raise_for_status()
            register_data = response.json()
            token = register_data.get("access_token") or register_data.get("token")
            
            if token:
                print("Registration successful!")
                return token
            else:
                raise ValueError("No token in registration response")
                
        except Exception as reg_error:
            print(f"Registration also failed: {reg_error}")
            sys.exit(1)

def create_chainsaw_transform(token):
    """Create the Chainsaw transform"""
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Chainsaw JSON Transform
    chainsaw_transform = {
        "name": "chainsaw-061125",
        "description": "Chainsaw JSON output parser for EVTX threat hunting",
        "input_format": "json",
        "mapping": {
            "json": {
                "json_path": "$[*]"
            },
            "fields": [
                {
                    "source": "timestamp",
                    "target": "Timestamp",
                    "type": "timestamp"
                },
                {
                    "source": "name",
                    "target": "Event Name",
                    "type": "text"
                },
                {
                    "source": "group",
                    "target": "Group",
                    "type": "text"
                },
                {
                    "source": "level",
                    "target": "Level",
                    "type": "text"
                },
                {
                    "source": "document.data.Event.System.EventID",
                    "target": "Event ID",
                    "type": "number"
                },
                {
                    "source": "document.data.Event.System.Computer",
                    "target": "Computer",
                    "type": "text"
                },
                {
                    "source": "document.data.Event.System.Channel",
                    "target": "Channel",
                    "type": "text"
                },
                {
                    "source": "document.data.Event.EventData.TargetUserName",
                    "target": "Target User",
                    "type": "text"
                },
                {
                    "source": "document.data.Event.EventData.IpAddress",
                    "target": "IP Address",
                    "type": "text"
                },
                {
                    "source": "document.data.Event.EventData.WorkstationName",
                    "target": "Workstation",
                    "type": "text"
                },
                {
                    "source": "document.path",
                    "target": "Source Path",
                    "type": "text"
                }
            ]
        },
        "is_public": True,
        "imported_via_api": True
    }
    
    print("Creating Chainsaw transform...")
    try:
        response = requests.post(
            API_URL,
            headers=headers,
            json=chainsaw_transform
        )
        response.raise_for_status()
        result = response.json()
        
        print("Successfully created transform: chainsaw-061125")
        print(f"  ID: {result.get('id')}")
        
    except requests.exceptions.RequestException as e:
        print(f"Error creating transform: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response: {e.response.text}")
        sys.exit(1)

def main():
    # Get authentication token
    token = get_auth_token()
    
    if not token:
        print("Failed to obtain authentication token")
        sys.exit(1)
    
    print("Token obtained successfully")
    
    # Create the transform
    create_chainsaw_transform(token)

if __name__ == "__main__":
    main()
