"""Run the quantized PoC model on the actual Coral Edge TPU and compare to CPU.

Loads both the plain int8 tflite (CPU) and the _edgetpu.tflite (TPU via the
libedgetpu delegate), runs the held-out validation samples through each, and
reports: per-sample detected effects vs. true labels, CPU-vs-TPU agreement, and
timing. The effects head is identified by output width (22) — unambiguous since
the three heads are 19/22/8.
"""
import os, sys, time
import numpy as np
import tensorflow as tf

MODELS = "/mnt/t/ml/timbria-ear/models"
EFF_W = 22


def effects_output_index(interp):
    for i, d in enumerate(interp.get_output_details()):
        if d["shape"][-1] == EFF_W:
            return i
    raise RuntimeError("no output with effects width 22")


def quant_in(interp, x_float):
    d = interp.get_input_details()[0]
    scale, zp = d["quantization"]
    if scale == 0:
        return x_float.astype(d["dtype"])
    q = np.round(x_float / scale + zp)
    info = np.iinfo(d["dtype"])
    return np.clip(q, info.min, info.max).astype(d["dtype"])


def dequant_out(interp, idx):
    d = interp.get_output_details()[idx]
    y = interp.get_tensor(d["index"]).astype(np.float32)
    scale, zp = d["quantization"]
    return (y - zp) * scale if scale != 0 else y


def run(interp, x_float):
    inp = interp.get_input_details()[0]
    eff_i = effects_output_index(interp)
    interp.set_tensor(inp["index"], quant_in(interp, x_float))
    t0 = time.perf_counter()
    interp.invoke()
    dt = (time.perf_counter() - t0) * 1000
    return dequant_out(interp, eff_i)[0], dt


def main():
    data = np.load(os.path.join(MODELS, "poc_val_sample.npz"), allow_pickle=True)
    X, Y, EFFECTS = data["X"], data["Y"], list(data["effects"])

    cpu = tf.lite.Interpreter(model_path=os.path.join(MODELS, "poc_effects_int8.tflite"))
    cpu.allocate_tensors()

    edgetpu_path = os.path.join(MODELS, "poc_effects_int8_edgetpu.tflite")
    delegate = tf.lite.experimental.load_delegate("libedgetpu.so.1")
    tpu = tf.lite.Interpreter(model_path=edgetpu_path, experimental_delegates=[delegate])
    tpu.allocate_tensors()
    print("[coral] Edge TPU delegate loaded; interpreter allocated.", flush=True)

    cpu_ms, tpu_ms, agree = [], [], 0
    for i in range(len(X)):
        xf = X[i:i+1]
        pe_cpu, dc = run(cpu, xf); cpu_ms.append(dc)
        pe_tpu, dt = run(tpu, xf); tpu_ms.append(dt)
        true = {EFFECTS[j] for j in np.where(Y[i] > 0.5)[0]}
        det_tpu = {EFFECTS[j] for j in np.where(pe_tpu > 0.5)[0]}
        # agreement: top predictions match between backends (argmax over effects)
        if np.argmax(pe_cpu) == np.argmax(pe_tpu):
            agree += 1
        print(f"  clip {i}: true={sorted(true) or '[]'}  coral_detected={sorted(det_tpu) or '[]'} "
              f"(top={EFFECTS[int(np.argmax(pe_tpu))]} {pe_tpu.max():.2f})", flush=True)

    print(f"\n[timing] CPU {np.mean(cpu_ms):.1f}ms/clip  |  Coral {np.mean(tpu_ms):.1f}ms/clip", flush=True)
    print(f"[agreement] CPU vs Coral top-effect match: {agree}/{len(X)}", flush=True)


if __name__ == "__main__":
    main()
