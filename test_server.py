import subprocess
import time
import requests
import pytest

PORT = 7777
BASE_URL = f"http://localhost:{PORT}"

@pytest.fixture(scope="module", autouse=True)
def server():
    # Start the pastebin server
    proc = subprocess.Popen(["node", "server.js"])
    
    # Wait for the server to start
    started = False
    for _ in range(20):
        try:
            r = requests.get(BASE_URL, timeout=1)
            if r.status_code == 200:
                started = True
                break
        except requests.exceptions.RequestException:
            time.sleep(0.5)
            
    if not started:
        proc.terminate()
        pytest.fail("Server did not start in time")
            
    yield
    proc.terminate()
    proc.wait()

def test_homepage():
    r = requests.get(BASE_URL)
    assert r.status_code == 200
    assert "<html" in r.text.lower()

def test_add_and_retrieve_document():
    # POST to /documents
    payload = "This is a secure test document for pytest."
    r = requests.post(f"{BASE_URL}/documents", data=payload)
    assert r.status_code == 200
    data = r.json()
    assert "key" in data, "Response should have a key"
    
    key = data["key"]
    
    # GET /raw/{key}
    r2 = requests.get(f"{BASE_URL}/raw/{key}")
    assert r2.status_code == 200
    assert r2.text == payload

def test_static_about_document():
    # Check that static document about exists
    r = requests.get(f"{BASE_URL}/raw/about")
    assert r.status_code == 200
    assert len(r.text) > 0
