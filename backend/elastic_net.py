# elastic_net_regression.py
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.linear_model import ElasticNet
import matplotlib.pyplot as plt


def run_elastic_net_regression(data, feature_cols, target_col, alpha=1.0, l1_ratio=0.5):
    data = data.dropna(subset=feature_cols + [target_col]).copy()
    X = data[feature_cols]
    y = data[target_col]

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42
    )

    model = ElasticNet(alpha=alpha, l1_ratio=l1_ratio, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

    mse = mean_squared_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)

    print("\n--- Elastic Net Regression Results ---")
    print(f"Features Used: {feature_cols}")
    print(f"Alpha: {alpha}, L1 Ratio: {l1_ratio}")
    print(f"Mean Squared Error: {mse:.4f}")
    print(f"R² Score: {r2:.4f}")
    print("Coefficients:", model.coef_)
    print("Intercept:", model.intercept_)

    # Plot Actual vs Predicted
    plt.figure(figsize=(8, 6), num="Elastic Net Regression")
    plt.scatter(y_test, y_pred, alpha=0.6, label="Predictions")
    plt.plot([y.min(), y.max()], [y.min(), y.max()], "r--", label="Ideal Fit")
    plt.xlabel("Actual Prevalence")
    plt.ylabel("Predicted Prevalence")
    plt.title("Elastic Net: Actual vs Predicted Asthma Prevalence")
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.show()

    return {
        "Features Used": feature_cols,
        "Alpha": alpha,
        "L1 Ratio": l1_ratio,
        "Mean Squared Error": mse,
        "R² score": r2,
        "Coefficients": model.coef_.tolist(),
        "Intercept": model.intercept_,
    }