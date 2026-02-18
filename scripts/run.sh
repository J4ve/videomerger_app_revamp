#!/bin/bash
# Script to run the Video Merger application

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Video Merger Application...${NC}"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Virtual environment not found. Creating one...${NC}"
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies if needed
if [ ! -f "venv/installed" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    pip install -r requirements.txt
    pip install -e .
    touch venv/installed
fi

# Create necessary directories
mkdir -p src/videomerger/static/uploads
mkdir -p src/videomerger/static/outputs

# Export environment variables
export FLASK_APP=src/videomerger/app.py
export FLASK_ENV=development

# Run the application
echo -e "${GREEN}Application starting at http://localhost:5000${NC}"
python src/videomerger/app.py
