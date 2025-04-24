from fastapi import FastAPI, UploadFile, File
import psycopg2
from datetime import datetime
from backend.moran_analysis import compute_morans_i

app = FastAPI()

def get_db_connection():
    return psycopg2.connect(
        dbname="FIT4701",
        user="postgres",
        password="hanikodi4701!",
        host="localhost",
        port="5432"
    )

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/moran")
async def run_moran():
    """
    Run Moran's I analysis on the specified variable.
    """
    try:
        shapefile_path = "shapefiles/CA_Counties.shp"
        result = compute_morans_i(shapefile_path, variable)
        return result
    except Exception as e:
        return {"status": "error", "error": e}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    contents = await file.read()
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO file (file_name, file_data, upload_date) VALUES (%s, %s, %s)",
        (file.filename, psycopg2.Binary(contents), datetime.now())
    )
    conn.commit()
    cur.close()
    conn.close()
    return {"status": "success", "filename": file.filename}
