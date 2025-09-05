import pandas as pd
import geopandas as gpd
import matplotlib.pyplot as plt
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import KFold, train_test_split, cross_val_score
from sklearn.metrics import mean_squared_error, r2_score

def load_data():
    asthma = pd.read_csv("data/current-asthma-prevalence-by-county-2015_2022.csv", encoding='latin1')
    gas = pd.read_csv("data/castnet-CA-gasdata-2015-2022.csv", encoding='latin1')
    ozone = pd.read_csv("data/castnet-CA-ozone-2015-2022.csv", encoding='latin1')
    return asthma, gas, ozone

def remove_cols(df, cols):
    return df.drop(columns=cols, errors='ignore')

def remove_na_rows(df, cols):
    return df.dropna(subset=cols, how='any')



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

def run_rf_model(data, feature_cols, target_col='CURRENT_PREVALENCE'):
    data.dropna(subset=feature_cols + [target_col])
    X = data[feature_cols]
    y = data[target_col]
    rf = RandomForestRegressor(random_state=42)
    cv = KFold(n_splits=5, shuffle=True, random_state=42)
    cv_scores = cross_val_score(rf, X, y, cv=cv, scoring="r2")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42) #play around with the test size
    model = RandomForestRegressor(random_state=42)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    mse = mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    print("\n--- Cross-Validation Results ---")
    print("CV R² scores:", cv_scores)
    print("Mean CV R²:", cv_scores.mean())
    print("Std Dev:", cv_scores.std())
    print("\n--- Model Evaluation ---")
    print(f"Mean Squared Error: {mse:.2f}")
    print(f"R^2 Score: {r2:.2f}")
    data['Predicted Prevalence'] = model.predict(X)

    # Create a 1x3 grid of subplots
    fig, axs = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle("Random Forest Regression Analysis", fontsize=16)

    # Actual vs Predicted plot
    axs[0, 0].scatter(y_test, y_pred, alpha=0.6, label="Predictions")
    axs[0, 0].plot([y.min(), y.max()], [y.min(), y.max()], 'r--', label="Ideal Fit")
    axs[0, 0].set_xlabel("Actual Prevalence")
    axs[0, 0].set_ylabel("Predicted Prevalence")
    axs[0, 0].set_title("Actual vs Predicted")
    axs[0, 0].legend()
    axs[0, 0].grid(True)

    # Residual plot
    residuals = y_test - y_pred
    axs[0, 1].scatter(y_pred, residuals, alpha=0.6)
    axs[0, 1].axhline(0, color='red', linestyle='--')
    axs[0, 1].set_xlabel("Predicted Prevalence")
    axs[0, 1].set_ylabel("Residuals")
    axs[0, 1].set_title("Residual Plot")
    axs[0, 1].grid(True)

    # Feature Importance plot
    importances = model.feature_importances_
    axs[1, 0].barh(feature_cols, importances)
    axs[1, 0].set_xlabel("Feature Importance")
    axs[1, 0].set_title("Feature Importance")

    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    axs[1, 1].axis('off')
    plt.show()

    # Show worst residuals
    residual_df = pd.DataFrame({
        'Actual': y_test,
        'Predicted': y_pred,
        'Residual': residuals
    })
    print("\n--- Worst Residuals (Top 5) ---")
    print(residual_df.reindex(residuals.abs().sort_values(ascending=False).index).head())
    
    res = {
        "Features Used": feature_cols,
        "Mean Squared Error": mse,
        "R² score": r2,
        "Worst Residuals": residual_df.reindex(residuals.abs().sort_values(ascending=False).index).head() 
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
    run_rf_model(merged, feature_cols, target_col='CURRENT PREVALENCE')

if __name__ == "__main__":
    main()



