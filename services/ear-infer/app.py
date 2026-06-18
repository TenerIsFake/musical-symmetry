import base64
from fastapi import FastAPI
from pydantic import BaseModel
from infer import Model

app = FastAPI(title="timbria-ear-infer")
_model = Model()

class InferReq(BaseModel):
    pcm_base64: str
    domain: str = "isolated"

@app.post("/infer")
def infer(req: InferReq):
    pcm = base64.b64decode(req.pcm_base64)
    return _model.infer(pcm, req.domain)

@app.get("/health")
def health():
    return {"ok": True, "model": _model.interp is not None}
