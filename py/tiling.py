import subprocess
import geopandas as gpd
import os
import json
import shutil
import requests
import dotenv

TILING_ENV_PATH = "../data/mapbox_metadata/mapbox_tilekey.env"
USERNAME = "t968rs"


def check_crs(input_file):
    gdf = gpd.read_file(input_file)
    if gdf.crs != "EPSG:4326":
        print(f'\tConverting {input_file} to EPSG:4326...')
        gdf = gdf.to_crs("EPSG:4326")
        gdf.to_file(input_file)

def delete_existing_source(source_name):
    access_token = check_mapbox_api(USERNAME)
    url = f"https://api.mapbox.com/tilesets/v1/sources/{USERNAME}?access_token={access_token}"
    response = requests.get(url)

    if response.ok:
        sources = response.json()
        print(f"Sources: {sources}")
        for source in sources:
            if source.get("id") == f"mapbox://tileset-source/{source_name}":
                print(f"Tileset source '{source_name}' exists.")
                del_url = f"https://api.mapbox.com/tilesets/v1/sources/{source_name}?access_token={access_token}"
                response = requests.delete(del_url)
                if response.ok:
                    print(f"\tDeleted existing tileset source: {source_name}")
                else:
                    print(f"\tError deleting existing tileset source: {source_name}")

def check_source_exists(source_id):
    access_token = check_mapbox_api(USERNAME)
    url = f"https://api.mapbox.com/tilesets/v1/sources/{USERNAME}?access_token={access_token}"
    response = requests.get(url)

    if response.ok:
        sources = response.json()
        print(f"Sources: {sources}")
        for source in sources:
            if source.get("id") == source_id:
                print(f"Tileset source '{source_id}' exists.")
                return True
    return False

def check_tileset_exists(tileset_name):
    access_token = check_mapbox_api(USERNAME)
    url = f"https://api.mapbox.com/tilesets/v1/{USERNAME}?access_token={access_token}"
    response = requests.get(url)

    if response.ok:
        tilesets = response.json()
        for tileset in tilesets:
            print(f'Tileset: {tileset}')
            if tileset.get("id") == f"{USERNAME}.{tileset_name}":
                print(f"Tileset '{tileset_name}' exists.")
                return True
        print(f"Tileset '{tileset_name}' does not exist.")
        return False
    else:
        print("Error checking tilesets:")
        print(response.status_code, response.text)
        return False

def check_mapbox_api(username):
    env = dotenv.load_dotenv(TILING_ENV_PATH)
    if not env:
        raise ValueError(
            "Mapbox API token not found. Please set the TILES_TOKEN environment variable."
        )
    access_token = dotenv.get_key(TILING_ENV_PATH, "TILES_TOKEN")
    url = f"https://api.mapbox.com/tilesets/v1/{username}?access_token=" + access_token

    response = requests.get(url)

    if response.ok:
        account_info_path = os.path.split(TILING_ENV_PATH)[0] + "/account_info.json"
        with open(account_info_path, 'w') as outfile:
            json.dump(response.json(), outfile, indent=4)
        return access_token
    else:
        print("Error:", response.status_code, response.text)

def preprocess_geojson(input_path, id_field="HUC8"):
    # First, remove all columns except HUC8
    gdf = gpd.read_file(input_path)
    gdf = gdf[[id_field, "geometry"]]
    gdf.to_file(input_path, driver="GeoJSON")

    with open(input_path, 'r') as infile:
        geojson = json.load(infile)

    input_dir, input_file = os.path.split(input_path)
    input_name, input_ext = os.path.splitext(input_file)

    output_path = os.path.join(input_dir, f"{input_name}_preprocessed{input_ext}")

    # Convert FeatureCollection to line-delimited GeoJSON
    if geojson.get("type") == "FeatureCollection":
        with open(output_path, 'w') as outfile:
            for feature in geojson["features"]:
                outfile.write(json.dumps(feature) + "\n")
        print(f"Converted to line-delimited GeoJSON: {output_path}")
    else:
        print("Input GeoJSON is not a FeatureCollection.")

    return output_path


def upload_tileset_source(username, tileset_name, geojson_file):
    full_name = f"{username}/{tileset_name}"
    delete_existing_source(full_name)

    # Preprocess
    geojson_file = preprocess_geojson(geojson_file)

    # Get token
    access_token = check_mapbox_api(username)

    full_name = f"{username}/{tileset_name}"
    url = f"https://api.mapbox.com/tilesets/v1/sources/{full_name}?access_token={access_token}"

    with open(geojson_file, 'rb') as geojson:
        response = requests.post(
            url,
            files={"file": (f"{tileset_name}.geojson", geojson, "application/json")}
        )

    if response.ok:
        print("Tileset source uploaded successfully.")
        tileset_source_info_path = os.path.join(os.path.split(TILING_ENV_PATH)[0], "temp", "tileset_source_info.json")
        with open(tileset_source_info_path, 'w') as outfile:
            json.dump(response.json(), outfile, indent=4)
        return tileset_source_info_path
    else:
        print("Error uploading tileset source:")
        print(response.status_code, response.text)

def prep_post_payload(recipe, tileset_name, full_name, access_token):
    # Prepare payload
    payload = {
        "recipe": recipe,
        "name": tileset_name,
        "description": f"Custom tileset created from GeoJSON, {full_name}",
        "visibility": "private"
    }

    # Create or update tileset
    url = f"https://api.mapbox.com/tilesets/v1/{USERNAME}.{tileset_name}?access_token={access_token}"
    print(f"\tURL: {url}")
    response = requests.post(url, json=payload)

    return response

def create_new_tileset(tileset_name, recipe):
    access_token = check_mapbox_api(USERNAME)
    full_name = f"{USERNAME}/{tileset_name}"

    return prep_post_payload(recipe, tileset_name, full_name, access_token)


def update_tileset_recipe(username, tileset_name, info_json, suffix=""):
    access_token = check_mapbox_api(username)

    tileset_id = f"{username}.{tileset_name}"

    # Retrieve the tileset source ID from info_json
    with open(info_json, 'r') as infile:
        source_info = json.load(infile)
        source_id = source_info.get("id")
        if not source_id:
            print("Error: Source ID is missing from info_json.")
            return False
    check_source_exists(source_id)

    # Define the new recipe
    recipe = {
      "version": 1,
      "layers": {
        f"{tileset_name}{suffix}": {
          "source": f"mapbox://tileset-source/{USERNAME}/{tileset_name}",
          "minzoom": 3,
          "maxzoom": 16,
          "features": {
            "id": ["get", "HUC8"]
          }
        }
      }
    }

    # Check if the tileset exists
    tileset_check_url = f"https://api.mapbox.com/tilesets/v1/{tileset_id}?access_token={access_token}"
    get_res = requests.get(tileset_check_url)
    if not get_res.ok:
        print(f"\tCan't get tileset details: {get_res.status_code}, {get_res.text}")
        print("\tAttempting to create a new tileset...")
        create_res = create_new_tileset(tileset_name, recipe)
        if create_res.ok:
            print("Tileset created successfully.")
            print(create_res.json())
            return True
        else:
            print("Error creating tileset:")
            print(create_res.status_code, create_res.text)
            return False

    # Update the recipe using PUT
    update_url = f"https://api.mapbox.com/tilesets/v1/{tileset_id}/recipe?access_token={access_token}"
    response = requests.put(update_url, json=recipe)
    if response.ok:
        print("Recipe updated successfully.")
        print(response.json())
        return True
    else:
        print("Error updating recipe:")
        print(response.status_code, response.text, response.url)
        return False

def check_tileset_info(tileset_name):
    access_token = check_mapbox_api(USERNAME)
    url = f"https://api.mapbox.com/tilesets/v1/{USERNAME}.{tileset_name}?access_token={access_token}"
    response = requests.get(url)
    if response.ok:
        tileset_info = response.json()
        return tileset_info
    else:
        print("Error checking tileset info:")
        print(response.status_code, response.text)
        return False

def publish_tileset(username, tileset_name):
    access_token = check_mapbox_api(username)
    full_name = f"{username}/{tileset_name}"
    url = f"https://api.mapbox.com/tilesets/v1/{username}.{tileset_name}/publish?access_token={access_token}"

    response = requests.post(url)

    if response.ok:
        print("Tileset published successfully.")
        print(response.json())
    else:
        print("Error publishing tileset:")
        print(response.status_code, response.text)



if __name__ == "__main__":

    user_name = "t968rs"
    tileset_nameing = "ia-ble-tracking"
    suffix = "-01"
    geojson_filepath = r"Z:\automation\toolboxes\IA_BLE_tracking\data\spatial\IA_BLE_Tracking.geojson"
    recipe_filepath = r"Z:\automation\toolboxes\IA_BLE_tracking\data\mapbox_metadata\tileset_recipe_template.json"

    tilset_info = check_tileset_info(tileset_nameing)
    if tilset_info:
        with open(r"Z:\automation\toolboxes\IA_BLE_tracking\data\mapbox_metadata\temp\tileset_info.json", 'w') as outfile:
            json.dump(tilset_info, outfile, indent=4)
    else:
        print(f"Tileset '{tileset_nameing}' does not exist.")
    # uploaded_info_path = upload_tileset_source(user_name, tileset_nameing, geojson_filepath)
    #
    # update_tileset_recipe(user_name, tileset_nameing, uploaded_info_path, suffix)
    # publish_tileset(
    #     user_name,
    #     tileset_nameing,)




