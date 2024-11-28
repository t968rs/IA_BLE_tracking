import json
import os
import toml
from typing import Tuple, Union
import geopandas as gpd
import pandas as pd
import datetime


class StatusTableManager:
    """Class to manage the metadata and formatting of a status table."""

    def __init__(self, metadata_file):
        self.metadata_file = metadata_file
        self.metadata = None

    def __enter__(self):
        """Load the metadata file when entering the context."""
        with open(self.metadata_file, 'r') as f:
            self.metadata = json.load(f)
        return self  # Return the instance to use in the context block

    def __exit__(self, exc_type, exc_value, traceback):
        """Clean up when exiting the context (if necessary)."""
        self._write_toml()  # Write the metadata back to the TOML file
        self.metadata = None  # Clear metadata from memory
        # Optional: Handle exceptions here if needed
        if exc_type:
            print(f"An exception of type {exc_type} occurred: {exc_value}")
        return False  # Returning False will propagate the exception, True will suppress it

    def _write_toml(self):
        json_to_toml(self.metadata_file)

    def get_column_names(self, target_format):
        """Get column names for a specific format."""
        return {key: value.get(target_format) for key, value in
                self.metadata["columns"].items()}

    def rename_columns(self, df, target_format, current_format):
        """
        Rename columns of a DataFrame from current_format to target_format.

        Args:
            df (pd.DataFrame): The input DataFrame.
            target_format (str): The desired output format (e.g., 'geojson', 'excel', 'shapefile').
            current_format (str): The current format of the input DataFrame.

        Returns:
            pd.DataFrame: The DataFrame with renamed columns.
        """
        # Reverse lookup to get universal keys from current column names
        reverse_map = {v[current_format]: k for k, v in self.metadata["columns"].items() if current_format in v}

        # Map current column names to universal keys
        universal_columns = {reverse_map.get(col, col): col for col in df.columns}

        # Map universal keys to target column names
        column_map = {key: self.metadata["columns"][key][target_format] for key in universal_columns if
                      key in self.metadata["columns"]}

        # Rename the DataFrame columns
        df = df.rename(columns={universal_columns[key]: column_map[key] for key in column_map})

        # Ensure all target columns are present, even if missing in input
        for key, target_col in column_map.items():
            if target_col not in df.columns:
                df[target_col] = None  # Default value for missing columns

        # Reorder columns to match the target format
        target_columns = [self.metadata["columns"][key][target_format] for key in self.metadata["columns"] if
                          target_format in self.metadata["columns"][key]]
        return df[[col for col in target_columns if col in df.columns]]

    def sort_rows(self, df):
        """Sort rows of a DataFrame by a specific column."""
        for col in self.metadata.get("sort_order", []):
            if col in df.columns:
                df = df.sort_values(by=col)
        return df

    def enforce_types(self, df, current_format="geojson"):
        """Enforce column data types based on metadata and current column names."""
        # Map current column names to metadata names
        column_map = {v[current_format]: k for k, v in self.metadata["columns"].items()}
        for current_col, metadata_col in column_map.items():
            if current_col in df.columns:  # Check if the column exists in the DataFrame
                dtype = self.metadata["columns"][metadata_col].get("dtype")
                if dtype == "date":
                    # Convert to date format without times
                    df[current_col] = pd.to_datetime(df[current_col], errors="coerce").dt.date
                elif dtype == "string":
                    df[current_col] = df[current_col].astype(str)
                # Add other type conversions as needed
        return df


def df_to_excel(df: pd.DataFrame, out_loc: str, filename=None, sheetname="Sheet1"):

    value_sheetname = sheetname + "_values"

    print(f"\nExcel Stuff for {filename}")
    if filename is None:
        filename = "output"
    outpath = os.path.join(out_loc, f"{filename}.xlsx") if ".xlsx" not in filename else os.path.join(out_loc, filename)
    os.makedirs(out_loc, exist_ok=True)

    if isinstance(df, gpd.GeoDataFrame) or "geometry" in df.columns:
        df = pd.DataFrame(df.drop(columns=['geometry']))

    for c in df.columns:
        if "legend" in c.lower():
            df.drop(columns=c, inplace=True)

    # Check existing sheets for target and value sheets
    if os.path.exists(outpath):
        try:
            with pd.ExcelFile(outpath, engine="openpyxl") as reader:
                sheets = reader.sheet_names
                print(f" Sheet Names: {sheets}")
        except KeyError:
            os.remove(outpath)

    # Open the Excel file in append mode or create a new one
    with pd.ExcelWriter(outpath, engine="openpyxl", mode="w") as writer:
        if value_sheetname:
            # Ensure the target sheet exists and delete it safely
            if value_sheetname in writer.book.sheetnames:
                if len(writer.book.sheetnames) > 1:
                    writer.book.remove(writer.book[value_sheetname])
                else:
                    raise ValueError("Cannot delete the only visible sheet in the workbook.")
            df.to_excel(writer, index=False, sheet_name=value_sheetname)

        # Ensure at least one sheet is active and visible
        if writer.book.sheetnames:
            writer.book.active = 0  # Set the first sheet as active
            writer.book[writer.book.sheetnames[0]].sheet_state = "visible"

        if sheetname in writer.book.sheetnames:
            writer.book.remove(writer.book[sheetname])
        df.to_excel(writer, index=False, sheet_name=sheetname)


def df_to_json(data, out_loc: str, filename: str = None):
    if isinstance(data, gpd.GeoDataFrame):
        df = pd.DataFrame(data.drop(columns='geometry'))
    elif isinstance(data, pd.DataFrame):
        df = data
    else:
        raise ValueError("Data must be a GeoDataFrame or DataFrame")

    if ".json" in out_loc:
        out_loc, file = os.path.split(out_loc)
        filename, ext = os.path.splitext(file)
    outpath_table = os.path.normpath(os.path.join(out_loc, filename + ".json"))

    # Convert Timestamp and date objects to strings
    dicted = df.to_dict(orient='records')

    with open(outpath_table, 'w') as f:
        json.dump(dicted, f, indent=2)


def gdf_to_geojson(gdf: gpd.GeoDataFrame, out_loc, filename=None):
    if not isinstance(gdf, gpd.GeoDataFrame):
        if isinstance(gdf, gpd.GeoSeries):
            gdf = gpd.GeoDataFrame(geometry=gdf)
        print(f"Data type: {type(gdf)}")
        raise ValueError("Data must be a GeoDataFrame")
    driver = "GeoJSON"
    outpath = out_loc + f"{filename}.geojson"
    os.makedirs(out_loc, exist_ok=True)
    gdf.to_file(filename=outpath, driver=driver)

    print(f"Saved {filename} to {outpath}")
    print(f"Columns: {gdf.columns.to_list()}")


def gdf_to_shapefile(gdf: gpd.GeoDataFrame, out_loc):
    """
    Save a GeoDataFrame to a shapefile
    :param gdf:
    :param out_loc:
    :return:
    """

    if not isinstance(gdf, gpd.GeoDataFrame):
        if isinstance(gdf, gpd.GeoSeries):
            gdf = gpd.GeoDataFrame(geometry=gdf)
        print(f"Data type: {type(gdf)}")
        raise ValueError("Data must be a GeoDataFrame")

    driver = "ESRI Shapefile"

    if ".shp" in out_loc:
        outpath = out_loc
        out_loc, filename = os.path.split(out_loc)
    else:
        filename = "OUTPUT_FILE.shp"
        outpath = out_loc + f"OUTPUT_FILE.shp"
    os.makedirs(out_loc, exist_ok=True)
    gdf.to_file(outpath, driver=driver)

    print(f"Saved {filename} to {outpath}")


def json_to_toml(input_json: Union[json, str], toml_file: str = None
                 ) -> Tuple[dict, str]:
    """
    Convert a JSON file to a TOML file
    :param input_json:
    :param toml_file:
    :return: json data, toml file path
    """
    if isinstance(input_json, str):
        with open(input_json, "r") as jf:
            data = json.load(jf)
    else:
        if not toml_file:
            raise ValueError("Must give output TOML file path")
        data = input_json

    # Export to TOML
    if not toml_file:
        toml_file = input_json.replace(".json", ".toml")
    with open(toml_file, "w") as tf:
        toml.dump(data, tf)

    return data, toml_file


def toml_to_json(toml_file: str, json_file: str = None
                 ) -> Tuple[dict, str]:
    """
    Convert a TOML file to a JSON file
    :param toml_file:
    :param json_file:
    :return: json data, json file path
    """
    with open(toml_file, "r") as tf:
        data = toml.load(tf)

    # Export to JSON
    if not json_file:
        json_file = toml_file.replace(".toml", ".json")
    with open(json_file, "w") as jf:
        json.dump(data, jf, indent=2)

    return data, json_file
