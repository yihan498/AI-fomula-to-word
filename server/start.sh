#\!/bin/bash
cd "$(dirname "$0")"
echo "Starting server at http://127.0.0.1:5678 ..."
python3 server.py
