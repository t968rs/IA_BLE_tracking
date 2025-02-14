import json
import logging
import os
import shutil
import tempfile
from datetime import datetime
import pandas as pd
import geopandas as gpd
from dotenv import load_dotenv
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_compress import Compress
from werkzeug.utils import secure_filename
from py.read_write_df import StatusTableManager, gdf_to_shapefile, df_to_excel_for_export


DEBUG_MODE = True
logging.basicConfig(level=logging.DEBUG if DEBUG_MODE else logging.INFO)
load_dotenv(override=True)  # Load environment variables from .env file
app = Flask(__name__)
Compress(app)
app.secret_key = os.getenv("SECRET_KEY")
# socketio = SocketIO(app, cors_allowed_origins='*', path='/socket.io')  # or another custom path


MANUAL_UPDATES_FOLDER = "data/manual_updates"
EXCEL_DIR = os.path.join(app.root_path, "data", "tables")
EXCEL_FILE = os.path.join(EXCEL_DIR, "IA_BLE_Tracking.xlsx")
BACKUP_LOC = "data/_backups"
TRACKING_FILE = "data/spatial/IA_BLE_Tracking.geojson"
SHEET_NAME = "Tracking_Main"
TABLE_METADATA = "data/IA_BLE_Tracking_metadata.json"
SHAPEFILE = "data/IA_BLE_Tracking.shp"


# Homepage route
@app.route("/")
def home():
    return render_template("index.html", )  # Dynamic reference to HTML

@app.route("/mapbox-token/")
def mapbox_token():
    logging.debug("Getting mapbox token...")
    token = os.getenv("MAPBOX_TOKEN")
    logging.debug(f"MB token: {token}")
    return jsonify({"MAPBOX_TOKEN": token})

@app.route('/metadata-columns')
def metadata_columns():
    # Grab the requested format from the query parameters.
    # If none is provided, default to 'geojson'.
    requested_format = request.args.get('source_file_format', default='geojson')

    with open(TABLE_METADATA) as f:
        metadata = json.load(f)

    columns_metadata = {k: v for k, v in metadata["columns"].items()}

    filtered_meta = {}
    for col_key, col_info in columns_metadata.items():
        if requested_format in col_info:
            filtered_meta[col_key] = {requested_format: col_info[requested_format]}

    # Construct the order based on the requested format
    filtered_order = [col_info[requested_format] for col_info in columns_metadata.values() if
                      requested_format in col_info]

    return jsonify({
        "meta": columns_metadata,
        "order": filtered_order  # Include the key order explicitly
    })


@app.route('/verify-password', methods=['POST'])
def verify_password():
    data = request.get_json()

    # Validate if required fields are present
    if not data or 'password' not in data or 'password_variable' not in data:
        return jsonify({"success": False, "message": "Invalid request data"}), 400

    # Retrieve the password variable and the provided password
    password_variable = data['password_variable']
    user_password = data['password']
    actual_password = os.getenv(password_variable)

    if user_password == actual_password:
        return jsonify({"success": True, "message": "Password accepted"}), 200
    else:
        return jsonify({"success": False, "message": "Invalid password"}), 403


@app.route('/data-table.json', methods=['GET'])
def get_table_data():
    try:
        df = gpd.read_file(TRACKING_FILE)
        if 'geometry' in df.columns:
            df = df.drop(columns='geometry')

        with StatusTableManager(TABLE_METADATA) as manager:
            df = manager.enforce_types(df, "geojson")
            df = manager.sort_rows(df)

        table_data = df.to_dict(orient='records')

        # Return as JSON
        return jsonify(table_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/export-excel', methods=['GET'])
def export_excel():
    try:
        # Load the GeoJSON data
        gdf = gpd.read_file(TRACKING_FILE)
        if 'geometry' in gdf.columns:
            df = gdf.drop(columns='geometry')
        else:
            df = gdf

        with StatusTableManager(TABLE_METADATA) as manager:
            df = manager.rename_columns(df, "excel", "geojson")
            df = manager.enforce_types(df, "excel")
            df = manager.sort_rows(df)

        # Define merged headers
        merged_headers = [
            {'text': 'Delivery Area Info', 'colspan': 3},
            {'text': 'MIP Task Status', 'colspan': 3},
            {'text': 'Model Manager Uploads', 'colspan': 5},
            {'text': 'Details', 'colspan': len(df.columns) - 11},
        ]

        # Generate the Excel file
        excel_output_dir = os.path.join(app.root_path, 'data', 'exports')
        os.makedirs(excel_output_dir, exist_ok=True)
        excel_filename = 'IA_BLE_Tracking.xlsx'
        df_to_excel_for_export(df, out_loc=excel_output_dir, filename=excel_filename, sheetname='Tracking_Main',
                               merged_headers=merged_headers)

        # Send the file as a response
        return send_from_directory(excel_output_dir, excel_filename, as_attachment=True)

    except Exception as e:
        logging.error(f"Error generating Excel file: {e}")
        return jsonify({'error': str(e)}), 500


@app.route("/api/sources", methods=["GET"])
def get_sources_metadata():
    """Load sources from a JSON file and return them as a response."""
    # data/mapbox_metadata/mapbox_sources.json
    sources_file = os.path.normpath(os.path.join(
        app.root_path, "data/mapbox_metadata", "mapbox_sources.json"))

    if not os.path.exists(sources_file):
        return jsonify({"error": "Sources file not found"}), 404

    with open(sources_file, "r") as f:
        sources = json.load(f)

    return jsonify(sources)


@app.route("/served/<path:filename>")
def serve_data(filename):
    data_dir = os.path.join(app.root_path, "data")
    if not os.path.exists(data_dir):
        return jsonify({"error": "Data directory not found"}), 404
    if not os.path.isfile(os.path.join(data_dir, filename)):
        return jsonify({"error": "File not found"}), 404
    return send_from_directory(data_dir, filename)


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


# Allowed extensions for file uploads
ALLOWED_EXTENSIONS = {'geojson', 'shp', 'dbf', 'shx', 'prj', 'cpg'}


def allowed_file(filename):
    return '.' in filename and \
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/update-tracking-geojson', methods=['POST'])
def update_tracking_attributes():
    if 'files' not in request.files:
        return jsonify({'success': False, 'message': 'No files part in the request'}), 400

    files = request.files.getlist('files')
    if not files or len(files) == 0:
        return jsonify({'success': False, 'message': 'No files selected'}), 400

    # Save the uploaded files to a temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        try:
            for file in files:
                if allowed_file(file.filename):
                    filename = secure_filename(file.filename)
                    file.save(os.path.join(temp_dir, filename))
                else:
                    return jsonify({'success': False, 'message': f'File type not allowed: {file.filename}'}), 400

            # Process the files
            shp_files = [f for f in os.listdir(temp_dir) if f.endswith('.shp')]
            if shp_files:
                # There should be at least one .shp file
                shp_file_path = os.path.join(temp_dir, shp_files[0])

                # Read the shapefile using GeoPandas
                gdf = gpd.read_file(shp_file_path)

                # Process the GeoDataFrame
                if 'huc8' in gdf.columns and 'HUC8' not in gdf.columns:
                    gdf['HUC8'] = gdf['huc8']
                elif 'HUC8' not in gdf.columns and 'huc8' not in gdf.columns:
                    return jsonify({'success': False, 'message': 'Required column "HUC8" not found in the data'}), 400

                # Get metadata columns
                # Load metadata directly
                with open(TABLE_METADATA) as f:
                    metadata = json.load(f)

                columns_metadata = {k: v for k, v in metadata["columns"].items()}
                # print(f"Col dict: {columns_metadata}")
                colnames = set()
                for k, file_info in columns_metadata.items():
                    if file_info.get("shapefile"):
                        colnames.add(file_info.get("shapefile"))
                print(f"Column names to match: {colnames}")

                # Count matching columns
                gdf_cols = set(gdf.columns)
                meta_cols = set(colnames)
                matching_cols = gdf_cols.intersection(meta_cols)
                if len(matching_cols) < 2:
                    logging.warning(f"Upload did not have enough matching cols: {matching_cols}")
                    return jsonify({'success': False, 'message': f'At least two metadata columns are '
                                                                 f'required, {len(matching_cols)} provided'}), 400

                gdf = gdf[gdf['project_id'].notnull()]

                # Optionally, process metadata or enforce column types using StatusTableManager
                with StatusTableManager(TABLE_METADATA) as manager:
                    gdf = manager.rename_columns(gdf, "geojson", "shapefile")
                    gdf = manager.enforce_types(gdf, "geojson")
                    gdf = manager.sort_rows(gdf)

                # Save out the new temp GeoJSON
                temp_geojson_path = os.path.join(temp_dir, 'temp_IA_BLE_Tracking.geojson')
                gdf.to_file(temp_geojson_path, driver='GeoJSON')

                # Backup the old GeoJSON
                os.makedirs(BACKUP_LOC, exist_ok=True)
                date_string = datetime.now().strftime("%Y_%m%d_%H%M%S")
                backup_filename = f"IA_BLE_Tracking_{date_string}.geojson"
                backup_path = os.path.join(BACKUP_LOC, backup_filename)
                shutil.copy2(TRACKING_FILE, backup_path)

                # Overwrite the served GeoJSON
                shutil.copy2(temp_geojson_path, TRACKING_FILE)

                # Attributes for the response
                df = gdf.drop(columns='geometry')

                # Copy CSV to temp then overwrite production csv
                save_dir, attributes_filename = os.path.split(TRACKING_FILE)
                attributes_filename, ext = os.path.splitext(attributes_filename)
                attributes_filename = attributes_filename + "_attributes.csv"
                temp_path = os.path.join(temp_dir, attributes_filename)
                df.to_csv(temp_path, index=False)

                shutil.copy2(temp_path, os.path.join(save_dir, attributes_filename))

                # *** EMIT SOCKET UPDATE HERE ***
                # Here you emit an event signaling that the data has been updated
                # You can send along any relevant data. For example, you might send:
                # - A message that data is updated
                # - The URL/path to the new GeoJSON so the client can fetch it
                # emit('data_updated', {
                #     'message': 'Tracking attributes updated successfully',
                #     'csv_url': '/served/spatial/IA_BLE_Tracking_attributes.csv',  # Adjust this URL to how you serve the file
                #     'timestamp': date_string
                # }, broadcast=True)

                return jsonify({'success': True, 'message': 'GeoJSON updated successfully'})
            else:
                return jsonify({'success': False, 'message': 'No .shp file found among uploaded files'}), 400
        except Exception as e:
            logging.error(f"Error processing uploaded files: {e}")
            return jsonify({'success': False, 'message': f'Error processing files: {str(e)}'}), 500


@app.route('/static/<path:path>')
def send_static(path):
    return send_from_directory('static', path)


if __name__ == "__main__":
    app.run(debug=True)
