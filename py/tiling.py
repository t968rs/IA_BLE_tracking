import subprocess
import geopandas as gpd
import os
import shutil

TILING_ENV_PATH = "data/mapbox_metadata/mapbox_tilekey.env"


def check_crs(input_file):
    gdf = gpd.read_file(input_file)
    if gdf.crs != "EPSG:4326":
        gdf = gdf.to_crs("EPSG:4326")
        gdf.to_file(input_file)

def generate_mvt(input_file, output_dir, min_zoom=0, max_zoom=22, id_field="HUC8"):
    check_crs(input_file)

    if os.path.exists(output_dir):
        shutil.rmtree(output_dir)
        print(f"Removed existing directory: {output_dir}")

    cmd = [
        "ogr2ogr",
        "-f", "MVT",
        output_dir,
        input_file,
        "-dsco", f"MINZOOM={min_zoom}",
        "-dsco", f"MAXZOOM={max_zoom}",
        "-lco", f"ID_FIELD={id_field}",
        "-overwrite", "-progress",
        "-select", f"{id_field}"
    ]
    subprocess.run(cmd, check=True)

generate_mvt("../data/spatial/IA_BLE_Tracking.geojson", "../data/spatial/IA_BLE_Tracking_tiles",
             min_zoom=3, max_zoom=11)
