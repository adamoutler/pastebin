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

def test_homepage_and_security_headers():
    r = requests.get(BASE_URL)
    assert r.status_code == 200
    assert "<html" in r.text.lower()
    assert "markdown.min.js" in r.text
    assert 'id="mode-bar"' not in r.text
    assert 'id="write-bar"' in r.text
    assert 'id="markdown"' in r.text
    assert r.headers.get("X-Content-Type-Options") == "nosniff"
    assert r.headers.get("Referrer-Policy") == "no-referrer"
    assert r.headers.get("X-Frame-Options") == "DENY"
    assert "default-src 'self'" in r.headers.get("Content-Security-Policy", "")

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

def test_meta_tag_injection_prevention():
    # Attempt $' replacement pattern and attribute breakout in paste description
    hostile_paste = "# Markdown Title\n\n$'\" onload=\"alert(1)\"><script>alert(1)</script>"
    r = requests.post(f"{BASE_URL}/documents", data=hostile_paste)
    assert r.status_code == 200
    key = r.json()["key"]

    html_res = requests.get(f"{BASE_URL}/{key}")
    assert html_res.status_code == 200
    # Ensure unescaped <script>alert(1)</script> was not injected into the HTML page
    assert "<script>alert(1)</script>" not in html_res.text
    assert "&quot;" in html_res.text

def test_static_about_document():
    # Check that static document about exists
    r = requests.get(f"{BASE_URL}/raw/about")
    assert r.status_code == 200
    assert len(r.text) > 0

def test_markdown_security_node_suite():
    res = subprocess.run(["npm", "test"], capture_output=True, text=True)
    assert res.returncode == 0, f"npm test failed:\n{res.stdout}\n{res.stderr}"
