# API Documentation

## Overview

The Video Merger API provides RESTful endpoints for uploading, merging, and downloading video files.

## Base URL

```
http://localhost:5000
```

## Authentication

Currently, the API does not require authentication for local development. For production deployments, implement authentication as needed.

## Endpoints

### Health Check

Check if the API is running.

**Endpoint:** `GET /health`

**Response:**
```json
{
  "status": "healthy"
}
```

**Status Codes:**
- `200 OK`: Service is healthy

---

### Upload Videos

Upload multiple video files for merging.

**Endpoint:** `POST /api/upload`

**Content-Type:** `multipart/form-data`

**Parameters:**
- `videos` (required): Array of video files (minimum 2 files)

**Supported Formats:**
- MP4 (.mp4)
- AVI (.avi)
- MOV (.mov)
- MKV (.mkv)
- WebM (.webm)

**Example Request (curl):**
```bash
curl -X POST http://localhost:5000/api/upload \
  -F "videos=@video1.mp4" \
  -F "videos=@video2.mp4"
```

**Success Response:**
```json
{
  "message": "Files uploaded successfully",
  "files": [
    "/path/to/uploads/video1.mp4",
    "/path/to/uploads/video2.mp4"
  ],
  "count": 2
}
```

**Error Response:**
```json
{
  "error": "At least 2 videos are required"
}
```

**Status Codes:**
- `200 OK`: Upload successful
- `400 Bad Request`: Invalid request or insufficient files
- `413 Payload Too Large`: File size exceeds limit

---

### Merge Videos

Merge previously uploaded videos into a single file.

**Endpoint:** `POST /api/merge`

**Content-Type:** `application/json`

**Request Body:**
```json
{
  "files": [
    "/path/to/uploads/video1.mp4",
    "/path/to/uploads/video2.mp4"
  ],
  "output_name": "merged_video.mp4"
}
```

**Parameters:**
- `files` (required): Array of file paths to merge
- `output_name` (optional): Name for the output file (defaults to "merged_video.mp4")

**Example Request (curl):**
```bash
curl -X POST http://localhost:5000/api/merge \
  -H "Content-Type: application/json" \
  -d '{
    "files": ["/path/to/video1.mp4", "/path/to/video2.mp4"],
    "output_name": "my_merged_video.mp4"
  }'
```

**Success Response:**
```json
{
  "message": "Videos merged successfully",
  "output_file": "/path/to/outputs/merged_video.mp4"
}
```

**Error Response:**
```json
{
  "error": "No files specified"
}
```

**Status Codes:**
- `200 OK`: Merge successful
- `400 Bad Request`: Invalid request
- `500 Internal Server Error`: Merge operation failed

---

### Download Video

Download a merged video file.

**Endpoint:** `GET /api/download/<filename>`

**Parameters:**
- `filename` (required): Name of the file to download

**Example Request:**
```bash
curl -O http://localhost:5000/api/download/merged_video.mp4
```

**Status Codes:**
- `200 OK`: Download successful
- `404 Not Found`: File does not exist

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

- `200 OK`: Request successful
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Resource not found
- `413 Payload Too Large`: File size exceeds maximum allowed
- `500 Internal Server Error`: Server error during processing

## Rate Limiting

Currently not implemented. Consider adding rate limiting for production use.

## File Size Limits

- Maximum file size: 500MB (configurable via `MAX_CONTENT_LENGTH`)
- Maximum number of videos per merge: 10 (configurable via `MAX_VIDEOS_PER_MERGE`)

## Best Practices

1. **Upload Validation**: Always validate files before uploading
2. **Error Handling**: Implement proper error handling in your client
3. **File Cleanup**: Clean up uploaded files after merging
4. **Async Processing**: For large files, consider implementing asynchronous processing
5. **Progress Tracking**: Implement progress tracking for long-running operations

## Examples

### Python Example

```python
import requests

# Upload videos
files = {
    'videos': [
        open('video1.mp4', 'rb'),
        open('video2.mp4', 'rb')
    ]
}
response = requests.post('http://localhost:5000/api/upload', files=files)
upload_data = response.json()

# Merge videos
merge_request = {
    'files': upload_data['files'],
    'output_name': 'result.mp4'
}
response = requests.post(
    'http://localhost:5000/api/merge',
    json=merge_request
)

# Download result
if response.status_code == 200:
    download_url = f"http://localhost:5000/api/download/result.mp4"
    video = requests.get(download_url)
    with open('downloaded_video.mp4', 'wb') as f:
        f.write(video.content)
```

### JavaScript Example

```javascript
// Upload videos
const formData = new FormData();
formData.append('videos', file1);
formData.append('videos', file2);

const uploadResponse = await fetch('/api/upload', {
  method: 'POST',
  body: formData
});
const uploadData = await uploadResponse.json();

// Merge videos
const mergeResponse = await fetch('/api/merge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    files: uploadData.files,
    output_name: 'merged.mp4'
  })
});

// Download result
if (mergeResponse.ok) {
  window.location.href = '/api/download/merged.mp4';
}
```
