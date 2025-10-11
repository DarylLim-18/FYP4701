import pandas as pd
import numpy as np
import io
import base64
import matplotlib.pyplot as plt
from sklearn.ensemble import ExtraTreesRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

def load_data():
    asthma = pd.read_csv("data/current-asthma-prevalence-by-county-2015_2022.csv", encoding='latin1')
    gas = pd.read_csv("data/castnet-CA-gasdata-2015-2022.csv", encoding='latin1')
    ozone = pd.read_csv("data/castnet-CA-ozone-2015-2022.csv", encoding='latin1')
    return asthma, gas, ozone

def preprocess_asthma(asthma_df):
    asthma_df = asthma_df.copy()
    asthma_df.loc[:, 'COUNTY'] = asthma_df['COUNTY'].str.strip().str.title()
    asthma_df.loc[:, 'YEARS'] = asthma_df['YEARS'].str.replace('\x96', '-', regex=False)
    expanded = pd.concat([
        pd.DataFrame([dict(row, YEAR=year)]) for _, row in asthma_df.iterrows()
        for year in range(int(row['YEARS'].split('-')[0]), int(row['YEARS'].split('-')[1]) + 1)
    ], ignore_index=True)
    expanded['YEAR'] = expanded['YEAR'].astype(int)
    expanded['CURRENT PREVALENCE'] = pd.to_numeric(expanded['CURRENT PREVALENCE'], errors='coerce')
    expanded['log_PREVALENCE'] = np.log1p(expanded['CURRENT PREVALENCE'])
    return expanded.dropna(subset=['CURRENT PREVALENCE'])

def preprocess_gas(gas_df):
    gas_df = gas_df.copy()
    gas_df['COUNTY'] = gas_df['COUNTY'].str.strip().str.title()
    gas_df['Year'] = pd.to_numeric(gas_df['Year'], errors='coerce')
    gas_vars = ['Ca', 'Cl', 'HNO3', 'HNO3 PPB', 'K', 'Mg', 'Na', 'NH4',
                'NO3', 'SO2', 'SO2 PPB', 'SO4', 'TNO3']
    for var in gas_vars:
        gas_df[var] = pd.to_numeric(gas_df[var], errors='coerce')
    gas_df = gas_df.dropna(subset=['COUNTY', 'Year'] + gas_vars, how='any')
    gas_agg = gas_df.groupby(['COUNTY', 'Year'])[gas_vars].mean().reset_index()
    return gas_agg, gas_vars

def preprocess_ozone(ozone_df):
    ozone_df = ozone_df.copy()
    ozone_df['COUNTY'] = ozone_df['COUNTY'].str.strip().str.title()
    ozone_df['Selected Date_Time'] = pd.to_datetime(
        ozone_df['Selected Date_Time'],
        format='%m/%d/%Y %I:%M:%S %p',
        errors='coerce'
    )
    ozone_df = ozone_df.dropna(subset=['Selected Date_Time'])
    ozone_df['Year'] = ozone_df['Selected Date_Time'].dt.year.astype(int)
    ozone_df['Ozone'] = pd.to_numeric(ozone_df['Ozone'], errors='coerce')
    ozone_df = ozone_df.dropna(subset=['Ozone'])
    return ozone_df.groupby(['COUNTY', 'Year'])[['Ozone']].mean().reset_index()

def merge_data(asthma_df, gas_agg, ozone_agg):
    merged = asthma_df.merge(gas_agg, left_on=['COUNTY', 'YEAR'], right_on=['COUNTY', 'Year'], how='inner')
    merged = merged.merge(ozone_agg, left_on=['COUNTY', 'YEAR'], right_on=['COUNTY', 'Year'], how='inner')
    return merged.drop(columns=['Year_x', 'Year_y'])

def run_extra_trees_regressor(data, feature_cols, target_col='CURRENT PREVALENCE', n_estimators=200):
    data = data.dropna(subset=feature_cols + [target_col]).copy()

    X = data[feature_cols]
    y = data[target_col]

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42
    )

    model = ExtraTreesRegressor(n_estimators=n_estimators, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

    # Metrics
    mse = mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    print("\n--- Extra Trees Regression Results ---")
    print(f"Features Used: {feature_cols}")
    print(f"Mean Squared Error: {mse:.2f}")
    print(f"R² Score: {r2:.2f}")

    fig, axs = plt.subplots(1, 2, figsize=(14, 6))
    fig.suptitle("Extra Trees Regression Analysis", fontsize=16)

    # --- 1. Actual vs Predicted ---
    axs[0].scatter(y_test, y_pred, alpha=0.6, label="Predictions")
    y_min, y_max = min(y_test.min(), y_pred.min()), max(y_test.max(), y_pred.max())
    axs[0].plot([y_min, y_max], [y_min, y_max], 'r--', label="Ideal Fit")
    axs[0].set_xlabel("Actual Prevalence")
    axs[0].set_ylabel("Predicted Prevalence")
    axs[0].set_title("Actual vs Predicted")
    axs[0].legend()
    axs[0].grid(True)

    # --- 2. Feature Importances ---
    importances = model.feature_importances_
    axs[1].barh(feature_cols, importances)
    axs[1].set_xlabel("Feature Importance")
    axs[1].set_title("Feature Importance")

    plt.tight_layout(rect=[0, 0.03, 1, 0.95])


    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    image_base64 = base64.b64encode(buf.read()).decode("utf-8")

    # Return results
    res = {
        "Model": "Extra Trees Regressor",
        "Features Used": feature_cols,
        "Mean Squared Error": mse,
        "R² score": r2,
        "PlotImage": image_base64,
    }

    return res

def main():
    asthma, gas, ozone = load_data()
    asthma_clean = preprocess_asthma(asthma)
    gas_agg, gas_vars = preprocess_gas(gas)
    ozone_agg = preprocess_ozone(ozone)
    merged = merge_data(asthma_clean, gas_agg, ozone_agg)
    gas_vars.append('Ozone')
    merged = merged.drop(columns=['COMMENT', 'COUNTIES GROUPED'])
    feature_cols = ['SO2', 'Ozone', 'SO2 PPB', 'Cl']
    run_extra_trees_regressor(merged, feature_cols, target_col='CURRENT PREVALENCE')

if __name__ == "__main__":
    main()

