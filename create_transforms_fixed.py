#!/usr/bin/env python3
"""
Create transforms for EZ Tools (MFTECmd, EVTXCmd, JLECmd, LnkCmd, RECmd)
Python version of create_transforms_fixed.ps1
"""

import requests
import os
import getpass
from datetime import datetime
from pathlib import Path

# Config
API = "http://localhost:5000/api"
BASE_PATH = r"C:\Users\user01\Documents\EZ Tools"
DATE_SUFFIX = datetime.now().strftime("%d%m%y")

def login():
    """Authenticate and return access token"""
    email = input("Email: ")
    password = getpass.getpass("Password: ")
    
    response = requests.post(
        f"{API}/auth/login",
        json={"email": email, "password": password}
    )
    response.raise_for_status()
    
    return response.json()["access_token"]



def create_transform(name, mapping, description, headers):
    """Create a transform via API"""
    payload = {
        "name": name,
        "input_format": "csv",
        "mapping": mapping,
        "description": description,
        "is_public": True,
        "imported_via_api": True
    }
    
    print(f"Creating transform: {name}")
    try:
        response = requests.post(
            f"{API}/transforms",
            headers=headers,
            json=payload
        )
        response.raise_for_status()
        print(f"  ✓ Created: {name}")
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"  ✗ Failed: {name} - {str(e)}")
        return None

def main():
    # Authenticate
    token = login()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Generic CSV config
    csv_cfg = {"delimiter": ",", "has_header": True}
    
    print("\nCreating transforms for EZ Tools...\n")
    
    # 1) MFTECmd
  
    
    mapping = {
        "csv": csv_cfg,
        "fields": [
            {"source": "Created0x10", "target": "Timestamp", "type": "timestamp"},
            {"source": "FileName", "target": "Description", "type": "text"},
            {"source": "ParentPath", "target": "ParentPath", "type": "text"},
            {"source": "FileSize", "target": "FileSize", "type": "number"},
            {"source": "IsDirectory", "target": "IsDirectory", "type": "boolean"},
            {"source": "InUse", "target": "InUse", "type": "boolean"},
            {"source": "Extension", "target": "Extension", "type": "text"},
            {"source": "SourceFile", "target": "SourceFile", "type": "text"}
        ]
    }
    create_transform(
        f"mftecmd-{DATE_SUFFIX}",
        mapping,
        "MFTECmd CSV to timeline mapping",
        headers
    )
    
    # 2) EVTXCmd
    
    
    mapping = {
    "csv": csv_cfg,
    "fields": [
        {"source": "TimeCreated", "target": "Timestamp", "type": "timestamp"},
        {"source": "Provider", "target": "Description", "type": "text"},
        {"source": "EventId", "target": "EventId", "type": "number"},
        {"source": "Level", "target": "Level", "type": "text"},
        {"source": "Channel", "target": "Channel", "type": "text"},
        {"source": "Computer", "target": "Computer", "type": "text"},
        {"source": "MapDescription", "target": "EventDescription", "type": "text"},
        {"source": "UserName", "target": "UserName", "type": "text"},
        {"source": "RemoteHost", "target": "RemoteHost", "type": "text"},
        {"source": "PayloadData1", "target": "PayloadData1", "type": "text"},
        {"source": "PayloadData2", "target": "PayloadData2", "type": "text"},
        {"source": "PayloadData3", "target": "PayloadData3", "type": "text"},
        {"source": "PayloadData4", "target": "PayloadData4", "type": "text"},
        {"source": "PayloadData5", "target": "PayloadData5", "type": "text"},
        {"source": "PayloadData6", "target": "PayloadData6", "type": "text"},
        {"source": "ExecutableInfo", "target": "ExecutableInfo", "type": "text"},
        {"source": "Payload", "target": "Payload_Raw", "type": "text"},
        {"source": "SourceFile", "target": "SourceFile", "type": "text"}
    ],
    "json_fields": [
        {
            "source": "Payload",
            "flatten": True,
            "prefix": "Event_"
        }
    ]
    }
    create_transform(
        f"evtxcmd-{DATE_SUFFIX}",
        mapping,
        "EVTXCmd CSV to timeline mapping with expanded Payload fields",
        headers
    )
    
    # 3) JLECmd (Jump Lists)
    
    mapping = {
        "csv": csv_cfg,
        "fields": [
            {"source": "LastModified", "target": "Timestamp", "type": "timestamp"},
            {"source": "Path", "target": "Description", "type": "text"},
            {"source": "LocalPath", "target": "LocalPath", "type": "text"},
            {"source": "Arguments", "target": "Arguments", "type": "text"},
            {"source": "AppIdDescription", "target": "AppIdDescription", "type": "text"},
            {"source": "InteractionCount", "target": "InteractionCount", "type": "number"},
            {"source": "MachineID", "target": "MachineID", "type": "text"},
            {"source": "TrackerCreatedOn", "target": "TrackerCreatedOn", "type": "timestamp"}
        ]
    }
    create_transform(
        f"jlecmd-{DATE_SUFFIX}",
        mapping,
        "JLECmd CSV to timeline mapping",
        headers
    )
    
    # 4) LnkCmd
    
    mapping = {
        "csv": csv_cfg,
        "fields": [
            {"source": "TargetModified", "target": "Timestamp", "type": "timestamp"},
            {"source": "LocalPath", "target": "Description", "type": "text"},
            {"source": "Arguments", "target": "Arguments", "type": "text"},
            {"source": "FileSize", "target": "FileSize", "type": "number"},
            {"source": "MachineID", "target": "MachineID", "type": "text"},
            {"source": "TrackerCreatedOn", "target": "TrackerCreatedOn", "type": "timestamp"},
            {"source": "TargetIDAbsolutePath", "target": "TargetPath", "type": "text"}
        ]
    }
    create_transform(
        f"lnkcmd-{DATE_SUFFIX}",
        mapping,
        "LnkCmd CSV to timeline mapping",
        headers
    )
    
    # 5) RECmd (Registry)
   
    mapping = {
        "csv": csv_cfg,
        "fields": [
            {"source": "LastWriteTimestamp", "target": "Timestamp", "type": "timestamp"},
            {"source": "Description", "target": "Description", "type": "text"},
            {"source": "Category", "target": "Category", "type": "text"},
            {"source": "KeyPath", "target": "KeyPath", "type": "text"},
            {"source": "ValueName", "target": "ValueName", "type": "text"},
            {"source": "ValueData", "target": "ValueData", "type": "text"},
            {"source": "HiveType", "target": "HiveType", "type": "text"},
            {"source": "SourceFile", "target": "SourceFile", "type": "text"}
        ]
    }
    create_transform(
        f"recmd-{DATE_SUFFIX}",
        mapping,
        "RECmd CSV to timeline mapping",
        headers
    )
    
    print("\nDone creating transforms!")

if __name__ == "__main__":
    main()
