import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.data import Data
from torch_geometric.nn import GCNConv
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score

# Load and prepare data
df = pd.read_csv("data/merged_data/complete_merge.csv")  # Adjust file path as needed
features = ['Avg CO', 'Avg SO2', 'Avg PM2.5', 'Avg PM10', 'Avg NO2', 'Avg OZONE']
df = df.dropna(subset=features + ['LIFETIME PREVALENCE'])

x = torch.tensor(df[features].values, dtype=torch.float)
y = torch.tensor(df['LIFETIME PREVALENCE'].values, dtype=torch.float)

# Build graph edges based on shared county
edges = []
for i in range(len(df)):
    for j in range(i + 1, len(df)):
        if df.iloc[i]['County Name'] == df.iloc[j]['County Name']:
            edges.append((i, j))
            edges.append((j, i))
edge_index = torch.tensor(edges, dtype=torch.long).T if edges else torch.empty((2, 0), dtype=torch.long)

# Create data object
data = Data(x=x, edge_index=edge_index, y=y)

# Create train/test split masks
indices = list(range(len(df)))
train_idx, test_idx = train_test_split(indices, test_size=0.2, random_state=42)

train_mask = torch.zeros(data.num_nodes, dtype=torch.bool)
test_mask = torch.zeros(data.num_nodes, dtype=torch.bool)
train_mask[train_idx] = True
test_mask[test_idx] = True
data.train_mask = train_mask
data.test_mask = test_mask

# Define GCN model with dropout and 3 layers
class GCN(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim, dropout_rate=0.2):
        super().__init__()
        self.conv1 = GCNConv(input_dim, hidden_dim)
        self.conv2 = GCNConv(hidden_dim, hidden_dim)
        self.conv3 = GCNConv(hidden_dim, output_dim)
        self.dropout = nn.Dropout(dropout_rate)

    def forward(self, data):
        x, edge_index = data.x, data.edge_index
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = self.dropout(x)
        x = self.conv2(x, edge_index)
        x = F.relu(x)
        x = self.dropout(x)
        x = self.conv3(x, edge_index)
        return x

# Initialize model
model = GCN(input_dim=len(features), hidden_dim=32, output_dim=1, dropout_rate=0.4)
optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
loss_fn = nn.MSELoss()

# Training loop
for epoch in range(10000):
    model.train()
    optimizer.zero_grad()
    out = model(data).squeeze()
    loss = loss_fn(out[data.train_mask], data.y[data.train_mask])
    loss.backward()
    optimizer.step()

    if epoch % 100 == 0:
        model.eval()
        with torch.no_grad():
            preds = model(data).squeeze()
            test_loss = loss_fn(preds[data.test_mask], data.y[data.test_mask])
            r2 = r2_score(data.y[data.test_mask].numpy(), preds[data.test_mask].numpy())
            print(f"Epoch {epoch}, Train Loss: {loss.item():.4f}, Test Loss: {test_loss:.4f}, R²: {r2:.4f}")

# Final evaluation
model.eval()
with torch.no_grad():
    final_preds = model(data).squeeze()
    final_r2 = r2_score(data.y[data.test_mask].numpy(), final_preds[data.test_mask].numpy())
    print(f"\nFinal Test R²: {final_r2:.4f}")
