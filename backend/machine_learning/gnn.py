import torch
import torch.nn.functional as F
from torch_geometric.data import Data
from torch_geometric.nn import GCNConv
from sklearn.metrics import mean_squared_error, r2_score
import pandas as pd
import os


def load_data(csv_path: str, features: list, label_col: str = "LIFETIME PREVALENCE", edge_col: str = "County Name") -> Data:
    df = pd.read_csv(csv_path, encoding='latin1')
    x = torch.tensor(df[features].values, dtype=torch.float)
    y = torch.tensor(df[label_col].values, dtype=torch.float)

    # Build edges by COUNTY
    edges = []
    for i in range(len(df)):
        for j in range(i + 1, len(df)):
            if df.iloc[i][edge_col] == df.iloc[j][edge_col]:
                edges.append((i, j))
                edges.append((j, i))  # Undirected

    edge_index = torch.tensor(edges, dtype=torch.long).T
    return Data(x=x, edge_index=edge_index, y=y), df


class GCN(torch.nn.Module):
    def __init__(self, input_dim, hidden_dim=16, output_dim=1):
        super().__init__()
        self.conv1 = GCNConv(input_dim, hidden_dim)
        self.conv2 = GCNConv(hidden_dim, output_dim)

    def forward(self, data: Data):
        x, edge_index = data.x, data.edge_index
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = self.conv2(x, edge_index)
        return x


def train_model(model, data: Data, epochs: int = 1000, lr: float = 0.01, verbose: bool = True):
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = torch.nn.MSELoss()
    
    for epoch in range(epochs):
        model.train()
        optimizer.zero_grad()
        out = model(data).squeeze()
        loss = loss_fn(out, data.y)
        loss.backward()
        optimizer.step()

        if verbose and epoch % 100 == 0:
            r2 = r2_score(data.y.detach().numpy(), out.detach().numpy())
            print(f"Epoch {epoch}, Loss: {loss.item():.4f}, R²: {r2:.4f}")

    return model


def evaluate_model(model, data: Data):
    model.eval()
    with torch.no_grad():
        predictions = model(data).squeeze()
        y_true = data.y
        mse = mean_squared_error(y_true.numpy(), predictions.numpy())
        r2 = r2_score(y_true.numpy(), predictions.numpy())
    return mse, r2, predictions


def run_pipeline(
    csv_path: str,
    features: list,
    label_col: str = "LIFETIME PREVALENCE",
    edge_col: str = "County Name",
    hidden_dim: int = 16,
    epochs: int = 1000,
    lr: float = 0.01,
    verbose: bool = True
    
):
    data, df = load_data(csv_path, features, label_col)
    model = GCN(input_dim=len(features), hidden_dim=hidden_dim)
    model = train_model(model, data, epochs=epochs, lr=lr, verbose=verbose)
    mse, r2, preds = evaluate_model(model, data)

    return {
        "mse": mse,
        "r2": r2,
        "predictions": preds.numpy().tolist(),
        "true_values": data.y.numpy().tolist(),
        "features_used": features,
        "epochs": epochs
    }


def main():
    csv_path = "data/merged_data/complete_merge.csv"
    full_features = ['Avg PM10', 'Avg SO2', 'Avg CO', 'Avg NO2', 'Avg OZONE', 'Avg PM2.5']
    label_col = "LIFETIME PREVALENCE"
    edge_col = "County Name"
    hidden_dim = 32
    epochs = 10000
    learning_rate = 0.01
    verbose = True

    print("Running GCN pipeline...")
    result = run_pipeline(
        csv_path=csv_path,
        features=full_features,
        label_col=label_col,
        edge_col=edge_col,
        hidden_dim=hidden_dim,
        epochs=epochs,
        lr=learning_rate,
        verbose=verbose
    )

    print("\n=== Final Evaluation ===")
    print(f"R² Score: {result['r2']:.4f}")
    print(f"MSE: {result['mse']:.4f}") 


if __name__ == "__main__":
    main()
    
# R² Score: 0.3089
# MSE: 14.3248