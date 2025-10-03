# train_model_zoo.py
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Tuple, List

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (
    r2_score, root_mean_squared_error, mean_absolute_error,
    accuracy_score, f1_score, roc_auc_score
)
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler

# Regressors
from sklearn.linear_model import LinearRegression, RidgeCV, LassoCV, ElasticNetCV
from sklearn.neighbors import KNeighborsRegressor
from sklearn.svm import SVR
from sklearn.ensemble import (
    RandomForestRegressor, ExtraTreesRegressor, GradientBoostingRegressor, HistGradientBoostingRegressor
)

# Classifiers (optional)
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, HistGradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier

import joblib

# -----------------------------
# CONFIG
# -----------------------------
INPUT_CSV = "ml_dataset_smoking.csv"   # cleaned merged file
TARGET_COL = "Asthma Prevalence%"         # continuous target for regression
TEST_SIZE = 0.2
RANDOM_STATE = 42
N_JOBS = -1

# Toggle classification view (e.g., if you like how Logistic Regression performs)
ENABLE_CLASSIFICATION = False      # set True to also run the classification block
CLASSIFICATION_SCHEME = "median"   # "median", "mean", or a numeric cutoff (e.g., 12.0)

# How many top models to persist
TOP_K_TO_SAVE = 3

# -----------------------------
# LOAD & PREP
# -----------------------------
df = pd.read_csv(INPUT_CSV)

# Drop helper duplicates if present
df = df.drop(columns=["year_key", "state_key", "year", "state"], errors="ignore")

# Feature columns = all Avg ...
# feature_cols = [c for c in df.columns if c.startswith("Avg ")]
feature_cols = ["Avg CO2","Avg NO2","Avg Ozone","Avg PM10","Avg PM2.5","Avg SO2", "Smoking Prevalence %"]
if not feature_cols:
    raise ValueError("No feature columns found (expected columns starting with 'Avg ').")


# Drop rows with missing TARGET (for regression)
df = df.dropna(subset=[TARGET_COL])

X = df[feature_cols].copy()
y = df[TARGET_COL].astype(float).copy()

# Split once to compare consistently
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE
)

# Identify columns that may need scaling (most do); we’ll scale all numeric features for certain models
numeric_features = feature_cols

# Base preprocessors
imputer_only = ColumnTransformer(
    transformers=[("num", SimpleImputer(strategy="median"), numeric_features)],
    remainder="drop"
)

imputer_scaler = ColumnTransformer(
    transformers=[
        ("num", Pipeline(steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler(with_mean=True, with_std=True))
        ]), numeric_features)
    ],
    remainder="drop"
)

# -----------------------------
# MODEL ZOO (Regression)
# -----------------------------
reg_models: Dict[str, Pipeline] = {
    # Linear family (with scaling recommended)
    "LinearRegression": Pipeline([
        ("prep", imputer_scaler),
        ("model", LinearRegression(n_jobs=None))  # linear regression has no n_jobs
    ]),
    "RidgeCV": Pipeline([
        ("prep", imputer_scaler),
        ("model", RidgeCV(alphas=np.logspace(-3, 3, 13)))
    ]),
    "LassoCV": Pipeline([
        ("prep", imputer_scaler),
        ("model", LassoCV(alphas=None, cv=5, random_state=RANDOM_STATE, max_iter=5000))
    ]),
    "ElasticNetCV": Pipeline([
        ("prep", imputer_scaler),
        ("model", ElasticNetCV(l1_ratio=[.1,.3,.5,.7,.9,.95,.99,1], cv=5, random_state=RANDOM_STATE, max_iter=5000))
    ]),

    # Distance/kernel models (scale helps)
    "KNNRegressor": Pipeline([
        ("prep", imputer_scaler),
        ("model", KNeighborsRegressor(n_neighbors=7))
    ]),
    "SVR": Pipeline([
        ("prep", imputer_scaler),
        ("model", SVR(C=2.0, epsilon=0.1, kernel="rbf"))
    ]),

    # Tree/ensemble (scale not needed, impute only)
    "RandomForestRegressor": Pipeline([
        ("prep", imputer_only),
        ("model", RandomForestRegressor(
            n_estimators=400, max_depth=None, random_state=RANDOM_STATE, n_jobs=N_JOBS))
    ]),
    "ExtraTreesRegressor": Pipeline([
        ("prep", imputer_only),
        ("model", ExtraTreesRegressor(
            n_estimators=500, max_depth=None, random_state=RANDOM_STATE, n_jobs=N_JOBS))
    ]),
    "GradientBoostingRegressor": Pipeline([
        ("prep", imputer_only),
        ("model", GradientBoostingRegressor(random_state=RANDOM_STATE))
    ]),
    # Handles NaNs natively in X, so we can skip imputation if desired; we still impute target-only
    "HistGradientBoostingRegressor": Pipeline([
        ("prep", ColumnTransformer([("pass", "passthrough", numeric_features)], remainder="drop")),
        ("model", HistGradientBoostingRegressor(random_state=RANDOM_STATE))
    ]),
}

def eval_regression(pipe: Pipeline, Xtr, Xte, ytr, yte) -> Tuple[float, float, float, float]:
    pipe.fit(Xtr, ytr)
    pred = pipe.predict(Xte)
    r2 = r2_score(yte, pred)
    rmse = root_mean_squared_error(yte, pred)
    mae = mean_absolute_error(yte, pred)
    # CV on full X,y for stability
    cv_scores = cross_val_score(pipe, X, y, cv=5, scoring="r2")
    cv_mean = float(np.mean(cv_scores))
    return r2, rmse, mae, cv_mean

print("\n=== REGRESSION RESULTS ===")
reg_results = []
for name, pipe in reg_models.items():
    r2, rmse, mae, cvm = eval_regression(pipe, X_train, X_test, y_train, y_test)
    reg_results.append((name, r2, rmse, mae, cvm))
    print(f"{name:30s} R2={r2: .3f} | RMSE={rmse: .3f} | MAE={mae: .3f} | CV R2={cvm: .3f}")

# Rank by holdout R2
reg_results_sorted = sorted(reg_results, key=lambda t: t[1], reverse=True)

# Save top-K models
out_dir = Path("models")
out_dir.mkdir(exist_ok=True)
for rank, (name, r2, rmse, mae, cvm) in enumerate(reg_results_sorted[:TOP_K_TO_SAVE], 1):
    fname = out_dir / f"reg_{rank}_{name}.pkl"
    joblib.dump({"model": reg_models[name], "features": feature_cols}, fname)
    print(f"Saved model #{rank}: {name} → {fname} (R2={r2:.3f})")

# -----------------------------
# OPTIONAL: CLASSIFICATION VIEW
# -----------------------------
if ENABLE_CLASSIFICATION:
    # Build labels from continuous prevalence
    if CLASSIFICATION_SCHEME == "median":
        cutoff = y.median()
    elif CLASSIFICATION_SCHEME == "mean":
        cutoff = y.mean()
    else:
        # numeric cutoff
        cutoff = float(CLASSIFICATION_SCHEME)
    y_cls = (y >= cutoff).astype(int)

    Xc_train, Xc_test, yc_train, yc_test = train_test_split(
        X, y_cls, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y_cls
    )

    clf_models: Dict[str, Pipeline] = {
        "LogisticRegression": Pipeline([
            ("prep", imputer_scaler),
            ("clf", LogisticRegression(max_iter=600, class_weight="balanced", solver="lbfgs"))
        ]),
        "RandomForestClassifier": Pipeline([
            ("prep", imputer_only),
            ("clf", RandomForestClassifier(
                n_estimators=300, random_state=RANDOM_STATE, n_jobs=N_JOBS, class_weight="balanced"))
        ]),
        "GradientBoostingClassifier": Pipeline([
            ("prep", imputer_only),
            ("clf", GradientBoostingClassifier(random_state=RANDOM_STATE))
        ]),
        "HistGradientBoostingClassifier": Pipeline([
            ("prep", ColumnTransformer([("pass", "passthrough", numeric_features)], remainder="drop")),
            ("clf", HistGradientBoostingClassifier(random_state=RANDOM_STATE))
        ]),
        "SVC": Pipeline([
            ("prep", imputer_scaler),
            ("clf", SVC(kernel="rbf", C=2.0, probability=True, class_weight="balanced"))
        ]),
        "KNNClassifier": Pipeline([
            ("prep", imputer_scaler),
            ("clf", KNeighborsClassifier(n_neighbors=9))
        ]),
    }

    def eval_classification(pipe: Pipeline, Xtr, Xte, ytr, yte) -> Tuple[float, float, float]:
        pipe.fit(Xtr, ytr)
        pred = pipe.predict(Xte)
        proba = None
        try:
            proba = pipe.predict_proba(Xte)[:, 1]
        except Exception:
            pass
        acc = accuracy_score(yte, pred)
        f1 = f1_score(yte, pred, average="binary")
        auc = roc_auc_score(yte, proba) if proba is not None else np.nan
        return acc, f1, auc

    print("\n=== CLASSIFICATION RESULTS (binary High/Low) ===")
    cls_results = []
    for name, pipe in clf_models.items():
        acc, f1, auc = eval_classification(pipe, Xc_train, Xc_test, yc_train, yc_test)
        # CV (ROC-AUC) for stability where possible
        try:
            cv_auc = cross_val_score(pipe, X, y_cls, cv=5, scoring="roc_auc")
            cv_auc_mean = float(np.mean(cv_auc))
        except Exception:
            cv_auc_mean = np.nan
        cls_results.append((name, acc, f1, auc, cv_auc_mean))
        print(f"{name:28s} Acc={acc: .3f} | F1={f1: .3f} | AUC={auc: .3f} | CV AUC={cv_auc_mean: .3f}")

    cls_sorted = sorted(cls_results, key=lambda t: (np.nan_to_num(t[2]), np.nan_to_num(t[1])), reverse=True)
    for rank, (name, acc, f1, auc, cv_auc_mean) in enumerate(cls_sorted[:TOP_K_TO_SAVE], 1):
        fname = out_dir / f"cls_{rank}_{name}.pkl"
        joblib.dump({"model": clf_models[name], "features": feature_cols, "cutoff": float(cutoff)}, fname)
        print(f"Saved classifier #{rank}: {name} → {fname} (Acc={acc:.3f}, F1={f1:.3f}, AUC={auc:.3f})")

print("\nDone.")
