"""Unit tests for the Flask application."""
import json


def test_index_route(client):
    """Test the index page loads correctly."""
    response = client.get('/')
    assert response.status_code == 200
    assert b'Video Merger Application' in response.data


def test_health_endpoint(client):
    """Test the health check endpoint."""
    response = client.get('/health')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'healthy'


def test_upload_no_files(client):
    """Test upload endpoint with no files."""
    response = client.post('/api/upload')
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data


def test_merge_no_data(client):
    """Test merge endpoint with no data."""
    response = client.post('/api/merge',
                          data=json.dumps({}),
                          content_type='application/json')
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data


def test_download_nonexistent_file(client):
    """Test downloading a file that doesn't exist."""
    response = client.get('/api/download/nonexistent.mp4')
    assert response.status_code == 404
