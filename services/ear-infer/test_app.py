import base64
from fastapi.testclient import TestClient
from app import app

def test_infer_stub_returns_three_heads():
    c = TestClient(app)
    pcm = (b"\x01\x00" * 8000)
    r = c.post("/infer", json={"pcm_base64": base64.b64encode(pcm).decode(), "domain": "isolated"})
    assert r.status_code == 200
    body = r.json()
    for head in ("instruments", "effects", "mood"):
        assert head in body and isinstance(body[head], list)
    for item in body["effects"]:
        assert set(item) == {"label", "confidence"}
        assert 0.0 <= item["confidence"] <= 1.0

def test_infer_is_deterministic():
    c = TestClient(app)
    import base64 as b
    pcm = b.b64encode(b"\x02\x00" * 8000).decode()
    a = c.post("/infer", json={"pcm_base64": pcm, "domain": "isolated"}).json()
    b2 = c.post("/infer", json={"pcm_base64": pcm, "domain": "isolated"}).json()
    assert a == b2
