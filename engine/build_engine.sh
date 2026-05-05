#!/bin/bash
set -e

echo "Building standalone Python engine..."

# Create a fresh virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install playwright pyinstaller

# Build the standalone executable
pyinstaller --onefile --name extractor extractor.py

# Create bin directory in electron project if it doesn't exist
mkdir -p ../resources/bin

# Move the built binary to the electron project resources folder
mv dist/extractor ../resources/bin/

echo "Build complete! Binary located at ../resources/bin/extractor"
