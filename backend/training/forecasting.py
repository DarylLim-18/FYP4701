# forecast_future_years.py
# Hardcoded, final version (fixed & hardened)

import numpy as np
import pandas as pd
import joblib
from pathlib import Path

# =========================
# CONFIG (edit as needed)
# =========================
DIR = "backend/training/"
HIST_CSV   = f"{DIR}ml_dataset_smoking.csv"         # historical dataset (Year, State, features)
MODEL_PKL  = f"{DIR}models/best_ensemble.pkl"       # trained model bundle from tuning
#START_YEAR = 2025
#END_YEAR   = 2027

# =========================

def forecast_linear(years, values, future_years):
    """
    Simple, robust linear trend forecast with fallbacks:
      - >=2 points: linear fit
      - 1 point: carry forward
      - 0 points: NaN
    """
    years = np.asarray(pd.to_numeric(years, errors="coerce"), dtype=float)
    values = np.asarray(pd.to_numeric(values, errors="coerce"), dtype=float)
    mask = ~np.isnan(values)
    x = years[mask]
    y = values[mask]
    fy = np.asarray(future_years, dtype=float)

    if x.size >= 2:
        slope, intercept = np.polyfit(x, y, 1)
        return intercept + slope * fy
    elif x.size == 1:
        return np.full_like(fy, y[0], dtype=float)
    else:
        return np.full_like(fy, np.nan, dtype=float)

def forecast_feature_per_state(hist_df, states, years_future, feature_name):
    """
    Forecast a single numeric feature per state across future years using forecast_linear.
    Returns a Series aligned to (states x years_future) row order.
    """
    preds_all = []
    for s in states:
        sub = hist_df.loc[hist_df["State"] == s, ["Year"]].copy()
        if feature_name in hist_df.columns:
            sub[feature_name] = hist_df.loc[hist_df["State"] == s, feature_name].values
        # arrays
        yrs  = sub["Year"].to_numpy()
        vals = sub[feature_name].to_numpy(dtype=float) if feature_name in sub.columns else np.array([])
        preds = forecast_linear(yrs, vals, np.array(years_future, dtype=float))
        preds_all.append(preds)
    return pd.Series(np.vstack(preds_all).ravel()) if preds_all else pd.Series(dtype=float)

def build_future_grid(states, years_future):
    """Create a DataFrame with all State × Year combinations for target years."""
    rows = [{"Year": yf, "State": s} for s in states for yf in years_future]
    return pd.DataFrame(rows)

def main(START_YEAR: int, END_YEAR: int):
    # 1) Load historical data
    # OUT_CSV    = f"asthma_forecast_{START_YEAR}_{END_YEAR}.csv"
    hist = pd.read_csv(HIST_CSV)
    hist.columns = hist.columns.astype(str).str.strip()
    if not {"Year", "State"}.issubset(hist.columns):
        raise ValueError("Historical file must contain 'Year' and 'State' columns.")

    # Clean keys
    hist["Year"] = pd.to_numeric(hist["Year"], errors="coerce").astype("Int64")
    hist["State"] = hist["State"].astype(str).str.strip()

    # Feature discovery from history (pollutants)
    pollutant_cols = [c for c in hist.columns if c.startswith("Avg ")]
    if not pollutant_cols:
        raise ValueError("No pollutant feature columns found (expected columns starting with 'Avg ').")

    # 2) Load trained model bundle and discover exact features used
    bundle = joblib.load(MODEL_PKL)
    model = bundle["model"]
    feat = bundle.get("features", pollutant_cols)  # numeric features the model expects
    cat  = bundle.get("cat_cols", []) or []        # categorical features (e.g., State, Year)
    needed = list(feat) + list(cat)

    print("→ Model expects numeric features:", feat)
    print("→ Model categorical cols:", cat)

    # 3) Build future grid (state × future years)
    years_future = list(range(START_YEAR, END_YEAR + 1))
    states = sorted(hist["State"].dropna().unique().tolist())
    future = build_future_grid(states, years_future)

    # 4) Forecast every pollutant feature per state
    for col in pollutant_cols:
        future[col] = forecast_feature_per_state(hist, states, years_future, col).values

    # 5) Forecast any additional NON-Avg numeric features expected by the model
    #    (e.g., "Smoking Prevalence %"). If not in history, create as NaN so the model's imputer can handle it.
    extra_numeric_feats = [c for c in feat if (not c.startswith("Avg ")) and (c not in cat)]
    for col in extra_numeric_feats:
        if col in hist.columns:
            future[col] = forecast_feature_per_state(hist, states, years_future, col).values
        else:
            future[col] = np.nan  # numeric missing

    # 6) Ensure categorical columns required by the model exist (State/Year usually already present)
    for c in cat:
        if c not in future.columns:
            future[c] = future.get(c, pd.NA)

    # 7) Guarantee every required column exists; create NaN columns if still missing
    for c in needed:
        if c not in future.columns:
            # numeric features → np.nan, categorical → pd.NA
            future[c] = np.nan if c in feat else pd.NA

    # 8) Predict
    X_future = future[needed].copy()
    # Helpful debug if something is still off:
    missing_in_future = [c for c in needed if c not in X_future.columns]
    if missing_in_future:
        raise KeyError(f"Required columns missing in future design matrix: {missing_in_future}")

    preds = model.predict(X_future)
    future["Predicted Asthma Prevalence %"] = preds

    # 9) Save tidy output (combined file)
    key_cols = [c for c in ["Year", "State"] if c in future.columns]
    ordered = key_cols + ["Predicted Asthma Prevalence %"] + pollutant_cols + [
        c for c in extra_numeric_feats if c not in pollutant_cols
    ]
    # out_path = Path(OUT_CSV)
    # out_path.parent.mkdir(parents=True, exist_ok=True)
    # future[ordered].to_csv(out_path, index=False)
    # print(f"✅ Saved forecast → {out_path}")

    # Also save one CSV per year
    PER_YEAR_DIR = Path("forecasts_by_year")
    PER_YEAR_DIR.mkdir(parents=True, exist_ok=True)
    for year, df_y in future[ordered].groupby("Year"):
        out_y = PER_YEAR_DIR / f"asthma_forecast_{int(year)}.csv"
        df_y.to_csv(out_y, index=False)
    print(f"📁 Saved per-year files in → {PER_YEAR_DIR}")

    
    


    # print(f"✅ Saved forecast → {out_path}")
    print(future[ordered].head(10).to_string(index=False))


def run_forecast(
    start_year: int,
    end_year: int,
    hist_csv=HIST_CSV,
    model_pkl=MODEL_PKL,
    save_per_year=False,
    per_year_dir="forecasts_by_year"
):
    # ---- (same steps as your finalized script) ----
    hist = pd.read_csv(hist_csv)
    hist.columns = hist.columns.astype(str).str.strip()
    hist["Year"] = pd.to_numeric(hist["Year"], errors="coerce").astype("Int64")
    hist["State"] = hist["State"].astype(str).str.strip()

    pollutant_cols = [c for c in hist.columns if c.startswith("Avg ")]
    bundle = joblib.load(model_pkl)
    model = bundle["model"]
    feat = bundle.get("features", pollutant_cols)
    cat  = bundle.get("cat_cols", []) or []
    needed = list(feat) + list(cat)

    years_future = list(range(start_year, end_year + 1))
    states = sorted(hist["State"].dropna().unique().tolist())
    future = build_future_grid(states, years_future)

    # forecast pollutants
    for col in pollutant_cols:
        future[col] = forecast_feature_per_state(hist, states, years_future, col).values

    # forecast extra numeric features (e.g., Smoking Prevalence %) if model expects them
    extra_numeric_feats = [c for c in feat if (not c.startswith("Avg ")) and (c not in cat)]
    for col in extra_numeric_feats:
        if col in hist.columns:
            future[col] = forecast_feature_per_state(hist, states, years_future, col).values
        else:
            future[col] = np.nan

    # ensure categoricals and required columns exist
    for c in cat:
        if c not in future.columns:
            future[c] = pd.NA
    for c in needed:
        if c not in future.columns:
            future[c] = np.nan if c in feat else pd.NA

    # predict
    X_future = future[needed].copy()
    preds = model.predict(X_future)
    future["Predicted Asthma Prevalence %"] = preds
    
    # ---- add Country column and order columns ----
    future["Country"] = "United States of America"
    key_cols = ["Country", "Year", "State"]  # Country first
    # Ensure these keys exist in case of custom cat cols
    key_cols = [c for c in key_cols if c in future.columns]

    ordered = key_cols + ["Predicted Asthma Prevalence %"] + pollutant_cols + [
        c for c in extra_numeric_feats if c not in pollutant_cols
    ]

    # # save combined
    # Path(out_csv).parent.mkdir(parents=True, exist_ok=True)
    combined_df = future[ordered].copy()
    # combined_df.to_csv(out_csv, index=False)

    # build "array" of per-year outputs
    per_year_list = []            # list of DataFrames
    per_year_dict = {}            # dict[year] -> DataFrame
    per_year_csvs = {}            # dict[year] -> CSV string (in-memory)
    years = []

    for year, df_y in combined_df.groupby("Year"):
        df_y = df_y.reset_index(drop=True)
        per_year_list.append(df_y)
        per_year_dict[int(year)] = df_y
        per_year_csvs[int(year)] = df_y.to_csv(index=False)
        years.append(year)

    # optionally save each year to disk too
    if save_per_year:
        pdir = Path(per_year_dir)
        pdir.mkdir(parents=True, exist_ok=True)
        for y, df_y in per_year_dict.items():
            df_y.to_csv(pdir / f"asthma_forecast_{y}.csv", index=False)
    

    # return whatever you need to use programmatically
    return {
        "combined_df": combined_df,
        "per_year_frames": per_year_list,  # “array” of DataFrames
        "per_year_dict": per_year_dict,    # easy keyed access by year
        "per_year_csvs": per_year_csvs,    # CSV text blobs if you need to upload/send
        "years": years
    }
if __name__ == "__main__":
    run_forecast(2025, 2027)
    
