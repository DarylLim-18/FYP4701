from fastapi import FastAPI, UploadFile, File, HTTPException
import psycopg2
from psycopg2 import sql
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
    try:
        # Read the contents of the uploaded file
        contents = await file.read()

        # Connect to PostgreSQL
        conn = psycopg2.connect(
            dbname="FIT4701",
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
