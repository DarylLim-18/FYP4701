from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import JSONResponse
import pandas as pd
import geopandas as gpd
from libpysal.weights import Queen
from esda.moran import Moran, Moran_Local
from geopandas import GeoDataFrame
import libpysal
import numpy as np

app = FastAPI()
asthma_df = pd.read_csv("data/current-asthma-prevalence-by-county-2015_2022.csv", encoding='latin1')
gdf = gpd.read_file("backend/shapefiles/CA_Counties.shp")

# Clean the dataset
# After reading CSV
asthma_df['YEARS'] = asthma_df['YEARS'].str.replace('\x96', '-', regex=False)
asthma_df = asthma_df[asthma_df['AGE GROUP'] == 'All ages']
asthma_df['COUNTY'] = asthma_df['COUNTY'].str.strip().str.title()
gdf['NAME'] = gdf['NAME'].str.strip().str.title()

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
def compute_morans_i(merged: GeoDataFrame, variable: str, year: str):
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

def compute_morans_i_local(merged: GeoDataFrame, variable: str, year: str):
    merged = merged.copy()
    
    w = Queen.from_dataframe(merged)
    w.transform = 'r'

    x = merged[variable].values
    x = np.nan_to_num(x)

    moran_local = Moran_Local(x, w)

    merged['local_I'] = moran_local.Is
    merged['p_value'] = moran_local.p_sim
    merged['z_score'] = moran_local.z_sim

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
    
    merged['cluster'] = cluster_labels

    # Return GeoJSON for frontend display
    return merged.to_json()


@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/moran")
async def run_moran(variable: str = Query(..., description="Variable for Moran's I analysis"), year: str = Query(..., description="Year for asthma data")):
    """
    Run Moran's I analysis on the specified variable.
    """
    try:
        merged = get_asthma_geodata(year)
        result = compute_morans_i(merged, variable, year)
        return result
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/moran_local")
async def run_moran_local(variable: str = Query(..., description="Variable for Moran's I analysis"), year: str = Query(..., description="Year for asthma data")):
    """
    Run Local Moran's I analysis on the specified variable.
    """
    try:
        merged = get_asthma_geodata(year)
        result = compute_morans_i_local(merged, variable, year)
        return JSONResponse(content=result)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/asthma")
async def get_asthma_data(year: str = Query(..., description="Year for asthma data")):
    """
    Get asthma data for a specific year.
    """

    try:
        merged = get_asthma_geodata(year)
        return JSONResponse(content=merged.to_json())
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_coordinates")
async def get_coordinates():
    """
    Get coordinates of the counties in the shapefile.
    """
    try:
        return {
            "County": gdf["NAME"].tolist(),
            "Latitude": gdf["INTPTLAT"].tolist(),
            "Longitude": gdf["INTPTLON"].tolist()
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

