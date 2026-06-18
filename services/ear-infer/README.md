# timbria-ear-infer

Remote inference service for the Timbria **ear** feature. `timbria-api`'s `HttpEarInfer`
client POSTs raw PCM audio here and receives three classification heads
(instruments / effects / mood).

This service is designed to run on the **Windows host that has the Coral Edge TPU
attached**, while `timbria-api` runs in Docker/WSL2 and reaches it over the LAN.
It degrades gracefully: with no model and no Coral present it returns a
**deterministic stub** so development and CI never need hardware.

## HTTP contract

```
POST /infer
  body: { "pcm_base64": "<base64 of little-endian int16 PCM @ 16 kHz>", "domain": "isolated" }
  ->   { "instruments": [{label, confidence}], "effects": [...], "mood": [...] }

GET /health
  ->   { "ok": true, "model": <bool: true when a real interpreter is loaded> }
```

`confidence` is a float in `[0.0, 1.0]`. The stub output is a deterministic
function of the input PCM bytes (same audio in -> same labels out).

## Run the STUB (no model, dev/CI)

No `EAR_INFER_MODEL` env var -> `Model.interp` stays `None` -> stub heads.

```bash
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/uvicorn app:app --host 0.0.0.0 --port 9009
```

Run the tests:

```bash
./venv/bin/pip install pytest httpx
./venv/bin/python -m pytest test_app.py -q
```

## Run on the WINDOWS host with the Coral Edge TPU

The Edge TPU model file name **must** end in `_edgetpu.tflite` — that suffix is
how the loader decides to use `pycoral` rather than `tflite-runtime`.

```powershell
pip install pycoral
set EAR_INFER_MODEL=C:\path\to\models\ear-isolated_edgetpu.tflite
uvicorn app:app --host 0.0.0.0 --port 9009
```

`GET /health` should then report `"model": true`.

## Run CPU mode (no Coral)

Point `EAR_INFER_MODEL` at a plain `.tflite` (no `_edgetpu` suffix) and install
the CPU runtime:

```bash
pip install tflite-runtime
export EAR_INFER_MODEL=/path/to/models/ear-isolated.tflite
uvicorn app:app --host 0.0.0.0 --port 9009
```

## Connect timbria-api

Tell `timbria-api` where this service lives:

```bash
set EAR_INFER_URL=http://<windows-ip>:9009
```

`HttpEarInfer` will POST to `${EAR_INFER_URL}/infer`.

## Status

The real model I/O signature (tensor shapes, label decoding from the model's
output tensors) is **finalized in sub-project B**. Until then, even when a real
interpreter loads, `Model.infer` computes the log-mel feature and then returns
the deterministic stub heads as a placeholder.
