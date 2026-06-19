"""Shared thread-pool helper for corpus ingest.

I/O-bound reads release the GIL, so a thread pool provides real concurrency
even in CPython.  Pre-assigned indices (passed to the worker via the item tuple)
keep output filenames deterministic regardless of completion order.
"""
from concurrent.futures import ThreadPoolExecutor


def parallel_count(items, worker, max_workers=16):
    """Run worker(item) over items in a thread pool; return count of truthy results.

    max_workers<=1 runs serially (handy for tests/determinism checks).
    items is materialised into a list so callers may pass generators.
    """
    items = list(items)
    if max_workers <= 1:
        return sum(1 for it in items if worker(it))
    n = 0
    with ThreadPoolExecutor(max_workers=max_workers) as ex:
        for ok in ex.map(worker, items):
            if ok:
                n += 1
    return n
