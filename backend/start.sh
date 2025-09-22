#!/bin/bash
# Railway startup script for Flask backend

# Install dependencies
pip install -r requirements.txt

# Start the Flask application using Gunicorn
gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 1 --timeout 300 app:app
