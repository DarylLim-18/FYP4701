import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import matplotlib.pyplot as plt



def load_data():
    asthma = pd.read_csv("data/current-asthma-prevalence-by-county-2015_2022.csv", encoding='latin1')
    gas = pd.read_csv("data/castnet-CA-gasdata-2015-2022.csv", encoding='latin1')
    ozone = pd.read_csv("data/castnet-CA-ozone-2015-2022.csv", encoding='latin1')
    return asthma, gas, ozone


def preprocess_asthma(asthma_df):
    asthma_df = asthma_df.copy()
    asthma_df.loc[:, 'COUNTY'] = asthma_df['COUNTY'].str.strip().str.title()
    asthma_df.loc[:, 'YEARS'] = asthma_df['YEARS'].str.replace('\x96', '-', regex=False)

    # Expand year ranges
    expanded = pd.concat(
        [pd.DataFrame([dict(row, YEAR=year)]) for _, row in asthma_df.iterrows()
         for year in range(int(row['YEARS'].split('-')[0]), int(row['YEARS'].split('-')[1]) + 1)],
        ignore_index=True
    )
    expanded['YEAR'] = expanded['YEAR'].astype(int)
    expanded['CURRENT PREVALENCE'] = pd.to_numeric(expanded['CURRENT PREVALENCE'], errors='coerce')
    expanded = expanded.dropna(subset=['CURRENT PREVALENCE'])
    return expanded


def preprocess_gas(gas_df):
    gas_df = gas_df.copy()

    gas_df['COUNTY'] = gas_df['COUNTY'].str.strip().str.title()
    gas_df['Year'] = pd.to_numeric(gas_df['Year'], errors='coerce')

    # List of variables to include
    gas_vars = ['Ca', 'Cl', 'HNO3', 'HNO3 PPB', 'K', 'Mg', 'Na', 'NH4',
                'NO3', 'SO2', 'SO2 PPB', 'SO4', 'TNO3']

    # Convert all variables to numeric
    for var in gas_vars:
        gas_df[var] = pd.to_numeric(gas_df[var], errors='coerce')

    # Drop rows missing all values or COUNTY/YEAR
    gas_df = gas_df.dropna(subset=['COUNTY', 'Year'] + gas_vars, how='any')

    # Aggregate (mean) by county and year
    gas_agg = gas_df.groupby(['COUNTY', 'Year'])[gas_vars].mean().reset_index()
    return gas_agg, gas_vars



def preprocess_ozone(ozone_df):
    ozone_df = ozone_df.copy()
    ozone_df['COUNTY'] = ozone_df['COUNTY'].str.strip().str.title()
    
    # Convert to datetime safely
    ozone_df['Selected Date_Time'] = pd.to_datetime(
        ozone_df['Selected Date_Time'],
        format='%m/%d/%Y %I:%M:%S %p',
        errors='coerce'
    )
    
    # Drop rows where datetime conversion failed
    ozone_df = ozone_df.dropna(subset=['Selected Date_Time'])

    # Only now extract year
    ozone_df['Year'] = ozone_df['Selected Date_Time'].dt.year.astype(int)

    # Convert ozone values to numeric and drop NaNs
    ozone_df['Ozone'] = pd.to_numeric(ozone_df['Ozone'], errors='coerce')
    ozone_df = ozone_df.dropna(subset=['Ozone'])

    # Group and return
    return ozone_df.groupby(['COUNTY', 'Year'])[['Ozone']].mean().reset_index()



def merge_data(asthma_df, gas_agg, ozone_agg):
    merged = asthma_df.merge(gas_agg, left_on=['COUNTY', 'YEAR'], right_on=['COUNTY', 'Year'], how='inner')
    merged = merged.merge(ozone_agg, left_on=['COUNTY', 'YEAR'], right_on=['COUNTY', 'Year'], how='inner')
    return merged.drop(columns=['Year_x', 'Year_y'])


def run_linear_regression(data, feature_cols, target_col='CURRENT PREVALENCE'):
    data = data.dropna(subset=feature_cols + [target_col])
    X = data[feature_cols]
    y = data[target_col]

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)
    model = LinearRegression()
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    mse = mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    print("\n--- Linear Regression Results ---")
    print(f"Features Used: {feature_cols}")
    print(f"Mean Squared Error: {mse}") # Averaged squared difference between predicted and actual values (Lower is better)
    print(f"R² score: {r2}") # Proportion of variance explained by the model (1 is perfect fit)
    print("Coefficients:", model.coef_) # Represents the expected change in the target for one unit increase of the feature
    print("Intercept:", model.intercept_) # Predicted value of asthma prevalence when all features are 0
    print("\nSample of merged data:\n", data.head())
    
    plt.figure(figsize=(8, 6), num='Linear Regression')
    plt.scatter(y_test, y_pred, alpha=0.6, label="Predictions")
    plt.plot([y.min(), y.max()], [y.min(), y.max()], 'r--', label="Ideal Fit")
    plt.xlabel("Actual Prevalence")
    plt.ylabel("Predicted Prevalence")
    plt.title("Actual vs Predicted Asthma Prevalence")
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.show()
    

def main():
    # Load and preprocess
    asthma, gas, ozone = load_data()
    asthma_clean = preprocess_asthma(asthma)
    gas_agg, gas_vars = preprocess_gas(gas)
    ozone_agg = preprocess_ozone(ozone)
    merged = merge_data(asthma_clean, gas_agg, ozone_agg)
    gas_vars.append('Ozone')  # Add Ozone to gas_vars for user selection
    merged = merged.drop(columns=['COMMENT', 'COUNTIES GROUPED'])
    
    # --- User defines features here ---
    user_features = ['SO2', 'Ozone', 'NO3', 'SO4']  # Default features
    
    run_linear_regression(merged, gas_vars)
    


if __name__ == "__main__":
    main()
