from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Path, Form, Response
from fastapi.middleware.cors import CORSMiddleware
import fiona
import psycopg2
from psycopg2.extras import Json
from fastapi.responses import JSONResponse
import pandas as pd
from pandas import DataFrame
import geopandas as gpd
from libpysal.weights import Queen, Rook, KNN
from esda.moran import Moran, Moran_Local
from geopandas import GeoDataFrame
import numpy as np
from numpy.typing import NDArray
import io, json, os, unicodedata
from pathlib import Path as pt
from dotenv import load_dotenv


# Import Machine Learning functions
from backend.machine_learning.linear_regression import run_linear_regression
from backend.machine_learning.random_forest import run_rf_model
from backend.machine_learning.logistic_regression import run_logistic_regression
from backend.machine_learning.naive_bayes import run_naive_bayes
from backend.machine_learning.asthma_arthimetic_mean import preprocess_gas_data
from backend.machine_learning.gradient_boosting import run_gradient_boosting
from backend.machine_learning.svr import run_svr_model
from backend.machine_learning.extra_trees import run_extra_trees_regressor
from backend.machine_learning.elastic_net import run_elastic_net_regression
# from backend.machine_learning.kNN import run_knn_classifier

# Import forecasting functions
from backend.training.forecasting import run_forecast

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # or restrict to ['POST'] if needed
    allow_headers=["*"],
)


# Load multi-level geopackages:
GPKG_PATHS = {
    "adm0": "backend/geopackages/adm0.gpkg", # Country level
    "adm1": "backend/geopackages/adm1.gpkg", # State level
    "adm2": "backend/geopackages/adm2.gpkg"  # County level
}

COLUMN_MAPPINGS = {
    "adm0": {"code": "shapeGroup", "name": "shapeName", "alias": "country"},
    "adm1": {"code": "shapeID", "name": "shapeName", "alias": "state"},
    "adm2": {"code": "shapeID", "name": "shapeName", "alias": "county"}
}


def assign_weights(gdf: GeoDataFrame, wtype: str, k: int | None):
    wtype = wtype.lower()
    if wtype == "queen":
        w = Queen.from_dataframe(gdf)
        
    elif wtype == "rook":
        w = Rook.from_dataframe(gdf)
        
    elif wtype == "knn":
        if k is None:
            raise ValueError("k can't be None for weight type knn")
        cent = gdf.geometry.representative_point()
        w = KNN.from_dataframe(gdf.set_geometry(cent), k=k, use_index=True)
        
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported weight type: {wtype}")
    w.transform = "R" # pyright: ignore[reportAttributeAccessIssue]
    
    if getattr(w, 'islands', None):
        pass
    return w

def normalize(s: pd.Series):
    # ascii-fold
    def fold(x):
        if pd.isna(x):
            x = ""
        else:
            x = str(x)
        x = unicodedata.normalize("NFKD", x)
        chars =[]
        for char in x:
            if not unicodedata.combining(char):
                chars.append(char)
        x = "".join(chars)
        return x.lower()
    output = s.map(fold).str.replace(r"[^a-z0-9]+",  " ", regex=True).str.strip()
    return output


def join_layers(
    df: DataFrame,
    gdf: GeoDataFrame,
    level: str,
    variable: str,
    *,
    join_by: str = "code",
    join_key: str | None = None,
    country_iso3: str | None = None,
    country_col: str | None = "country",
    state_col: str | None = "state",
    county_col: str | None = "county",
    lon_col: str | None = "lon",
    lat_col: str | None = "lat",
    ):
    
    if country_iso3:
        if "iso_a3" in gdf.columns:
            gdf = gdf[gdf["iso_a3"].astype(str).str.upper() == country_iso3.upper()].copy()
        elif "shapeGroup" in gdf.columns:
            gdf = gdf[gdf["shapeGroup"].astype(str).str.upper() == country_iso3.upper()].copy()
    
    
    if join_by == "code":
        if not join_key or join_key not in df.columns:
            raise HTTPException(400, detail=f"join_by code required join_key to be in the uploaded file")
        temp = df.copy()
        temp["code"] = temp[join_key].astype(str).str.strip()
        merged = gdf.merge(temp[["code", variable]], on="code", how="inner")
        return merged
    
    elif join_by == "name":
        if level == "adm0":
            if country_col in df.columns:
                left = gdf.copy()
                right = df.copy()
                left["name_norm"] = normalize(left["name"])
                right["name_norm"] = normalize(right[country_col])
                merged = left.merge(right[[country_col, "name_norm", variable]], on="name_norm", how="inner")
                return merged
            else:
                raise HTTPException(400, detail="for join_by=adm0, country name column must be provided")
        
        elif level == "adm1":
            for column in (country_col, state_col):
                if column not in df.columns:
                    raise HTTPException(400, detail=f"missing '{column}' for adm1 name join.")
            left = gdf.copy()
            right = df.copy()
            left["state_norm"] = normalize(left["name"])
            right["state_norm"] = normalize(right[state_col])
            merged = left.merge(right[[country_col, state_col, "state_norm", variable]], on="state_norm", how="inner")
            return merged
        
        elif level == "adm2":
            # Require county name; recommend country_iso3 to pre-filter base
            if county_col not in df.columns:
                raise HTTPException(400, detail=f"missing '{county_col}' for adm2 name join")
            left = gdf.copy()
            right = df.copy()
            left["county_norm"] = normalize(left["name"])
            right["county_norm"] = normalize(right[county_col])
            merged = left.merge(right[[county_col, "county_norm", variable]],
                                on="county_norm", how="inner")
            return merged
        
        else:
            raise HTTPException(400, detail="Invalid Level")
    
    elif join_by == "point":
        if lon_col not in df.columns or lat_col not in df.columns:
            raise HTTPException(400, detail=f"join_by=point required '{lon_col}'")
        
        if gdf.crs is None or gdf.crs.to_epsg() != 4326:
            gdf = gdf.to_crs(epsg=4326)
        
        points = gpd.GeoDataFrame(df[[lon_col, lat_col, variable]].copy(), geometry=gpd.points_from_xy(df[lon_col], df[lat_col], crs="EPSG:4326"))
        spatial_join = gpd.sjoin(points, gdf[["code", "name", "geometry"]], predicate="within", how="inner")
        agg = spatial_join.groupby("code", as_index=False)[variable].mean()
        merged = gdf.merge(agg, on="code", how="inner")
        return merged
    
    else:
        raise HTTPException(400, detail="join_by must be one of: code, name or point")
        
def local_moran(
    gdf: GeoDataFrame,
    variable: str,
    *,
    wtype: str = "queen",
    k: int | None = None,
    perm: int = 999,
    alpha: float = 0.05
):
    if gdf.crs is None:
        gdf = gdf.set_crs(4326)
    else:
        gdf = gdf.to_crs(4326)   
    
    gdf = gdf.copy()
    gdf["geometry"] = gdf.geometry.buffer(0)
    y = pd.to_numeric(gdf[variable], errors="coerce")
    mask = y.notna()
    if mask.sum() < 5:
        raise ValueError("Not enough valid numeric values (>=5 required)")
    sub = gdf.loc[mask].copy()
    y_sub = y.loc[mask].to_numpy()
    
    try:
        # weights & LISA
        w = assign_weights(sub, wtype, k)
        lisa = Moran_Local(y_sub, w, permutations=perm)
        
    except ValueError as e:
        raise HTTPException(400, detail=str(e))

    # attach results back
    out = gdf.copy()
    out["local_I"] = np.nan
    out["p_value"] = np.nan
    out.loc[mask, "local_I"] = lisa.Is
    out.loc[mask, "p_value"] = lisa.p_sim

    # cluster labels (1=HH, 2=LH, 3=LL, 4=HL), only when significant
    q_series = pd.Series(lisa.q, index=sub.index)
    label_map = {1: "HH", 2: "LH", 3: "LL", 4: "HL"}
    labels = np.full(len(out), "Not Significant", dtype=object)
    sig_idx = out.index[(out["p_value"] < alpha) & mask]
    if len(sig_idx):
        mapped = q_series.reindex(sig_idx).map(label_map).fillna("Not Significant")
        pos = out.index.get_indexer(sig_idx)
        labels[pos] = mapped
    out["cluster_label"] = labels

    return out

def upsert_cache(cache_id: int, cache_name: str, geojson_obj: dict):
    conn = psycopg2.connect(
        dbname="postgres",
        user="postgres",
        password="hanikodi4701!",   # move to env var
        host="localhost",
        port="5432"
    )
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO cache (cache_id, cache_name, cache_data)
                VALUES (%s, %s, %s)
                ON CONFLICT (cache_id) DO UPDATE
                  SET cache_name = EXCLUDED.cache_name,
                      cache_data = EXCLUDED.cache_data,
                      updated_time = now();
                """,
                (cache_id, cache_name, Json(geojson_obj))
            )
    finally:
        conn.close()

def upload_asthmageo_data(year: int, geojson_obj: dict):
    conn = psycopg2.connect(
        dbname=os.getenv("PG_DB", "postgres"),
        user=os.getenv("PG_USER", "postgres"),
        password=os.getenv("PG_PASSWORD", "hanikodi4701!"),  # move to env var
        host=os.getenv("PG_HOST", "localhost"),
        port=os.getenv("PG_PORT", "5432"),
    )
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO asthma_geodata (asthmageo_id, asthmageo_name, asthmageo_data)
                VALUES (%s, %s, %s)
                ON CONFLICT (asthmageo_id) DO NOTHING
                RETURNING asthmageo_id;
                """,
                (year, f"asthma_forecast_{year}", Json(geojson_obj)),
            )
            inserted = cur.fetchone()  # None if DO NOTHING triggered
            print(f"Saved: {year}")
            return bool(inserted)  # True = saved, False = already existed
    finally:
        conn.close()
        
        
def run_lisa_forecast(
    df: DataFrame,
    year: int,
    level: str= "adm1",
    variable: str ="Predicted Asthma Prevalence %",
    # join options
    join_by: str = "name",
    country_col: str = "Country",
    state_col: str = "State",
    # analysis options
    wtype: str = "queen",
    k: int | None = None,
    perm: int = 999,
    alpha: float =0.05,
    simplify_tol: float | None = 0.01,
):
    

    gdf = gpd.read_file(GPKG_PATHS[level])
    mapping = COLUMN_MAPPINGS[level]
    bcode, bname, alias = mapping["code"], mapping["name"], mapping["alias"]
    gdf = gdf.rename(columns={bcode: "code", bname: "name"})

    if gdf.crs is None:
        gdf.set_crs(4326, inplace=True)
    else:
        gdf = gdf.to_crs(4326)
    gdf["geometry"] = gdf.geometry.buffer(0)

    # join user data onto polygons
    try:
        merged = join_layers(
            gdf=gdf, df=df, level=level, variable=variable,
            join_by=join_by, join_key=None, country_iso3=None,
            country_col=country_col, state_col=state_col, county_col=None,
            lon_col=None, lat_col=None
        )
    except ValueError as ve:
        raise HTTPException(400, detail=str(ve))

    # run Local Moran in an independent function
    try:
        result = local_moran(
            merged, variable,
            wtype=wtype, k=k, perm=perm, alpha=alpha
        )
    except ValueError as ve:
        raise HTTPException(400, detail=str(ve))

    # optional simplify for web payload
    if simplify_tol:
        result["geometry"] = result.geometry.simplify(simplify_tol, preserve_topology=True)

    # rename name -> alias (country/state/county) for output
    result = result.rename(columns={"name": alias})

    cols = ["code", alias, variable, "local_I", "p_value", "cluster_label", "geometry"]
    geojson = result[cols].to_json()
    geojson_obj = json.loads(geojson)
    
    upload_asthmageo_data(year=year, geojson_obj=geojson_obj)
    return 1



load_dotenv()

DB_NAME = os.environ["DB_NAME"]
DB_USER = os.environ["DB_USER"]
DB_PASS = os.environ["DB_PASS"]
DB_HOST = os.environ["DB_HOST"]
DB_PORT = int(os.environ["DB_PORT"])

def get_db_connection():
    return psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASS,
        host=DB_HOST,
        port=DB_PORT
    )


@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.post("/fill_database")
async def fill_database():
    conn = get_db_connection()
    try:
        file_path = "ml_dataset_smoking_Year-"
        for year in range(2011, 2022):
            df = pd.read_csv(f"data/out_years/{file_path}{year}.csv")
            with conn, conn.cursor() as cur:
                cur.execute("""
                            SELECT asthmageo_id FROM asthma_geodata WHERE asthmageo_id=%s
                            """, (year,))
                row = cur.fetchone()
                if not row:
                    run_lisa_forecast(df=df, year=year, variable="Asthma Prevalence%")
                else:
                    continue
        
    except Exception as e:
        return HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()
        

    
@app.post("/lisa/{file_id}")
async def run_lisa(
    file_id: int = Path(..., description="ID of the uploaded CSV file"),
    level: str = Form(..., description="adm0 | adm1 | adm2"),
    variable: str = Form(..., description="numeric column to analyze"),
    # join options
    join_by: str = Form("code", description="code | name | point"),
    join_key: str | None = Form(None, description="required for join_by=code"),
    country_iso3: str | None = Form(None, description="recommended for ADM2"),
    country_col: str = Form("country"),
    state_col: str = Form("state"),
    county_col: str = Form("county"),
    lon_col: str = Form("lon"),
    lat_col: str = Form("lat"),
    # analysis options
    wtype: str = Form("queen"),
    k: int | None = Form(None),
    perm: int = Form(499),
    alpha: float = Form(0.05),
    simplify_tol: float | None = Form(0.01),
    cache: bool = True,
):
    """
    This function performs LISA analysis on the provided data and returns the results.
    Args:
        - file_id (required): ID of the CSV file to run LISA on
        - level (required): Spatial level for analysis 
            - adm0 -> Countries
            - adm1 -> State/Provinces
            - adm2 -> Counties/Districts
        - variable (required): Numeric column to analyze
            - Column must be numeric, preprocessing may be required if the column is not numeric
        - join_by: Method to join the data by:
            - Code: ISO3 naming format (e.g. "USA", "MYR", "SGD")
            - Name: Name of the region (e.g. "California", "Texas", "San Benito")
            - Point: Longitude and Latitude coordinates (e.g. "lon", "lat")
        - join_key (required if join_by = code): Key for joining the data
            - Column name to act as a join_key
        - country_iso3: ISO3 code for country (recommended for ADM2)
            - Acts as a pre-filter to speed up the join process by reducing the number of features to match based on the location of the data
        - country_col (required for adm0 and adm1): Name of the Country column in the CSV
        - state_col (required for adm1, optional for adm0): Name of the State column in the CSV
        - county_col (required for adm2): Name of the County column in the CSV
        - lon_col (required for join_by=point): Name of longitude column in the CSV
        - lat_col (required for join_by=point): Name of latitude column in the CSV
        - wtype (default="queen"): Type of weights to use.
            - queen: Includes all neighboring polygons (contiguity-based)
            - rook: Includes only shared borders (contiguity-based)
            - knn: Includes k-nearest neighbors (distance-based)
        - k (required if wtype=knn): Number of neighbors to consider
        - perm (default=499): Number of permutations for significance testing
        - alpha (default=0.05): Significance level for testing
        - simplify_tol: Douglas-Peucker tolerance in degrees to simplify polygons for speedup

    Raises:
        HTTPException: If the level is invalid.
        HTTPException: If the required columns are missing.
        HTTPException: If the CRS is not set.
        HTTPException: If the join fails.
        HTTPException: If the analysis fails.

    Returns:
        GeoJson: GeoJson of spatial analysis results

    """
    
    df = retrieve_csv_table(file_id)
    level = level.lower()
    if level not in GPKG_PATHS:
        raise HTTPException(400, detail="Invalid level, use adm0, adm1 or adm2")

    gdf = gpd.read_file(GPKG_PATHS[level])
    mapping = COLUMN_MAPPINGS[level]
    for req in ("code", "name", "alias"):
        if req not in mapping:
            raise HTTPException(500, detail=f"COLUMN_MAP[{level}] missing '{req}'")
    bcode, bname, alias = mapping["code"], mapping["name"], mapping["alias"]
    
    missing = None
    for char in (bcode, bname):
        if char not in gdf.columns:
            missing = char
    
    if missing:
        raise HTTPException(500, detail=f"{level} boundary missing columns: {missing}"
                            f"Found: {list(gdf.columns)}")
    gdf = gdf.rename(columns={bcode: "code", bname: "name"})

    if gdf.crs is None:
        gdf.set_crs(4326, inplace=True)
    else:
        gdf = gdf.to_crs(4326)
    gdf["geometry"] = gdf.geometry.buffer(0)

    # join user data onto polygons
    try:
        merged = join_layers(
            gdf=gdf, df=df, level=level, variable=variable,
            join_by=join_by, join_key=join_key, country_iso3=country_iso3,
            country_col=country_col, state_col=state_col, county_col=county_col,
            lon_col=lon_col, lat_col=lat_col
        )
    except ValueError as ve:
        raise HTTPException(400, detail=str(ve))

    # run Local Moran in an independent function
    try:
        result = local_moran(
            merged, variable,
            wtype=wtype, k=k, perm=perm, alpha=alpha
        )
    except ValueError as ve:
        raise HTTPException(400, detail=str(ve))

    # optional simplify for web payload
    if simplify_tol:
        result["geometry"] = result.geometry.simplify(simplify_tol, preserve_topology=True)

    # rename name -> alias (country/state/county) for output
    result = result.rename(columns={"name": alias})

    cols = ["code", alias, variable, "local_I", "p_value", "cluster_label", "geometry"]
    geojson = result[cols].to_json()
    geojson_obj = json.loads(geojson)
    if cache:
        upsert_cache(1, "lisa-latest.geojson", geojson_obj)
    return Response(content=geojson, media_type="application/geo+json")
    
@app.post("/forecast")
async def forecast(start: int = Form(2025, description="Starting year to begin forecasting from"), 
                    end: int = Form(2027, description="End year to stop forecasting at")):
    try:
        result = run_forecast(start_year= start, end_year=end)
        for i, obj in enumerate(result["per_year_frames"]):
            run_lisa_forecast(df=obj, year=result["years"][i])
        
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
    

# cache/1       

@app.get("/cache")
def get_cache():
    conn = psycopg2.connect(
        dbname="postgres", 
        user="postgres", 
        password="hanikodi4701!",
        host="localhost",
        port="5432"
    )
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT cache_name, cache_data FROM cache WHERE cache_id=%s
                """, 
                (1,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Cache not found")
            cache_name, cache_data = row
            return Response(content=json.dumps(cache_data), media_type="application/geo+json")
    except:
        return Response(content=None)
    finally:
        conn.close()


@app.get("/get_forecasted_asthma/{year}")
async def get_forecasted_asthma(year: int = Path(..., description="Year of the data")):
    conn = psycopg2.connect(
        dbname="postgres", 
        user="postgres", 
        password="hanikodi4701!",
        host="localhost",
        port="5432"
    )
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT asthmageo_name, asthmageo_data FROM asthma_geodata WHERE asthmageo_id=%s
                """, 
                (year,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Data not found")
            name, data = row
            return Response(content=json.dumps(data), media_type="application/geo+json")
    finally:
        conn.close()
        
@app.get("/list_asthma")
async def list_asthma_geodata():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT asthmageo_id, asthmageo_name FROM asthma_geodata")
        files = cur.fetchall()
        cur.close()
        conn.close()

        return [{"id": f[0], "Geodata Name": f[1]} for f in files]
    except Exception as e:
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
    conn = get_db_connection()
    cur = conn.cursor()
    try:
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
    conn = get_db_connection()
    cur = conn.cursor()
    try:

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
    conn = get_db_connection()
    cur = conn.cursor()
    try:

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

@app.get("/machine-learning/gradient-boosting")
def run_gradient_boosting_endpoint(target_variable: str = Query(..., description="Target variable for regression"),
    feature_variables: list = Query(..., description="List of feature variables"),
    file_id: int = Query(..., description="ID of the uploaded CSV file")):
    try:
        print(f"Running naive bayes with target: {target_variable}, features: {feature_variables}, file_id: {file_id}")
        data = retrieve_csv_table(file_id)
        res = run_gradient_boosting(
            data=data,
            feature_cols=feature_variables,
            target_col=target_variable
        )   
        return res
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/machine-learning/svr")
def run_svr_endpoint(target_variable: str = Query(..., description="Target variable for regression"),
    feature_variables: list = Query(..., description="List of feature variables"),
    file_id: int = Query(..., description="ID of the uploaded CSV file")):
    try:
        print(f"Running naive bayes with target: {target_variable}, features: {feature_variables}, file_id: {file_id}")
        data = retrieve_csv_table(file_id)
        res = run_svr_model(
            data=data,
            feature_cols=feature_variables,
            target_col=target_variable
        )   
        return res
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/machine-learning/extra-trees-regressor")
def run_extra_trees_regressor_endpoint(target_variable: str = Query(..., description="Target variable for regression"),
    feature_variables: list = Query(..., description="List of feature variables"),
    file_id: int = Query(..., description="ID of the uploaded CSV file"),
    n_estimators: int = Query(200, description="Number of trees in the Extra Trees Regressor (default=200)")
):
    try:
        print(f"Running Extra Trees Regressor with target: {target_variable}, features: {feature_variables}, file_id: {file_id}")
        data = retrieve_csv_table(file_id)
        res = run_extra_trees_regressor(
            data=data,
            feature_cols=feature_variables,
            target_col=target_variable,
            n_estimators=n_estimators
        )   
        return res

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/machine-learning/elastic-net")
def run_elastic_net_endpoint(
    target_variable: str = Query(..., description="Target variable for regression"),
    feature_variables: list = Query(..., description="List of feature variables"),
    file_id: int = Query(..., description="ID of the uploaded CSV file"),
    alpha: float = Query(1.0, description="Regularization strength (default=1.0)"),
    l1_ratio: float = Query(0.5, description="ElasticNet mixing parameter (0=Ridge, 1=Lasso)")
):
    try:
        print(f"Running Elastic Net with target: {target_variable}, features: {feature_variables}, file_id: {file_id}")
        data = retrieve_csv_table(file_id)
        res = run_elastic_net_regression(
            data=data,
            feature_cols=feature_variables,
            target_col=target_variable,
            alpha=alpha,
            l1_ratio=l1_ratio
        )
        return res

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# @app.get("/machine-learning/knn")
# def run_knn_endpoint(
#     target_variable: str = Query(..., description="Target variable for classification"),
#     feature_variables: list = Query(..., description="List of feature variables"),
#     file_id: int = Query(..., description="ID of the uploaded CSV file"),
#     n_neighbors: int = Query(5, description="Number of neighbors (default=5)")
# ):
#     try:
#         print(f"Running KNN with target: {target_variable}, features: {feature_variables}, file_id: {file_id}, k={n_neighbors}")
#         data = retrieve_csv_table(file_id)
#         res = run_knn_classifier(
#             data=data,
#             feature_cols=feature_variables,
#             target_col=target_variable,
#             n_neighbors=n_neighbors
#         )
#         return res

#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
    
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