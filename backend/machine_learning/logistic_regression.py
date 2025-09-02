import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
import matplotlib.pyplot as plt
from sklearn.linear_model import LogisticRegression


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


def run_logistic_regression(data, feature_cols, target_col='CURRENT PREVALENCE', threshold=None):
    data = data.dropna(subset=feature_cols + [target_col]).copy()

    if threshold is None:
        threshold = data[target_col].median()

    data['PREVALENCE_CLASS'] = (data[target_col] > threshold).astype(int)
    
    X = data[feature_cols]
    y = data['PREVALENCE_CLASS']

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    from sklearn.model_selection import train_test_split
    X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)

    model = LogisticRegression()
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

    acc = accuracy_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred)
    report = classification_report(y_test, y_pred)

    print("\n--- Logistic Regression Classification Results ---")
    print(f"Features Used: {feature_cols}")
    print(f"Threshold for classification: {threshold:.2f}")
    print(f"Accuracy: {acc:.2f}")
    print("\nConfusion Matrix:\n", cm)
    print("\nClassification Report:\n", report)

    # Set up 2x2 grid for logistic regression visualization
    fig, axs = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle("Logistic Regression Analysis", fontsize=16)

    # --- Confusion Matrix ---
    axs[0, 0].imshow(cm, cmap="Blues")
    axs[0, 0].set_title("Confusion Matrix")
    axs[0, 0].set_xticks([0, 1])
    axs[0, 0].set_yticks([0, 1])
    axs[0, 0].set_xticklabels(['Low', 'High'])
    axs[0, 0].set_yticklabels(['Low', 'High'])
    axs[0, 0].set_xlabel("Predicted")
    axs[0, 0].set_ylabel("Actual")
    for i in range(2):
        for j in range(2):
            axs[0, 0].text(j, i, cm[i, j], ha='center', va='center', color='black')

    # --- Actual vs Predicted Classes Line Plot ---
    axs[0, 1].plot(list(range(len(y_test))), y_test.values, label='Actual', marker='o')
    axs[0, 1].plot(list(range(len(y_pred))), y_pred, label='Predicted', marker='x')
    axs[0, 1].set_title("Actual vs Predicted Classes")
    axs[0, 1].set_xlabel("Sample Index")
    axs[0, 1].set_ylabel("Class (0 = Low, 1 = High)")
    axs[0, 1].legend()
    axs[0, 1].grid(True)

    # --- Predicted Probabilities Line Plot ---
    y_proba = model.predict_proba(X_test)[:, 1]
    axs[1, 0].plot(list(range(len(y_proba))), y_proba, label='Predicted Probability', marker='.')
    axs[1, 0].axhline(0.5, color='red', linestyle='--', label='Threshold = 0.5')
    axs[1, 0].set_title("Predicted Probability of High Prevalence")
    axs[1, 0].set_xlabel("Sample Index")
    axs[1, 0].set_ylabel("Probability (Class 1)")
    axs[1, 0].legend()
    axs[1, 0].grid(True)

    # --- Leave last subplot blank (or use for notes/legend) ---
    axs[1, 1].axis('off')

    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    plt.show()


    return {
        "Features Used": feature_cols,
        "Threshold": threshold,
        "Accuracy": acc,
        "Classification Report": report,
        "Coefficients": model.coef_.tolist(),
        "Intercept": model.intercept_.tolist(),
    }

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
    
    run_logistic_regression(merged, user_features, target_col='CURRENT PREVALENCE')    


if __name__ == "__main__":
    main()
