import pandas as pd
import os

def preprocess_gas_data(
    folder="data/merged_data",
    gases=["co", "no2", "ozone", "pm2.5", "pm10", "so2"],
    start_year=2015,
    end_year=2022,
):
    """
    Preprocesses air quality data for the specified gases and years.

    Returns:
        county_year_means: dict of DataFrames (gas -> DataFrame with columns: County Name, Year, Mean)
        yearly_stats: dict of DataFrames (gas -> DataFrame with columns: Year, Min, Max, Mean, Std)
    """
    county_year_means = {}
    yearly_stats = {}

    for gas in gases:
        # Compose file path
        path = os.path.join(folder, f"merged_cleaned_{gas}.csv")
        df = pd.read_csv(path, encoding="utf-8")

        # Clean columns
        df["County Name"] = df["County Name"].str.strip().str.title()
        df["Date Local"] = pd.to_datetime(df["Date Local"], errors='coerce')
        df["Year"] = df["Date Local"].dt.year

        # Filter by year range
        df = df[df["Year"].between(start_year, end_year)]

        # Remove rows with missing required data
        df = df.dropna(subset=["Arithmetic Mean", "County Name", "Year"])

        # Compute county-year means (for plotting)
        mean_df = (
            df.groupby(["County Name", "Year"])["Arithmetic Mean"]
            .mean()
            .reset_index()
            .rename(columns={"Arithmetic Mean": "Mean"})
        )
        county_year_means[gas] = mean_df

        #Compute yearly stats
        stats_df = (
            df.groupby("Year")["Arithmetic Mean"]
            .agg(["min", "max", "mean", "std"])
            .reset_index()
            .rename(columns={
                "min": "Minimum",
                "max": "Maximum",
                "mean": "Mean",
                "std": "Standard Deviation"
            })
        )
        yearly_stats[gas] = stats_df

    return county_year_means, yearly_stats

if __name__ == "__main__":
    county_year_means, yearly_stats = preprocess_gas_data()

    import matplotlib.pyplot as plt

    for gas in county_year_means:
        # --- Plot ---
        df = county_year_means[gas]
        plot_df = df.pivot(index="County Name", columns="Year", values="Mean")
        plot_df.plot(kind="bar", figsize=(14, 6))
        plt.title(f"{gas.upper()} Average Arithmetic Mean by County (2015–2022)")
        plt.ylabel("Arithmetic Mean")
        plt.xlabel("County Name")
        plt.legend(title="Year")
        plt.tight_layout()
        plt.show()
        
        # --- Print table ---
        print(f"\nYearly summary stats for {gas.upper()}:")
        print(yearly_stats[gas].to_string(index=False, float_format="{:.3f}".format))
        

