import json
import sys
from pathlib import Path

import joblib
import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model.pkl"


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


def sum_responses(prefix, count, reverse_scored_items=None):
    reverse_scored_items = reverse_scored_items or []
    total = 0

    for item_number in range(1, count + 1):
        value = float(data[f"{prefix}_{item_number}"])
        total += 4 - value if item_number in reverse_scored_items else value

    return total


def add_calculated_features():
    if "pss_score" not in data and all(f"pss_{index}" in data for index in range(1, 11)):
        data["pss_score"] = sum_responses("pss", 10, [4, 5, 7, 8])

    if "gad7_score" not in data and all(f"gad7_{index}" in data for index in range(1, 8)):
        data["gad7_score"] = sum_responses("gad7", 7)

    if "phq9_score" not in data and all(f"phq9_{index}" in data for index in range(1, 10)):
        data["phq9_score"] = sum_responses("phq9", 9)

    if "distress_total" not in data and all(column in data for column in ["pss_score", "gad7_score", "phq9_score"]):
        data["distress_total"] = float(data["pss_score"]) + float(data["gad7_score"]) + float(data["phq9_score"])

    if "distress_normalized" not in data and all(column in data for column in ["pss_score", "gad7_score", "phq9_score"]):
        data["distress_normalized"] = (
            (float(data["pss_score"]) / 40)
            + (float(data["gad7_score"]) / 21)
            + (float(data["phq9_score"]) / 27)
        ) / 3

    if "coping_productivity_balance" not in data and all(column in data for column in ["coping_index", "productivity_index"]):
        data["coping_productivity_balance"] = float(data["coping_index"]) - float(data["productivity_index"])

    if "stressor_coping_gap" not in data and all(column in data for column in ["stressor_index", "coping_index"]):
        data["stressor_coping_gap"] = float(data["stressor_index"]) - float(data["coping_index"])


add_calculated_features()

missing_features = [column for column in feature_columns if column not in data]

if missing_features:
    error_response(f"Missing required features: {missing_features}")

df = pd.DataFrame([{column: data[column] for column in feature_columns}], columns=feature_columns)
df = df.apply(pd.to_numeric, errors="raise")

try:
    prediction = model.predict(df)
except Exception as exc:
    error_response(f"Prediction failed: {exc}")

result = {
    "stress_score": round(float(prediction[0][0]), 2),
    "anxiety_score": round(float(prediction[0][1]), 2),
    "depression_score": round(float(prediction[0][2]), 2),
    "wellbeing_score": round(float(prediction[0][2]), 2),
    "feature_count": len(feature_columns)
}

print(json.dumps(result))
