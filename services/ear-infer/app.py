import base64, binascii
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from infer import Model

app = FastAPI(title="timbria-ear-infer")
_model = Model()

class InferReq(BaseModel):
    pcm_base64: str
    domain: str = "isolated"

@app.post("/infer")
def infer(req: InferReq):
    try:
        pcm = base64.b64decode(req.pcm_base64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="invalid base64")
    if len(pcm) % 2 != 0:
        raise HTTPException(status_code=400, detail="pcm must be 16-bit (even byte length)")
    return _model.infer(pcm, req.domain)

@app.get("/health")
def health():
    return {"ok": True, "model": _model.interp is not None}
