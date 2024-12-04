from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import geopandas as gpd
import pandas as pd
from py.read_write_df import StatusTableManager, df_to_excel, gdf_to_shapefile
from datetime import datetime
from dotenv import load_dotenv
import logging
import shutil
import json


DEBUG_MODE = False
logging.basicConfig(level=logging.DEBUG if DEBUG_MODE else logging.INFO)
load_dotenv()  # Load environment variables from .env file
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")

MANUAL_UPDATES_FOLDER = "data/manual_updates"
EXCEL_DIR = os.path.join(app.root_path, "data", "tables")
EXCEL_FILE = os.path.join(EXCEL_DIR, "IA_BLE_Tracking.xlsx")
BACKUP_LOC = "data/_backups"
TRACKING_FILE = "data/spatial/IA_BLE_Tracking.geojson"
SHEET_NAME = "Tracking_Main"
YAML_FILE = os.path.join(EXCEL_DIR, "last_modified.yaml")
TABLE_METADATA = "data/IA_BLE_Tracking_metadata.json"
SHAPEFILE = "data/IA_BLE_Tracking.shp"


# Start the file observer when the app starts
# check_and_process_on_start(EXCEL_FILE, SHEET_NAME, YAML_FILE)
# observer = start_file_observer(EXCEL_FILE, SHEET_NAME, YAML_FILE)

# Homepage route
@app.route("/")
def home():
    mapbox_token = os.getenv("MAPBOX_TOKEN")
    return render_template("index.html",
                           mapbox_token=mapbox_token)  # Dynamic reference to HTML

@app.route('/metadata-columns')
def metadata_columns():
    with open(TABLE_METADATA) as f:
        metadata = json.load(f)

    columns_metadata = {k: v for k, v in metadata["columns"].items()}
    print(f"Column Order Before jsonify: {list(columns_metadata.keys())}")
    return jsonify({
        "meta": columns_metadata,
        "order": list(columns_metadata.keys())  # Include the key order explicitly
    })


@app.route('/data-table.json', methods=['GET'])
def get_table_data():
    try:
        with open(TRACKING_FILE.replace(".geojson", ".json"), "r") as data:
            df = pd.DataFrame.from_dict(json.load(data), orient="columns")
        if 'geometry' in df.columns:
            df = df.drop(columns='geometry')

        table_data = df.to_dict(orient='records')

        # Return as JSON
        return jsonify(table_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/update-data', methods=['POST'])
def update_data():
    try:
        updated_data = request.get_json()
        # logging.info(f"Received data: {updated_data}")
        if not updated_data:
            logging.error("No data received in the request body.")
            return jsonify({'error': 'No data received'}), 400
        updated_df = pd.DataFrame(updated_data).set_index("HUC8")
        logging.debug(f"DF cols: {updated_df.columns}")
    except Exception as e:
        logging.error(f"Error: {e}")
        return jsonify({'error': str(e)}), 400

    try:
        # Load GeoJSON and update properties
        gdf = gpd.read_file(TRACKING_FILE).set_index("HUC8")
        if gdf is None:
            logging.error("GeoJSON file is None. Could not load GeoDataFrame.")
            return jsonify({'error': 'Failed to load GeoJSON file.'}), 500
        logging.debug(f"GeoDataFrame cols: \n{gdf.columns}")

        # Ensure indices match
        updated_df = updated_df.reindex(index=gdf.index, fill_value=None)

        # Identify rows with differences in common columns
        common_columns = updated_df.columns.intersection(gdf.columns)

        # Ensure both DataFrames are aligned in terms of indices and columns
        aligned_gdf = gdf[common_columns].reindex(index=updated_df.index)
        aligned_updated_df = updated_df[common_columns]

        # Compare for differences
        diffs = (aligned_gdf != aligned_updated_df).any(axis=1)

        # Update the rows with differences
        gdf.loc[diffs, common_columns] = updated_df.loc[diffs, common_columns]
        gdf.loc[diffs, 'last_updated'] = datetime.now().isoformat()

        # Reset the index for saving
        gdf.reset_index(inplace=True)

    except Exception as e:
        logging.error(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

    try:
        with StatusTableManager(TABLE_METADATA) as manager:
            gdf = manager.enforce_types(gdf)
            gdf = manager.sort_rows(gdf)
    except Exception as e:
        logging.error(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

    try:
        # Save updated GeoJSON
        temp_file = TRACKING_FILE.replace(".geojson", "_temp.geojson")
        gdf.to_file(temp_file, driver='GeoJSON')

        export_shp(gdf)

        # Back up current
        date_string = datetime.now().strftime("%Y_%m%d")
        path, file = os.path.split(TRACKING_FILE)
        filename, ext = os.path.splitext(file)
        backup_path = f"{BACKUP_LOC}/{filename}_{date_string}{ext}"
        shutil.copy2(TRACKING_FILE, backup_path)

        # Write the new file
        os.replace(temp_file, TRACKING_FILE)
        logging.info("Saved updated GeoJSON file.")
    except Exception as e:
        logging.error(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

    return jsonify({'success': True})


@app.route('/export-excel', methods=['POST'])
def export_excel(gdf):  # TODO Add functions to read GeoJSON and export Excel files for user downoad
    try:
        logging.debug("Updating Excel file...")
        logging.debug(f"GDF has columns: {hasattr(gdf, 'columns')}")
        if "geometry" in gdf.columns:
            df = gdf.drop(columns='geometry')
        else:
            df = gdf

        logging.debug(f"DF columns: {df.columns}")
        with StatusTableManager(TABLE_METADATA) as manager:
            df = manager.rename_columns(df, "excel", "geojson")
            df = manager.enforce_types(df, "excel")
            df = manager.sort_rows(df)

        # Save updated Excel
        df_to_excel(df, EXCEL_FILE, SHEET_NAME)

        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route("/data/<path:filename>")
def serve_data(filename):
    data_dir = os.path.join(app.root_path, "data")
    if not os.path.exists(data_dir):
        return jsonify({"error": "Data directory not found"}), 404
    if not os.path.isfile(os.path.join(data_dir, filename)):
        return jsonify({"error": "File not found"}), 404
    return send_from_directory(data_dir, filename)

@app.route("/update-from-shapefile", methods=["POST"])
def update_from_shapefile():
    """API endpoint to update GeoJSON from a shapefile."""
    result = process_shapefile()
    if result["success"]:
        return jsonify({"success": True, "message": result["message"]})
    else:
        return jsonify({"success": False, "message": result["message"]}), 400


@app.route('/export-shape', methods=['POST'])
def export_shp(gdf):  # TODO Add functions to read GeoJSON and export Excel files for user downoad
    try:
        logging.debug("Updating SHAPEFILE file...")
        logging.debug(f"GDF has columns: {hasattr(gdf, 'columns')}")

        with StatusTableManager(TABLE_METADATA) as manager:
            gdf = manager.rename_columns(gdf, "shapefile", "geojson")
            gdf = manager.enforce_types(gdf, "shapefile")
            gdf = manager.sort_rows(gdf)

        # Save updated Excel
        gdf_to_shapefile(gdf, SHAPEFILE)

        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def process_shapefile():
    """Check for the most recent .shp file in the designated folder and update GeoJSON."""
    try:
        # Find all .shp files in the folder
        shapefiles = [os.path.join(MANUAL_UPDATES_FOLDER, f) for f in os.listdir(MANUAL_UPDATES_FOLDER) if f.endswith(".shp")]
        if not shapefiles:
            return {"success": False, "message": "No shapefiles found."}

        # Find the most recent .shp file by modification time
        most_recent_shapefile = max(shapefiles, key=os.path.getmtime)

        # Read the shapefile into a GeoDataFrame
        gdf = gpd.read_file(most_recent_shapefile)

        # Backup the current GeoJSON
        os.makedirs(BACKUP_LOC, exist_ok=True)
        date_string = datetime.now().strftime("%Y_%m%d")
        trackingfilename = os.path.split(TRACKING_FILE)[-1]
        filename, ext = os.path.splitext(trackingfilename)
        backup_path = f"{BACKUP_LOC}/{filename}_{date_string}{ext}"
        shutil.copy2(TRACKING_FILE, backup_path)
        print(f"Backup saved: {backup_path}")

        with StatusTableManager(TABLE_METADATA) as manager:
            gdf = manager.rename_columns(gdf, "shapefile", "geojson")
            print(gdf.columns)
            gdf = manager.enforce_types(gdf, "geojson")
            gdf = manager.sort_rows(gdf)

        # Save the new GeoJSON
        gdf.to_file(TRACKING_FILE, driver="GeoJSON")
        print(f"Updated GeoJSON saved to: {TRACKING_FILE}")

        # Optionally, clean up the processed shapefile
        os.remove(most_recent_shapefile)
        print(f"Processed shapefile deleted: {most_recent_shapefile}")

        return {"success": True, "message": "GeoJSON updated successfully."}
    except Exception as e:
        print(f"Error processing shapefile: {e}")
        return {"success": False, "message": str(e)}


if __name__ == "__main__":
    app.run(debug=True)
