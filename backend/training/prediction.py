import pandas as pd
import joblib
from pathlib import Path

# -----------------------------
# CONFIG
# -----------------------------
MODEL_PATH = "models/best_ensemble.pkl"
FUTURE_FILES = [
    "asthma_forecast_2025_2027.csv",
    
]
OUTPUT_PATH = "predictions_asthma_forecast.csv"

# -----------------------------
# LOAD MODEL
# -----------------------------
bundle = joblib.load(MODEL_PATH)
model = bundle["model"]
features = bundle.get("features", [])
cat_cols = bundle.get("cat_cols", []) or []
with_fixed = bundle.get("with_fixed_effects", False)

print(f"Loaded model trained with fixed effects = {with_fixed}")
print(f"Numeric features: {features}")
print(f"Categorical features: {cat_cols}")

# -----------------------------
# LOAD AND COMBINE FUTURE DATA
# -----------------------------
frames = []
for f in FUTURE_FILES:
    df = pd.read_csv(f)
    print(f"Loaded {f}: {df.shape}")
    frames.append(df)
future = pd.concat(frames, ignore_index=True)

# Clean up columns
future.columns = future.columns.str.strip()
needed = features + cat_cols
missing = [c for c in needed if c not in future.columns]
if missing:
    print(f"[WARN] Missing columns in input: {missing} → filling with NaN")
    for c in missing:
        future[c] = pd.NA

X_future = future[needed].copy()

# -----------------------------
# PREDICT
# -----------------------------
preds = model.predict(X_future)
future["Predicted Asthma Prevalence %"] = preds

# Reorder for readability
cols = ["Year", "State", "Predicted Asthma Prevalence %"] + [
    c for c in future.columns if c not in ["Year", "State", "Predicted Asthma Prevalence %"]
]
future = future[cols]

Path(OUTPUT_PATH).parent.mkdir(exist_ok=True)
future.to_csv(OUTPUT_PATH, index=False)
print(f"\n✅ Saved forecast → {OUTPUT_PATH}")
print(future.head(10).to_string(index=False))
