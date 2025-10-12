import numpy as np
import pandas as pd
import io
import base64
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
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

def run_naive_bayes(data, feature_cols, target_col='CURRENT PREVALENCE', bins=3):
    data = data.dropna(subset=feature_cols + [target_col]).copy()

    # Bin target into classes (quantile-based)
    class_labels = [f"Class_{i}" for i in range(bins)]
    data['Target_Class'] = pd.qcut(data[target_col], q=bins, labels=class_labels)

    X = data[feature_cols]
    y = data['Target_Class']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = GaussianNB()
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    acc = accuracy_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred).tolist()

    # Get classification report as a dict (for structured JSON)
    report_dict = classification_report(y_test, y_pred, output_dict=True)
    report_str = classification_report(y_test, y_pred)  # for readable version

    print("\n--- Naive Bayes Classification Results ---")
    print(f"Features Used: {feature_cols}")
    print(f"Accuracy: {acc:.2f}")
    print("\nConfusion Matrix:\n", cm)
    print("\nClassification Report:\n", report_str)

        # Plot predicted vs actual classes
# Map class labels to integer codes for plotting
    label_to_code = {label: i for i, label in enumerate(class_labels)}
    y_test_codes = pd.Series(y_test).map(label_to_code).reset_index(drop=True)
    y_pred_codes = pd.Series(y_pred).map(label_to_code).reset_index(drop=True)

    fig, ax = plt.subplots(figsize=(9, 5))
    ax.scatter(range(len(y_test_codes)), y_test_codes, alpha=0.6, label="Actual", marker='o')
    ax.scatter(range(len(y_pred_codes)), y_pred_codes, alpha=0.6, label="Predicted", marker='x')
    ax.set_xlabel("Test Sample Index")
    ax.set_ylabel("Class (numeric code)")
    ax.set_title("Naive Bayes: Actual vs Predicted Asthma Prevalence Classes")

    # Replace y-ticks with class labels
    ax.set_yticks(list(label_to_code.values()))
    ax.set_yticklabels(list(label_to_code.keys()))
    ax.legend()
    ax.grid(True)
    fig.tight_layout()

    # Export figure to base64 PNG
    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    image_base64 = base64.b64encode(buf.read()).decode("utf-8")

    # ---- Return full payload (JSON-serializable) ----
    return {
        "Model": "Naive Bayes",
        "Features Used": feature_cols,
        "Accuracy": float(acc),
        "Confusion Matrix": cm,
        "Classification Report": report_str,
        "Classification Report (Dict)": report_dict,
        "Class Labels": class_labels,
        "PlotImage": image_base64
    }
    
def main():
    # Load and preprocess data
    asthma, gas, ozone = load_data()
    asthma_clean = preprocess_asthma(asthma)
    gas_agg, gas_vars = preprocess_gas(gas)
    ozone_agg = preprocess_ozone(ozone)
    merged = merge_data(asthma_clean, gas_agg, ozone_agg)

    # Add 'Ozone' to feature columns
    gas_vars.append('Ozone')

    # Drop unnecessary columns if they exist
    for col in ['COMMENT', 'COUNTIES GROUPED']:
        if col in merged.columns:
            merged = merged.drop(columns=[col])

    # --- User-defined feature subset for training --- (Can add additional features if required)
    selected_features = ['SO2', 'Ozone', 'NO3', 'SO4']  

    # Run Naive Bayes classification
    run_naive_bayes(merged, selected_features)


if __name__ == "__main__":
    main()
