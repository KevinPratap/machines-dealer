import http.server
import socketserver
import webbrowser
import os
import json
import shutil
from datetime import datetime
import base64
import binascii
import subprocess
import sys

PORT = 8000
DIRECTORY = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def translate_path(self, path):
        print(f"Translating path: {path}")
        # Handle clean URLs (e.g., /admin -> admin.html)
        # Remove query parameters
        path_only = path.split('?')[0]
        
        if path_only == '/admin':
            path = '/admin.html'
        elif not path_only.endswith('/') and not '.' in os.path.basename(path_only):
            # Check if an .html file exists for this path
            potential_file = path_only.lstrip('/') + '.html'
            if os.path.exists(os.path.join(DIRECTORY, potential_file)):
                path = '/' + potential_file
        
        return super().translate_path(path)

    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)

        try:
            print(f"POST request to: {self.path}")
            
            # Mapping endpoints to target files
            endpoints = {
                '/api/save-inventory': 'inventory.json',
                '/api/save-news': 'news.json',
                '/api/save-blogs': 'blogs.json',
                '/api/save-videos': 'videos.json',
                '/api/save-pages': 'pages.json',
                '/api/save-staff': 'our_staff.json',
                '/api/save-settings': 'settings.json',
                '/api/save-subscribers': 'subscribers.json'
            }

            if self.path == '/api/subscribe':
                # Lead capture endpoint
                try:
                    data = json.loads(post_data)
                    email = data.get('email')
                    
                    if not email:
                        self.send_response(400)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({"status": "error", "message": "Email is required"}).encode())
                        return

                    sub_path = os.path.join(DIRECTORY, 'data', 'subscribers.json')
                    subs = []
                    if os.path.exists(sub_path):
                        with open(sub_path, 'r', encoding='utf-8') as f:
                            subs = json.load(f)
                    
                    # Prevent duplicates
                    if any(s.get('email') == email for s in subs):
                        self.send_response(200)
                        self.send_header('Content-type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({"status": "success", "message": "Already subscribed"}).encode())
                        return

                    subs.append({
                        "email": email,
                        "date": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    })

                    with open(sub_path, 'w', encoding='utf-8') as f:
                        json.dump(subs, f, indent=4)

                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "success", "message": "Subscription successful"}).encode())
                    return
                except Exception as e:
                    self.send_response(500)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode())
                    return

            if self.path == '/api/sync-reviews':
                # Run the sync script
                script_path = os.path.join(DIRECTORY, 'scripts', 'sync_reviews.py')
                try:
                    result = subprocess.run([sys.executable, script_path], capture_output=True, text=True)
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(result.stdout.encode())
                    return
                except Exception as e:
                    self.send_response(500)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode())
                    return

            if self.path in endpoints:
                target_file = endpoints[self.path]
            elif self.path == '/api/upload':
                data = json.loads(post_data)
                folder = data.get('folder', 'misc')
                filename = data.get('filename')
                content = data.get('content') # Base64 string

                if not filename or not content:
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": "Missing filename or content"}).encode())
                    return

                try:
                    file_data = base64.b64decode(content)
                except (binascii.Error, ValueError):
                    self.send_response(400)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({"status": "error", "message": "Invalid base64 content"}).encode())
                    return

                target_dir = os.path.join(DIRECTORY, 'uploads', folder)
                if not os.path.exists(target_dir):
                    os.makedirs(target_dir, exist_ok=True)

                target_path = os.path.join(target_dir, filename)
                with open(target_path, 'wb') as f:
                    f.write(file_data)

                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "success", "message": f"File saved to {folder}/{filename}"}).encode())
                return
            else:
                self.send_response(404)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": "Endpoint not found"}).encode())
                return

            data = json.loads(post_data)
            file_path = os.path.join(DIRECTORY, 'data', target_file)
            if os.path.exists(file_path):
                backup_path = file_path + f'.{datetime.now().strftime("%Y%m%d%H%M%S")}.bak'
                shutil.copy2(file_path, backup_path)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=4)
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "success", "message": f"{target_file} saved and backed up"}).encode())
            
        except Exception as e:
            # Handle potential connection errors during sending the error response
            try:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode())
            except (ConnectionAbortedError, BrokenPipeError):
                pass 

    def handle_one_request(self):
        """Override to handle Windows connection aborts gracefully."""
        try:
            return super().handle_one_request()
        except (ConnectionAbortedError, BrokenPipeError):
            print(f"Client disconnected abruptly for: {self.path}")
        except Exception as e:
            print(f"Unexpected error: {e}")
            return super().handle_one_request() # Fallback to default handler for other errors

def start_server():
    os.chdir(DIRECTORY)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"Server started at http://localhost:{PORT}")
        print("Press Ctrl+C to stop the server.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
            httpd.server_close()

if __name__ == "__main__":
    start_server()
