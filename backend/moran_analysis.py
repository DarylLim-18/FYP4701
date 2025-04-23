# moran_analysis.py
import geopandas as gpd
from libpysal.weights import Queen
from esda.moran import Moran

def compute_morans_i(shapefile_path: str, variable: str, year: str):
    # Load the shapefile and asthma data (from previously cleaned sources)
    gdf = gpd.read_file(shapefile_path)
    asthma_df = pd.read_csv("data/current-asthma-prevalence-by-county-2015_2022.csv", encoding='latin1')

    # Filter asthma data by year
    asthma_year_df = asthma_df[asthma_df['YEARS'] == year]
    
    # Merge data and shapefile
    merged = gdf.merge(asthma_year_df, left_on='NAME', right_on='COUNTY')
    
    # Ensure that the variable exists in the merged data
    if variable not in merged.columns:
        raise ValueError(f"Variable '{variable}' not found in the data.")

    # Create spatial weights matrix
    w = pysal.lib.weights.Queen.from_dataframe(merged)
    w.transform = 'r'  # Row-standardize
    
    # Get the values for the variable (e.g., asthma prevalence)
    variable_values = merged[variable].values
    
    # Calculate Moran's I
    moran = pysal.explore.esda.Moran(variable_values, w)
    
    # Return results
    return {"Moran's I": moran.I, "p-value": moran.p_sim}
