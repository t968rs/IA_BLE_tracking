from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import geopandas as gpd
import pandas as pd
from py.read_write_df import StatusTableManager, df_to_excel, gdf_to_shapefile
from dotenv import load_dotenv
import logging
import json

logging.basicConfig(level=logging.DEBUG)
load_dotenv()  # Load environment variables from .env file
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")

EXCEL_DIR = os.path.join(app.root_path, "data", "tables")
EXCEL_FILE = os.path.join(EXCEL_DIR, "IA_BLE_Tracking.xlsx")
TRACKING_FILE = "data/spatial/IA_BLE_Tracking.geojson"
SHEET_NAME = "Tracking_Main"
YAML_FILE = os.path.join(EXCEL_DIR, "last_modified.yaml")
TABLE_METADATA = "data/IA_BLE_Tracking_metadata.json"


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
        # logging.info(f"DF data: {updated_df}")
    except Exception as e:
        logging.error(f"Error: {e}")
        return jsonify({'error': str(e)}), 400

    try:
        # Load GeoJSON and update properties
        gdf = gpd.read_file(TRACKING_FILE).set_index("HUC8")
        if gdf is None:
            logging.error("GeoJSON file is None. Could not load GeoDataFrame.")
            return jsonify({'error': 'Failed to load GeoJSON file.'}), 500
        logging.info(f"GeoDataFrame: \n{gdf}")
        for col in updated_df.columns:
            if col in gdf.columns:
                gdf[col] = updated_df[col]
        gdf.reset_index(inplace=True)
    except Exception as e:
        logging.error(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

    try:
        with StatusTableManager(TABLE_METADATA) as manager:
            manager.enforce_types(gdf)
            manager.sort_rows(gdf)
    except Exception as e:
        logging.error(f"Error: {e}")
        return jsonify({'error': str(e)}), 500

    try:
        # Save updated GeoJSON
        temp_file = TRACKING_FILE.replace(".geojson", "_temp.geojson")
        gdf.to_file(temp_file, driver='GeoJSON')
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
            manager.rename_columns(df, "excel", "geojson")
            manager.enforce_types(df, "excel")
            manager.sort_rows(df)

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


# @app.teardown_appcontext
# def shutdown_observer(exception=None):
#     observer.stop()
#     observer.join()

if __name__ == "__main__":
    app.run(debug=True)
