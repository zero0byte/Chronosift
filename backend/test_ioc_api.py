"""Test script for IOC API endpoints."""
import requests
import json

# Configuration
BASE_URL = "http://localhost:5000/api"

# You can change these credentials to match your test user
TEST_EMAIL = "admin@chronosift.local"
TEST_PASSWORD = "SecurePass123!"

def print_section(title):
    """Print a section header."""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def print_result(test_name, success, details=""):
    """Print test result."""
    status = "✓ PASS" if success else "✗ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"  Details: {details}")

# Test execution
def run_tests():
    print_section("IOC API Backend Tests")
    
    # Step 1: Login to get token
    print_section("1. Authentication")
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            data = response.json()
            token = data['access_token']
            user = data['user']
            print_result("Login successful", True, f"User: {user['email']}")
            headers = {"Authorization": f"Bearer {token}"}
        else:
            print_result("Login failed", False, f"Status: {response.status_code}")
            print("Cannot proceed without authentication. Exiting.")
            return
    except Exception as e:
        print_result("Login request failed", False, str(e))
        return
    
    # Step 2: Get projects
    print_section("2. Get Projects")
    try:
        response = requests.get(f"{BASE_URL}/projects", headers=headers)
        if response.status_code == 200:
            data = response.json()
            projects = data.get('projects', [])
            if projects:
                project_id = projects[0]['id']
                project_name = projects[0]['name']
                print_result("Projects retrieved", True, f"Using project '{project_name}' (ID: {project_id})")
            else:
                print_result("No projects found", False, "Create a project first")
                return
        else:
            print_result("Failed to get projects", False, f"Status: {response.status_code}, Response: {response.text}")
            return
    except Exception as e:
        import traceback
        print_result("Projects request failed", False, str(e))
        print(f"  Traceback: {traceback.format_exc()}")
        return
    
    # Step 3: Test IOC Extraction via API
    print_section("3. Test IOC Extraction via API")
    # We'll test extraction after we create some timeline entries
    print("  Note: Extraction testing will be done after creating test IOCs")
    
    # Step 4: Create IOCs via API
    print_section("4. Create IOCs")
    test_iocs = [
        {"ioc_type": "ipv4", "value": "1.2.3.4", "severity": "high", "confidence": "confirmed"},
        {"ioc_type": "domain", "value": "malware-test.com", "severity": "critical", "confidence": "high"},
        {"ioc_type": "md5", "value": "d41d8cd98f00b204e9800998ecf8427e", "severity": "medium", "confidence": "medium"},
    ]
    
    created_ioc_ids = []
    for ioc_data in test_iocs:
        try:
            response = requests.post(
                f"{BASE_URL}/iocs/projects/{project_id}/iocs",
                headers=headers,
                json=ioc_data
            )
            if response.status_code in [200, 201]:
                ioc = response.json() if response.status_code == 201 else response.json()['ioc']
                created_ioc_ids.append(ioc['id'])
                print_result(
                    f"Create {ioc_data['ioc_type']}: {ioc_data['value']}", 
                    True, 
                    f"ID: {ioc['id']}"
                )
            else:
                print_result(
                    f"Create {ioc_data['ioc_type']}", 
                    False, 
                    f"Status: {response.status_code}, {response.text}"
                )
        except Exception as e:
            print_result(f"Create {ioc_data['ioc_type']}", False, str(e))
    
    # Step 5: List IOCs
    print_section("5. List IOCs")
    try:
        response = requests.get(f"{BASE_URL}/iocs/projects/{project_id}/iocs", headers=headers)
        if response.status_code == 200:
            data = response.json()
            print_result("List IOCs", True, f"Total: {data['total']}, Page: {data['page']}")
            print(f"  IOCs on this page: {len(data['iocs'])}")
        else:
            print_result("List IOCs", False, f"Status: {response.status_code}")
    except Exception as e:
        print_result("List IOCs", False, str(e))
    
    # Step 6: Get IOC by ID
    print_section("6. Get Single IOC")
    if created_ioc_ids:
        try:
            ioc_id = created_ioc_ids[0]
            response = requests.get(f"{BASE_URL}/iocs/iocs/{ioc_id}", headers=headers)
            if response.status_code == 200:
                ioc = response.json()
                print_result("Get IOC by ID", True, f"Type: {ioc['ioc_type']}, Value: {ioc['value']}")
            else:
                print_result("Get IOC by ID", False, f"Status: {response.status_code}")
        except Exception as e:
            print_result("Get IOC by ID", False, str(e))
    
    # Step 7: Update IOC
    print_section("7. Update IOC")
    if created_ioc_ids:
        try:
            ioc_id = created_ioc_ids[0]
            response = requests.put(
                f"{BASE_URL}/iocs/iocs/{ioc_id}",
                headers=headers,
                json={"status": "investigating", "notes": "Under review"}
            )
            if response.status_code == 200:
                ioc = response.json()
                print_result("Update IOC", True, f"Status: {ioc['status']}")
            else:
                print_result("Update IOC", False, f"Status: {response.status_code}")
        except Exception as e:
            print_result("Update IOC", False, str(e))
    
    # Step 8: Bulk Update IOCs
    print_section("8. Bulk Update IOCs")
    if len(created_ioc_ids) >= 2:
        try:
            response = requests.post(
                f"{BASE_URL}/iocs/projects/{project_id}/iocs/bulk",
                headers=headers,
                json={
                    "ioc_ids": created_ioc_ids[:2],
                    "updates": {"tags": ["test", "bulk-update"], "confidence": "high"}
                }
            )
            if response.status_code == 200:
                result = response.json()
                print_result("Bulk Update", True, f"Updated: {result['updated']}")
            else:
                print_result("Bulk Update", False, f"Status: {response.status_code}")
        except Exception as e:
            print_result("Bulk Update", False, str(e))
    
    # Step 9: Filter IOCs
    print_section("9. Filter IOCs")
    filters = [
        ("By Type", {"type": "ipv4"}),
        ("By Severity", {"severity": "high"}),
        ("By Status", {"status": "investigating"}),
    ]
    
    for filter_name, params in filters:
        try:
            response = requests.get(
                f"{BASE_URL}/iocs/projects/{project_id}/iocs",
                headers=headers,
                params=params
            )
            if response.status_code == 200:
                data = response.json()
                print_result(filter_name, True, f"Found: {data['total']}")
            else:
                print_result(filter_name, False, f"Status: {response.status_code}")
        except Exception as e:
            print_result(filter_name, False, str(e))
    
    # Step 10: Get IOC Statistics
    print_section("10. IOC Statistics")
    try:
        response = requests.get(f"{BASE_URL}/iocs/projects/{project_id}/iocs/stats", headers=headers)
        if response.status_code == 200:
            stats = response.json()
            print_result("Get Statistics", True, f"Total IOCs: {stats['total']}")
            print(f"  By Type: {stats['by_type']}")
            print(f"  By Severity: {stats['by_severity']}")
            print(f"  By Status: {stats['by_status']}")
        else:
            print_result("Get Statistics", False, f"Status: {response.status_code}")
    except Exception as e:
        print_result("Get Statistics", False, str(e))
    
    # Step 11: Delete IOCs (cleanup)
    print_section("11. Cleanup - Delete Test IOCs")
    for ioc_id in created_ioc_ids:
        try:
            response = requests.delete(f"{BASE_URL}/iocs/iocs/{ioc_id}", headers=headers)
            if response.status_code == 200:
                print_result(f"Delete IOC {ioc_id}", True)
            else:
                print_result(f"Delete IOC {ioc_id}", False, f"Status: {response.status_code}")
        except Exception as e:
            print_result(f"Delete IOC {ioc_id}", False, str(e))
    
    print_section("Test Summary")
    print("All IOC API tests completed!")
    print("Check results above for any failures.")

if __name__ == "__main__":
    run_tests()
