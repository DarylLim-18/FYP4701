# tune_ensembles.py
import warnings, numpy as np, pandas as pd
from pathlib import Path
from typing import List, Dict, Any
warnings.filterwarnings("ignore")

from sklearn.model_selection import GridSearchCV, cross_val_score, train_test_split
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from sklearn.ensemble import ExtraTreesRegressor, RandomForestRegressor
import joblib

# -----------------------
# CONFIG
# -----------------------
DATA_CSV = "ml_dataset_smoking.csv"   # change if needed
TARGET_COL = "Asthma Prevalence%"
TEST_SIZE = 0.2
RANDOM_STATE = 42
CV_FOLDS = 5
N_JOBS = -1

# Try models with and without fixed effects (State and Year one-hot)
INCLUDE_FIXED_EFFECTS = True

# -----------------------
# LOAD DATA
# -----------------------
df = pd.read_csv(DATA_CSV)
# Keep columns
# feature_cols = [c for c in df.columns if c.startswith("Avg ")]
feature_cols = ["Avg CO2","Avg NO2","Avg Ozone","Avg PM10","Avg PM2.5","Avg SO2", "Smoking Prevalence %"]
if not feature_cols:
    raise ValueError("No 'Avg ...' feature columns found.")

# Basic target cleaning
df = df.dropna(subset=[TARGET_COL])
y = df[TARGET_COL].astype(float).values

# Optional fixed effects
cat_cols: List[str] = []
if INCLUDE_FIXED_EFFECTS:
    # Expect these columns to exist in your aggregated dataset
    if "State" in df.columns:
        cat_cols.append("State")
    if "Year" in df.columns:
        cat_cols.append("Year")

# Build X dataframe for preprocessing
X = df[feature_cols + cat_cols].copy()

# -----------------------
# PREPROCESSORS
# -----------------------
# Numeric features: impute median (tree ensembles don't need scaling)
num_transformer = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="median")),
])

# Categorical features (optional): one-hot + handle unknowns
if cat_cols:
    cat_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("ohe", OneHotEncoder(handle_unknown="ignore")),
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", num_transformer, feature_cols),
            ("cat", cat_transformer, cat_cols),
        ],
        remainder="drop",
    )
else:
    preprocessor = ColumnTransformer(
        transformers=[("num", num_transformer, feature_cols)],
        remainder="drop",
    )

# -----------------------
# MODELS + GRIDS
# -----------------------
rf = RandomForestRegressor(random_state=RANDOM_STATE, n_jobs=N_JOBS)
et = ExtraTreesRegressor(random_state=RANDOM_STATE, n_jobs=N_JOBS)

rf_grid: Dict[str, List[Any]] = {
    "model__n_estimators": [400, 800, 1200],
    "model__max_depth": [None, 12, 20],
    "model__min_samples_split": [2, 5, 10],
    "model__min_samples_leaf": [1, 2, 4],
    "model__max_features": ["sqrt", None],  # sqrt ~ good default
}

et_grid: Dict[str, List[Any]] = {
    "model__n_estimators": [500, 1000, 1500],
    "model__max_depth": [None, 12, 20],
    "model__min_samples_leaf": [1, 2, 4],
    "model__max_features": ["sqrt", None],
    "model__bootstrap": [False],  # ET typically without bootstrap
}

candidates = {
    "RandomForestRegressor": (rf, rf_grid),
    "ExtraTreesRegressor": (et, et_grid),
}

# -----------------------
# TRAIN/TEST SPLIT (for a final holdout score)
# -----------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE
)

# -----------------------
# SEARCH + EVALUATION
# -----------------------
results = []
best_model = None
best_name = None
best_cv = -np.inf

for name, (est, grid) in candidates.items():
    pipe = Pipeline(steps=[
        ("prep", preprocessor),
        ("model", est)
    ])

    search = GridSearchCV(
        estimator=pipe,
        param_grid=grid,
        scoring="r2",
        cv=CV_FOLDS,
        n_jobs=N_JOBS,
        verbose=1,
    )
    search.fit(X_train, y_train)

    # CV score from the best params
    cv_best = float(search.best_score_)
    # Holdout evaluation
    pred = search.best_estimator_.predict(X_test)
    r2 = r2_score(y_test, pred)
    # RMSE (handle sklearn versions without 'squared' arg)
    try:
        rmse = mean_squared_error(y_test, pred, squared=False)
    except TypeError:
        rmse = float(np.sqrt(mean_squared_error(y_test, pred)))
    mae = float(np.mean(np.abs(y_test - pred)))

    results.append({
        "model": name,
        "best_params": search.best_params_,
        "cv_r2": cv_best,
        "holdout_r2": float(r2),
        "holdout_rmse": float(rmse),
        "holdout_mae": float(mae),
    })

    if cv_best > best_cv:
        best_cv = cv_best
        best_model = search.best_estimator_
        best_name = name

# Save results table
out_dir = Path("models")
out_dir.mkdir(exist_ok=True)
pd.DataFrame(results).to_csv(out_dir / "tuning_results.csv", index=False)

# Save best model
joblib.dump(
    {
        "model": best_model,
        "features": feature_cols,
        "cat_cols": cat_cols,
        "with_fixed_effects": INCLUDE_FIXED_EFFECTS,
        "target": TARGET_COL,
    },
    out_dir / "best_ensemble.pkl"
)

print("\n=== TUNING SUMMARY ===")
for row in results:
    print(
        f"{row['model']}: CV R²={row['cv_r2']:.3f} | "
        f"Holdout R²={row['holdout_r2']:.3f} | "
        f"RMSE={row['holdout_rmse']:.3f} | MAE={row['holdout_mae']:.3f}"
    )
print(f"\nBest by CV: {best_name} (CV R²={best_cv:.3f})")
print(f"Saved best model → {out_dir / 'best_ensemble.pkl'}")
print(f"Saved full tuning table → {out_dir / 'tuning_results.csv'}")
