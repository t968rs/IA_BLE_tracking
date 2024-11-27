from flask import Flask, render_template, request, jsonify, send_from_directory, send_file
import os
import shutil
from dotenv import load_dotenv
from py.excel_convert_vlookups import convert_vlookups_to_values
from py.files_watcher import start_file_observer, check_and_process_on_start



load_dotenv()  # Load environment variables from .env file
app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")


EXCEL_DIR = os.path.join(app.root_path, "data", "tables")
EXCEL_FILE = os.path.join(EXCEL_DIR, "IA_BLE_Tracking.xlsx")
SHEET_NAME = "Tracking_VLOOKUP"
YAML_FILE = os.path.join(EXCEL_DIR, "last_modified.yaml")

# Start the file observer when the app starts
# check_and_process_on_start(EXCEL_FILE, SHEET_NAME, YAML_FILE)
# observer = start_file_observer(EXCEL_FILE, SHEET_NAME, YAML_FILE)


# Homepage route
@app.route("/")
def home():
    mapbox_token = os.getenv("MAPBOX_TOKEN")
    return render_template("index.html",
                           mapbox_token=mapbox_token)  # Dynamic reference to HTML


@app.route("/excel")
def serve_excel():
    file_path = os.path.join(EXCEL_DIR, "IA_BLE_Tracking.xlsx")
    sheet_name = "Tracking_Main_values"

    if not os.path.exists(file_path):
        return jsonify({"error": "File not found"}), 404

    # Create a custom response
    response = send_from_directory(
        directory=EXCEL_DIR,
        path="IA_BLE_Tracking.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        as_attachment=True,
    )

    # Add the sheet name as a custom header
    target_sheet = sheet_name
    response.headers["Sheet-Name"] = target_sheet
    return response

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
