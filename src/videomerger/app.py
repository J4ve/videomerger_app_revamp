"""Main Flask application entry point."""
import os
from flask import Flask, render_template, request, jsonify, send_file
from werkzeug.utils import secure_filename

from videomerger.core.video_processor import VideoProcessor
from videomerger.utils.config import Config


def create_app(config=None):
    """Application factory pattern for creating Flask app."""
    app = Flask(__name__, template_folder="templates", static_folder="static")

    # Load configuration
    if config is None:
        app.config.from_object(Config)
    else:
        app.config.from_object(config)

    # Ensure upload and output directories exist
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
    os.makedirs(app.config["OUTPUT_FOLDER"], exist_ok=True)

    # Initialize video processor
    video_processor = VideoProcessor()

    @app.route("/")
    def index():
        """Render the main page."""
        return render_template("index.html")

    @app.route("/api/upload", methods=["POST"])
    def upload_videos():
        """Handle video file uploads."""
        if "videos" not in request.files:
            return jsonify({"error": "No videos provided"}), 400

        files = request.files.getlist("videos")
        if not files or len(files) < 2:
            return jsonify({"error": "At least 2 videos are required"}), 400

        uploaded_files = []
        for file in files:
            if file and allowed_file(file.filename, app.config["ALLOWED_EXTENSIONS"]):
                filename = secure_filename(file.filename)
                filepath = os.path.join(app.config["UPLOAD_FOLDER"], filename)
                file.save(filepath)
                uploaded_files.append(filepath)

        if len(uploaded_files) < 2:
            return jsonify({"error": "Invalid file types"}), 400

        return (
            jsonify(
                {
                    "message": "Files uploaded successfully",
                    "files": uploaded_files,
                    "count": len(uploaded_files),
                }
            ),
            200,
        )

    @app.route("/api/merge", methods=["POST"])
    def merge_videos():
        """Merge uploaded videos."""
        data = request.get_json()

        if not data or "files" not in data:
            return jsonify({"error": "No files specified"}), 400

        video_files = data["files"]
        output_filename = data.get("output_name", "merged_video.mp4")

        try:
            output_path = video_processor.merge_videos(
                video_files, os.path.join(app.config["OUTPUT_FOLDER"], output_filename)
            )
            return (
                jsonify({"message": "Videos merged successfully", "output_file": output_path}),
                200,
            )
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/download/<filename>")
    def download_video(filename):
        """Download merged video."""
        filepath = os.path.join(app.config["OUTPUT_FOLDER"], secure_filename(filename))
        if os.path.exists(filepath):
            return send_file(filepath, as_attachment=True)
        return jsonify({"error": "File not found"}), 404

    @app.route("/health")
    def health():
        """Health check endpoint."""
        return jsonify({"status": "healthy"}), 200

    return app


def allowed_file(filename, allowed_extensions):
    """Check if file has allowed extension."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in allowed_extensions


if __name__ == "__main__":
    app = create_app()
    app.run(
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 5000)),
        debug=os.getenv("DEBUG", "True") == "True",
    )
