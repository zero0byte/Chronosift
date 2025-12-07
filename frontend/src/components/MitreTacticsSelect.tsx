import { useState, useRef, useEffect } from 'react';

export const MITRE_TACTICS = [
  { 
    id: 'TA0043', 
    name: 'Reconnaissance', 
    description: 'The adversary is trying to gather information they can use to plan future operations.',
    techniques: [
      { id: 'T1595', name: 'Active Scanning', subs: ['T1595.001 Scanning IP Blocks', 'T1595.002 Vulnerability Scanning', 'T1595.003 Wordlist Scanning'] },
      { id: 'T1592', name: 'Gather Victim Host Information', subs: ['T1592.001 Hardware', 'T1592.002 Software', 'T1592.003 Firmware', 'T1592.004 Client Configurations'] },
      { id: 'T1589', name: 'Gather Victim Identity Information', subs: ['T1589.001 Credentials', 'T1589.002 Email Addresses', 'T1589.003 Employee Names'] },
      { id: 'T1590', name: 'Gather Victim Network Information', subs: ['T1590.001 Domain Properties', 'T1590.002 DNS', 'T1590.003 Network Trust Dependencies', 'T1590.004 Network Topology', 'T1590.005 IP Addresses', 'T1590.006 Network Security Appliances'] },
      { id: 'T1591', name: 'Gather Victim Org Information', subs: ['T1591.001 Determine Physical Locations', 'T1591.002 Business Relationships', 'T1591.003 Identify Business Tempo', 'T1591.004 Identify Roles'] },
      { id: 'T1598', name: 'Phishing for Information', subs: ['T1598.001 Spearphishing Service', 'T1598.002 Spearphishing Attachment', 'T1598.003 Spearphishing Link'] },
      { id: 'T1597', name: 'Search Closed Sources', subs: ['T1597.001 Threat Intel Vendors', 'T1597.002 Purchase Technical Data'] },
      { id: 'T1596', name: 'Search Open Technical Databases', subs: ['T1596.001 DNS/Passive DNS', 'T1596.002 WHOIS', 'T1596.003 Digital Certificates', 'T1596.004 CDNs', 'T1596.005 Scan Databases'] },
      { id: 'T1593', name: 'Search Open Websites/Domains', subs: ['T1593.001 Social Media', 'T1593.002 Search Engines', 'T1593.003 Code Repositories'] },
      { id: 'T1594', name: 'Search Victim-Owned Websites', subs: [] },
      { id: 'T1583', name: 'Acquire Infrastructure', subs: ['T1583.001 Domains', 'T1583.002 DNS Server', 'T1583.003 Virtual Private Server', 'T1583.004 Server', 'T1583.005 Botnet', 'T1583.006 Web Services', 'T1583.007 Serverless', 'T1583.008 Malvertising'] },
    ]
  },
  { 
    id: 'TA0042', 
    name: 'Resource Development', 
    description: 'The adversary is trying to establish resources they can use to support operations.',
    techniques: [
      { id: 'T1583', name: 'Acquire Infrastructure', subs: ['T1583.001 Domains', 'T1583.002 DNS Server', 'T1583.003 Virtual Private Server', 'T1583.004 Server', 'T1583.005 Botnet', 'T1583.006 Web Services', 'T1583.007 Serverless', 'T1583.008 Malvertising'] },
      { id: 'T1586', name: 'Compromise Accounts', subs: ['T1586.001 Social Media Accounts', 'T1586.002 Email Accounts', 'T1586.003 Cloud Accounts'] },
      { id: 'T1584', name: 'Compromise Infrastructure', subs: ['T1584.001 Domains', 'T1584.002 DNS Server', 'T1584.003 Virtual Private Server', 'T1584.004 Server', 'T1584.005 Botnet', 'T1584.006 Web Services', 'T1584.007 Serverless'] },
      { id: 'T1587', name: 'Develop Capabilities', subs: ['T1587.001 Malware', 'T1587.002 Code Signing Certificates', 'T1587.003 Digital Certificates', 'T1587.004 Exploits'] },
      { id: 'T1585', name: 'Establish Accounts', subs: ['T1585.001 Social Media Accounts', 'T1585.002 Email Accounts', 'T1585.003 Cloud Accounts'] },
      { id: 'T1588', name: 'Obtain Capabilities', subs: ['T1588.001 Malware', 'T1588.002 Tool', 'T1588.003 Code Signing Certificates', 'T1588.004 Digital Certificates', 'T1588.005 Exploits', 'T1588.006 Vulnerabilities'] },
    ]
  },
  { 
    id: 'TA0001', 
    name: 'Initial Access', 
    description: 'The adversary is trying to get into your network.',
    techniques: [
      { id: 'T1189', name: 'Drive-by Compromise', subs: [] },
      { id: 'T1190', name: 'Exploit Public-Facing Application', subs: [] },
      { id: 'T1133', name: 'External Remote Services', subs: [] },
      { id: 'T1200', name: 'Hardware Additions', subs: [] },
      { id: 'T1566', name: 'Phishing', subs: ['T1566.001 Spearphishing Attachment', 'T1566.002 Spearphishing Link', 'T1566.003 Spearphishing via Service', 'T1566.004 Spearphishing Voice'] },
      { id: 'T1091', name: 'Replication Through Removable Media', subs: [] },
      { id: 'T1195', name: 'Supply Chain Compromise', subs: ['T1195.001 Compromise Software Dependencies and Development Tools', 'T1195.002 Compromise Software Supply Chain', 'T1195.003 Compromise Hardware Supply Chain'] },
      { id: 'T1199', name: 'Trusted Relationship', subs: [] },
      { id: 'T1078', name: 'Valid Accounts', subs: ['T1078.001 Default Accounts', 'T1078.002 Domain Accounts', 'T1078.003 Local Accounts', 'T1078.004 Cloud Accounts'] },
    ]
  },
  { 
    id: 'TA0002', 
    name: 'Execution', 
    description: 'The adversary is trying to run malicious code.',
    techniques: [
      { id: 'T1059', name: 'Command and Scripting Interpreter', subs: ['T1059.001 PowerShell', 'T1059.002 AppleScript', 'T1059.003 Windows Command Shell', 'T1059.004 Unix Shell', 'T1059.005 Visual Basic', 'T1059.006 Python', 'T1059.007 JavaScript', 'T1059.008 Network Device CLI', 'T1059.009 Cloud API'] },
      { id: 'T1609', name: 'Container Administration Command', subs: [] },
      { id: 'T1610', name: 'Deploy Container', subs: [] },
      { id: 'T1203', name: 'Exploitation for Client Execution', subs: [] },
      { id: 'T1559', name: 'Inter-Process Communication', subs: ['T1559.001 Component Object Model', 'T1559.002 Dynamic Data Exchange'] },
      { id: 'T1106', name: 'Native API', subs: [] },
      { id: 'T1053', name: 'Scheduled Task/Job', subs: ['T1053.001 At', 'T1053.002 Cron', 'T1053.003 Cron', 'T1053.005 Scheduled Task', 'T1053.006 Systemd Timers', 'T1053.007 Container Orchestration Job'] },
      { id: 'T1129', name: 'Shared Modules', subs: [] },
      { id: 'T1072', name: 'Software Deployment Tools', subs: [] },
      { id: 'T1569', name: 'System Services', subs: ['T1569.001 Launchctl', 'T1569.002 Service Execution'] },
      { id: 'T1204', name: 'User Execution', subs: ['T1204.001 Malicious Link', 'T1204.002 Malicious File', 'T1204.003 Malicious Image'] },
      { id: 'T1047', name: 'Windows Management Instrumentation', subs: [] },
    ]
  },
  { 
    id: 'TA0003', 
    name: 'Persistence', 
    description: 'The adversary is trying to maintain their foothold.',
    techniques: [
      { id: 'T1098', name: 'Account Manipulation', subs: ['T1098.001 Additional Cloud Credentials', 'T1098.002 Additional Email Delegate Permissions', 'T1098.003 Additional Cloud Roles', 'T1098.004 SSH Authorized Keys', 'T1098.005 Device Registration'] },
      { id: 'T1197', name: 'BITS Jobs', subs: [] },
      { id: 'T1547', name: 'Boot or Logon Autostart Execution', subs: ['T1547.001 Registry Run Keys / Startup Folder', 'T1547.002 Authentication Package', 'T1547.003 Time Providers', 'T1547.004 Winlogon Helper DLL', 'T1547.005 Security Support Provider', 'T1547.006 Kernel Modules and Extensions', 'T1547.007 Re-opened Applications', 'T1547.008 LSASS Driver', 'T1547.009 Shortcut Modification', 'T1547.010 Port Monitors', 'T1547.012 Print Processors', 'T1547.013 XDG Autostart Entries', 'T1547.014 Active Setup', 'T1547.015 Login Items'] },
      { id: 'T1037', name: 'Boot or Logon Initialization Scripts', subs: ['T1037.001 Logon Script (Windows)', 'T1037.002 Login Hook', 'T1037.003 Network Logon Script', 'T1037.004 RC Scripts', 'T1037.005 Startup Items'] },
      { id: 'T1176', name: 'Browser Extensions', subs: [] },
      { id: 'T1554', name: 'Compromise Client Software Binary', subs: [] },
      { id: 'T1136', name: 'Create Account', subs: ['T1136.001 Local Account', 'T1136.002 Domain Account', 'T1136.003 Cloud Account'] },
      { id: 'T1543', name: 'Create or Modify System Process', subs: ['T1543.001 Launch Agent', 'T1543.002 Systemd Service', 'T1543.003 Windows Service', 'T1543.004 Launch Daemon'] },
      { id: 'T1546', name: 'Event Triggered Execution', subs: ['T1546.001 Change Default File Association', 'T1546.002 Screensaver', 'T1546.003 Windows Management Instrumentation Event Subscription', 'T1546.004 Unix Shell Configuration Modification', 'T1546.005 Trap', 'T1546.006 LC_LOAD_DYLIB Addition', 'T1546.007 Netsh Helper DLL', 'T1546.008 Accessibility Features', 'T1546.009 AppCert DLLs', 'T1546.010 AppInit DLLs', 'T1546.011 Application Shimming', 'T1546.012 Image File Execution Options Injection', 'T1546.013 PowerShell Profile', 'T1546.014 Emond', 'T1546.015 Component Object Model Hijacking', 'T1546.016 Installer Packages'] },
      { id: 'T1133', name: 'External Remote Services', subs: [] },
      { id: 'T1574', name: 'Hijack Execution Flow', subs: ['T1574.001 DLL Search Order Hijacking', 'T1574.002 DLL Side-Loading', 'T1574.004 Dylib Hijacking', 'T1574.005 Executable Installer File Permissions Weakness', 'T1574.006 Dynamic Linker Hijacking', 'T1574.007 Path Interception by PATH Environment Variable', 'T1574.008 Path Interception by Search Order Hijacking', 'T1574.009 Path Interception by Unquoted Path', 'T1574.010 Services File Permissions Weakness', 'T1574.011 Services Registry Permissions Weakness', 'T1574.012 COR_PROFILER', 'T1574.013 KernelCallbackTable'] },
      { id: 'T1525', name: 'Implant Internal Image', subs: [] },
      { id: 'T1556', name: 'Modify Authentication Process', subs: ['T1556.001 Domain Controller Authentication', 'T1556.002 Password Filter DLL', 'T1556.003 Pluggable Authentication Modules', 'T1556.004 Network Device Authentication', 'T1556.006 Multi-Factor Authentication', 'T1556.007 Hybrid Identity', 'T1556.008 Network Provider DLL'] },
      { id: 'T1137', name: 'Office Application Startup', subs: ['T1137.001 Office Template Macros', 'T1137.002 Office Test', 'T1137.003 Outlook Forms', 'T1137.004 Outlook Home Page', 'T1137.005 Outlook Rules', 'T1137.006 Add-ins'] },
      { id: 'T1542', name: 'Pre-OS Boot', subs: ['T1542.001 System Firmware', 'T1542.002 Component Firmware', 'T1542.003 Bootkit', 'T1542.004 ROMMONkit', 'T1542.005 TFTP Boot'] },
      { id: 'T1053', name: 'Scheduled Task/Job', subs: ['T1053.001 At', 'T1053.002 Cron', 'T1053.003 Cron', 'T1053.005 Scheduled Task', 'T1053.006 Systemd Timers', 'T1053.007 Container Orchestration Job'] },
      { id: 'T1505', name: 'Server Software Component', subs: ['T1505.001 SQL Stored Procedures', 'T1505.002 Transport Agent', 'T1505.003 Web Shell', 'T1505.004 IIS Components', 'T1505.005 Terminal Services DLL'] },
      { id: 'T1205', name: 'Traffic Signaling', subs: ['T1205.001 Port Knocking', 'T1205.002 Socket Filters'] },
      { id: 'T1078', name: 'Valid Accounts', subs: ['T1078.001 Default Accounts', 'T1078.002 Domain Accounts', 'T1078.003 Local Accounts', 'T1078.004 Cloud Accounts'] },
    ]
  },
  { 
    id: 'TA0004', 
    name: 'Privilege Escalation', 
    description: 'The adversary is trying to gain higher-level permissions.',
    techniques: [
      { id: 'T1548', name: 'Abuse Elevation Control Mechanism', subs: ['T1548.001 Setuid and Setgid', 'T1548.002 Bypass User Account Control', 'T1548.003 Sudo and Sudo Caching', 'T1548.004 Elevated Execution with Prompt'] },
      { id: 'T1134', name: 'Access Token Manipulation', subs: ['T1134.001 Token Impersonation/Theft', 'T1134.002 Create Process with Token', 'T1134.003 Make and Impersonate Token', 'T1134.004 Parent PID Spoofing', 'T1134.005 SID-History Injection'] },
      { id: 'T1547', name: 'Boot or Logon Autostart Execution', subs: ['T1547.001 Registry Run Keys / Startup Folder', 'T1547.002 Authentication Package', 'T1547.003 Time Providers', 'T1547.004 Winlogon Helper DLL', 'T1547.005 Security Support Provider', 'T1547.006 Kernel Modules and Extensions', 'T1547.007 Re-opened Applications', 'T1547.008 LSASS Driver', 'T1547.009 Shortcut Modification', 'T1547.010 Port Monitors', 'T1547.012 Print Processors', 'T1547.013 XDG Autostart Entries', 'T1547.014 Active Setup', 'T1547.015 Login Items'] },
      { id: 'T1037', name: 'Boot or Logon Initialization Scripts', subs: ['T1037.001 Logon Script (Windows)', 'T1037.002 Login Hook', 'T1037.003 Network Logon Script', 'T1037.004 RC Scripts', 'T1037.005 Startup Items'] },
      { id: 'T1543', name: 'Create or Modify System Process', subs: ['T1543.001 Launch Agent', 'T1543.002 Systemd Service', 'T1543.003 Windows Service', 'T1543.004 Launch Daemon'] },
      { id: 'T1484', name: 'Domain Policy Modification', subs: ['T1484.001 Group Policy Modification', 'T1484.002 Domain Trust Modification'] },
      { id: 'T1611', name: 'Escape to Host', subs: [] },
      { id: 'T1546', name: 'Event Triggered Execution', subs: ['T1546.001 Change Default File Association', 'T1546.002 Screensaver', 'T1546.003 Windows Management Instrumentation Event Subscription', 'T1546.004 Unix Shell Configuration Modification', 'T1546.005 Trap', 'T1546.006 LC_LOAD_DYLIB Addition', 'T1546.007 Netsh Helper DLL', 'T1546.008 Accessibility Features', 'T1546.009 AppCert DLLs', 'T1546.010 AppInit DLLs', 'T1546.011 Application Shimming', 'T1546.012 Image File Execution Options Injection', 'T1546.013 PowerShell Profile', 'T1546.014 Emond', 'T1546.015 Component Object Model Hijacking', 'T1546.016 Installer Packages'] },
      { id: 'T1068', name: 'Exploitation for Privilege Escalation', subs: [] },
      { id: 'T1574', name: 'Hijack Execution Flow', subs: ['T1574.001 DLL Search Order Hijacking', 'T1574.002 DLL Side-Loading', 'T1574.004 Dylib Hijacking', 'T1574.005 Executable Installer File Permissions Weakness', 'T1574.006 Dynamic Linker Hijacking', 'T1574.007 Path Interception by PATH Environment Variable', 'T1574.008 Path Interception by Search Order Hijacking', 'T1574.009 Path Interception by Unquoted Path', 'T1574.010 Services File Permissions Weakness', 'T1574.011 Services Registry Permissions Weakness', 'T1574.012 COR_PROFILER', 'T1574.013 KernelCallbackTable'] },
      { id: 'T1053', name: 'Scheduled Task/Job', subs: ['T1053.001 At', 'T1053.002 Cron', 'T1053.003 Cron', 'T1053.005 Scheduled Task', 'T1053.006 Systemd Timers', 'T1053.007 Container Orchestration Job'] },
      { id: 'T1078', name: 'Valid Accounts', subs: ['T1078.001 Default Accounts', 'T1078.002 Domain Accounts', 'T1078.003 Local Accounts', 'T1078.004 Cloud Accounts'] },
    ]
  },
  { 
    id: 'TA0005', 
    name: 'Defense Evasion', 
    description: 'The adversary is trying to avoid being detected.',
    techniques: [
      { id: 'T1548', name: 'Abuse Elevation Control Mechanism', subs: ['T1548.001 Setuid and Setgid', 'T1548.002 Bypass User Account Control', 'T1548.003 Sudo and Sudo Caching', 'T1548.004 Elevated Execution with Prompt'] },
      { id: 'T1134', name: 'Access Token Manipulation', subs: ['T1134.001 Token Impersonation/Theft', 'T1134.002 Create Process with Token', 'T1134.003 Make and Impersonate Token', 'T1134.004 Parent PID Spoofing', 'T1134.005 SID-History Injection'] },
      { id: 'T1197', name: 'BITS Jobs', subs: [] },
      { id: 'T1612', name: 'Build Image on Host', subs: [] },
      { id: 'T1622', name: 'Debugger Evasion', subs: [] },
      { id: 'T1140', name: 'Deobfuscate/Decode Files or Information', subs: [] },
      { id: 'T1610', name: 'Deploy Container', subs: [] },
      { id: 'T1006', name: 'Direct Volume Access', subs: [] },
      { id: 'T1484', name: 'Domain Policy Modification', subs: ['T1484.001 Group Policy Modification', 'T1484.002 Domain Trust Modification'] },
      { id: 'T1480', name: 'Execution Guardrails', subs: ['T1480.001 Environmental Keying'] },
      { id: 'T1211', name: 'Exploitation for Defense Evasion', subs: [] },
      { id: 'T1222', name: 'File and Directory Permissions Modification', subs: ['T1222.001 Windows File and Directory Permissions Modification', 'T1222.002 Linux and Mac File and Directory Permissions Modification'] },
      { id: 'T1564', name: 'Hide Artifacts', subs: ['T1564.001 Hidden Files and Directories', 'T1564.002 Hidden Users', 'T1564.003 Hidden Window', 'T1564.004 NTFS File Attributes', 'T1564.005 Hidden File System', 'T1564.006 Run Virtual Instance', 'T1564.007 VBA Stomping', 'T1564.008 Email Hiding Rules', 'T1564.009 Resource Forking', 'T1564.010 Process Argument Spoofing', 'T1564.011 Ignore Process Interrupts', 'T1564.012 File/Path Exclusions'] },
      { id: 'T1574', name: 'Hijack Execution Flow', subs: ['T1574.001 DLL Search Order Hijacking', 'T1574.002 DLL Side-Loading', 'T1574.004 Dylib Hijacking', 'T1574.005 Executable Installer File Permissions Weakness', 'T1574.006 Dynamic Linker Hijacking', 'T1574.007 Path Interception by PATH Environment Variable', 'T1574.008 Path Interception by Search Order Hijacking', 'T1574.009 Path Interception by Unquoted Path', 'T1574.010 Services File Permissions Weakness', 'T1574.011 Services Registry Permissions Weakness', 'T1574.012 COR_PROFILER', 'T1574.013 KernelCallbackTable'] },
      { id: 'T1562', name: 'Impair Defenses', subs: ['T1562.001 Disable or Modify Tools', 'T1562.002 Disable Windows Event Logging', 'T1562.003 Impair Command History Logging', 'T1562.004 Disable or Modify System Firewall', 'T1562.006 Indicator Blocking', 'T1562.007 Disable or Modify Cloud Firewall', 'T1562.008 Disable or Modify Cloud Logs', 'T1562.009 Safe Mode Boot', 'T1562.010 Downgrade Attack', 'T1562.011 Impair System Recovery', 'T1562.012 Disable or Modify Linux Audit System'] },
      { id: 'T1070', name: 'Indicator Removal', subs: ['T1070.001 Clear Windows Event Logs', 'T1070.002 Clear Linux or Mac System Logs', 'T1070.003 Clear Command History', 'T1070.004 File Deletion', 'T1070.005 Network Share Connection Removal', 'T1070.006 Timestomp', 'T1070.007 Clear Network Connection History and Configurations', 'T1070.008 Clear Mailbox Data', 'T1070.009 Clear Persistence'] },
      { id: 'T1202', name: 'Indirect Command Execution', subs: [] },
      { id: 'T1036', name: 'Masquerading', subs: ['T1036.001 Invalid Code Signature', 'T1036.002 Right-to-Left Override', 'T1036.003 Rename System Utilities', 'T1036.004 Masquerade Task or Service', 'T1036.005 Match Legitimate Name or Location', 'T1036.006 Space after Filename', 'T1036.007 Double File Extension', 'T1036.008 Masquerade File Type', 'T1036.009 Break Process Trees'] },
      { id: 'T1556', name: 'Modify Authentication Process', subs: ['T1556.001 Domain Controller Authentication', 'T1556.002 Password Filter DLL', 'T1556.003 Pluggable Authentication Modules', 'T1556.004 Network Device Authentication', 'T1556.006 Multi-Factor Authentication', 'T1556.007 Hybrid Identity', 'T1556.008 Network Provider DLL'] },
      { id: 'T1578', name: 'Modify Cloud Compute Infrastructure', subs: ['T1578.001 Create Snapshot', 'T1578.002 Create Cloud Instance', 'T1578.003 Delete Cloud Instance', 'T1578.004 Revert Cloud Instance', 'T1578.005 Modify Cloud Compute Configurations'] },
      { id: 'T1112', name: 'Modify Registry', subs: [] },
      { id: 'T1601', name: 'Modify System Image', subs: ['T1601.001 Patch System Image', 'T1601.002 Downgrade System Image'] },
      { id: 'T1599', name: 'Network Boundary Bridging', subs: ['T1599.001 Network Address Translation Traversal'] },
      { id: 'T1027', name: 'Obfuscated Files or Information', subs: ['T1027.001 Binary Padding', 'T1027.002 Software Packing', 'T1027.003 Steganography', 'T1027.004 Compile After Delivery', 'T1027.005 Indicator Removal from Tools', 'T1027.006 HTML Smuggling', 'T1027.007 Dynamic API Resolution', 'T1027.008 Stripped Payloads', 'T1027.009 Embedded Payloads', 'T1027.010 Command Obfuscation', 'T1027.011 Fileless Storage', 'T1027.013 Encrypted/Encoded File'] },
      { id: 'T1542', name: 'Pre-OS Boot', subs: ['T1542.001 System Firmware', 'T1542.002 Component Firmware', 'T1542.003 Bootkit', 'T1542.004 ROMMONkit', 'T1542.005 TFTP Boot'] },
      { id: 'T1055', name: 'Process Injection', subs: ['T1055.001 Dynamic-link Library Injection', 'T1055.002 Portable Executable Injection', 'T1055.003 Thread Execution Hijacking', 'T1055.004 Asynchronous Procedure Call', 'T1055.005 Thread Local Storage', 'T1055.008 Ptrace System Calls', 'T1055.009 Proc Memory', 'T1055.011 Extra Window Memory Injection', 'T1055.012 Process Hollowing', 'T1055.013 Process Doppelgänging', 'T1055.014 VDSO Hijacking', 'T1055.015 ListPlanting'] },
      { id: 'T1207', name: 'Rogue Domain Controller', subs: [] },
      { id: 'T1014', name: 'Rootkit', subs: [] },
      { id: 'T1218', name: 'System Binary Proxy Execution', subs: ['T1218.001 Compiled HTML File', 'T1218.002 Control Panel', 'T1218.003 CMSTP', 'T1218.004 InstallUtil', 'T1218.005 Mshta', 'T1218.007 Msiexec', 'T1218.008 Odbcconf', 'T1218.009 Regsvcs/Regasm', 'T1218.010 Regsvr32', 'T1218.011 Rundll32', 'T1218.012 Verclsid', 'T1218.013 Mavinject', 'T1218.014 MMC'] },
      { id: 'T1216', name: 'System Script Proxy Execution', subs: ['T1216.001 PubPrn'] },
      { id: 'T1221', name: 'Template Injection', subs: [] },
      { id: 'T1205', name: 'Traffic Signaling', subs: ['T1205.001 Port Knocking', 'T1205.002 Socket Filters'] },
      { id: 'T1127', name: 'Trusted Developer Utilities Proxy Execution', subs: ['T1127.001 MSBuild'] },
      { id: 'T1535', name: 'Unused/Unsupported Cloud Regions', subs: [] },
      { id: 'T1550', name: 'Use Alternate Authentication Material', subs: ['T1550.001 Application Access Token', 'T1550.002 Pass the Hash', 'T1550.003 Pass the Ticket', 'T1550.004 Web Session Cookie'] },
      { id: 'T1078', name: 'Valid Accounts', subs: ['T1078.001 Default Accounts', 'T1078.002 Domain Accounts', 'T1078.003 Local Accounts', 'T1078.004 Cloud Accounts'] },
      { id: 'T1497', name: 'Virtualization/Sandbox Evasion', subs: ['T1497.001 System Checks', 'T1497.002 User Activity Based Checks', 'T1497.003 Time Based Evasion'] },
      { id: 'T1600', name: 'Weaken Encryption', subs: ['T1600.001 Reduce Key Space', 'T1600.002 Disable Crypto Hardware'] },
      { id: 'T1220', name: 'XSL Script Processing', subs: [] },
    ]
  },
  { 
    id: 'TA0006', 
    name: 'Credential Access', 
    description: 'The adversary is trying to steal account names and passwords.',
    techniques: [
      { id: 'T1110', name: 'Brute Force', subs: ['T1110.001 Password Guessing', 'T1110.002 Password Cracking', 'T1110.003 Password Spraying', 'T1110.004 Credential Stuffing'] },
      { id: 'T1555', name: 'Credentials from Password Stores', subs: ['T1555.001 Keychain', 'T1555.002 Securityd Memory', 'T1555.003 Credentials from Web Browsers', 'T1555.004 Windows Credential Manager', 'T1555.005 Password Managers', 'T1555.006 Cloud Secrets Management Stores'] },
      { id: 'T1212', name: 'Exploitation for Credential Access', subs: [] },
      { id: 'T1187', name: 'Forced Authentication', subs: [] },
      { id: 'T1606', name: 'Forge Web Credentials', subs: ['T1606.001 Web Cookies', 'T1606.002 SAML Tokens'] },
      { id: 'T1056', name: 'Input Capture', subs: ['T1056.001 Keylogging', 'T1056.002 GUI Input Capture', 'T1056.003 Web Portal Capture', 'T1056.004 Credential API Hooking'] },
      { id: 'T1557', name: 'Adversary-in-the-Middle', subs: ['T1557.001 LLMNR/NBT-NS Poisoning and SMB Relay', 'T1557.002 ARP Cache Poisoning', 'T1557.003 DHCP Spoofing'] },
      { id: 'T1556', name: 'Modify Authentication Process', subs: ['T1556.001 Domain Controller Authentication', 'T1556.002 Password Filter DLL', 'T1556.003 Pluggable Authentication Modules', 'T1556.004 Network Device Authentication', 'T1556.006 Multi-Factor Authentication', 'T1556.007 Hybrid Identity', 'T1556.008 Network Provider DLL'] },
      { id: 'T1111', name: 'Multi-Factor Authentication Interception', subs: [] },
      { id: 'T1621', name: 'Multi-Factor Authentication Request Generation', subs: [] },
      { id: 'T1040', name: 'Network Sniffing', subs: [] },
      { id: 'T1003', name: 'OS Credential Dumping', subs: ['T1003.001 LSASS Memory', 'T1003.002 Security Account Manager', 'T1003.003 NTDS', 'T1003.004 LSA Secrets', 'T1003.005 Cached Domain Credentials', 'T1003.006 DCSync', 'T1003.007 Proc Filesystem', 'T1003.008 /etc/passwd and /etc/shadow'] },
      { id: 'T1528', name: 'Steal Application Access Token', subs: [] },
      { id: 'T1558', name: 'Steal or Forge Kerberos Tickets', subs: ['T1558.001 Golden Ticket', 'T1558.002 Silver Ticket', 'T1558.003 Kerberoasting', 'T1558.004 AS-REP Roasting'] },
      { id: 'T1539', name: 'Steal Web Session Cookie', subs: [] },
      { id: 'T1552', name: 'Unsecured Credentials', subs: ['T1552.001 Credentials In Files', 'T1552.002 Credentials in Registry', 'T1552.003 Bash History', 'T1552.004 Private Keys', 'T1552.005 Cloud Instance Metadata API', 'T1552.006 Group Policy Preferences', 'T1552.007 Container API'] },
    ]
  },
  { 
    id: 'TA0007', 
    name: 'Discovery', 
    description: 'The adversary is trying to figure out your environment.',
    techniques: [
      { id: 'T1087', name: 'Account Discovery', subs: ['T1087.001 Local Account', 'T1087.002 Domain Account', 'T1087.003 Email Account', 'T1087.004 Cloud Account'] },
      { id: 'T1010', name: 'Application Window Discovery', subs: [] },
      { id: 'T1217', name: 'Browser Information Discovery', subs: [] },
      { id: 'T1580', name: 'Cloud Infrastructure Discovery', subs: [] },
      { id: 'T1538', name: 'Cloud Service Dashboard', subs: [] },
      { id: 'T1526', name: 'Cloud Service Discovery', subs: [] },
      { id: 'T1613', name: 'Container and Resource Discovery', subs: [] },
      { id: 'T1622', name: 'Debugger Evasion', subs: [] },
      { id: 'T1482', name: 'Domain Trust Discovery', subs: [] },
      { id: 'T1083', name: 'File and Directory Discovery', subs: [] },
      { id: 'T1615', name: 'Group Policy Discovery', subs: [] },
      { id: 'T1069', name: 'Permission Groups Discovery', subs: ['T1069.001 Local Groups', 'T1069.002 Domain Groups', 'T1069.003 Cloud Groups'] },
      { id: 'T1046', name: 'Network Service Discovery', subs: [] },
      { id: 'T1135', name: 'Network Share Discovery', subs: [] },
      { id: 'T1040', name: 'Network Sniffing', subs: [] },
      { id: 'T1201', name: 'Password Policy Discovery', subs: [] },
      { id: 'T1120', name: 'Peripheral Device Discovery', subs: [] },
      { id: 'T1069', name: 'Permission Groups Discovery', subs: ['T1069.001 Local Groups', 'T1069.002 Domain Groups', 'T1069.003 Cloud Groups'] },
      { id: 'T1057', name: 'Process Discovery', subs: [] },
      { id: 'T1012', name: 'Query Registry', subs: [] },
      { id: 'T1018', name: 'Remote System Discovery', subs: [] },
      { id: 'T1518', name: 'Software Discovery', subs: ['T1518.001 Security Software Discovery'] },
      { id: 'T1082', name: 'System Information Discovery', subs: [] },
      { id: 'T1614', name: 'System Location Discovery', subs: ['T1614.001 System Language Discovery'] },
      { id: 'T1016', name: 'System Network Configuration Discovery', subs: ['T1016.001 Internet Connection Discovery', 'T1016.002 Wi-Fi Discovery'] },
      { id: 'T1049', name: 'System Network Connections Discovery', subs: [] },
      { id: 'T1033', name: 'System Owner/User Discovery', subs: [] },
      { id: 'T1007', name: 'System Service Discovery', subs: [] },
      { id: 'T1124', name: 'System Time Discovery', subs: [] },
      { id: 'T1497', name: 'Virtualization/Sandbox Evasion', subs: ['T1497.001 System Checks', 'T1497.002 User Activity Based Checks', 'T1497.003 Time Based Evasion'] },
    ]
  },
  { 
    id: 'TA0008', 
    name: 'Lateral Movement', 
    description: 'The adversary is trying to move through your environment.',
    techniques: [
      { id: 'T1210', name: 'Exploitation of Remote Services', subs: [] },
      { id: 'T1534', name: 'Internal Spearphishing', subs: [] },
      { id: 'T1570', name: 'Lateral Tool Transfer', subs: [] },
      { id: 'T1563', name: 'Remote Service Session Hijacking', subs: ['T1563.001 SSH Hijacking', 'T1563.002 RDP Hijacking'] },
      { id: 'T1021', name: 'Remote Services', subs: ['T1021.001 Remote Desktop Protocol', 'T1021.002 SMB/Windows Admin Shares', 'T1021.003 Distributed Component Object Model', 'T1021.004 SSH', 'T1021.005 VNC', 'T1021.006 Windows Remote Management', 'T1021.007 Cloud Services', 'T1021.008 Direct Cloud VM Connections'] },
      { id: 'T1091', name: 'Replication Through Removable Media', subs: [] },
      { id: 'T1072', name: 'Software Deployment Tools', subs: [] },
      { id: 'T1080', name: 'Taint Shared Content', subs: [] },
      { id: 'T1550', name: 'Use Alternate Authentication Material', subs: ['T1550.001 Application Access Token', 'T1550.002 Pass the Hash', 'T1550.003 Pass the Ticket', 'T1550.004 Web Session Cookie'] },
    ]
  },
  { 
    id: 'TA0009', 
    name: 'Collection', 
    description: 'The adversary is trying to gather data of interest to their goal.',
    techniques: [
      { id: 'T1557', name: 'Adversary-in-the-Middle', subs: ['T1557.001 LLMNR/NBT-NS Poisoning and SMB Relay', 'T1557.002 ARP Cache Poisoning', 'T1557.003 DHCP Spoofing'] },
      { id: 'T1560', name: 'Archive Collected Data', subs: ['T1560.001 Archive via Utility', 'T1560.002 Archive via Library', 'T1560.003 Archive via Custom Method'] },
      { id: 'T1123', name: 'Audio Capture', subs: [] },
      { id: 'T1119', name: 'Automated Collection', subs: [] },
      { id: 'T1185', name: 'Browser Session Hijacking', subs: [] },
      { id: 'T1115', name: 'Clipboard Data', subs: [] },
      { id: 'T1530', name: 'Data from Cloud Storage', subs: [] },
      { id: 'T1602', name: 'Data from Configuration Repository', subs: ['T1602.001 SNMP (MIB Dump)', 'T1602.002 Network Device Configuration Dump'] },
      { id: 'T1213', name: 'Data from Information Repositories', subs: ['T1213.001 Confluence', 'T1213.002 Sharepoint', 'T1213.003 Code Repositories'] },
      { id: 'T1005', name: 'Data from Local System', subs: [] },
      { id: 'T1039', name: 'Data from Network Shared Drive', subs: [] },
      { id: 'T1025', name: 'Data from Removable Media', subs: [] },
      { id: 'T1074', name: 'Data Staged', subs: ['T1074.001 Local Data Staging', 'T1074.002 Remote Data Staging'] },
      { id: 'T1114', name: 'Email Collection', subs: ['T1114.001 Local Email Collection', 'T1114.002 Remote Email Collection', 'T1114.003 Email Forwarding Rule'] },
      { id: 'T1056', name: 'Input Capture', subs: ['T1056.001 Keylogging', 'T1056.002 GUI Input Capture', 'T1056.003 Web Portal Capture', 'T1056.004 Credential API Hooking'] },
      { id: 'T1113', name: 'Screen Capture', subs: [] },
      { id: 'T1125', name: 'Video Capture', subs: [] },
    ]
  },
  { 
    id: 'TA0011', 
    name: 'Command and Control', 
    description: 'The adversary is trying to communicate with compromised systems to control them.',
    techniques: [
      { id: 'T1071', name: 'Application Layer Protocol', subs: ['T1071.001 Web Protocols', 'T1071.002 File Transfer Protocols', 'T1071.003 Mail Protocols', 'T1071.004 DNS'] },
      { id: 'T1092', name: 'Communication Through Removable Media', subs: [] },
      { id: 'T1132', name: 'Data Encoding', subs: ['T1132.001 Standard Encoding', 'T1132.002 Non-Standard Encoding'] },
      { id: 'T1001', name: 'Data Obfuscation', subs: ['T1001.001 Junk Data', 'T1001.002 Steganography', 'T1001.003 Protocol Impersonation'] },
      { id: 'T1568', name: 'Dynamic Resolution', subs: ['T1568.001 Fast Flux DNS', 'T1568.002 Domain Generation Algorithms', 'T1568.003 DNS Calculation'] },
      { id: 'T1573', name: 'Encrypted Channel', subs: ['T1573.001 Symmetric Cryptography', 'T1573.002 Asymmetric Cryptography'] },
      { id: 'T1008', name: 'Fallback Channels', subs: [] },
      { id: 'T1105', name: 'Ingress Tool Transfer', subs: [] },
      { id: 'T1104', name: 'Multi-Stage Channels', subs: [] },
      { id: 'T1095', name: 'Non-Application Layer Protocol', subs: [] },
      { id: 'T1571', name: 'Non-Standard Port', subs: [] },
      { id: 'T1572', name: 'Protocol Tunneling', subs: [] },
      { id: 'T1090', name: 'Proxy', subs: ['T1090.001 Internal Proxy', 'T1090.002 External Proxy', 'T1090.003 Multi-hop Proxy', 'T1090.004 Domain Fronting'] },
      { id: 'T1219', name: 'Remote Access Software', subs: [] },
      { id: 'T1205', name: 'Traffic Signaling', subs: ['T1205.001 Port Knocking', 'T1205.002 Socket Filters'] },
      { id: 'T1102', name: 'Web Service', subs: ['T1102.001 Dead Drop Resolver', 'T1102.002 Bidirectional Communication', 'T1102.003 One-Way Communication'] },
    ]
  },
  { 
    id: 'TA0010', 
    name: 'Exfiltration', 
    description: 'The adversary is trying to steal data.',
    techniques: [
      { id: 'T1020', name: 'Automated Exfiltration', subs: ['T1020.001 Traffic Duplication'] },
      { id: 'T1030', name: 'Data Transfer Size Limits', subs: [] },
      { id: 'T1048', name: 'Exfiltration Over Alternative Protocol', subs: ['T1048.001 Exfiltration Over Symmetric Encrypted Non-C2 Protocol', 'T1048.002 Exfiltration Over Asymmetric Encrypted Non-C2 Protocol', 'T1048.003 Exfiltration Over Unencrypted Non-C2 Protocol'] },
      { id: 'T1041', name: 'Exfiltration Over C2 Channel', subs: [] },
      { id: 'T1011', name: 'Exfiltration Over Other Network Medium', subs: ['T1011.001 Exfiltration Over Bluetooth'] },
      { id: 'T1052', name: 'Exfiltration Over Physical Medium', subs: ['T1052.001 Exfiltration over USB'] },
      { id: 'T1567', name: 'Exfiltration Over Web Service', subs: ['T1567.001 Exfiltration to Code Repository', 'T1567.002 Exfiltration to Cloud Storage', 'T1567.003 Exfiltration to Text Storage Sites', 'T1567.004 Exfiltration Over Webhook'] },
      { id: 'T1029', name: 'Scheduled Transfer', subs: [] },
      { id: 'T1537', name: 'Transfer Data to Cloud Account', subs: [] },
    ]
  },
  { 
    id: 'TA0040', 
    name: 'Impact', 
    description: 'The adversary is trying to manipulate, interrupt, or destroy your systems and data.',
    techniques: [
      { id: 'T1531', name: 'Account Access Removal', subs: [] },
      { id: 'T1485', name: 'Data Destruction', subs: [] },
      { id: 'T1486', name: 'Data Encrypted for Impact', subs: [] },
      { id: 'T1565', name: 'Data Manipulation', subs: ['T1565.001 Stored Data Manipulation', 'T1565.002 Transmitted Data Manipulation', 'T1565.003 Runtime Data Manipulation'] },
      { id: 'T1491', name: 'Defacement', subs: ['T1491.001 Internal Defacement', 'T1491.002 External Defacement'] },
      { id: 'T1561', name: 'Disk Wipe', subs: ['T1561.001 Disk Content Wipe', 'T1561.002 Disk Structure Wipe'] },
      { id: 'T1499', name: 'Endpoint Denial of Service', subs: ['T1499.001 OS Exhaustion Flood', 'T1499.002 Service Exhaustion Flood', 'T1499.003 Application Exhaustion Flood', 'T1499.004 Application or System Exploitation'] },
      { id: 'T1495', name: 'Firmware Corruption', subs: [] },
      { id: 'T1490', name: 'Inhibit System Recovery', subs: [] },
      { id: 'T1498', name: 'Network Denial of Service', subs: ['T1498.001 Direct Network Flood', 'T1498.002 Reflection Amplification'] },
      { id: 'T1496', name: 'Resource Hijacking', subs: [] },
      { id: 'T1489', name: 'Service Stop', subs: [] },
      { id: 'T1529', name: 'System Shutdown/Reboot', subs: [] },
    ]
  },
];

interface MitreTacticsSelectProps {
  value: string[]; // Array of tactic IDs
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

export default function MitreTacticsSelect({ value, onChange, disabled }: MitreTacticsSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedTactics, setExpandedTactics] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const toggleSelection = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id));
    } else {
      onChange([...value, id]);
    }
  };
  const getDisplayText = (id: string) => {
    // Check if it's a tactic
    const tactic = MITRE_TACTICS.find(t => t.id === id);
    if (tactic) return `${tactic.id}: ${tactic.name}`;
    
    // Check if it's a technique or sub-technique
    for (const tactic of MITRE_TACTICS) {
      for (const technique of tactic.techniques || []) {
        if (technique.id === id) return `${technique.id} ${technique.name}`;
        const sub = technique.subs.find(s => s.startsWith(id));
        if (sub) return sub;
      }
    }
    return id;
  };
  
  const toggleTactic = (tacticId: string) => {
    setExpandedTactics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tacticId)) {
        newSet.delete(tacticId);
      } else {
        newSet.add(tacticId);
      }
      return newSet;
    });
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      {/* Display/Trigger */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          padding: '8px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: disabled ? '#f5f5f5' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          minHeight: '38px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          alignItems: 'center'
        }}
      >
        {value.length === 0 ? (
          <span style={{ color: '#999', fontSize: '14px' }}>Select MITRE ATT&CK Tactics/Techniques...</span>
        ) : (
          value.map(id => (
            <span
              key={id}
              style={{
                backgroundColor: '#007bff',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '3px',
                fontSize: '11px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {getDisplayText(id)}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!disabled) toggleSelection(id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '0 2px',
                  fontSize: '14px',
                  lineHeight: '1'
                }}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            maxHeight: '400px',
            overflowY: 'auto',
            zIndex: 1000
          }}
        >
          {MITRE_TACTICS.map(tactic => {
            const isTacticSelected = value.includes(tactic.id);
            const isTacticExpanded = expandedTactics.has(tactic.id);
            const hasTechniques = tactic.techniques && tactic.techniques.length > 0;
            
            return (
              <div key={tactic.id}>
                {/* Tactic Row */}
                <div
                  style={{
                    padding: '10px',
                    backgroundColor: isTacticSelected ? '#e3f2fd' : '#fff',
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}
                >
                  {hasTechniques && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTactic(tactic.id);
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: 0 }}
                    >
                      {isTacticExpanded ? '▼' : '▶'}
                    </button>
                  )}
                  <input
                    type="checkbox"
                    checked={isTacticSelected}
                    onChange={() => toggleSelection(tactic.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginTop: '2px', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '2px' }}>
                      {tactic.id}: {tactic.name} {hasTechniques && `(${tactic.techniques.length} techniques)`}
                    </div>
                    <div style={{ fontSize: '11px', color: '#666' }}>
                      {tactic.description}
                    </div>
                    <a
                      href={`https://attack.mitre.org/tactics/${tactic.id}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ fontSize: '10px', color: '#007bff', marginTop: '4px', display: 'inline-block' }}
                    >
                      View on MITRE ATT&CK →
                    </a>
                  </div>
                </div>
                
                {/* Techniques (if expanded) */}
                {isTacticExpanded && hasTechniques && (
                  <div style={{ backgroundColor: '#f9f9f9', paddingLeft: '30px' }}>
                    {tactic.techniques.map(technique => {
                      const isTechSelected = value.includes(technique.id);
                      return (
                        <div key={technique.id}>
                          <div
                            style={{
                              padding: '8px 10px',
                              borderBottom: '1px solid #e0e0e0',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              backgroundColor: isTechSelected ? '#e3f2fd' : 'transparent'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isTechSelected}
                              onChange={() => toggleSelection(technique.id)}
                              style={{ cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: '12px', fontWeight: '500' }}>
                                {technique.id} {technique.name}
                              </span>
                              <a
                                href={`https://attack.mitre.org/techniques/${technique.id}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{ fontSize: '10px', color: '#007bff', marginLeft: '8px' }}
                              >
                                →
                              </a>
                            </div>
                          </div>
                          {/* Sub-techniques */}
                          {technique.subs && technique.subs.length > 0 && (
                            <div style={{ paddingLeft: '20px', backgroundColor: '#f0f0f0' }}>
                              {technique.subs.map((sub) => {
                                const subId = sub.split(' ')[0];
                                const isSubSelected = value.includes(subId);
                                return (
                                  <div
                                    key={subId}
                                    style={{
                                      padding: '6px 10px',
                                      borderBottom: '1px solid #e0e0e0',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      backgroundColor: isSubSelected ? '#e3f2fd' : 'transparent'
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSubSelected}
                                      onChange={() => toggleSelection(subId)}
                                      style={{ cursor: 'pointer' }}
                                    />
                                    <span style={{ fontSize: '11px', flex: 1 }}>{sub}</span>
                                    <a
                                      href={`https://attack.mitre.org/techniques/${subId.replace('.', '/')}/`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ fontSize: '10px', color: '#007bff' }}
                                    >
                                      →
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
