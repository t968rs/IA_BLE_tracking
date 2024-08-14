import os
import geopandas as gpd
import json
import pandas as pd


def process_date(x):
    from datetime import datetime
    try:
        # Try to parse the date to check if it's a valid datetime
        dt = datetime.fromisoformat(str(x))
        return dt.strftime('%Y/%m/%d')
    except ValueError:
        return x

def read_json_to_dict(file: str) -> dict:
    with open(file, 'r') as f:
        return json.load(f)


def add_numbered_primary_key(gdf, col_name):
    if col_name not in gdf.columns:
        gdf[col_name] = range(1, len(gdf) + 1)
    else:
        current_max_id = gdf[col_name].max(skipna=True)
        new_id = current_max_id + 1 if not pd.isna(current_max_id) else 1
        for idx, row in gdf.iterrows():
            if pd.isna(row[col_name]):
                gdf.at[idx, col_name] = new_id
                new_id += 1
    return gdf


column_mapping = {"Iowa_BLE_Tracking": {"huc8": "HUC8", "which_grid": "which_grid", "name": "Name", "Name HUC8": None,
                                        "has_AECOM": "Has AECOM Tie"}}

column_orders = {"Iowa_BLE_Tracking": {"first": ['huc8', 'which_grid', "name", "PBL_Assign", "Phase_1_Su"],
                                       "last": ['geometry']}, }


def remove_time_from_date_columns(gdf):

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
            print(f"Converting {col} to string")
            gdf[col] = gdf[col].astype(str)
            gdf[col] = gdf[col].apply(process_date)

    return gdf


def reorder_gdf_columns(gdf, first_columns, last_columns=None):
    if last_columns is None:
        last_columns = []

    # Columns that are not in first_columns or last_columns
    middle_columns = [col for col in gdf.columns if col not in first_columns and col not in last_columns]

    # New column order
    new_column_order = first_columns + middle_columns + last_columns

    # Reorder the columns in the GeoDataFrame
    gdf = gdf[new_column_order]

    return gdf


def gdf_to_geojson(gdf, out_loc, filename=None):
    driver = "GeoJSON"
    outpath = out_loc + f"{filename}.geojson"
    os.makedirs(out_loc, exist_ok=True)
    gdf.to_file(filename=outpath, driver=driver)
    df = pd.DataFrame(gdf.drop(columns='geometry'))

    outpath_table = out_loc + filename + ".json"
    dicted = df.to_dict(orient='index')
    with open(outpath_table, 'w') as f:
        json.dump(dicted, f)
    print(f"Saved {filename} to {outpath}")
    print(f"Columns: {gdf.columns.to_list()}")


class WriteNewGeoJSON:
    def __init__(self):
        self.server_path = os.path.split(__file__)[0]
        self.esri_folder = "../data/esri_exports/"
        self.output_folder = "../data/spatial/"

        self.esri_files = {}
        self.gdf_dict = {}

        self.crs_dict = {}
        self.c_lists = {}

        for v in vars(self):
            var_value = getattr(self, v)
            if var_value is not None:
                if isinstance(var_value, dict):
                    pass
                else:
                    print(f' {v}: {getattr(self, v)}')
        self._init_gdf_from_fc()

    def _init_gdf_from_fc(self):
        # Read Polygon fc
        with os.scandir(self.esri_folder) as entries:
            for entry in entries:
                if entry.is_file():
                    if ".shp" in entry.name:
                        if "xml" not in entry.name and ".lock" not in entry.name:
                            base, filename = os.path.split(entry.path)
                            if "." in filename:
                                name = filename.split(".")[0]
                            else:
                                name = filename
                            print(f'   Name: {name} \n   Filename: {filename}\n')
                            self.esri_files[name] = entry.path

        for fname, path, in self.esri_files.items():
            if ".gdb" in base:
                # print(fiona.listlayers(gdb))
                gdf = gpd.read_file(base, driver='FileGDB', layer=fname)
            else:
                gdf = gpd.read_file(path)

            self.crs_dict[fname] = gdf.crs
            gdf = gdf.explode(ignore_index=True)
            gdf = add_numbered_primary_key(gdf, 'loc_id')
            if fname in column_orders:
                gdf = reorder_gdf_columns(gdf, column_orders[fname]["first"], column_orders[fname]["last"])

            # Fix* times
            time_cs = [c for c in gdf.columns if gdf[c].astype(str).str.contains('T').any()]
            print(f"Time columns: {time_cs}")
            gdf = remove_time_from_date_columns(gdf)
            gdf = gdf.to_crs(epsg=4326)
            self.c_lists[fname] = [c for c in gdf.columns.to_list()]
            print(f'   {fname} Input Columns: {self.c_lists[fname]}, \n   CRS: {self.crs_dict[fname]}')
            self.gdf_dict[fname] = gdf

    def export_geojsons(self, cname_to_summarize=None):
        print(f'{self.gdf_dict.keys()}')
        for name, gdf in self.gdf_dict.items():
            print(f"Found {name}")
            if cname_to_summarize is not None and cname_to_summarize in gdf.columns:
                unique_names = gdf[cname_to_summarize].unique()
                print(f"Unique {cname_to_summarize} values: {[u for u in unique_names if u]}")
                print(f'   Plus, {None if None in unique_names else "No None"}  values')
                gdf_to_geojson(gdf, self.output_folder, name)
            else:
                print(f"{cname_to_summarize} not in {name} columns")


cname = "which_grid"
to_gdf = WriteNewGeoJSON()
to_gdf.export_geojsons(cname)
