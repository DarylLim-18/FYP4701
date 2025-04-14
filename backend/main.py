from fastapi import FastAPI, Query
from backend.moran_analysis import compute_morans_i

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/moran")
def run_moran():
    """
    Run Moran's I analysis on the specified variable.
    """
    shapefile_path = "shapefiles/CA_Counties.shp"
    result = compute_morans_i(shapefile_path, variable)
    return result


