import pandas as pd

# this is going to be hard coded for now

def load_data(path: str):
    df = pd.read_csv(path, encoding='latin1')
    return df
    
# drop all rows except when column is 'California'

def drop_row(df: pd.DataFrame, column: str = 'State Name', value: str = 'California') -> pd.DataFrame:
    return df[df[column] == value].reset_index(drop=True)

def drop_row_count(df: pd.DataFrame, column: str = 'Observation Count', threshold: int = 18) -> pd.DataFrame:
    return df[df[column] >= threshold].reset_index(drop=True)

def drop_columns(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    return df.drop(columns=columns, axis=1, errors='ignore')

def save_data(df: pd.DataFrame, path: str):
    df.to_csv(path, index=False, encoding='latin1')
    
def drop_empty_rows(df: pd.DataFrame) -> pd.DataFrame:
    return df.dropna(how='all').reset_index(drop=True)

def convert_to_datetime(df: pd.DataFrame, column: str = 'Date Local') -> pd.DataFrame:
    df[column] = pd.to_datetime(df[column], errors='coerce')
    return df

def clean_data():
    columns_to_drop = []
    path_str = "data/daily_ozone/daily_44201_"
    for i in range(2015, 2023):
        path = f"{path_str}{i}.csv"
        df = load_data(path)
        for column in df.columns:
            if column in ['State Name', 'County Name', 'Parameter Name', 'Observation Count', 'Arithmetic Mean', 'Date Local', 'AQI', 'Observation Percent', '1st Max Value', '1st Max Hour']:
                continue
            else:
                columns_to_drop.append(column)
        df = drop_columns(df, columns_to_drop)
        df = drop_row(df)
        #df = drop_row_count(df)
        df = drop_empty_rows(df)
        df = convert_to_datetime(df)
        save_data(df, f"data/cleaned_data/cleaned_ozone_{i}.csv")


def merge_data():
    var = 'ozone'
    cleaned_files = [f"data/cleaned_data/cleaned_{var}_{i}.csv" for i in range(2015, 2023)]
    dfs = [pd.read_csv(file, encoding='latin1') for file in cleaned_files]
    
    merged_df = pd.concat(dfs, ignore_index=True)
    merged_df = merged_df.drop_duplicates(subset=['County Name', 'Date Local'])
    
    # Save the merged data
    merged_df.to_csv(f"data/merged_data/merged_cleaned_{var}.csv", index=False, encoding='latin1')


def add_year_column(df: pd.DataFrame, date_col: str = 'Date Local') -> pd.DataFrame:
    df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
    df['Year'] = df[date_col].dt.year
    return df

def aggregate_by_county_year(df: pd.DataFrame, var: str) -> pd.DataFrame:
    return df.groupby(['County Name', 'Year'])['Arithmetic Mean'].mean().reset_index().rename(columns={'Arithmetic Mean': f'Avg {var}'})



def combine_data(asthma_df: pd.DataFrame, df: pd.DataFrame):
    # Standardize column names
    asthma_df = asthma_df.rename(columns={'COUNTY': 'County Name', 'YEARS': 'Year'})
    # Ensure 'Year' is int in both
    asthma_df['Year'] = asthma_df['Year'].astype(int)
    return pd.merge(asthma_df, df, on=['County Name', 'Year'], how='inner')



# merge all cleaned data into one file on column named 'county name'

