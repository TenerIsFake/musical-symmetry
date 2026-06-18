# Compiling for the Coral Edge TPU

Turns an int8 `.tflite` (from `quantize.py`) into a `*_edgetpu.tflite` that runs
on the Coral. This is a **build-time** step on an x86 Linux box; it is separate
from the **runtime** (`pycoral`) on the Windows service host, which is covered
in `../README.md`.

---

## 1. Install `edgetpu_compiler`

The compiler is **x86-64 Debian/Ubuntu only**. There is **no ARM build and no
native Windows build** — do not try to install it on a Pi or on Windows.

```bash
echo "deb https://packages.cloud.google.com/apt coral-edgetpu-stable main" \
  | sudo tee /etc/apt/sources.list.d/coral-edgetpu.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key add -
sudo apt-get update
sudo apt-get install -y edgetpu-compiler
edgetpu_compiler --version
```

**Alternative: Google Colab.** If you have no x86 Debian host, run the same
`apt`/`edgetpu_compiler` commands in a Colab notebook, upload the `.tflite`,
and download the compiled artifact. (The compiler runs anywhere x86 Linux runs;
Colab is just a convenient one.)

---

## 2. Compile

```bash
edgetpu_compiler ./out/ear-isolated.tflite -o ./out/
```

Produces:

- `./out/ear-isolated_edgetpu.tflite` — the deployable model (note the
  `_edgetpu` suffix that `../infer.py` keys on to choose `pycoral`).
- `./out/ear-isolated_edgetpu.log` — the op-mapping report.

The input **must** be a full-int8 model. A float or dynamic-range model will be
rejected or mapped entirely to CPU — re-run `quantize.py` if so.

---

## 3. Read the op-mapping report

The log ends with a table like:

```
Number of operations that will run on Edge TPU: 31
Number of operations that will run on CPU: 2

Operator                       Count      Status
CONV_2D                        3          Mapped to Edge TPU
MAX_POOL_2D                    3          Mapped to Edge TPU
MEAN                           1          Mapped to Edge TPU
FULLY_CONNECTED                3          Mapped to Edge TPU
LOGISTIC                       3          Mapped to Edge TPU
...                            ...        More than one subgraph is not supported
```

What to check:

- **% mapped to TPU.** The headline ratio. Aim for essentially all compute ops
  on the TPU. Once an op falls back to CPU, *every op after it* runs on CPU too
  (the compiler splits at the first unsupported op), so a single early fallback
  can tank throughput.
- **"More than one subgraph is not supported"** or a low mapped count means an
  op in the middle isn't supported — that's the one to eliminate.

---

## 4. If too many ops fall back — simplify the backbone

The architecture in `model.py` (`Conv2D` → `MaxPool2D` ×3 →
`GlobalAveragePooling2D` → per-head `Dense`+sigmoid) uses only Edge-TPU-mapped
ops and should map cleanly. If your variant adds something that falls back:

- **Replace unsupported ops with mapped equivalents.** Common offenders:
  exotic activations (use `relu`), `BatchNormalization` placement (fold it into
  the preceding conv, or drop it), large/odd strides, dynamic shapes. Stick to
  `Conv2D`, `DepthwiseConv2D`, `MaxPool2D`, `MEAN`/GAP, `FULLY_CONNECTED`,
  `LOGISTIC`.
- **Shrink to fit Edge TPU SRAM.** If the log says parameters didn't fit
  on-chip ("caching ... off-chip"), reduce channel widths (the `(16, 32, 64)`
  filter schedule) or `frames`.
- **Avoid a CPU op early in the graph** — reorder so any unavoidable CPU op is
  last, since everything after the first fallback also runs on CPU.

Re-quantize (if you changed the graph) and re-compile, then re-check the report.

---

## 5. Next

Hand the `*_edgetpu.tflite` to `eval.py` (ship gate, README step 7) and then to
deploy (README step 8). Runtime loading on the Coral host (`pycoral`,
`EAR_INFER_MODEL`) is in `../README.md`.
