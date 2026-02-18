// Video Merger App - Frontend JavaScript

class VideoMergerApp {
    constructor() {
        this.selectedFiles = [];
        this.uploadedFilePaths = [];
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        this.videoInput = document.getElementById('videoInput');
        this.uploadArea = document.getElementById('uploadArea');
        this.fileList = document.getElementById('fileList');
        this.actions = document.getElementById('actions');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.mergeBtn = document.getElementById('mergeBtn');
        this.outputName = document.getElementById('outputName');
        this.statusMessage = document.getElementById('statusMessage');
        this.progressBar = document.getElementById('progressBar');
        this.resultSection = document.getElementById('resultSection');
        this.downloadLink = document.getElementById('downloadLink');
    }

    attachEventListeners() {
        // File input change
        this.videoInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));

        // Buttons
        this.uploadBtn.addEventListener('click', () => this.uploadFiles());
        this.mergeBtn.addEventListener('click', () => this.mergeVideos());
    }

    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.addFiles(files);
    }

    handleDragOver(event) {
        event.preventDefault();
        this.uploadArea.classList.add('drag-over');
    }

    handleDragLeave(event) {
        event.preventDefault();
        this.uploadArea.classList.remove('drag-over');
    }

    handleDrop(event) {
        event.preventDefault();
        this.uploadArea.classList.remove('drag-over');
        const files = Array.from(event.dataTransfer.files);
        const videoFiles = files.filter(file => file.type.startsWith('video/'));
        this.addFiles(videoFiles);
    }

    addFiles(files) {
        files.forEach(file => {
            if (!this.selectedFiles.find(f => f.name === file.name)) {
                this.selectedFiles.push(file);
            }
        });
        this.renderFileList();
        this.updateUI();
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.renderFileList();
        this.updateUI();
    }

    renderFileList() {
        if (this.selectedFiles.length === 0) {
            this.fileList.innerHTML = '';
            return;
        }

        this.fileList.innerHTML = this.selectedFiles.map((file, index) => `
            <div class="file-item">
                <div>
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${this.formatFileSize(file.size)}</div>
                </div>
                <button class="remove-btn" onclick="app.removeFile(${index})">Remove</button>
            </div>
        `).join('');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    updateUI() {
        if (this.selectedFiles.length >= 2) {
            this.actions.style.display = 'flex';
        } else {
            this.actions.style.display = 'none';
        }
    }

    async uploadFiles() {
        if (this.selectedFiles.length < 2) {
            this.showStatus('Please select at least 2 videos', 'error');
            return;
        }

        const formData = new FormData();
        this.selectedFiles.forEach(file => {
            formData.append('videos', file);
        });

        this.uploadBtn.disabled = true;
        this.showStatus('Uploading videos...', 'info');
        this.progressBar.style.display = 'block';

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                this.uploadedFilePaths = data.files;
                this.showStatus(`Successfully uploaded ${data.count} videos!`, 'success');
                this.mergeBtn.style.display = 'inline-block';
                this.uploadBtn.style.display = 'none';
            } else {
                this.showStatus(`Error: ${data.error}`, 'error');
                this.uploadBtn.disabled = false;
            }
        } catch (error) {
            this.showStatus(`Upload failed: ${error.message}`, 'error');
            this.uploadBtn.disabled = false;
        } finally {
            this.progressBar.style.display = 'none';
        }
    }

    async mergeVideos() {
        if (this.uploadedFilePaths.length < 2) {
            this.showStatus('Please upload videos first', 'error');
            return;
        }

        const outputFilename = this.outputName.value.trim() || 'merged_video.mp4';

        this.mergeBtn.disabled = true;
        this.showStatus('Merging videos... This may take a while.', 'info');
        this.progressBar.style.display = 'block';

        try {
            const response = await fetch('/api/merge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    files: this.uploadedFilePaths,
                    output_name: outputFilename
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showStatus('Videos merged successfully!', 'success');
                this.showDownloadLink(outputFilename);
            } else {
                this.showStatus(`Error: ${data.error}`, 'error');
                this.mergeBtn.disabled = false;
            }
        } catch (error) {
            this.showStatus(`Merge failed: ${error.message}`, 'error');
            this.mergeBtn.disabled = false;
        } finally {
            this.progressBar.style.display = 'none';
        }
    }

    showStatus(message, type) {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type}`;
    }

    showDownloadLink(filename) {
        this.resultSection.style.display = 'block';
        this.downloadLink.innerHTML = `
            <a href="/api/download/${filename}" class="download-link" download>
                Download Merged Video
            </a>
        `;
    }
}

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new VideoMergerApp();
});
