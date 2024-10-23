import os
import geopandas as gpd
import json
import pandas as pd
import warnings
import typing as T
from shapely.geometry import Polygon, Point
from shapely.lib import unary_union
from shapely.ops import nearest_points

import pyproj


def get_utm_zone(gdf):
    # Get UTM area

    # Get input CRS and bounding box
    input_crs = gdf.crs
    bbox = gdf.total_bounds.tolist()
    extent_gdf = bbox_to_gdf(bbox, input_crs)

    east_lon_degree, north_lat_degree, south_lat_degree, west_lon_degree = bbox
    aoi = pyproj.aoi.AreaOfInterest(east_lon_degree, north_lat_degree, south_lat_degree, west_lon_degree)
    # print(f"  AOI: {aoi}")
    utm_list = pyproj.database.query_utm_crs_info("WGS 84", aoi)

    areas_lookup = {}
    for utm in utm_list:
        utm_crs = pyproj.CRS.from_epsg(utm.code)
        utm_aoi = utm.area_of_use
        aoi_bounds = utm_aoi.bounds
        utm_gdf = bbox_to_gdf(aoi_bounds, input_crs)

        # Get area of intersection
        # extent_gdf_convert = extent_gdf.to_crs(epsg=utm.code)
        intsct_area = extent_gdf.intersection(utm_gdf)
        # Check if intersection is valid and not empty
        if not intsct_area.is_empty.any():
            # print(f"  Intsct Units: {intersect_units}")
            total_area = intsct_area.geometry.to_crs(utm_crs).area.sum()
            # print(f"  Intsct Area: {total_area}")
            areas_lookup[utm.code] = total_area

    max_area = max(areas_lookup, key=areas_lookup.get)
    # print(f"  UTM Area: {max_area}")
    return max_area


def bbox_to_gdf(bbox_tuple, crs, name_str=None, outfolder=None) -> gpd.GeoDataFrame:
    # function to return polygon
    # long0, lat0, lat1, long1
    west, south, east, north = bbox_tuple
    vertices = [
        (west, south),
        (east, south),
        (east, north),
        (west, north),
        (west, south)]  # Closing the polygon by repeating the first vertex
    polygon = Polygon(vertices)

    gdf = gpd.GeoDataFrame(geometry=[polygon], crs=crs)

    gdf = gdf.buffer(0)
    gdf = gdf[~gdf.is_empty]  # Step 2: Delete Null Geometry
    gdf = gdf.explode(index_parts=False)
    gdf.reset_index(drop=True, inplace=True)  # Optionally, reset index
    if outfolder is not None and name_str is not None:
        outpath = os.path.join(outfolder, f"box_test_{name_str}.shp")
        gdf.to_file(outpath)
    print(f'\n  Created pg from bounds')

    return gdf


def get_label_point(gdf, position=None, buffer_distance=None):
    mipcase = gdf['MIP_Case'].iloc[0]
    if not position:
        position = "top_center"
    if not buffer_distance:
        buffer_distance = 0

    input_crs = gdf.crs
    input_units = input_crs.axis_info[0].unit_name
    if input_crs.is_geographic or input_units != "metre":
        utm_crs = get_utm_zone(gdf)
        gdf = gdf.to_crs(epsg=utm_crs)
        print(f'\t\t85 Converted CRS to {gdf.crs}')
    else:
        utm_crs = gdf.crs

    # convex hull
    ch = gdf.geometry.convex_hull
    ch = ch.buffer(-1 * buffer_distance)
    gdf_temp = gpd.GeoDataFrame(geometry=ch, crs=utm_crs)
    outfile = f"./test/convex_hull_{mipcase}.shp"
    os.makedirs(os.path.split(outfile)[0], exist_ok=True)
    gdf_temp.to_file(outfile)

    # Get the bounds of the convex hull
    min_x, min_y, max_x, max_y = ch.total_bounds
    print(f'\t\tBounds: {min_x, min_y, max_x, max_y}')

    # Create points for each bounds location
    positions = {"bottom_left": Point(min_x, min_y),
                 "bottom_right": Point(max_x, min_y),
                 "top_left": Point(min_x, max_y),
                 "top_right": Point(max_x, max_y),
                 "top_center": Point((max_x - min_x) / 2, max_y),
                 "bottom_center": Point((max_x - min_x) / 2, min_y),
                 "left_center": Point(min_x, (max_y - min_y) / 2),
                 "right_center": Point(max_x, (max_y - min_y) / 2)}

    # Initialize variables to track the closest point and minimum distance
    input_point = positions[position]
    pg_geo = unary_union(ch)
    print(f'\t\tInput Point: {input_point},\n\t\tType: {type(input_point)}')
    print(f'\t\tPG Geo: {pg_geo}')

    # Find nearest point
    nearest_point = nearest_points(input_point, pg_geo)[1].buffer(buffer_distance / 2).iloc[0]

    print(f'\t\tNearest Point: {nearest_point},\n\t\tType: {type(nearest_point)}')

    if utm_crs != input_crs:
        pt_gdf = gpd.GeoDataFrame(geometry=[nearest_point], crs=utm_crs)
        pt_gdf = pt_gdf.to_crs(input_crs)
        nearest_point = pt_gdf.geometry.iloc[0]
        print(f'\t\t91 Converted back to {pt_gdf.crs}')

    return nearest_point


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


def read_json_to_dict(file: str) -> dict:
    with open(file, 'r') as f:
        return json.load(f)


def excel_warn_checker(path: str) -> bool:
    """Load data from an Excel file and checks for warnings"""
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter('always', UserWarning)
        pd.ExcelFile(path)
        return len(w) > 0


def get_centroids(gdf):
    points = gdf.geometry.representative_point()
    new_gdf = gdf.drop(columns='geometry')
    new_gdf['geometry'] = points
    new_gdf = gpd.GeoDataFrame(new_gdf, geometry='geometry', crs=gdf.crs)
    return new_gdf


def look_for_duplicates(gdf, column):
    duplicates = gdf[gdf.duplicated(subset=column, keep=False)]
    # print(f" \nDuplicates in {column}: \n  {duplicates}\n")
    return duplicates


def filter_gdf_by_column(gdf, column, value):
    return gdf[gdf[column].fillna("").str.contains(value, case=False)]


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


GROUP_LAYERS_LOOKUP = {
    "IA_BLE_Tracking": {"name": 'Production Status', 'zoom': 7},
    "Iowa_WhereISmodel": {"name": 'Mod Model Outlines', 'zoom': 8},
    "S_BFE_Example": {"name": 'BFE Example', 'zoom': 11},
}

COLUMN_MAPPING = {"IA_BLE_Tracking": {"huc8": "HUC8", "which_grid": "which_grid", "name": "Name", "Name HUC8": None,
                                        "Draft_MIP": "Draft_MIP",
                                        "FP_MIP": "FP_MIP",
                                        "MIP_Case": "MIP_Case",
                                        "Hydra MIP": "Hydraulics MIP",
                                        "BFE_TODO": "BFE_TODO",
                                        "has_AECOM": "Has AECOM Tie",
                                        "FRP_Perc_Complete": "FRP_Perc_Complete",
                                        "FRP": "FRP",
                                        'PBL_Assign': "P02a_Assign",
                                        'Phase_1_Su': "P01_MM",
                                        'RAW_Grid': "RAW_Grd_MM",
                                        'DFIRM_Grid': "DFIRM_Grd_MM",
                                        'Addl_Grids': "Addl_Grd_MM",
                                        'Production': "Prod Stage",
                                        'Mapping_In': "P01 Analyst",
                                        'Has_Tie_In': "AECOM Tie-in",
                                        'Name__HUC8': None,
                                        'TO_Area': "TO_Area",
                                        'Final_Mode': "Model Complete",
                                        'Contractor': None,
                                        'loc_id': None,
                                        'Grids_Note': "Notes",
                                        'has_AECOM_': None,
                                        'Extent': None}}

COLUMN_ORDERS = {"IA_BLE_Tracking": {"first": ['huc8', "Name", "Draft_MIP", "FP_MIP", "Hydraulics MIP",
                                               "FRP_Perc_Complete", "FRP", "BFE_TODO", "PBL_Assign",
                                                 "Phase_1_Su"],
                                       "last": ['geometry']}, }

PROD_STATUS_MAPPING = {"DD Submit": "DD Submit",
                       "DD Validation": "DD Internal",
                       "Phase 1": "Phase 1",
                       "DD Mapping": "DD Mapping",
                       "Pass 1/2": "Pass 1/2",
                       "Pass 2/2": "Pass 2/2", }

SPECIAL_COLUMNS = {"FRP": 4}

STATIC_DATA = ["Iowa_WhereISmodel", "US_states"]


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


def df_to_excel(df, out_loc, filename=None, sheetname="Sheet1"):
    print(f"\nExcel Stuff for {filename}")
    if filename is None:
        filename = "output"
    outpath = os.path.join(out_loc, f"{filename}.xlsx")
    os.makedirs(out_loc, exist_ok=True)

    if isinstance(df, gpd.GeoDataFrame) or "geometry" in df.columns:
        df = pd.DataFrame(df.drop(columns=['geometry']))

    for c in df.columns:
        if "legend" in c.lower():
            df.drop(columns=c, inplace=True)

    # Check existing sheets for target and value sheets
    if os.path.exists(outpath):
        situations = {"Target Sheet Exists": False, "Value Sheet Exists": False}
        with pd.ExcelFile(outpath) as reader:
            pd.read_excel(reader, sheet_name=None)
            sheets = reader.sheet_names
            print(f" Sheet Names: {sheets}")
            if sheetname in sheets:
                situations["Target Sheet Exists"] = True
            if sheetname + "_values" in sheets:
                situations["Value Sheet Exists"] = True

        # Get existing header
        try:
            existing_df = pd.read_excel(outpath, sheet_name=sheetname, header=0)
            print(f" Existing: {existing_df.head()}")
            existing_columns = existing_df.columns.to_list()
            print(f"Existing Columns: {existing_columns}")
            # df.drop(columns=[c for c in df.columns if c not in existing_columns], inplace=True)
            # print(f"Unique Names: {df['Name'].unique()}")
        except Exception as e:
            print(f"Error reading existing file: {e}")
            os.remove(outpath)
            df.to_excel(outpath, index=False, sheet_name=sheetname)
            return

        # Append to the existing Excel file
        # Mod write kwargs based on situations
        write_kwargs = {"sheet_name": sheetname, "header": True, "startrow": 1}
        if situations["Target Sheet Exists"]:
            write_kwargs["sheet_name"] = sheetname + "_values"
        else:
            write_kwargs["sheet_name"] = sheetname

        # Do the write operation
        with pd.ExcelWriter(outpath, engine='openpyxl', mode="a", if_sheet_exists="overlay") as writer:
            # Clear the existing data in the sheet
            print(f" Sheets: {writer.sheets}")
            if situations["Target Sheet Exists"]:
                sheet = writer.sheets[sheetname + "_values"]
            if situations["Value Sheet Exists"]:
                sheet = writer.sheets[sheetname + "_values"]

            first_df_col = df.columns[0]
            print(f"  First Column: {first_df_col}")
            if "_Perc" in first_df_col:
                min_out_column = first_df_col.split("_")[0] + " %"
            elif first_df_col in existing_columns:
                min_out_column = first_df_col
            else:
                min_out_column = sheet.min_column
            sheet_column_index = existing_df.columns.get_loc(min_out_column)
            write_kwargs["startcol"] = sheet_column_index
            print(f"  Min Row: {sheet.min_row}")
            print(f"  Min Row Value: {sheet.cell(row=sheet.min_row, column=1).value}")
            print(f"  Max Row Value: {sheet.cell(row=sheet.max_row, column=1).value}")

            # Clear values sheet if exists
            if situations["Value Sheet Exists"]:
                print(f"  Clearing {sheetname}_values")
                values_sheet = writer.sheets[sheetname + "_values"]
                for row in values_sheet.iter_rows():
                    for cell in row:
                        cell.value = None

            # Write the new data to the sheet
            df.to_excel(writer, index=False, **write_kwargs)

    else:
        # Create a new Excel file
        df.to_excel(outpath, index=False, sheet_name=sheetname)


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


def aggregate_buffer_polygons(gdf, buffer_distance, summary_column: T.Union[str, list, None] = None):
    """
    Buffer and aggregate polygons in a GeoDataFrame.

    Parameters:
    gdf (GeoDataFrame): The GeoDataFrame containing the polygons to buffer and aggregate.
    buffer_distance (float): The distance to buffer the polygons.
    summary_column (str): The column to summarize the values of the polygons.

    Returns:
    GeoDataFrame: The GeoDataFrame with the buffered and aggregated polygons.
    """
    # .crs.axis_info[0].unit_name
    convert_back = False
    input_crs = gdf.crs
    input_units = input_crs.axis_info[0].unit_name
    print(f'\tInput CRS: {input_crs}, Units: {input_units}')
    if input_crs.is_geographic or input_units != "metre":
        utm_crs = get_utm_zone(gdf)
        gdf = gdf.to_crs(epsg=utm_crs)
        convert_back = True
        print(f'\tConverted CRS to {gdf.crs}')

    # Simplify the GeoDataFrame
    gdf['geometry'] = gdf.simplify(tolerance=100)

    # Ensure summary_column is a list
    if isinstance(summary_column, str):
        summary_column = [summary_column]

    # Aggregate the polygons
    print(f'\tAggregating polygons...')
    print(f'\tColumns: {gdf.columns}')
    summary_column = [c for c in summary_column if c in gdf.columns]
    print(f'\tSummary Column: {summary_column}')
    agg_dict = {col: 'first' for col in summary_column}
    gdf = gdf.dissolve(by=summary_column, aggfunc=agg_dict)
    print(f'\tPost_Diss Columns: {gdf.columns}')

    # Buffer the polygons
    gdf['geometry'] = (gdf['geometry'].buffer(buffer_distance, resolution=4))
    gdf = gdf.reset_index(drop=True)
    print(f'\tColumns: {gdf.columns}')

    if convert_back:
        gdf = gdf.to_crs(input_crs)
    return gdf


def df_to_json(data, out_loc, filename=None):
    if isinstance(data, gpd.GeoDataFrame):
        df = pd.DataFrame(data.drop(columns='geometry'))
    elif isinstance(data, pd.DataFrame):
        df = data
    else:
        raise ValueError("Data must be a GeoDataFrame or DataFrame")

    outpath_table = out_loc + filename + ".json"
    dicted = df.to_dict(orient='index')
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


class WriteNewGeoJSON:
    def __init__(self):
        self.server_path = os.path.split(__file__)[0]
        self.esri_folder = "../data/esri_exports/"
        self.output_folder = "../data/spatial/"

        self.esri_files = {}
        self.gdf_dict = {}
        self.primary_spatial = None
        self.cname_to_summarize = None

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
                            print(f'\n   Name: {name} \n   Filename: {filename}')
                            self.esri_files[name] = entry.path

        for fname, path, in self.esri_files.items():
            if ".gdb" in base:
                # print(fiona.listlayers(gdb))
                gdf = gpd.read_file(base, driver='FileGDB', layer=fname)
            else:
                gdf = gpd.read_file(path)
                if "." in fname:
                    fname = fname.split(".")[0]

            # Column Mapping
            print(f'    {fname} Formatting...')
            print(f"\tColumns: {gdf.columns}")
            self.crs_dict[fname] = gdf.crs
            # Single-Part
            gdf = gdf.explode(ignore_index=True)
            name_cols = [c for c in gdf.columns if "name" in c.lower()]
            print(f"     Name Columns: {name_cols}")
            if len(name_cols) > 0:
                for c in name_cols:
                    print(f"\t\t{c}")
                    uniques = sorted(gdf[c].unique())
                    duplicates = look_for_duplicates(gdf, c)
                    duplicate_names = duplicates[c].unique()
                    print(f"\t\tUnique Names: {uniques}")
                    print(f"\t\tDuplicate Names: {duplicate_names}")
            # print(f"     Duplicates: {duplicates.drop(columns='geometry')}")
            gdf = add_numbered_primary_key(gdf, 'loc_id')
            if fname in COLUMN_ORDERS:
                gdf = reorder_gdf_columns(gdf, COLUMN_ORDERS[fname]["first"], COLUMN_ORDERS[fname]["last"])
            if fname in COLUMN_MAPPING:
                # print(f"\tColumns: {gdf.columns}")
                cmapping = {k: v for k, v in COLUMN_MAPPING[fname].items() if v is not None and k in gdf.columns}
                removals = [c for c in COLUMN_MAPPING[fname].keys() if
                            COLUMN_MAPPING[fname][c] is None and c in gdf.columns]
                print(f'     Column Removals: {removals}')
                gdf.drop(columns=removals, inplace=True)
                # print(f"\tColumns: {gdf.columns}")
                gdf.rename(columns=cmapping, inplace=True)
                # print(f"\tColumns: {gdf.columns}")

                # Mod order list-dictionary to reflect new column names
                for c in COLUMN_ORDERS[fname]["first"]:
                    if c in COLUMN_MAPPING[fname]:
                        COLUMN_ORDERS[fname]["first"][COLUMN_ORDERS[fname]["first"].index(c)] = COLUMN_MAPPING[fname][c]
                print(f'     New Column Order Dict: {COLUMN_ORDERS[fname]}')

            else:
                print(f"     No column mapping for {fname}")

            # Summation columns
            print(f"\tColumns: {gdf.columns}")
            for c in gdf.columns:
                if c in SPECIAL_COLUMNS:
                    print(f"     Summarizing {c}")
                    gdf = self.add_summation_columns(gdf, c, SPECIAL_COLUMNS[c])

            # Fix* times and dates
            gdf = format_dates(gdf)
            gdf = gdf.to_crs(epsg=4326)

            # Store and print
            self.c_lists[fname] = [c for c in gdf.columns.to_list()]
            print(f'     {fname} Input Columns: {self.c_lists[fname]}, \n     CRS: {self.crs_dict[fname]}')
            self.gdf_dict[fname] = gdf

    @staticmethod
    def add_summation_columns(gdf, column, max_length):
        """
        Add columns to a GeoDataFrame that summarize the values of another column.

        Parameters:
        gdf (GeoDataFrame): The GeoDataFrame to which the columns will be added.
        column (str): The column whose values will be summarized.
        max_length (int): The maximum number of characters in the new column names.

        Returns:
        GeoDataFrame: The GeoDataFrame with the new columns.
        """
        # Add percentage complete column
        perc_complete_column = f"{column}_Perc_Complete"
        gdf['temp_split'] = gdf[column].apply(
            lambda x: [] if x in [None, ""] else [part for part in str(x).split(";") if part not in [None, ""]] )
        unique_test = gdf['temp_split'].explode().unique()
        print(f"\n\tColumn: {column}, {unique_test}")
        gdf['num_parts'] = gdf['temp_split'].apply(lambda x: len(x) if x not in [None, ""] else 0.0)
        print(f"\tNum Parts: {gdf['num_parts'].unique()}")
        gdf[perc_complete_column] = gdf['num_parts'] / max_length * 100
        gdf[perc_complete_column] = gdf[perc_complete_column].round()

        # Add legend column
        legend_column = f"{perc_complete_column}_Legend"
        min_val = 0
        max_val = 100
        perc_steps = int(max_val / max_length)
        print(f"\tMin: {min_val}, Max: {max_val}, Steps: {perc_steps}")

        # Initialize the legend column with empty strings
        gdf[legend_column] = ""

        # Iterate over the range and apply the legend values
        gdf[legend_column] = gdf[perc_complete_column].apply(
            lambda x: f"{int(x)}%")
        print(f"\tLegend Column: {legend_column}, {gdf[legend_column].unique()}")

        gdf.drop(columns=['temp_split', 'num_parts'], inplace=True)
        return gdf

    def output_centroids(self):
        centroids = {}
        for name, gdf in self.gdf_dict.items():
            extent_gdf = bbox_to_gdf(gdf.total_bounds, gdf.crs, name)
            incrs = gdf.crs
            datum = incrs.datum.name
            print(f'\tDatum: {datum}')
            extent_gdf = extent_gdf.to_crs(gdf.estimate_utm_crs())
            centroid = extent_gdf.geometry.centroid
            centroid = centroid.to_crs(incrs)
            print(f"\t\tCentroid: {centroid}")
            center_tuple = (centroid.x[0], centroid.y[0])
            print(f"\t\tCenter: {center_tuple}")
            centroid_info = GROUP_LAYERS_LOOKUP.get(name, None)
            if centroid_info:
                outname = centroid_info.get("name", None)
                if outname:
                    centroids[outname] = {"Centroid": center_tuple, "Zoom": centroid_info.get("zoom", 7)}

        with open(self.output_folder + "Centroids.json", 'w') as f:
            json.dump(centroids, f, indent=2)

    def export_geojsons(self, *kwd_args):
        print(f'{self.gdf_dict.keys()}')

        # Iterate gdf dictionary
        new_gdf = {}

        for name, gdf in self.gdf_dict.items():
            print(f"\n\nFound {name}")

            # Skip if static data and already exists
            if name in STATIC_DATA:
                outpath = self.output_folder + f"{name}.geojson"
                if os.path.exists(outpath):
                    continue

            # Create points
            points_gdf = get_centroids(gdf)
            new_gdf[f"{name}_points"] = points_gdf

            columns = gdf.columns
            # Rename Production Stage columns
            if "Prod Stage" in columns:
                gdf["Prod Stage"] = gdf["Prod Stage"].replace(PROD_STATUS_MAPPING)

            # Export GeoJSON
            gdf_to_geojson(gdf, self.output_folder, name)
            df = gdf.drop(columns='geometry')
            df_to_json(df, self.output_folder, name)

            # Export Excel
            if name == self.primary_spatial:
                # Excel Export
                excel_folder = os.path.dirname(os.path.dirname(self.output_folder)) + "/tables/"
                os.makedirs(excel_folder, exist_ok=True)
                df_to_excel(df, excel_folder, name, sheetname="Tracking_Main")

        self.gdf_dict.update(new_gdf)

        # print(f'Args: {kwd_args}')
        # for i, point_gdf in enumerate(self.export_specific_geojson(layer_names=None, args=kwd_args)):
        #     if isinstance(point_gdf, gpd.GeoDataFrame):
        #         try:
        #             print(f' Exporting {kwd_args[i]}, {len(point_gdf)} points')
        #             gdf_to_geojson(point_gdf, self.output_folder, f"{kwd_args[i]}_points")
        #         except IndexError as ie:
        #             print(f'Number {i} does not have a gdf to export')
        #             print(f"Point GDF: {point_gdf}")

    def export_specific_geojson(self, layer_names: list = None, args=None) -> gpd.GeoDataFrame:

        if layer_names is None:
            layer_names = ["IA_BLE_Tracking"]

        points_gdf_dict = {k: v for k, v in self.gdf_dict.items() if "_points" in k}
        for lyr in layer_names:
            points_gdf = [v for k, v in points_gdf_dict.items() if lyr in k]
            if points_gdf:
                points_gdf = points_gdf[0]
                for keyword in list(args):
                    if points_gdf is not None:
                        filtered_gdf = filter_gdf_by_column(points_gdf, "Notes", keyword)
                        yield filtered_gdf

    def update_iowa_status_map(self, summ_column, kwd_list):
        self.primary_spatial = "IA_BLE_Tracking"
        self.cname_to_summarize = summ_column
        # if not os.path.exists(f"{self.output_folder}Work_Areas.geojson"):
        work_areas_gdf = aggregate_buffer_polygons(self.gdf_dict["IA_BLE_Tracking"],
                                                   250, ["TO_Area", "MIP_Case"])
        self.gdf_dict["Work_Areas"] = work_areas_gdf

        wa_label_points = []
        for idx, row in work_areas_gdf.iterrows():
            row_gdf = gpd.GeoDataFrame([row], crs=work_areas_gdf.crs)
            point = get_label_point(row_gdf, "top_right", 10000)
            wa_label_points.append({"MIP_Case": row.MIP_Case, "TO_Area": row.TO_Area, "geometry": point})
        wa_label_gdf = gpd.GeoDataFrame(wa_label_points, geometry='geometry', crs=work_areas_gdf.crs)
        self.gdf_dict["Work_Area_Labels"] = wa_label_gdf


        self.export_geojsons(*kwd_list)
        self.output_centroids()


if __name__ == "__main__":
    cname = "Production"
    keywords = ["TODO", "UPDATE"]
    to_gdf = WriteNewGeoJSON()
    to_gdf.update_iowa_status_map(cname, keywords)
    print("Done")
