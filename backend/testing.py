import geopandas as gpd
import pandas as pd

# Load the shapefile
gdf = gpd.read_file("backend/shapefiles/CA_Counties.shp")

# Preview the first few rows
print(gdf.head())

# Check the column names to find a column with county names
print(gdf.columns)

# Check the coordinate reference system (CRS)
print("CRS:", gdf.crs)

# Check how many unique counties
if 'COUNTY' in gdf.columns:
    print("Unique counties:", gdf['COUNTY'].nunique())
elif 'NAME' in gdf.columns:
    print("Unique counties:", gdf['NAME'].nunique())

# Plot a quick map to visually confirm
gdf.plot(figsize=(8, 10), edgecolor='black')

print("------------------------------")


asthma_df = pd.read_csv("data/current-asthma-prevalence-by-county-2015_2022.csv", encoding='cp1252')

# Filter for relevant columns
asthma_cleaned = asthma_df[['COUNTY', 'YEARS', 'AGE GROUP', 'CURRENT PREVALENCE']]

# Filter to keep only rows for the total population (or any other desired age group)
asthma_cleaned = asthma_cleaned[asthma_cleaned['AGE GROUP'] == 'All ages']

# Clean YEAR column (we can either use the full range like '2015–2016' or split it)
asthma_cleaned['YEARS'] = asthma_cleaned['YEARS'].str.split('-').str[0]  # Keeps the start year for simplicity

# Filter counties matching the shapefile
counties_in_shapefile = gdf['NAME'].unique()
asthma_cleaned = asthma_cleaned[asthma_cleaned['COUNTY'].isin(counties_in_shapefile)]

# Filter for 2015
asthma_2015 = asthma_cleaned[asthma_cleaned['YEARS'] == '2015']

# Ensure the county names match the shapefile for a successful merge
asthma_2015['COUNTY'] = asthma_2015['COUNTY'].str.strip().str.title()
gdf['NAME'] = gdf['NAME'].str.strip().str.title()

# Merge asthma data with shapefile
gdf_asthma = gdf.merge(asthma_2015, left_on='NAME', right_on='COUNTY')

# Convert prevalence to float (if needed)
gdf_asthma['CURRENT PREVALENCE'] = pd.to_numeric(gdf_asthma['CURRENT PREVALENCE'], errors='coerce')

# Drop rows with missing prevalence values
gdf_asthma = gdf_asthma.dropna(subset=['CURRENT PREVALENCE'])

# Check the merged GeoDataFrame
print(gdf_asthma[['NAME', 'CURRENT PREVALENCE']].head())


