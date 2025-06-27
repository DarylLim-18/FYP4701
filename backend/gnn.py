import torch
from torch_geometric.data import Data
from torch_geometric.nn import GCNConv
import torch.nn.functional as F
from sklearn.metrics import mean_squared_error, r2_score
import pandas as pd
df = pd.read_csv(f"data/merged_data/complete_merge.csv", encoding='latin1')

full_features = ['Avg PM10', 'Avg SO2', 'Avg CO', 'Avg NO2', 'Avg OZONE', 'Avg PM2.5']

x = torch.tensor(df[full_features].values, dtype=torch.float)
y = torch.tensor(df["LIFETIME PREVALENCE"].values, dtype=torch.float)

# connect rows with the same COUNTY
edges = []
for i in range(len(df)):
    for j in range(i + 1, len(df)):
        if df.iloc[i]["County Name"] == df.iloc[j]["County Name"]:
            edges.append((i, j))
            edges.append((j, i))  # undirected

edge_index = torch.tensor(edges, dtype=torch.long).T


data = Data(x=x, edge_index=edge_index, y=y)


class GCN(torch.nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim):
        super().__init__()
        self.conv1 = GCNConv(input_dim, hidden_dim)
        self.conv2 = GCNConv(hidden_dim, output_dim)

    def forward(self, data):
        x, edge_index = data.x, data.edge_index
        x = self.conv1(x, edge_index)
        x = F.relu(x)
        x = self.conv2(x, edge_index)
        return x

model = GCN(input_dim=len(full_features), hidden_dim=16, output_dim=1)
optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
loss_fn = torch.nn.MSELoss()


model.train()
for epoch in range(100000):
    optimizer.zero_grad()
    out = model(data).squeeze()
    loss = loss_fn(out, data.y)
    loss.backward()
    optimizer.step()
    if epoch % 20 == 0:
        r2 = r2_score(data.y.detach().numpy(), out.detach().numpy())
        print(f"Epoch {epoch}, Loss: {loss.item():.4f}, R²: {r2:.4f}")
        
        

# PM2.5 : Loss: 25.1781, R²: 0.0048
# PM10 : Loss: 25.9275, R²: -0.0002
# SO2 : Loss: 22.3399, R²: 0.0210
# Ozone : Loss: 25.5920, R²: 0.0004
# NO2 : Loss: 24.8775, R²: 0.0157
# CO : Loss: 23.9040, R²: 0.0237
# Full Features : Epoch 41040, Loss: 15.0792, R²: 0.2725