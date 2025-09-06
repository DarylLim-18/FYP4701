# knn_classifier.py
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
from sklearn.neighbors import KNeighborsClassifier
import matplotlib.pyplot as plt


def run_knn_classifier(data, feature_cols, target_col='CURRENT PREVALENCE',
                       threshold=None, n_neighbors=5):
    data = data.dropna(subset=feature_cols + [target_col]).copy()

    if threshold is None:
        threshold = data[target_col].median()

    # Create binary class label
    data['PREVALENCE_CLASS'] = (data[target_col] > threshold).astype(int)

    X = data[feature_cols]
    y = data['PREVALENCE_CLASS']

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42
    )

    model = KNeighborsClassifier(n_neighbors=n_neighbors)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

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

    # Plot confusion matrix
    plt.figure(figsize=(6, 6), num="KNN Confusion Matrix")
    plt.imshow(cm, cmap="Blues")
    plt.title("KNN Confusion Matrix")
    plt.xticks([0, 1], ['Low', 'High'])
    plt.yticks([0, 1], ['Low', 'High'])
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    for i in range(2):
        for j in range(2):
            plt.text(j, i, cm[i, j], ha='center', va='center', color='black')
    plt.tight_layout()
    plt.show()

    return {
        "Features Used": feature_cols,
        "Neighbors": n_neighbors,
        "Threshold": threshold,
        "Accuracy": acc,
        "Confusion Matrix": cm.tolist(),
        "Classification Report": report,
    }
