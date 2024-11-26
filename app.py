from flask import Flask, render_template, request, jsonify, send_from_directory
import os

app = Flask(__name__)


# Homepage route
@app.route("/")
def home():
    return render_template("index.html")  # Dynamic reference to your HTML


# Example dynamic route
@app.route("/process", methods=["POST"])
def process():
    data = request.json  # Handle JSON sent from the client
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Example dynamic processing
    name = data.get("name", "Guest")
    response = {"message": f"Hello, {name}!"}
    return jsonify(response)

@app.route("/data/<path:filename>")
def serve_data(filename):
    data_dir = os.path.join(app.root_path, "data")
    if not os.path.exists(data_dir):
        return jsonify({"error": "Data directory not found"}), 404
    if not os.path.isfile(os.path.join(data_dir, filename)):
        return jsonify({"error": "File not found"}), 404
    return send_from_directory(data_dir, filename)


# Another example dynamic route
@app.route("/greet/<username>")
def greet(username):
    return render_template("result.html", username=username)


if __name__ == "__main__":
    app.run(debug=True)
