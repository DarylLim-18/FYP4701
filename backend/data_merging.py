import pandas as pd

def load_data(asthma_path: str, gas_path: str) -> tuple:
    asthma_df = pd.read_csv(asthma_path)
    gas_df = pd.read_csv(gas_path)
    return asthma_df, gas_df

def add_year_column(df: pd.DataFrame, date_col: str = 'Date Local') -> pd.DataFrame:
    df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
    df['Year'] = df[date_col].dt.year
    return df

def aggregate_gas_by_county_year(df: pd.DataFrame, var: str, value_col: str = 'Arithmetic Mean') -> pd.DataFrame:
    return (
        df.groupby(['County Name', 'Year'])[value_col]
        .mean()
        .reset_index()
        .rename(columns={value_col: f'Avg {var.upper()}'})
    )

def clean_asthma_df(asthma_df: pd.DataFrame, county_col: str = 'COUNTY', year_col: str = 'YEARS') -> pd.DataFrame:
    asthma_df = asthma_df.rename(columns={county_col: 'County Name', year_col: 'Year'})
    asthma_df['Year'] = asthma_df['Year'].astype(str).str.extract(r'(\d{4})').astype(int)
    return asthma_df

def merge_asthma_gas(asthma_df: pd.DataFrame, gas_df: pd.DataFrame) -> pd.DataFrame:
    return pd.merge(asthma_df, gas_df, on=['County Name', 'Year'], how='inner')

def drop_missing_prevalence(df: pd.DataFrame, col: str = 'LIFETIME PREVALENCE') -> pd.DataFrame:
    return df.dropna(subset=[col]).reset_index(drop=True)

def process_asthma_gas_data(var, asthma_path: str, gas_path: str,output_path: str = None) -> pd.DataFrame:
    asthma_df, gas_df = load_data(asthma_path, gas_path)
    gas_df = add_year_column(gas_df)
    gas_agg = aggregate_gas_by_county_year(gas_df, var)
    asthma_cleaned = clean_asthma_df(asthma_df)
    merged_df = merge_asthma_gas(asthma_cleaned, gas_agg)
    final_df = drop_missing_prevalence(merged_df)
    
    if output_path:
        final_df.to_csv(output_path, index=False) 
        print(f"Saved cleaned merged data to: {output_path}")
    
    return final_df

var = 'so2'
df = process_asthma_gas_data(
    var,
    asthma_path="data/lifetime-asthma-prevalence-by-county-2015_2022.csv",
    gas_path=f"data/merged_data/merged_cleaned_{var}.csv",
    output_path=f"data/merged_data/cleaned_merged_asthma_{var}.csv"
)
