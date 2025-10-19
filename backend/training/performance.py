# make_model_report_plots.py
import os
from pathlib import Path
import numpy as np
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split, cross_val_predict, KFold
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
from sklearn.inspection import permutation_importance
import matplotlib.pyplot as plt

# --------------------
# CONFIG
# --------------------
DATA_CSV  = "backend/training/ml_dataset_smoking.csv"            # your training dataset
MODEL_PKL = "backend/training/models/best_ensemble.pkl"  # saved from tuning
TARGET_COLS_CANDIDATES = [
    "Asthma Prevalence%"
]
TEST_SIZE = 0.2
RANDOM_STATE = 42
REPORT_DIR = Path("backend/training/performance_graphs")
REPORT_DIR.mkdir(parents=True, exist_ok=True)

# --------------------
# LOAD DATA & MODEL
# --------------------
df = pd.read_csv(DATA_CSV)
df.columns = df.columns.astype(str).str.strip()

# find target column
target_col = None
for c in TARGET_COLS_CANDIDATES:
    if c in df.columns:
        target_col = c
        break
if target_col is None:
    raise ValueError(f"Could not find any of {TARGET_COLS_CANDIDATES} in {DATA_CSV}")

# features = everything the model says it needs
bundle = joblib.load(MODEL_PKL)
pipe = bundle["model"]
feat_cols = bundle.get("features", [c for c in df.columns if c.startswith("Avg ")])
cat_cols  = bundle.get("cat_cols", []) or []
needed_cols = feat_cols + cat_cols

# trim/clean
df = df.dropna(subset=[target_col])
X = df[needed_cols].copy()
y = df[target_col].astype(float).values

# --------------------
# TRAIN/TEST SPLIT
# --------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE
)
pipe.fit(X_train, y_train)
y_pred = pipe.predict(X_test)

# metrics
def safe_rmse(y_true, y_hat):
    try:
        return mean_squared_error(y_true, y_hat, squared=False)
    except TypeError:
        return float(np.sqrt(mean_squared_error(y_true, y_hat)))

r2   = r2_score(y_test, y_pred)
rmse = safe_rmse(y_test, y_pred)
mae  = mean_absolute_error(y_test, y_pred)

# --------------------
# 1) PARITY PLOT (holdout)
# --------------------
plt.figure()
plt.scatter(y_test, y_pred, s=20)
mn = float(min(y_test.min(), y_pred.min()))
mx = float(max(y_test.max(), y_pred.max()))
plt.plot([mn, mx], [mn, mx])  # y=x
plt.xlabel("Actual")
plt.ylabel("Predicted")
plt.title("Parity Plot (Holdout)")
# metrics box
txt = f"R² = {r2:.3f}\nRMSE = {rmse:.3f}\nMAE = {mae:.3f}\nN = {len(y_test)}"
plt.gcf().text(0.72, 0.20, txt)
plt.tight_layout()
plt.savefig(REPORT_DIR / "parity_holdout.png", dpi=200)

# --------------------
# 2) RESIDUALS (hist)
# --------------------
resid = y_test - y_pred
plt.figure()
plt.hist(resid, bins=20)
plt.xlabel("Residual (Actual - Predicted)")
plt.ylabel("Count")
plt.title("Residuals Histogram (Holdout)")
plt.tight_layout()
plt.savefig(REPORT_DIR / "residuals_hist.png", dpi=200)

# --------------------
# 3) RESIDUALS vs PREDICTED
# --------------------
plt.figure()
plt.scatter(y_pred, resid, s=20)
plt.axhline(0)
plt.xlabel("Predicted")
plt.ylabel("Residual")
plt.title("Residuals vs Predicted (Holdout)")
plt.tight_layout()
plt.savefig(REPORT_DIR / "residuals_vs_pred.png", dpi=200)

# --------------------
# 4) CROSS-VALIDATED PARITY (out-of-fold)
# --------------------
# This gives a more robust sense than a single split
cv = KFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
y_cv = cross_val_predict(pipe, X, y, cv=cv, n_jobs=-1)
r2_cv = r2_score(y, y_cv)
rmse_cv = safe_rmse(y, y_cv)
mae_cv = mean_absolute_error(y, y_cv)

plt.figure()
plt.scatter(y, y_cv, s=14)
mn = float(min(y.min(), y_cv.min()))
mx = float(max(y.max(), y_cv.max()))
plt.plot([mn, mx], [mn, mx])
plt.xlabel("Actual")
plt.ylabel("Predicted (out-of-fold)")
plt.title("Parity Plot (5-fold CV)")
txt = f"CV R² = {r2_cv:.3f}\nCV RMSE = {rmse_cv:.3f}\nCV MAE = {mae_cv:.3f}\nN = {len(y)}"
plt.gcf().text(0.70, 0.20, txt)
plt.tight_layout()
plt.savefig(REPORT_DIR / "parity_cv.png", dpi=200)

# --------------------
# 5) PERMUTATION IMPORTANCE (top 12)
# --------------------
# Works on the pipeline directly; uses original (untransformed) columns.
# Runtime is fine for your dataset; adjust n_repeats for stability.
result = permutation_importance(
    pipe, X_test, y_test, n_repeats=20, random_state=RANDOM_STATE, n_jobs=-1
)
importances = result.importances_mean
stds = result.importances_std

feat_names = needed_cols

# Exclude 'State' and 'Year' from the display
EXCLUDE = {"State", "Year"}  # add more if needed
mask = [f not in EXCLUDE for f in feat_names]

imp_df = pd.DataFrame({
    "feature": np.array(feat_names)[mask],
    "importance": np.array(importances)[mask],
    "std": np.array(stds)[mask],
}).sort_values("importance", ascending=False).head(12)

plt.figure()
plt.barh(range(len(imp_df)), imp_df["importance"].values)
plt.yticks(range(len(imp_df)), imp_df["feature"].values)
plt.gca().invert_yaxis()
plt.xlabel("Permutation importance (mean ΔR²)")
plt.title("Feature Importance (Permutation, Holdout, Top 12 — excl. State/Year)")
plt.tight_layout()
plt.savefig(REPORT_DIR / "feature_importance_permutation.png", dpi=200)

print("Saved figures to:", REPORT_DIR.resolve())
print(" - parity_holdout.png")
print(" - residuals_hist.png")
print(" - residuals_vs_pred.png")
print(" - parity_cv.png")
print(" - feature_importance_permutation.png")
print(f"Holdout: R²={r2:.3f}, RMSE={rmse:.3f}, MAE={mae:.3f}")
print(f"   5-fold CV: R²={r2_cv:.3f}, RMSE={rmse_cv:.3f}, MAE={mae_cv:.3f}")
