# moran_analysis.py
import geopandas as gpd
from libpysal.weights import Queen
from esda.moran import Moran, Moran_Local
import pandas as pd
from geopandas import GeoDataFrame
import numpy as np

asthma_df = pd.read_csv("data/current-asthma-prevalence-by-county-2015_2022.csv", encoding='latin1')
gdf = gpd.read_file("backend/shapefiles/CA_Counties.shp")

# Clean the dataset
# After reading CSV
asthma_df['YEARS'] = asthma_df['YEARS'].str.replace('\x96', '-', regex=False)
#asthma_df = asthma_df[asthma_df['AGE GROUP'] == 'All ages']
asthma_df = asthma_df.drop('COUNTIES GROUPED', axis=1, errors='coerce')
asthma_df = asthma_df.drop('COMMENT', axis=1, errors='coerce')
asthma_df['COUNTY'] = asthma_df['COUNTY'].str.strip().str.title()
gdf['NAME'] = gdf['NAME'].str.strip().str.title()

def remove_empty_rows(df: pd.DataFrame, column: str):
    """
    Removes rows from a DataFrame where the specified column is empty.
    """
    try:
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in DataFrame.")
        
        return df.dropna(subset=[column])
    except Exception as e:
        raise ValueError(f"Error removing empty rows in column '{column}': {e}")

def remove_column(df: pd.DataFrame, column: str):
    """
    Removes a column from a DataFrame.
    """
    try:
        if column not in df.columns:
            raise ValueError(f"Column '{column}' not found in DataFrame.")
        
        return df.drop(columns=[column], axis=1, errors='coerce')
    except Exception as e:
        raise ValueError(f"Error removing column '{column}': {e}")
    

def read_csv(file_path: str):
    """
    Reads a CSV file and returns a DataFrame.
    """
    try:
        df = pd.read_csv(file_path, encoding='latin1')
        return df
    except Exception as e:
        raise ValueError(f"Error reading CSV file: {e}")
    
def get_csv_columns(df: pd.DataFrame):
    """
    Returns the columns of a DataFrame.
    """
    return df.columns.tolist()

def merge_dataframes(gdf: gpd.GeoDataFrame, df2: pd.DataFrame, left_on: str, right_on: str):
    """
    Merges two DataFrames on specified columns.
    """
    
    df2 = df2.copy()
    gdf = gdf.copy()
    if left_on not in gdf.columns or right_on not in df2.columns:
        raise ValueError(f"Columns '{left_on}' or '{right_on}' not found in DataFrames.")
    
    return gdf.merge(df2, left_on=left_on, right_on=right_on)


# Merge function
def get_asthma_geodata(year: str):
    asthma_year_df = asthma_df[asthma_df['YEARS'] == year].copy()

    if asthma_year_df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for year {year}")

    asthma_year_df['CURRENT PREVALENCE'] = pd.to_numeric(asthma_year_df['CURRENT PREVALENCE'], errors='coerce')
    merged = gdf.merge(asthma_year_df, left_on='NAME', right_on='COUNTY')
    merged = merged.dropna(subset=['CURRENT PREVALENCE'])
    return merged

# Moran's I Analysis
def compute_morans_i(merged: GeoDataFrame, variable: str):
    # Ensure that the variable exists in the merged data
    if variable not in merged.columns:
        raise ValueError(f"Variable '{variable}' not found in the data.")

    # Create spatial weights matrix
    w = Queen.from_dataframe(merged)
    w.transform = 'r'  # Row-standardize
    
    # Get the values for the variable (e.g., asthma prevalence)
    variable_values = merged[variable].values
    
    # Calculate Moran's I
    moran = Moran(variable_values, w)
    
    # Return results
    return {
        "Moran's I": moran.I, 
        "z-value": moran.z.tolist(),
        "p-value": moran.p_norm
        }

def compute_morans_i_local(merged: GeoDataFrame, variable: str):
    merged = merged.copy()
    
    w = Queen.from_dataframe(merged)
    w.transform = 'r'

    x = merged[variable].values
    x = np.nan_to_num(x)

    moran_local = Moran_Local(x, w)

    merged['local_I'] = moran_local.Is
    merged['p_value'] = moran_local.p_sim
    merged['z_score'] = moran_local.z.tolist()

    # Classify cluster types
    cluster_labels = []
    for i, (Ii, sig, q) in enumerate(zip(moran_local.Is, moran_local.p_sim, moran_local.q)):
        if sig < 0.05:
            if q == 1:
                cluster_labels.append('HH')  # High-High
            elif q == 2:
                cluster_labels.append('LH')  # Low-High
            elif q == 3:
                cluster_labels.append('LL')  # Low-Low
            elif q == 4:
                cluster_labels.append('HL')  # High-Low
            else:
                cluster_labels.append('Not Significant')
        else:
            cluster_labels.append('Not Significant')


    # Return GeoJSON for frontend display
    return merged.to_json()
