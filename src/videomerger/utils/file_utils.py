"""File handling utilities."""
import os
from typing import List
from werkzeug.utils import secure_filename


def clean_upload_folder(folder_path: str, keep_recent: int = 0):
    """
    Clean up old files from upload folder.

    Args:
        folder_path: Path to the folder to clean
        keep_recent: Number of recent files to keep (0 = delete all)
    """
    if not os.path.exists(folder_path):
        return

    files = []
    for filename in os.listdir(folder_path):
        filepath = os.path.join(folder_path, filename)
        if os.path.isfile(filepath):
            files.append((filepath, os.path.getmtime(filepath)))

    # Sort by modification time
    files.sort(key=lambda x: x[1], reverse=True)

    # Delete old files
    for filepath, _ in files[keep_recent:]:
        try:
            os.remove(filepath)
        except OSError:
            pass


def get_file_size_mb(filepath: str) -> float:
    """
    Get file size in megabytes.

    Args:
        filepath: Path to the file

    Returns:
        File size in MB
    """
    if not os.path.exists(filepath):
        return 0.0

    size_bytes = os.path.getsize(filepath)
    return size_bytes / (1024 * 1024)


def ensure_directory_exists(directory: str):
    """
    Ensure a directory exists, create if it doesn't.

    Args:
        directory: Path to the directory
    """
    os.makedirs(directory, exist_ok=True)


def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to make it safe for saving.

    Args:
        filename: Original filename

    Returns:
        Sanitized filename
    """
    return secure_filename(filename)


def delete_files(file_paths: List[str]):
    """
    Delete multiple files.

    Args:
        file_paths: List of file paths to delete
    """
    for filepath in file_paths:
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except OSError:
            pass
