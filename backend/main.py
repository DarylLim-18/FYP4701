from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Path
from fastapi.middleware.cors import CORSMiddleware
import psycopg2
from backend.moran_analysis import compute_morans_i
from fastapi.responses import JSONResponse
import pandas as pd
from pandas import DataFrame
import geopandas as gpd
from libpysal.weights import Queen, Rook, KNN
from esda.moran import Moran, Moran_Local
from geopandas import GeoDataFrame
import numpy as np
import io, json, os


# Import Machine Learning functions
from backend.linear_regression import run_linear_regression
from backend.random_forest import run_rf_model
from backend.logistic_regression import run_logistic_regression
from backend.naive_bayes import run_naive_bayes
from backend.asthma_arthimetic_mean import preprocess_gas_data

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # or restrict to ['POST'] if needed
    allow_headers=["*"],
)


# Load multi-level geopackages:
GPKG_PATH = {
    "adm0": "backend/geopackages/adm0.gpkg", # Country level
    "adm1": "backend/geopackages/adm1.gpkg", # State level
    "adm2": "backend/geopackages/adm2.gpkg"  # County level
}

COLUMN_MAPPINGS = {
    "adm0": {"code": "iso_a3", "name": "ADMIN", "alias": "country"},
    "adm1": {"code": "iso_3166_2", "name": "NAME_1", "alias": "state"},
    "adm2": {"code": "adm2_code", "name": "NAME_2", "alias": "county"}
}



lifetime_df = pd.read_csv("data/lifetime-asthma-prevalence-by-county-2015_2022.csv", encoding='latin1')
gdf = gpd.read_file("backend/shapefiles/CA_Counties.shp")
current_df = pd.read_csv("data/current-asthma-prevalence-by-county-2015_2022.csv", encoding='latin1')


#Lifetime
lifetime_df['YEARS'] = lifetime_df['YEARS'].str.replace('\x96', '-', regex=False)
lifetime_df['COUNTY'] = lifetime_df['COUNTY'].str.strip().str.title()
gdf['NAME'] = gdf['NAME'].str.strip().str.title()

#Current
current_df['YEARS'] = current_df['YEARS'].str.replace('\x96', '-', regex=False)
current_df = current_df[current_df['AGE GROUP'] == 'All ages']
current_df = current_df.drop('COUNTIES GROUPED', axis=1, errors='coerce')
current_df = current_df.drop('COMMENT', axis=1, errors='coerce')
current_df['COUNTY'] = current_df['COUNTY'].str.strip().str.title()
    
        

# Merge function
def get_asthma_geodata(dataset: DataFrame, target: str, year: str):
    asthma_year_df = dataset[dataset['YEARS'] == year].copy()

    if asthma_year_df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for year {year}")

    asthma_year_df[target] = pd.to_numeric(asthma_year_df[target], errors='coerce')
    merged = gdf.merge(asthma_year_df, left_on='NAME', right_on='COUNTY')
    merged = merged.dropna(subset=[target])
    return merged

def compute_morans_i_local(merged: GeoDataFrame, variable: str, year: str):
    merged = merged.copy()
    if variable not in merged.columns:
        raise ValueError(f"Variable '{variable}' not found in the data.")
    w = Queen.from_dataframe(merged)
    w.transform = 'R'

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

    merged['cluster_label'] = cluster_labels    

    if merged.crs is None:
        merged.set_crs(epsg=3310, inplace=True)
    merged = merged.to_crs(epsg=4326)

    output = merged.to_json()
    output = json.loads(output)
    name = ""
    
    if variable == "LIFETIME PREVALENCE":
        name = "lifetime"
    else:
        name = "current"
        
    os.makedirs("frontend/public/geojson", exist_ok=True)

    with open(f"frontend/public/geojson/{name}-{year}.geojson", "w") as f:
        output = json.dump(output, f, indent=4)
    return True


def assign_weights(gdf: GeoDataFrame, wtype: str, k: int | None):
    wtype = wtype.lower()
    if wtype == "queen":
        w = Queen.from_dataframe(gdf)
    elif wtype == "rook":
        w = Rook.from_dataframe(gdf)
    elif wtype == "knn":
        if k is None:
            raise HTTPException(status_code=400, detail="k cannot be None for KNN")
        cent = gdf.geometry.representative_point()
        w = KNN.from_dataframe(gdf.set_geomertry(cent), k=k)
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported weight type: {wtype}")
    w.transform = 'R'
    return w

def join_layers(dataset: DataFrame):
    # Check if dataset is in country level
    if "iso_a3" in dataset.columns:
        layer, left, right = adm0, "iso_a3", "iso_a3"
    # Check if dataset is in state level
    elif "iso_3166_2" in dataset.columns:
        layer, left, right = adm1, "iso_3166_2", "iso_3166_2"
    # Check if dataset is in county level
    elif {"lon", "lat"}.issubset(dataset.columns):
        gdf = gpd.GeoDataFrame(dataset, geometry=gpd.points_from_xy(dataset.lon, dataset.lat), crs="EPSG:4326")
        joined = gdf.sjoin(dataset, adm2[["adm2_code", "geom"]], predicate="within")
        result = joined.groupby("adm2_code", as_index=False)["value"].mean().merge(adm2, on="adm2_code")[["adm2_code","value","geom"]].to_crs(4326)
        return result
    else:
        
    
def get_db_connection():
    return psycopg2.connect(
        dbname="postgres",
        user="postgres",
        password="hanikodi4701!",
        host="localhost",
        port="5432"
    )


def get_all_geojson(current_df, lifetime_df, gdf):
    years = ['2015-2016', '2017-2018', '2019-2020', '2021-2022']
    for year in years:
        merged_curr = get_asthma_geodata(current_df, "CURRENT PREVALENCE", year)
        compute_morans_i_local(merged_curr, 'CURRENT PREVALENCE', year)
        merged_life = get_asthma_geodata(lifetime_df, "LIFETIME PREVALENCE", year)
        compute_morans_i_local(merged_life, 'LIFETIME PREVALENCE', year)
    
    return True



@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/get_geojson")
async def run_moran():
    """
    Get's all the GeoJSON files for lifetime, current and all years
    """
    try:
        result = get_all_geojson(current_df, lifetime_df, gdf)
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
    
@app.get("/moran_local/{file_id}")
async def run_moran_local(variable: str = Query(..., description="Variable for Moran's I analysis"), year: str = Query(..., description="Year for asthma data")):
    """
    Run Local Moran's I analysis on the specified variable.
    """
    try:
        file = retrieve_csv_table(file_id)
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

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        # Read the contents of the uploaded file
        contents = await file.read()
        # Connect to PostgreSQL
        conn = psycopg2.connect(
            dbname="postgres",
            user="postgres",
            password="hanikodi4701!",
            host="localhost",
            port="5432"
        )
        cur = conn.cursor()

        # Insert file into database
        cur.execute("""
            INSERT INTO files (file_name, file_data)
            VALUES (%s, %s)
        """, (file.filename, psycopg2.Binary(contents)))
        conn.commit()
        cur.close()
        conn.close()

        return {"status": "success", "filename": file.filename}
    except Exception as e:
        print("Error uploading file:", str(e))  # LOG TO TERMINAL
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/delete/{file_id}")
async def delete_file(file_id: int = Path(..., description="ID of the file to delete")):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM files WHERE file_id = %s", (file_id,))
        conn.commit()

        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="File not found")

        cur.close()
        conn.close()
        return {"status": "success", "message": f"File with ID {file_id} deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get("/list")
async def list_files():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT file_id, file_name FROM files")
        files = cur.fetchall()
        cur.close()
        conn.close()

        return [{"id": f[0], "file_name": f[1]} for f in files]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@app.get("/files/{file_id}")
def retrieve_csv_table(file_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT file_data FROM files WHERE file_id = %s", (file_id,))
        result = cur.fetchone()

        if result is None:
            raise HTTPException(status_code=404, detail="File not found")

        file_data = result[0]
        csv_content = file_data.tobytes().decode("utf-8")
        reader = pd.read_csv(io.StringIO(csv_content), encoding='latin1')
        
        return reader

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()


@app.get("/files/{file_id}/headers")
def get_csv_headers(file_id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT file_data FROM files WHERE file_id = %s", (file_id,))
        result = cur.fetchone()

        if result is None:
            raise HTTPException(status_code=404, detail="File not found")

        file_data = result[0]
        csv_content = file_data.tobytes().decode("utf-8")
        df = pd.read_csv(io.StringIO(csv_content), nrows=0, encoding='latin1')  # only reads headers
        headers = list(df.columns)

        return {"columns": headers}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()

@app.get("/preview/{file_id}")
def preview_file(
    file_id: int = Path(..., description="ID of the file to preview"),
    offset: int = Query(0, ge=0, description="Row offset to start from"),
    limit: int = Query(100, ge=1, le=1000, description="How many rows to return")
):
    """
    Paginated JSON preview
    -> { columns: [...], rows: [...], total: number }
    Supports .csv, .xlsx, .xls stored in the DB as bytes.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT file_name, file_data FROM files WHERE file_id = %s", (file_id,))
        result = cur.fetchone()
        if result is None:
            raise HTTPException(status_code=404, detail="File not found")

        import os, io, pandas as pd
        file_name, file_data = result
        raw = file_data.tobytes()
        ext = os.path.splitext(file_name or "")[1].lower()

        if ext == ".csv":
            df = pd.read_csv(io.StringIO(raw.decode("latin1")))
        elif ext in (".xlsx", ".xls"):
            df = pd.read_excel(io.BytesIO(raw), engine=None)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext or 'unknown'}")

        total = len(df)
        if offset >= total:
            slice_df = df.iloc[0:0]  # empty
        else:
            slice_df = df.iloc[offset: offset + limit]

        return JSONResponse(content={
            "columns": list(df.columns),
            "rows": slice_df.to_dict(orient="records"),
            "total": int(total)
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cur' in locals(): cur.close()
        if 'conn' in locals(): conn.close()
        

@app.get("/machine-learning/linear-regression")
def run_linear_regressions(target_variable: str = Query(..., description="Target variable for regression"),
    feature_variables: list = Query(..., description="List of feature variables"),
    file_id: int = Query(..., description="ID of the uploaded CSV file")):
    try:
        print(f"Running linear regression with target: {target_variable}, features: {feature_variables}, file_id: {file_id}")
        data = retrieve_csv_table(file_id)
        res = run_linear_regression(
            data=data,
            feature_cols=feature_variables,
            target_col=target_variable
        )   
        return res
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get("/machine-learning/random-forest")
def run_random_forest(target_variable: str = Query(..., description="Target variable for regression"),
    feature_variables: list = Query(..., description="List of feature variables"),
    file_id: int = Query(..., description="ID of the uploaded CSV file")):
    try:
        print(f"Running random forest with target: {target_variable}, features: {feature_variables}, file_id: {file_id}")
        data = retrieve_csv_table(file_id)
        res = run_rf_model(
            data=data,
            feature_cols=feature_variables,
            target_col=target_variable
        )   
        return res
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get("/machine-learning/logistic-regression")
def run_logistic_regressions(target_variable: str = Query(..., description="Target variable for regression"),
    feature_variables: list = Query(..., description="List of feature variables"),
    file_id: int = Query(..., description="ID of the uploaded CSV file")):
    try:
        print(f"Running logistic regression with target: {target_variable}, features: {feature_variables}, file_id: {file_id}")
        data = retrieve_csv_table(file_id)
        res = run_logistic_regression(
            data=data,
            feature_cols=feature_variables,
            target_col=target_variable
        )   
        return res
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get("/machine-learning/naive-bayes")
def run_naive_bayes_models(target_variable: str = Query(..., description="Target variable for model"),
    feature_variables: list = Query(..., description="List of feature variables"),
    file_id: int = Query(..., description="ID of the uploaded CSV file")):
    try:
        print(f"Running naive bayes with target: {target_variable}, features: {feature_variables}, file_id: {file_id}")
        data = retrieve_csv_table(file_id)
        res = run_naive_bayes(
            data=data,
            feature_cols=feature_variables,
            target_col=target_variable
        )   
        return res
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/machine-learning/asthma-arthimetic-mean")
def get_gas_analysis_data():
    try:
        county_year_means, yearly_stats = preprocess_gas_data()
        
        def df_to_records(dfs):
            return {gas: df.to_dict(orient="records") for gas, df in dfs.items()}

        return {
            "county_year_means": df_to_records(county_year_means),
            "yearly_stats": df_to_records(yearly_stats)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))