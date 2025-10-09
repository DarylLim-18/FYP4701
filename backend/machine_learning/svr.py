import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split, KFold, RandomizedSearchCV
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVR
from sklearn.metrics import mean_squared_error, r2_score
from scipy.stats import loguniform


def run_svr_model(data: pd.DataFrame, feature_cols: list, target_col: str):
    df = data.dropna(subset=feature_cols + [target_col]).copy()
    X = df[feature_cols]
    y = df[target_col]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, shuffle=True
    )

    pipe = make_pipeline(StandardScaler(), SVR(kernel="rbf"))

    # C, gamma, epsilon on log scales are key for SVR
    param_dist = {
        "svr__C": loguniform(1e-1, 1e3),
        "svr__gamma": loguniform(1e-4, 1e0),
        "svr__epsilon": loguniform(1e-3, 1e-1),
    }

    cv = KFold(n_splits=5, shuffle=True, random_state=42)
    search = RandomizedSearchCV(
        estimator=pipe,
        param_distributions=param_dist,
        n_iter=50,
        scoring="neg_root_mean_squared_error",
        cv=cv,
        random_state=42,
        n_jobs=-1,
        verbose=0,
        refit=True,
    )
    search.fit(X_train, y_train)
    model = search.best_estimator_

    # Hold-out
    y_pred = model.predict(X_test)
    mse = float(mean_squared_error(y_test, y_pred))
    r2 = float(r2_score(y_test, y_pred))

    print("\n--- SVR ---")
    print("Best params:", search.best_params_)
    print(f"CV best RMSE: {-search.best_score_:.4f}")
    print(f"Hold-out MSE: {mse:.4f} | R^2: {r2:.4f}")

    # Plots (same 2x2 layout)
    fig, axs = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle("SVR Regression", fontsize=16)

    # Actual vs Predicted
    axs[0, 0].scatter(y_test, y_pred, alpha=0.6, label="Predictions")
    y_min = min(y_test.min(), y_pred.min())
    y_max = max(y_test.max(), y_pred.max())
    axs[0, 0].plot([y_min, y_max], [y_min, y_max], 'r--', label="Ideal Fit")
    axs[0, 0].set_xlabel("Actual Prevalence")
    axs[0, 0].set_ylabel("Predicted Prevalence")
    axs[0, 0].set_title("Actual vs Predicted")
    axs[0, 0].legend(); axs[0, 0].grid(True)

    # Residuals
    residuals = y_test - y_pred
    axs[0, 1].scatter(y_pred, residuals, alpha=0.6)
    axs[0, 1].axhline(0, color='red', linestyle='--')
    axs[0, 1].set_xlabel("Predicted Prevalence")
    axs[0, 1].set_ylabel("Residuals")
    axs[0, 1].set_title("Residual Plot")
    axs[0, 1].grid(True)

    # No native feature importances for SVR
    axs[1, 0].axis('off'); axs[1, 1].axis('off')

    plt.tight_layout(rect=[0, 0.03, 1, 0.95])

    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    image_base64 = base64.b64encode(buf.read()).decode("utf-8")

    return {
        "Model": "Support Vector Regression",
        "Features Used": feature_cols,
        "Mean Squared Error": mse,
        "R² score": r2,
        "CV_best_params": search.best_params_,
        "CV_best_RMSE": -float(search.best_score_),
        "PlotImage": image_base64,
    }
