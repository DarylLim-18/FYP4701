import pandas as pd
import io
import base64
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
from sklearn.neighbors import KNeighborsClassifier
import matplotlib.pyplot as plt


def run_knn_classifier(data, feature_cols, target_col='CURRENT PREVALENCE',
                       threshold=None, n_neighbors=5):
    # --- Data prep ---
    data = data.dropna(subset=feature_cols + [target_col]).copy()

    if threshold is None:
        threshold = data[target_col].median()

    # Binary label
    data['PREVALENCE_CLASS'] = (data[target_col] > threshold).astype(int)

    X = data[feature_cols]
    y = data['PREVALENCE_CLASS']

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42
    )

    # --- Train model ---
    model = KNeighborsClassifier(n_neighbors=n_neighbors)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    # --- Metrics ---
    acc = accuracy_score(y_test, y_pred)
    cm = confusion_matrix(y_test, y_pred)
    report = classification_report(y_test, y_pred)

    print("\n--- KNN Classification Results ---")
    print(f"Features Used: {feature_cols}")
    print(f"Neighbors (k): {n_neighbors}")
    print(f"Threshold for classification: {threshold:.2f}")
    print(f"Accuracy: {acc:.2f}")
    print("\nConfusion Matrix:\n", cm)
    print("\nClassification Report:\n", report)

    # --- Visualization ---
    fig, ax = plt.subplots(figsize=(6, 6))
    ax.imshow(cm, cmap="Blues")
    ax.set_title("KNN Confusion Matrix")
    ax.set_xticks([0, 1])
    ax.set_yticks([0, 1])
    ax.set_xticklabels(['Low', 'High'])
    ax.set_yticklabels(['Low', 'High'])
    ax.set_xlabel("Predicted")
    ax.set_ylabel("Actual")

    # annotate cells
    for i in range(2):
        for j in range(2):
            ax.text(j, i, cm[i, j], ha='center', va='center', color='black', fontsize=12)

    plt.tight_layout()

    # --- Convert figure to base64 ---
    buf = io.BytesIO()
    plt.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    buf.seek(0)
    image_base64 = base64.b64encode(buf.read()).decode("utf-8")

    return {
        "Model": "KNN Classifier",
        "Features Used": feature_cols,
        "Neighbors": n_neighbors,
        "Threshold": threshold,
        "Accuracy": acc,
        "Confusion Matrix": cm.tolist(),
        "Classification Report": report,
        "PlotImage": image_base64,  # 👈 for inline display
    }
