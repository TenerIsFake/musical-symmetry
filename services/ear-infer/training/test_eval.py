"""Tests for eval.py, specifically the width-routing fix for TFLite output matching."""
import pytest

pytest.importorskip("tensorflow")

from eval import _match_outputs
from model import HEADS


def test_match_outputs_by_width():
    """Test that _match_outputs routes by head width, not by name substring.

    This verifies the Phase-3 fix: TFLite renames outputs to "StatefulPartitionedCall:N"
    with no head-name substrings, and positional order is not guaranteed. Width-routing
    is robust and unambiguous because the three head widths are distinct (19/22/8).
    """
    # Simulate real TFLite output tensors: renamed, reordered, no head substrings.
    out_details = [
        {"name": "StatefulPartitionedCall:0", "shape": (1, 22), "index": 0},
        {"name": "StatefulPartitionedCall:1", "shape": (1, 19), "index": 1},
        {"name": "StatefulPartitionedCall:2", "shape": (1, 8), "index": 2},
    ]

    result = _match_outputs(out_details, HEADS)

    # Verify each head is mapped to the correct output tensor by width.
    assert result["instrument"]["shape"] == (1, 19)
    assert result["effects"]["shape"] == (1, 22)
    assert result["mood"]["shape"] == (1, 8)

    # Verify the indices are as expected.
    assert result["instrument"]["index"] == 1
    assert result["effects"]["index"] == 0
    assert result["mood"]["index"] == 2


def test_match_outputs_missing_width():
    """Test that _match_outputs raises ValueError if a head's width is missing."""
    # Missing the width-8 (mood) output tensor.
    out_details = [
        {"name": "StatefulPartitionedCall:0", "shape": (1, 22), "index": 0},
        {"name": "StatefulPartitionedCall:1", "shape": (1, 19), "index": 1},
    ]

    with pytest.raises(ValueError, match="expected exactly 1 output tensor with width 8"):
        _match_outputs(out_details, HEADS)


def test_match_outputs_duplicate_width():
    """Test that _match_outputs raises ValueError if a width matches multiple tensors."""
    # Two tensors with width 19 (instrument).
    out_details = [
        {"name": "StatefulPartitionedCall:0", "shape": (1, 22), "index": 0},
        {"name": "StatefulPartitionedCall:1", "shape": (1, 19), "index": 1},
        {"name": "StatefulPartitionedCall:2", "shape": (1, 19), "index": 2},
        {"name": "StatefulPartitionedCall:3", "shape": (1, 8), "index": 3},
    ]

    with pytest.raises(ValueError, match="expected exactly 1 output tensor with width 19"):
        _match_outputs(out_details, HEADS)
