from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer
import time
import yaml
import os
from py.excel_convert_vlookups import convert_vlookups_to_values


class ExcelFileHandler(FileSystemEventHandler):
    def __init__(self, file_path, sheet_name, yaml_path):
        self.file_path = file_path
        self.sheet_name = sheet_name
        self.yaml_path = yaml_path

        # Ensure YAML file exists
        if not os.path.exists(self.yaml_path):
            with open(self.yaml_path, "w") as f:
                yaml.dump({"last_modified": None}, f)

    def get_last_modified(self):
        """Retrieve the last known modification timestamp from YAML."""
        with open(self.yaml_path, "r") as f:
            data = yaml.safe_load(f)
            if data is None:
                return None
        return data.get("last_modified")

    def update_last_modified(self, timestamp):
        """Update the last known modification timestamp in YAML."""
        with open(self.yaml_path, "w") as f:
            yaml.dump({"last_modified": timestamp}, f)

    def on_modified(self, event):
        """Triggered when the file is modified."""
        if event.src_path == self.file_path:
            self.process_file()

    def process_file(self):
        """Check timestamps and process the file if needed."""
        current_modified = os.path.getmtime(self.file_path)
        last_modified = self.get_last_modified()

        # Check if the file has been modified since the last known timestamp
        if last_modified is None or  (current_modified - last_modified) > 180:
            print(f"Processing modified file: {self.file_path}")
            try:
                convert_vlookups_to_values(
                    workbook_path=self.file_path,
                    vlookup_sheet_name=self.sheet_name
                )
                self.update_last_modified(current_modified)  # Update YAML after successful processing
                print(f"File {self.file_path} successfully converted.")
            except Exception as e:
                print(f"Error during conversion: {e}")


def start_file_observer(file_path, sheet_name, yaml_path):
    directory = os.path.dirname(file_path)
    event_handler = ExcelFileHandler(file_path, sheet_name, yaml_path)
    observer = Observer()
    observer.schedule(event_handler, path=directory, recursive=False)
    observer.start()
    return observer

def check_and_process_on_start(file_path, sheet_name, yaml_path):
    """Check and process the file if it was modified while the app was down."""
    handler = ExcelFileHandler(file_path, sheet_name, yaml_path)
    current_modified = os.path.getmtime(file_path)
    last_modified = handler.get_last_modified()

    if last_modified is None or current_modified > last_modified:
        print(f"File was modified while the app was down. Processing: {file_path}")
        handler.process_file()
