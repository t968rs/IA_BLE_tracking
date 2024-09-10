import os
import geopandas as gpd
import json
import pandas as pd
import warnings


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


COLUMN_MAPPING = {"Iowa_BLE_Tracking": {"huc8": "HUC8", "which_grid": "which_grid", "name": "Name", "Name HUC8": None,
                                        "BFE_TODO": "BFE_TODO",
                                        "has_AECOM": "Has AECOM Tie",
                                        "FRP_Perc_Complete": "FRP_Perc_Complete",
                                        "FRP": "FRP",
                                        'PBL_Assign': "P02a_Assign", 'Phase_1_Su': "P01_MM", 'RAW_Grid': "RAW_Grd_MM",
                                        'DFIRM_Grid': "DFIRM_Grd_MM", 'Addl_Grids': "Addl_Grd_MM",
                                        'Production': "Prod Stage", 'Mapping_In': "P01 Analyst",
                                        'Has_Tie_In': "AECOM Tie-in",
                                        'Name__HUC8': None,
                                        'TO_Area': "TO_Area", 'Final_Mode': "Model Complete",
                                        'Contractor': None, 'loc_id': None,
                                        'Grids_Note': "Notes",
                                        'has_AECOM_': None,
                                        'Extent': None}}

COLUMN_ORDERS = {"Iowa_BLE_Tracking": {"first": ['huc8', "Name", "FRP_Perc_Complete", "FRP", "BFE_TODO", "PBL_Assign",
                                                 "Phase_1_Su"],
                                       "last": ['geometry']}, }

PROD_STATUS_MAPPING = {"Draft DFIRM Submitted": "DD Submit",
                       "DD Validation": "DD Internal",
                       "Phase 1 Delivered": "Phase 1",
                       "DD Mapping": "DD Mapping",
                       "Pass 1/2 Validation": "Pass 1/2",
                       "Pass 2/2 Validation": "Pass 2/2", }

SPECIAL_COLUMNS = {"FRP": 3}


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
            print(f"Converting {col} to string")
            gdf[col] = gdf[col].astype(str)
            gdf[col] = gdf[col].apply(process_date)
            gdf[col] = gdf[col].str.replace("0000/00/00", "")
    gdf = gdf.replace("0000/00/00", "")

    return gdf


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
        json.dump(dicted, f)


def gdf_to_geojson(gdf, out_loc, filename=None):
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
            self.crs_dict[fname] = gdf.crs
            gdf = gdf.explode(ignore_index=True)
            name_col = [c for c in gdf.columns if "name" in c.lower()][0]
            duplicates = look_for_duplicates(gdf, name_col)
            duplicate_names = duplicates[name_col].unique()
            print(f"     Duplicate Names: {duplicate_names}")
            # print(f"     Duplicates: {duplicates.drop(columns='geometry')}")
            gdf = add_numbered_primary_key(gdf, 'loc_id')
            if fname in COLUMN_ORDERS:
                gdf = reorder_gdf_columns(gdf, COLUMN_ORDERS[fname]["first"], COLUMN_ORDERS[fname]["last"])
            if fname in COLUMN_MAPPING:
                cmapping = {k: v for k, v in COLUMN_MAPPING[fname].items() if v is not None and k in gdf.columns}
                removals = [c for c in COLUMN_MAPPING[fname].keys() if
                            COLUMN_MAPPING[fname][c] is None and c in gdf.columns]
                print(f'     Column Removals: {removals}')
                gdf.drop(columns=removals, inplace=True)
                gdf.rename(columns=cmapping, inplace=True)

                # Mod order list-dictionary to reflect new column names
                for c in COLUMN_ORDERS[fname]["first"]:
                    if c in COLUMN_MAPPING[fname]:
                        COLUMN_ORDERS[fname]["first"][COLUMN_ORDERS[fname]["first"].index(c)] = COLUMN_MAPPING[fname][c]
                print(f'\n New Column Order Dict: {COLUMN_ORDERS[fname]}')
            for c in gdf.columns:
                if c in SPECIAL_COLUMNS:
                    self.add_summation_columns(gdf, c, SPECIAL_COLUMNS[c])
                    if c in COLUMN_ORDERS[fname]["first"]:
                        gdf = reorder_gdf_columns(gdf, COLUMN_ORDERS[fname]["first"], COLUMN_ORDERS[fname]["last"])
            else:
                print(f"     No column mapping for {fname}")

            # Fix* times
            time_cs = [c for c in gdf.columns if gdf[c].astype(str).str.contains('T').any()]
            print(f" Time columns: {time_cs}")
            gdf = format_dates(gdf)
            gdf = gdf.to_crs(epsg=4326)
            self.c_lists[fname] = [c for c in gdf.columns.to_list()]
            print(f'   {fname} Input Columns: {self.c_lists[fname]}, \n   CRS: {self.crs_dict[fname]}')
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
            lambda x: [part for part in x.split(";") if part not in [None, ""]] if ";" in str(x) else None)
        gdf['num_parts'] = gdf['temp_split'].apply(lambda x: len(x) if x not in [None, ""] else 0.0)
        gdf[perc_complete_column] = gdf['num_parts'] / max_length * 100
        gdf[perc_complete_column] = gdf[perc_complete_column].round()

        # Add legend column
        legend_column = f"{perc_complete_column}_Legend"
        min_val = int(gdf[perc_complete_column].min())
        max_val = 100
        perc_steps = int(round(max_val / max_length))
        print(f"  Min: {min_val}, Max: {max_val}, Steps: {perc_steps}")

        # Initialize the legend column with empty strings
        gdf[legend_column] = ""

        # Iterate over the range and apply the legend values
        for i in range(min_val, max_val, perc_steps):
            range_label = f"{i}%"
            gdf[legend_column] = gdf[legend_column].mask(
                (gdf[perc_complete_column] >= i) & (gdf[perc_complete_column] < i + perc_steps),
                range_label
            )

        # Handle the max_val separately to include it in the last range
        gdf[legend_column] = gdf[legend_column].mask(
            gdf[perc_complete_column] >= max_val - perc_steps,
            f"{max_val}%"
        )

        gdf.drop(columns=['temp_split', 'num_parts'], inplace=True)
        return gdf

    def export_geojsons(self, cname_to_summarize=None, *args):
        print(f'{self.gdf_dict.keys()}')

        new_gdf = {}
        for name, gdf in self.gdf_dict.items():
            print(f"Found {name}")

            # Create points
            points_gdf = get_centroids(gdf)
            new_gdf[f"{name}_points"] = points_gdf

            # Export main Geojsons
            if cname_to_summarize is not None and cname_to_summarize in gdf.columns:
                # Rename Production Stage columns
                if "Prod Stage" in gdf.columns:
                    gdf["Prod Stage"] = gdf["Prod Stage"].replace(PROD_STATUS_MAPPING)
                unique_names = gdf[cname_to_summarize].unique()
                print(f"Unique {cname_to_summarize} values: {[u for u in unique_names]}")
                print(f'   Plus, {None if None in unique_names else "No-NULL"}  values')
                gdf_to_geojson(gdf, self.output_folder, name)
                df = gdf.drop(columns='geometry')
                df_to_json(df, self.output_folder, name)

                # Excel Export
                excel_folder = os.path.dirname(os.path.dirname(self.output_folder)) + "/tables/"
                os.makedirs(excel_folder, exist_ok=True)
                df_to_excel(df, excel_folder, name, sheetname="Tracking_Main")

            else:
                print(f"{cname_to_summarize} not in {name} columns")

        self.gdf_dict.update(new_gdf)

        print(f'Args: {args}')
        for i, point_gdf in enumerate(self.export_specific_geojson(layer_names=None, args=args)):
            if isinstance(point_gdf, gpd.GeoDataFrame):
                try:
                    print(f' Exporting {args[i]}, {len(point_gdf)} points')
                    gdf_to_geojson(point_gdf, self.output_folder, f"{args[i]}_points")
                except IndexError as ie:
                    print(f'NUmber {i} does not have a gdf to export')
                    print(f"Point GDF: {point_gdf}")

    def export_specific_geojson(self, layer_names=None, args=None):

        print(f"Exporting specific GeoJSONs, {layer_names}, {args}")
        if layer_names is None:
            layer_names = ["Iowa_BLE_Tracking"]

        points_gdf_dict = {k: v for k, v in self.gdf_dict.items() if "_points" in k}
        for lyr in layer_names:
            points_gdf = [v for k, v in points_gdf_dict.items() if lyr in k]
            if points_gdf:
                points_gdf = points_gdf[0]
                for keyword in list(args):
                    if points_gdf is not None:
                        filtered_gdf = filter_gdf_by_column(points_gdf, "Notes", keyword)
                        yield filtered_gdf


cname = "FRP_Perc_Complete_Legend"
keywords = ["TODO", "UPDATE"]
to_gdf = WriteNewGeoJSON()
to_gdf.export_geojsons(cname, *keywords)
