from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

BASE_DIR = Path(__file__).resolve().parent
DATASET_PATH = BASE_DIR / "AI_Scholar_Survey_Dataset.xlsx"
MODEL_PATH = BASE_DIR / "model.pkl"
FEATURE_COLUMNS = [
    "degree_level",
    "study_mode",
    "funding_status",
    "program_year",
    "weekly_hours",
    "supervisor_freq",
    "caregiving",
    "productivity_index",
    "coping_index",
    "stressor_index",
]
TARGET_COLUMNS = ["pss_score", "gad7_score", "phq9_score"]


def train_model():
    data = pd.read_excel(DATASET_PATH)
    required_columns = FEATURE_COLUMNS + TARGET_COLUMNS
    missing_columns = [column for column in required_columns if column not in data.columns]

    if missing_columns:
        raise ValueError(f"Dataset is missing required columns: {missing_columns}")

    X = data[FEATURE_COLUMNS]
    y = data[TARGET_COLUMNS]

    model = RandomForestRegressor(
        n_estimators=200,
        random_state=42,
        min_samples_leaf=2,
    )
    model.fit(X, y)

    model_package = {
        "model": model,
        "feature_columns": list(X.columns),
        "target_columns": TARGET_COLUMNS,
    }
    joblib.dump(model_package, MODEL_PATH)

    return model_package


if __name__ == "__main__":
    package = train_model()
    print(f"Model saved to {MODEL_PATH}")
    print(f"Features: {', '.join(package['feature_columns'])}")
