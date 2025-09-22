#!/usr/bin/env python3
"""
Development script for running React frontend and Flask backend concurrently
"""

import sys
import os
import subprocess
import threading
import time

def run_backend():
    """Run Flask backend in development mode"""
    print("🐍 Starting Flask backend...")
    
    # Use virtual environment's Python
    if sys.platform == "win32":
        python_path = os.path.join(".venv", "Scripts", "python")
    else:
        python_path = os.path.join(".venv", "bin", "python")
    
    app_path = os.path.join("backend", "app.py")
    
    try:
        subprocess.run([python_path, app_path])
    except KeyboardInterrupt:
        print("\n🐍 Backend stopped")

def run_frontend():
    """Run React frontend in development mode"""
    print("⚛️  Starting React frontend...")
    
    frontend_path = os.path.join(os.path.dirname(__file__), 'frontend')
    
    try:
        subprocess.run(['npm', 'start'], cwd=frontend_path)
    except KeyboardInterrupt:
        print("\n⚛️  Frontend stopped")

def setup_development():
    """Setup development environment"""
    print("🔧 Setting up development environment...")
    
    # Create virtual environment if needed
    venv_path = os.path.join(os.path.dirname(__file__), '.venv')
    if not os.path.exists(venv_path):
        print("📦 Creating virtual environment...")
        subprocess.check_call([sys.executable, "-m", "venv", ".venv"])
    
    # Install Python dependencies
    print("📦 Installing Python dependencies...")
    if sys.platform == "win32":
        pip_path = os.path.join(".venv", "Scripts", "pip")
    else:
        pip_path = os.path.join(".venv", "bin", "pip")
    
    subprocess.check_call([pip_path, "install", "-r", "requirements.txt"])
    
    # Install Node.js dependencies
    print("📦 Installing Node.js dependencies...")
    frontend_path = os.path.join(os.path.dirname(__file__), 'frontend')
    subprocess.check_call(['npm', 'install'], cwd=frontend_path)
    
    print("✅ Development environment ready!")

if __name__ == "__main__":
    print("Brand Sponsorship ROI Analytics - Development Mode")
    print("=" * 60)
    
    # Check if setup is needed
    if len(sys.argv) > 1 and sys.argv[1] == "setup":
        setup_development()
        sys.exit(0)
    
    print("🚀 Starting development servers...")
    print("⚛️  React Frontend: http://localhost:3000")
    print("🐍 Flask Backend: http://localhost:5000")
    print("📊 API Docs: http://localhost:5000/api/health")
    print("\n💡 Tip: React app will proxy API calls to Flask backend")
    print("🔥 Hot reload enabled for both frontend and backend")
    print("=" * 60)
    
    # Start backend in a thread
    backend_thread = threading.Thread(target=run_backend)
    backend_thread.daemon = True
    backend_thread.start()
    
    # Give backend time to start
    time.sleep(2)
    
    # Start frontend (this will block until Ctrl+C)
    try:
        run_frontend()
    except KeyboardInterrupt:
        print("\n🛑 Development servers stopped")
        sys.exit(0)
