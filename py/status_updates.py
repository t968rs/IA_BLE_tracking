import geopandas as gpd
import pandas as pd
import os
import datetime
from filter_sort_select import define_one_by_another
from read_write_df import df_to_excel, df_to_json, StatusTableManager, gdf_to_shapefile


class ProjectStatusUpdater:

    def __init__(self,
                 project_wildcard_list: list, new_status: str, column_name: str,
                 other_column: str = None, other_status: str = None):
        self.excel_file = "../data/tables/IA_BLE_Tracking.xlsx"
        self.tracking_file = "../data/spatial/IA_BLE_Tracking.geojson"
        self.shapefile = "../data/esri_exports/IA_BLE_Tracking.shp"
        self.sheet_name = "Tracking_Main"
        self.last_modified = None
        self.project_wildcard_list = project_wildcard_list
        self.new_status = new_status
        self.column_name = column_name
        self.other_column = other_column
        self.other_status = other_status
        self.tracking_gdf = gpd.read_file(self.tracking_file)

        out_dirs = [os.path.split(self.excel_file)[0], os.path.split(self.tracking_file)[0],
                    os.path.split(self.shapefile)[0]]
        for out_dir in out_dirs:
            os.makedirs(out_dir, exist_ok=True)

    @staticmethod
    def add_summation_columns(gdf, column, max_length=4):
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
        perc_complete_column = f"{column}_int"
        gdf['temp_split'] = gdf[column].apply(
            lambda x: [] if x in [None, ""] else [part for part in str(x).split(";") if part not in [None, ""]])
        unique_test = gdf['temp_split'].explode().unique()
        print(f"\n\tColumn: {column}, {unique_test}")
        gdf['num_parts'] = gdf['temp_split'].apply(lambda x: len(x) if x not in [None, ""] else 0.0)
        print(f"\tNum Parts: {gdf['num_parts'].unique()}")
        gdf[perc_complete_column] = gdf['num_parts'] / max_length * 100
        gdf[perc_complete_column] = gdf[perc_complete_column].round()

        # Add legend column
        legend_column = f"{column}_Legend"
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

    def _get_filtered_projects(self) -> pd.Index:
        """
        Get the projects idx that match the project wildcard list
        :return:
        """
        gdf = self.tracking_gdf
        print(gdf.columns)
        return gdf.loc[gdf["Name"].str.contains("|".join(self.project_wildcard_list))].index

    def _update_status(self, filter_idx: pd.Index):
        self.tracking_gdf.loc[filter_idx, self.column_name] = self.new_status

    def _format_for_geojson(self, sort=False):
        """
        Format the GeoDataFrame for GeoJSON export
        :return:
        """

        with StatusTableManager("../data/IA_BLE_Tracking_metadata.json") as table_manager:
            self.tracking_gdf = table_manager.rename_columns(self.tracking_gdf, "geojson",
                                                             "geojson")
            self.tracking_gdf = table_manager.enforce_types(self.tracking_gdf)
            if sort:
                self.tracking_gdf = table_manager.sort_rows(self.tracking_gdf)

    def _format_for_excel(self, sort=False):
        """
        Format the GeoDataFrame for Excel export
        :return:
        """
        if "geometry" in self.tracking_gdf.columns:
            self.tracking_gdf = self.tracking_gdf.drop(columns="geometry")
        with StatusTableManager("../data/IA_BLE_Tracking_metadata.json") as table_manager:
            print(f"Before:\n{self.tracking_gdf.columns}")
            self.tracking_gdf = table_manager.rename_columns(self.tracking_gdf, "excel",
                                                             "geojson")
            print(f"After:\n{self.tracking_gdf.columns}")
            self.tracking_gdf = table_manager.enforce_types(self.tracking_gdf, "excel")
            if sort:
                self.tracking_gdf = table_manager.sort_rows(self.tracking_gdf)

    def _format_for_shapefile(self, sort=False):
        """
        Format the GeoDataFrame for Shapefile export
        :return:
        """
        with StatusTableManager("../data/IA_BLE_Tracking_metadata.json") as table_manager:
            self.tracking_gdf = table_manager.rename_columns(self.tracking_gdf, "shapefile",
                                                             "geojson")
            self.tracking_gdf = table_manager.enforce_types(self.tracking_gdf, "shapefile")
            if sort:
                self.tracking_gdf = table_manager.sort_rows(self.tracking_gdf)

    def _format_dates_to_str(self):
        """
        Convert datetimes to dates and format as strings for export.
        """
        # Convert datetime and date objects to strings without time
        self.tracking_gdf = self.tracking_gdf.apply(
            lambda col: col.map(
                lambda x: x.date().isoformat() if isinstance(x, (pd.Timestamp, datetime.datetime)) else
                x.isoformat() if isinstance(x, datetime.date) else x
            )
        )

    def update_status(self, method="standard"):
        """
        Update the status of the projects that match the project wildcard list
        :return:
        """
        if method == "standard":
            filter_idx = self._get_filtered_projects()
            self._update_status(filter_idx)
        elif method == "by_other":
            if not self.other_column or not self.other_status:
                raise ValueError("You must provide a value for the 'other_column' parameter.")
            self.tracking_gdf = define_one_by_another(self.tracking_gdf, self.column_name, self.other_column,
                                                      self.other_status, self.new_status)
        self._format_for_geojson(sort=True)
        self.tracking_gdf["FRP_Perc_Complete_Legend"] = self.tracking_gdf.loc[
            :, "FRP_Perc_Complete"].apply(lambda x: f"{int(float(x))}%" if x not in [None, ""] else "")

        # Export the GeoDataFrame to GeoJSON
        self.tracking_gdf.to_file(self.tracking_file, driver="GeoJSON")

        # Convert the GeoDataFrame to a DataFrame
        tracking_df = self.tracking_gdf.drop(columns="geometry")

        # Eport GDF to Shapefile
        self._format_for_shapefile()
        gdf_to_shapefile(self.tracking_gdf, self.shapefile)

        # Convert dates to strings for Excel export
        self.tracking_gdf = tracking_df
        self._format_dates_to_str()

        df_to_json(self.tracking_gdf, self.tracking_file.replace(".geojson", ".json"))

        # Export the DataFrame to Excel
        self._format_for_excel(sort=True)
        excel_dir, excel_file = os.path.split(self.excel_file)
        df_to_excel(self.tracking_gdf, excel_dir, excel_file, self.sheet_name)


if __name__ == "__main__":
    PROJECT_WILDCARD_LIST = ["Copperas"]
    NEW_STATUS = "2/2"
    COLUMN_NAME = "Prod_Stage"
    other_col = "Draft_MIP"
    other_status = "Approved"
    method_type = "by_other"

    project_status_updater = ProjectStatusUpdater(PROJECT_WILDCARD_LIST, NEW_STATUS, COLUMN_NAME,
                                                  other_column=other_col, other_status=other_status)
    project_status_updater.update_status(method_type)
