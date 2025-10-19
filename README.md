# FYP4701

# Analyzing Respiratory Disease with Spatial Analysis and Machine Learning Platform

## Table of Contents

1. [Project Overview](#project-overview)
2. [Software Requirements](#software-requirements)
3. [Hardware Requirements](#hardware-requirements)
4. [Setup and Installation Instructions](#setup-and-installation-instructions)
5. [How to Run the Project](#how-to-run-the-project)
6. [Common Issues and Troubleshooting](#common-issues-and-troubleshooting)
7. [Contact Information](#contact-information)

## Project Overview

AsthmaAssist is an interactive spatial analytics platform for respiratory health research. The landing experience highlights:

- A configurable dashboard for comparing historic asthma prevalence against gas emissions, previewing choropleth legends, and running forecast scenarios.
- A data workspace that accepts CSV/XLSX uploads, provides instant previews, and keeps datasets stored securely in PostgreSQL.
- A no-code machine learning lab with nine prebuilt algorithms, guided feature/target selection, and inline performance reports.
- A spatial analysis studio that aligns datasets with ADM0/ADM1/ADM2 boundaries, builds Local Moran hotspot maps, and exports GeoJSON results.
- Productivity touches such as guided onboarding, explainable model outputs, collaboration-ready exports, and enterprise-grade access controls.

## Software Requirements

- Node.js
- React.js
- GeoPandas
- Pysal
- Fiona
- rtree
- Pandas
- Numpy
- Uvicorn
- FastAPI
- python-multipart
- scikit-learn
- matplotlib
- torch
- torch_geometric
- psycopg2
- dotenv
- PostgreSQL
- tested on Windows 11 and MacOS

## Hardware Requirements

- Requires a device which is able to connect to the internet and is able to run two separate terminals simultaneously.

## Setup and Installation Instructions

Front-end

1. Install the all the relavant dependency that is located in the software requirement.
2. Clone the applicaiton respository on to your device.
3. Open the main branch in the application's respository in your prefered IDE.
4. Change the directory to the `frontend` folder using `cd frontend` in a terminal.
5. Run `npm install` in the new terminal to download any other dependency.

Back-end

1. Open a new terminal at root directory.
2. Run `pip install -r requirements.txt`.
3. Create a `.env` file within the `backend` folder with contents:
   - `DB_NAME=postgres`
   - `DB_USER=postgres`
   - `DB_PASS=hanikodi4701!`
   - `DB_HOST=localhost`
   - `DB_PORT=5432`

Database

1. Install **PostgreSQL v18.0**: "https://www.postgresql.org".
2. Follow the setup instructions.
3. When prompted to input a **password**, input: `hanikodi4701!`
4. When prompted to input a **port**, input: `5432`

Connect PostgreSQL to VSCode

1. Install the VSCode extension `SQLTools` and `SQLTools PostgreSQL/Cockroach Driver`
2. In the `SQLTools` extension, add a new connection and select **PostgreSQL**
3. Set **Connection Name** to `postgres`
4. Set **Database Name** to `postgres`
5. Set **Username** to `postgres`
6. Press the **Test Connection** button and input `hanikodi4701!` as the password
7. Save the connection.

## How to Run the Project

Explain how to run the application or scripts, including any commands or parameters.
Front-end

1. Open the main branch in the application's respository in your prefered IDE.
2. Create a new terminal and change the directory to `frontend` folder: `cd frontend`
3. Run `npm run dev` in a new terminal and click the "http://localhost:3000" link to open the application.

Back-end

1. Open the main branch in the application's respository in your prefered IDE.
2. Download the three geopackages (ADM0, ADM1, ADM2) from https://www.geoboundaries.org/globalDownloads.html, rename them to `ADM0.gpkg`, `ADM1.gpkg`, and `ADM2.gpkg`, create a `geopackages` folder inside `backend`, and move the files there.
3. Run `main.py` at the root directory.
4. Before opening the application, call the `/fill_database` API (e.g. `curl http://localhost:8000/fill_database`) to seed the database. Allow at least 10 minutes for the data load to complete before proceeding.

## Common Issues and Troubleshooting

## Contact Information

| Name           | Email                       | Student ID |
| -------------- | --------------------------- | ---------- |
| Daryl Lim      | dlim0036@student.monash.edu | 33560757   |
| Hanideepu Kodi | hkod0003@student.monash.edu | 33560625   |
| Chong Jet Shen | jcho0161@student.monash.edu | 33517495   |
| Nicholas Yew   | nyew0001@student.monash.edu | 33642478   |
