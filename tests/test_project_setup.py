from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


def test_requirements_file_exists():
    assert (ROOT / "requirements.txt").exists(), "requirements.txt is missing"


def test_default_dataset_has_expected_columns():
    df = pd.read_csv(ROOT / "analyzed_reviews.csv")
    required = ["sentiment", "confidence", "review"]
    missing = [col for col in required if col not in df.columns]
    assert not missing, f"Missing required columns: {missing}"
