import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split, KFold, RandomizedSearchCV
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_squared_error, r2_score
from scipy.stats import loguniform, randint


def run_gradient_boosting(data: pd.DataFrame, feature_cols: list, target_col: str):
    df = data.dropna(subset=feature_cols + [target_col]).copy()
    X = df[feature_cols]
    y = df[target_col]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    base = GradientBoostingRegressor(random_state=42)

    # Reasonable search space (fast + effective)
    param_dist = {
        "n_estimators": randint(100, 800),
        "learning_rate": loguniform(1e-3, 3e-1),
        "max_depth": randint(2, 6),
        "subsample": [0.6, 0.8, 1.0],
        "min_samples_leaf": randint(1, 10),
    }

    cv = KFold(n_splits=5, shuffle=True, random_state=42)
    search = RandomizedSearchCV(
        estimator=base,
        param_distributions=param_dist,
        n_iter=40,
        scoring="neg_root_mean_squared_error",
        cv=cv,
        random_state=42,
        n_jobs=-1,
        verbose=0,
        refit=True,
    )
    search.fit(X_train, y_train)
    model = search.best_estimator_

    # Evaluate on hold-out
    y_pred = model.predict(X_test)
    mse = float(mean_squared_error(y_test, y_pred))
    r2 = float(r2_score(y_test, y_pred))

    print("\n--- Gradient Boosting---")
    print("Best params:", search.best_params_)
    print(f"CV best RMSE: {-search.best_score_:.4f}")
    print(f"Hold-out MSE: {mse:.4f} | R^2: {r2:.4f}")

    # Plots (same 2x2 layout you already use)
    fig, axs = plt.subplots(2, 2, figsize=(14, 10))
    fig.suptitle("Gradient Boosting Regression", fontsize=16)

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

    # Feature Importance
    importances = getattr(model, "feature_importances_", None)
    if importances is not None:
        axs[1, 0].barh(feature_cols, importances)
        axs[1, 0].set_xlabel("Feature Importance")
        axs[1, 0].set_title("Feature Importance")
    else:
        axs[1, 0].axis('off')

    axs[1, 1].axis('off')
    plt.tight_layout(rect=[0, 0.03, 1, 0.95])
    plt.show()

    top_features = []
    if importances is not None:
        pairs = sorted(zip(feature_cols, importances), key=lambda x: x[1], reverse=True)[:5]
        top_features = [{"feature": f, "importance": float(v)} for f, v in pairs]

    return {
        "Model": "Gradient Boosting Regressor",
        "Features Used": feature_cols,
        "Mean Squared Error": mse,
        "R² score": r2,
        "CV_best_params": search.best_params_,
        "CV_best_RMSE": -float(search.best_score_),
        "Top Features": top_features
    }
