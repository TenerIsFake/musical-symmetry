import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from labels import INSTRUMENTS, EFFECTS, MOOD
import infer as service

def test_labels_match_service_vocab():
    assert INSTRUMENTS == service.INSTRUMENTS
    assert EFFECTS == service.EFFECTS
    assert MOOD == service.MOOD

def test_no_duplicate_labels():
    for v in (INSTRUMENTS, EFFECTS, MOOD):
        assert len(set(v)) == len(v)
