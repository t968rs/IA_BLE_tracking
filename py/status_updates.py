import geopandas as gpd
import pandas as pd
import os
from get_esri_spatial_here import df_to_json, df_to_excel


class ProjectStatusUpdater:

    def __init__(self,
                 project_wildcard_list: list, new_status: str, column_name:str):
        self.excel_file = "../data/tables/IA_BLE_Tracking.xlsx"
        self.tracking_file = "../data/spatial/IA_BLE_Tracking.geojson"
        self.sheet_name = "Tracking_Main"
        self.last_modified = None
        self.project_wildcard_list = project_wildcard_list
        self.new_status = new_status
        self.column_name = column_name

        self.tracking_gdf = gpd.read_file(self.tracking_file)

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

    def update_status(self):
        """
        Update the status of the projects that match the project wildcard list
        :return:
        """
        filter_idx = self._get_filtered_projects()
        self._update_status(filter_idx)
        self.tracking_gdf.to_file(self.tracking_file, driver="GeoJSON")

        # Convert the GeoDataFrame to a DataFrame
        tracking_df = self.tracking_gdf.drop(columns="geometry")
        df_to_json(tracking_df, self.tracking_file.replace(".geojson", ".json"))

        excel_dir, excel_file = os.path.split(self.excel_file)
        df_to_excel(tracking_df, excel_dir, excel_file, self.sheet_name)


if __name__ == "__main__":
    PROJECT_WILDCARD_LIST = ["Copperas"]
    NEW_STATUS = "In Backcheck"
    COLUMN_NAME = "FP_MIP"

    project_status_updater = ProjectStatusUpdater(PROJECT_WILDCARD_LIST, NEW_STATUS, COLUMN_NAME)
    project_status_updater.update_status()
