import pandas as pd
import numpy as np


def process_date(x):
    from datetime import datetime
    try:
        # Try to parse the date to check if it's a valid datetime
        dt = datetime.fromisoformat(str(x))
        new_date = dt.strftime('%Y/%m/%d')

        # Check for 0s
        number_contents = [c for c in new_date if c.isnumeric()]
        number_contents = list(set(number_contents))
        if len(number_contents) == 1 and number_contents[0] == "0":
            return ""

        return new_date
    except ValueError:
        return x


def look_for_duplicates(gdf, column):
    duplicates = gdf[gdf.duplicated(subset=column, keep=False)]
    # print(f" \nDuplicates in {column}: \n  {duplicates}\n")
    return duplicates


def filter_gdf_by_column(gdf, column, value):
    return gdf[gdf[column].fillna("").str.contains(value, case=False)]


def format_dates(gdf):
    """
    Remove the time part from date columns in a GeoDataFrame.

    Parameters:
    gdf (GeoDataFrame): The GeoDataFrame whose date columns need to be processed.
    date_columns (list): A list of column names that contain date strings with a "T".

    Returns:
    GeoDataFrame: The GeoDataFrame with modified date columns.
    """
    # Convert Timestamp objects to strings
    for col in gdf.columns:
        if pd.api.types.is_datetime64_any_dtype(gdf[col]):
            print(f"\t\tConverting {col} to string")
            gdf[col] = gdf[col].astype(str)
            gdf[col] = gdf[col].apply(process_date)
            gdf[col] = gdf[col].str.replace("0000/00/00", "")
    gdf = gdf.replace("0000/00/00", "")

    return gdf


def summarize_column(gdf, column):
    if column in gdf.columns:
        unique_names = gdf[column].unique()
        print(f"Unique {column} values: {[u for u in unique_names]}")
        print(f'   Plus, {None if None in unique_names else "No-NULL"}  values')


def reorder_df_columns(df, renamer_dict):
    # Target column order
    target_columns = list(renamer_dict.values())

    # Drop columns not in the renamer_dict
    df = df[[col for col in df.columns if col in renamer_dict]]

    # Rename columns
    df = df.rename(columns=renamer_dict)

    # Reorder columns based on the target order
    df = df[target_columns]

    return df


def define_one_by_another(df: pd.DataFrame,
                          column1, column2,
                          condition,
                          new_value):
    if column1 in df.columns and column2 in df.columns:
        df[column1] = np.where(df[column2] == condition, new_value, df[column1])
    return df


def sort_df_by(df, column):
    if column in df.columns:
        df = df.sort_values(by=column)
    return df


def reorder_gdf_columns(gdf, first_columns, last_columns=None):
    if last_columns is None:
        last_columns = []

    # Columns that are not in first_columns or last_columns
    middle_columns = [col for col in gdf.columns if col not in first_columns and col not in last_columns]

    # New column order
    first_columns = [col for col in first_columns if col in gdf.columns]
    last_columns = [col for col in last_columns if col in gdf.columns]
    new_column_order = first_columns + middle_columns + last_columns

    # Reorder the columns in the GeoDataFrame
    gdf = gdf[new_column_order]

    return gdf
