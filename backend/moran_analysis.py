# moran_analysis.py

import geopandas as gpd
from libpysal.weights import Queen
from esda.moran import Moran

def compute_morans_i(shapefile_path: str, variable: str):
    # Load shapefile
    gdf = gpd.read_file("shapefiles/CA_Counties.shp")

    # Drop missing values
    gdf = gdf.dropna(subset=[variable])

    # Generate spatial weights using Queen contiguity
    w = Queen.from_dataframe(gdf)
    w.transform = 'r'

    # Calculate Moran's I
    moran = Moran(gdf[variable], w)

    return {
        "moran_i": moran.I,
        "p_value": moran.p_sim,
        "z_score": moran.z_sim,
        "expected_i": moran.EI_sim,
        "observations": moran.n,
    }