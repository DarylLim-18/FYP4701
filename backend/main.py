from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Path, Form, Response
from fastapi.middleware.cors import CORSMiddleware
import fiona
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
from numpy.typing import NDArray
import io, json, os, unicodedata
from pathlib import Path as pt


# Import Machine Learning functions
from backend.linear_regression import run_linear_regression
from backend.random_forest import run_rf_model
from backend.logistic_regression import run_logistic_regression
from backend.naive_bayes import run_naive_bayes
from backend.asthma_arthimetic_mean import preprocess_gas_data
from backend.gradient_boosting import run_gradient_boosting
from backend.svr import run_svr_model
from backend.extra_trees import run_extra_trees_regressor
from backend.elastic_net import run_elastic_net_regression
from backend.kNN import run_knn_classifier
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
current_df = current_df.drop('COUNTIES GROUPED', axis=1, errors='ignore')
current_df = current_df.drop('COMMENT', axis=1, errors='ignore')
current_df['COUNTY'] = current_df['COUNTY'].str.strip().str.title()
    
        
# Merge function
def get_asthma_geodata(dataset: DataFrame,  year: str, target: str = "LIFETIME PREVALENCE"):
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
    w.transform = 'R' # pyright: ignore[reportAttributeAccessIssue]

    ser = pd.to_numeric(gdf[variable], errors="coerce")
    ser = ser.replace([np.inf, -np.inf], np.nan)
    x: NDArray[np.float64] = np.nan_to_num(ser.to_numpy(dtype=float), nan=0.0)

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
        
    os.makedirs("frontend/public/geojsons", exist_ok=True)

    with open(f"frontend/public/geojsons/{name}-{year}.geojson", "w") as f:
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
    country_col: str = "country",
    state_col: str = "state",
    county_col: str = "county",
    lon_col: str = "lon",
    lat_col: str = "lat",
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
        merged_curr = get_asthma_geodata(current_df, year, "CURRENT PREVALENCE")
        compute_morans_i_local(merged_curr, 'CURRENT PREVALENCE', year)
        merged_life = get_asthma_geodata(lifetime_df, year, "LIFETIME PREVALENCE")
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
    perm: int = Form(999),
    alpha: float = Form(0.05),
    simplify_tol: float | None = Form(0.01),
):
    
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
        print(char)
        print(gdf.columns)
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
    
    output_pt = pt(f"frontend/public/geojsons/lisa-{file_id}.geojson")
    output_pt.parent.mkdir(parents=True, exist_ok=True)
    output_pt.write_text(geojson, encoding="utf-8")
    
    return Response(content=geojson, media_type="application/geo+json")
    
# @app.get("/moran_local")
# async def run_moran_local(variable: str = Query(..., description="Variable for Moran's I analysis"), year: str = Query(..., description="Year for asthma data")):
#     """
#     Run Local Moran's I analysis on the specified variable.
#     """
#     try:
#         merged = get_asthma_geodata(year=year, target=variable)
#         result = compute_morans_i_local(merged, variable, year)
#         return JSONResponse(content=result)
    
#     except ValueError as e:
#         raise HTTPException(status_code=400, detail=str(e))
    
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))
    
@app.get("/moran_local/{file_id}")
async def run_moran_local(variable: str = Query(..., description="Variable for Moran's I analysis"), year: str = Query(..., description="Year for asthma data"), file_id: int = Path(..., description="ID of the uploaded CSV file")):
    """
    Run Local Moran's I analysis on the specified variable.
    """
    try:
        file = retrieve_csv_table(file_id)
        merged = get_asthma_geodata(file, year, variable)
        result = compute_morans_i_local(merged, variable, year)
        return JSONResponse(content=result)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get("/testing")
async def test_endpoint():
    # List all layers inside the .gpkg
    path = GPKG_PATHS["adm0"]
    print("Layers:", fiona.listlayers(path))

    # Open a specific layer and see columns, dtypes, sample rows, CRS
    layer = fiona.listlayers(path)[0]  # or the exact layer name
    gdf = gpd.read_file(path, layer=layer)

    print("Columns:", list(gdf.columns))
    print("\nDtypes:\n", gdf.dtypes)
    print("\nCRS:", gdf.crs)
    print("\nFirst 5 rows:\n", gdf.head())

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
    file_id: int = Query(..., description="ID of the uploaded CSV file")
):
    try:
        print(f"Running Extra Trees Regressor with target: {target_variable}, features: {feature_variables}, file_id: {file_id}")
        data = retrieve_csv_table(file_id)
        res = run_extra_trees_regressor(
            data=data,
            feature_cols=feature_variables,
            target_col=target_variable
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
    
@app.get("/machine-learning/knn")
def run_knn_endpoint(
    target_variable: str = Query(..., description="Target variable for classification"),
    feature_variables: list = Query(..., description="List of feature variables"),
    file_id: int = Query(..., description="ID of the uploaded CSV file"),
    n_neighbors: int = Query(5, description="Number of neighbors (default=5)")
):
    try:
        print(f"Running KNN with target: {target_variable}, features: {feature_variables}, file_id: {file_id}, k={n_neighbors}")
        data = retrieve_csv_table(file_id)
        res = run_knn_classifier(
            data=data,
            feature_cols=feature_variables,
            target_col=target_variable,
            n_neighbors=n_neighbors
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