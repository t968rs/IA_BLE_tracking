import os
import geopandas as gpd
import json


def read_json_to_dict(file: str) -> dict:
    with open(file, 'r') as f:
        return json.load(f)


def add_numbered_primary_key(gdf, col_name):
    gdf[col_name] = range(1, len(gdf) + 1)
    return gdf


def gdf_to_geojson(gdf, out_loc, filename=None):

    driver = "GeoJSON"
    outpath = out_loc + f"{filename}.geojson"
    os.makedirs(out_loc, exist_ok=True)
    gdf.to_file(filename=outpath, driver=driver)
    print(f"Saved {filename} to {outpath}")


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
                            print(f'   Name: {name}, \n   Filename: {filename}')
                            self.esri_files[name] = entry.path

        for fname, path, in self.esri_files.items():
            if ".gdb" in base:
                # print(fiona.listlayers(gdb))
                gdf = gpd.read_file(base, driver='FileGDB', layer=fname)
            else:
                gdf = gpd.read_file(path)

            self.crs_dict[name] = gdf.crs
            gdf = gdf.explode(ignore_index=True)
            gdf = add_numbered_primary_key(gdf, 'loc_id')
            gdf = gdf.to_crs(epsg=4326)
            self.c_lists[name] = [c for c in gdf.columns.to_list()]
            print(f'   Input Columns: {self.c_lists[name]}, \n   CRS: {self.crs_dict[name]}')
            self.gdf_dict[name] = gdf

    def export_geojsons(self, cname_to_summarize=None):
        for name, gdf in self.gdf_dict.items():
            unique_names = gdf[cname_to_summarize].unique()
            print(f"Unique {cname_to_summarize} values: {unique_names}")
            gdf_to_geojson(gdf, self.output_folder, name)


cname = "PBL_Assign"
WriteNewGeoJSON().export_geojsons(cname_to_summarize=cname)



