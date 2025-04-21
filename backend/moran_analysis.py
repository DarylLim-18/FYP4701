# moran_analysis.py

import geopandas as gpd
from libpysal.weights import Queen
from esda.moran import Moran

def compute_morans_i(variable: str):
    # Load shapefile
    gdf = gpd.read_file("shapefiles/CA_Counties.shp")

    # Drop missing values
    gdf = gdf.dropna(subset=[variable]) # Drops rows that doesnt have values for the respective column

    # Generate spatial weights using Queen contiguity
    # Queen = areas are considered neighbors if they share an edge OR a corner
    w = Queen.from_dataframe(gdf)
    
    # Row-standardize the weights so each row sums to 1
    # This prevents larger polygons from dominating the analysis
    w.transform = 'r'

    # Calculate Moran's I
    # Pass the column of values and the spatial weights matrix
    moran = Moran(gdf[variable], w)

    return {
        "moran_i": moran.I,            # The Moran's I statistic
        "p_value": moran.p_sim,        # Simulated p-value (for statistical significance)
        "z_score": moran.z_sim,        # Z-score from the permutation test
        "expected_i": moran.EI_sim,    # Expected Moran’s I under null hypothesis (usually close to 0)
        "observations": moran.n        # Number of spatial units analyzed
    }