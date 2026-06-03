import json
import sys
from pathlib import Path

import joblib
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model.pkl"
EXPECTED_FEATURE_COLUMNS = [
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


def error_response(message, status="error"):
    print(json.dumps({"status": status, "error": message}))
    sys.exit(1)


if len(sys.argv) < 2:
    error_response("Missing prediction payload")

if not MODEL_PATH.exists() or MODEL_PATH.stat().st_size == 0:
    error_response("Model file is missing or empty. Run Train.py first.")

try:
    package = joblib.load(MODEL_PATH)
except Exception as exc:
    error_response(f"Unable to load model: {exc}")

model = package["model"] if isinstance(package, dict) and "model" in package else package
feature_columns = package.get("feature_columns") if isinstance(package, dict) else None

try:
    data = json.loads(sys.argv[1])
except json.JSONDecodeError as exc:
    error_response(f"Invalid JSON payload: {exc}")

if not isinstance(data, dict):
    error_response("Prediction payload must be a JSON object")

if isinstance(data.get("responses"), dict):
    data = data["responses"]

if feature_columns is None:
    feature_columns = list(getattr(model, "feature_names_in_", []))

if not feature_columns:
    error_response("Model does not define input feature columns")

if feature_columns != EXPECTED_FEATURE_COLUMNS:
    error_response(
        "Model feature columns are stale. Run Train.py with the 10 life-situation "
        "features before starting predictions."
    )

missing_features = [column for column in feature_columns if column not in data]

if missing_features:
    error_response(f"Missing required features: {missing_features}")

df = pd.DataFrame([{column: data[column] for column in feature_columns}], columns=feature_columns)
df = df.apply(pd.to_numeric, errors="raise")

try:
    prediction = model.predict(df)
except Exception as exc:
    error_response(f"Prediction failed: {exc}")

pss_score = round(float(prediction[0][0]), 2)
gad7_score = round(float(prediction[0][1]), 2)
phq9_score = round(float(prediction[0][2]), 2)
distress_total = round(pss_score + gad7_score + phq9_score, 2)
distress_normalized = round(((pss_score / 40) + (gad7_score / 21) + (phq9_score / 27)) / 3, 4)
overall_wellbeing = round(max(0, min(100, (1 - distress_normalized) * 100)))

result = {
    "pss_score": pss_score,
    "gad7_score": gad7_score,
    "phq9_score": phq9_score,
    "distress_total": distress_total,
    "distress_normalized": distress_normalized,
    "overall_wellbeing": overall_wellbeing,
    "stress_score": pss_score,
    "anxiety_score": gad7_score,
    "depression_score": phq9_score,
    "wellbeing_score": overall_wellbeing,
    "feature_count": len(feature_columns)
}

print(json.dumps(result))
