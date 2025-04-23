from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import JSONResponse
import pandas as pd
import geopandas as gpd
from libpysal.weights import Queen
from esda.moran import Moran
from geopandas import GeoDataFrame
import libpysal

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
    print(merged.columns)
    
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
    return {"Moran's I": moran.I, "p-value": moran.p_sim}



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
    
@app.get("/asthma")
def get_asthma_data(year: str = Query(..., description="Year for asthma data")):
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

