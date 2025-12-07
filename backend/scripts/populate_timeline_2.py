#!/usr/bin/env python3
"""
Populate Timeline 2 with realistic forensic data showing a complete attack chain.
This creates a scenario with: phishing -> credential access -> lateral movement -> exfiltration
"""

import sys
import os
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.timeline import Timeline, TimelineEntry

def create_realistic_attack_scenario():
    """Create a realistic multi-stage attack scenario."""
    
    app = create_app()
    with app.app_context():
        # Get timeline 2
        timeline = Timeline.query.get(2)
        if not timeline:
            print("Error: Timeline 2 not found")
            return
        
        # Clear existing entries
        TimelineEntry.query.filter_by(timeline_id=2).delete()
        db.session.commit()
        print(f"Cleared existing entries from timeline '{timeline.name}'")
        
        # Base timestamp for the scenario (simulating events from Jan 15, 2024)
        base_time = datetime(2024, 1, 15, 8, 30, 0)
        
        # Define attack scenario entries
        entries = [
            # Stage 1: Initial Compromise (Phishing)
            {
                "timestamp": base_time,
                "description": "Email received from external sender invoice@accounting-services.info to jsmith@company.com with subject 'Urgent: Outstanding Invoice #78452'",
                "tags": ["email", "external", "phishing"]
            },
            {
                "timestamp": base_time + timedelta(minutes=3),
                "description": "User jsmith clicked link in email, redirected to hxxps://company-portal-login.xyz/auth",
                "tags": ["web", "suspicious_domain", "user_activity"]
            },
            {
                "timestamp": base_time + timedelta(minutes=5),
                "description": "Browser history shows credential submission to hxxps://company-portal-login.xyz with POST to /api/validate",
                "tags": ["web", "credential_theft", "exfiltration"]
            },
            
            # Stage 2: Initial Access
            {
                "timestamp": base_time + timedelta(minutes=12),
                "description": "Successful VPN authentication from IP 185.220.101.42 (Tor exit node) using jsmith credentials",
                "tags": ["vpn", "authentication", "tor", "suspicious"]
            },
            {
                "timestamp": base_time + timedelta(minutes=13),
                "description": "New PowerShell process spawned by outlook.exe: powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden",
                "tags": ["process", "powershell", "suspicious", "execution"]
            },
            {
                "timestamp": base_time + timedelta(minutes=13, seconds=30),
                "description": "PowerShell script downloaded from hxxps://cdn.pastebin-alternative.com/raw/x7Ks9mPq to C:\\Users\\jsmith\\AppData\\Local\\Temp\\update.ps1",
                "tags": ["file_download", "powershell", "malware", "temp"]
            },
            
            # Stage 3: Execution & Persistence
            {
                "timestamp": base_time + timedelta(minutes=14),
                "description": "Registry modification: HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\SecurityUpdate = 'powershell.exe -w hidden -c C:\\Users\\jsmith\\AppData\\Local\\svhost.exe'",
                "tags": ["registry", "persistence", "autorun"]
            },
            {
                "timestamp": base_time + timedelta(minutes=14, seconds=15),
                "description": "New process created: svhost.exe (note typo vs legitimate svchost.exe) with parent powershell.exe, connecting to 203.0.113.87:443",
                "tags": ["process", "malware", "network", "c2"]
            },
            {
                "timestamp": base_time + timedelta(minutes=15),
                "description": "Scheduled task created: 'MicrosoftEdgeUpdateTaskMachineCore' running C:\\Users\\jsmith\\AppData\\Local\\svhost.exe daily at 9:00 AM",
                "tags": ["scheduled_task", "persistence", "masquerading"]
            },
            
            # Stage 4: Discovery
            {
                "timestamp": base_time + timedelta(minutes=18),
                "description": "Process whoami.exe executed by svhost.exe, output: CORPORATE\\jsmith",
                "tags": ["process", "discovery", "enumeration"]
            },
            {
                "timestamp": base_time + timedelta(minutes=18, seconds=30),
                "description": "Process net.exe executed with arguments: net user /domain",
                "tags": ["process", "discovery", "domain_enumeration"]
            },
            {
                "timestamp": base_time + timedelta(minutes=19),
                "description": "Process net.exe executed with arguments: net group 'Domain Admins' /domain",
                "tags": ["process", "discovery", "privilege_enumeration"]
            },
            {
                "timestamp": base_time + timedelta(minutes=20),
                "description": "nltest.exe executed to enumerate domain controllers: nltest /dclist:corporate.local",
                "tags": ["process", "discovery", "network_enumeration"]
            },
            
            # Stage 5: Credential Access
            {
                "timestamp": base_time + timedelta(minutes=25),
                "description": "Suspicious file downloaded: C:\\Users\\jsmith\\AppData\\Local\\Temp\\m.exe (detected as Mimikatz variant)",
                "tags": ["file_download", "credential_dumping", "tool", "malware"]
            },
            {
                "timestamp": base_time + timedelta(minutes=26),
                "description": "Process m.exe accessed LSASS.exe memory (PID 672), potential credential dumping",
                "tags": ["process", "lsass", "credential_access", "memory_access"]
            },
            {
                "timestamp": base_time + timedelta(minutes=27),
                "description": "Outbound HTTPS connection from svhost.exe to 203.0.113.87:443, 847KB uploaded in encrypted stream",
                "tags": ["network", "c2", "exfiltration", "encryption"]
            },
            
            # Stage 6: Lateral Movement
            {
                "timestamp": base_time + timedelta(hours=2, minutes=15),
                "description": "SMB connection from 10.0.10.45 (jsmith workstation) to 10.0.10.202 (FILE-SRV-01) using domain admin credentials",
                "tags": ["smb", "lateral_movement", "privileged_account"]
            },
            {
                "timestamp": base_time + timedelta(hours=2, minutes=16),
                "description": "Service creation on FILE-SRV-01: 'WindowsUpdateAssist' with binary path pointing to \\\\10.0.10.45\\C$\\Windows\\Temp\\svc.exe",
                "tags": ["service", "lateral_movement", "remote_execution"]
            },
            {
                "timestamp": base_time + timedelta(hours=2, minutes=17),
                "description": "Service 'WindowsUpdateAssist' started on FILE-SRV-01, process svc.exe spawned with SYSTEM privileges",
                "tags": ["service", "execution", "privilege_escalation", "system"]
            },
            {
                "timestamp": base_time + timedelta(hours=2, minutes=18),
                "description": "RDP session established from FILE-SRV-01 to DB-SRV-03 (10.0.20.15) using stolen domain admin credentials",
                "tags": ["rdp", "lateral_movement", "privileged_account"]
            },
            
            # Stage 7: Collection & Staging
            {
                "timestamp": base_time + timedelta(hours=2, minutes=35),
                "description": "PowerShell command on FILE-SRV-01: Get-ChildItem -Recurse -Path 'D:\\Shares\\Finance' -Include *.xlsx,*.pdf | Where-Object {$_.Length -lt 10MB}",
                "tags": ["powershell", "collection", "file_enumeration"]
            },
            {
                "timestamp": base_time + timedelta(hours=2, minutes=40),
                "description": "Archive created: C:\\Windows\\Temp\\backup_20240115.zip containing 247 files (156MB) from Finance share",
                "tags": ["compression", "collection", "staging"]
            },
            {
                "timestamp": base_time + timedelta(hours=2, minutes=45),
                "description": "7zip process executed: 7z.exe a -p[redacted] -tzip C:\\Windows\\Temp\\backup_20240115.zip.encrypted",
                "tags": ["compression", "encryption", "staging"]
            },
            
            # Stage 8: Command and Control
            {
                "timestamp": base_time + timedelta(hours=3, minutes=5),
                "description": "Repeated DNS queries for update.microsoft-cloud-services.com (typosquatting domain) every 30 seconds",
                "tags": ["dns", "c2", "beaconing", "typosquatting"]
            },
            {
                "timestamp": base_time + timedelta(hours=3, minutes=12),
                "description": "TLS connection established to 198.51.100.44:443 with suspicious certificate (CN=localhost, self-signed)",
                "tags": ["network", "c2", "tls", "suspicious_certificate"]
            },
            
            # Stage 9: Exfiltration
            {
                "timestamp": base_time + timedelta(hours=3, minutes=30),
                "description": "Large outbound transfer initiated: FILE-SRV-01 to 198.51.100.44:443, 156MB uploaded over 8 minutes",
                "tags": ["network", "exfiltration", "large_transfer"]
            },
            {
                "timestamp": base_time + timedelta(hours=3, minutes=38),
                "description": "File deleted: C:\\Windows\\Temp\\backup_20240115.zip.encrypted",
                "tags": ["file_deletion", "anti_forensics"]
            },
            {
                "timestamp": base_time + timedelta(hours=3, minutes=39),
                "description": "PowerShell command executed: Clear-EventLog -LogName Security, Application, System",
                "tags": ["powershell", "log_clearing", "anti_forensics"]
            },
            
            # Stage 10: Impact (Ransomware deployment - optional)
            {
                "timestamp": base_time + timedelta(hours=4, minutes=0),
                "description": "Suspicious executable dropped: C:\\ProgramData\\crypt.exe (4.2MB), high entropy suggesting encryption/packing",
                "tags": ["file_creation", "malware", "ransomware"]
            },
            {
                "timestamp": base_time + timedelta(hours=4, minutes=2),
                "description": "Mass file modifications detected: 1,247 files renamed with .locked extension in D:\\Shares\\Finance",
                "tags": ["file_modification", "ransomware", "impact"]
            },
            {
                "timestamp": base_time + timedelta(hours=4, minutes=2, seconds=30),
                "description": "Ransom note created: D:\\Shares\\Finance\\README_FOR_DECRYPT.txt containing cryptocurrency wallet address",
                "tags": ["file_creation", "ransomware", "note"]
            },
            
            # Additional Indicators
            {
                "timestamp": base_time + timedelta(minutes=10),
                "description": "Windows Defender real-time protection disabled via registry: HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows Defender\\DisableAntiSpyware = 1",
                "tags": ["registry", "defense_evasion", "antivirus"]
            },
            {
                "timestamp": base_time + timedelta(hours=1, minutes=30),
                "description": "Volume Shadow Copy deletion: vssadmin.exe delete shadows /all /quiet",
                "tags": ["process", "defense_evasion", "backup_deletion"]
            },
            {
                "timestamp": base_time + timedelta(hours=2, minutes=5),
                "description": "Windows Event Log service stopped: net stop eventlog",
                "tags": ["service", "defense_evasion", "log_tampering"]
            }
        ]
        
        # Create entries
        print(f"\nCreating {len(entries)} timeline entries...")
        for i, entry_data in enumerate(entries, 1):
            entry = TimelineEntry(
                timeline_id=timeline.id,
                created_by=1,  # admin user
                data={
                    "Timestamp": entry_data["timestamp"].isoformat(),
                    "Description": entry_data["description"],
                    "Tags": entry_data["tags"]
                }
            )
            db.session.add(entry)
            
            if i % 10 == 0:
                print(f"  Created {i}/{len(entries)} entries...")
        
        db.session.commit()
        print(f"\n✅ Successfully populated timeline '{timeline.name}' with {len(entries)} entries")
        print(f"📊 Attack scenario spans {(entries[-1]['timestamp'] - entries[0]['timestamp']).total_seconds() / 3600:.1f} hours")
        print(f"🔗 Covers: Initial Access → Execution → Persistence → Discovery → Credential Access → Lateral Movement → Collection → Exfiltration → Impact")
        print(f"\n🌐 View at: http://192.168.1.253:3000/timelines/2")

if __name__ == "__main__":
    create_realistic_attack_scenario()
