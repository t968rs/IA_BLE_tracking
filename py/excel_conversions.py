import pandas as pd
import geopandas as gpd
import openpyxl


def read_excel_to_dict(file: str) -> dict:
    return pd.read_excel(file, sheet_name=None)


def read_excel_to_df(file: str, sheet_name: str) -> pd.DataFrame:
    return pd.read_excel(file, sheet_name=sheet_name)


def write_df_to_excel(df: pd.DataFrame, file: str, sheet_name: str):
    with pd.ExcelWriter(file) as writer:
        df.to_excel(writer, sheet_name=sheet_name)


def write_dict_to_excel(data: dict, file: str):
    with pd.ExcelWriter(file) as writer:
        for sheet, df in data.items():
            df.to_excel(writer, sheet_name=sheet)


def write_excel_to_df(file: str, sheet_name: str) -> pd.DataFrame:
    return pd.read_excel(file, sheet_name=sheet_name)


def update_geojson_with_dataframe(geojson_path, excel_path, common_column):
    # Read the GeoJSON file into a GeoDataFrame
    gdf = gpd.read_file(geojson_path)
    gdf[common_column] = gdf[common_column].astype("int8")

    # Read the Excel file into a DataFrame
    df = pd.read_excel(excel_path).drop(columns=['Unnamed: 0'])
    print(df.columns)
    df[common_column] = df[common_column].astype("int8")

    # Merge the GeoDataFrame and DataFrame on the common column
    merged_gdf = gdf.join(df, on=common_column, how='inner', rsuffix='_updated')
    print(f'Merged GDF: {merged_gdf.columns}')

    # Update the GeoDataFrame with the new values from the DataFrame
    for column in df.columns:
        print(F"{column}")
        if column != common_column:
            if f'{column}_updated' in merged_gdf.columns:
                merged_gdf[column] = merged_gdf[f'{column}_updated']
                merged_gdf.drop(columns=[f'{column}_updated'], inplace=True)

    # Write the updated GeoDataFrame back to a GeoJSON file
    for c in merged_gdf.columns:
        try:
            print(F"{c}: {merged_gdf[c].unique()}")
        except AttributeError:
            print(F"{c}: {merged_gdf[c]}")
    merged_gdf.to_file(geojson_path, driver='GeoJSON')


if __name__ == "__main__":
    # Example usage
    geojson_path = '../data/spatial/Iowa_BLE_Tracking.geojson'
    excel_path = '../data/spatial/Iowa_BLE_Tracking.xlsx'
    common_column = 'HUC8'  # Replace with the actual common column name
    update_geojson_with_dataframe(geojson_path, excel_path, common_column)
