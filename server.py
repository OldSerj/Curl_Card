import mimetypes
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs, unquote
import json
import traceback
import webbrowser

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    requests = None
    BeautifulSoup = None

file_map = {
    '/': 'curl-card/index.html',
    '/index.html': 'curl-card/index.html',
    '/style.css': 'curl-card/style.css',
    '/script.js': 'curl-card/script.js',
}

class RequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            parsed_url = urlparse(self.path)
            path = parsed_url.path

            if path.startswith('/preview'):
                self.handle_preview()
            elif path in file_map:
                file_name = file_map[path]
                content_type = self.get_content_type(file_name)
                with open(file_name, 'rb') as f:
                    self.send_response(200)
                    self.send_header('Content-type', content_type)
                    self.end_headers()
                    self.wfile.write(f.read())
            else:
                self.send_response(404)
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                self.wfile.write(b'Not Found')
        except Exception as e:
            print("Exception in do_GET:", e)
            traceback.print_exc()
            try:
                self.send_response(500)
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                self.wfile.write(b'Internal Server Error')
            except Exception:
                pass

    def get_content_type(self, file_name):
        if file_name.endswith('.js'):
            return 'application/javascript'
        elif file_name.endswith('.css'):
            return 'text/css'
        elif file_name.endswith('.html'):
            return 'text/html'
        return mimetypes.guess_type(file_name)[0] or 'application/octet-stream'

    def handle_preview(self):
        if requests is None or BeautifulSoup is None:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Missing dependencies'}).encode('utf-8'))
            return

        query = parse_qs(urlparse(self.path).query)
        target = query.get('url', [None])[0]
        if not target:
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Missing URL'}).encode('utf-8'))
            return

        try:
            metadata = fetch_metadata(unquote(target))
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(metadata).encode('utf-8'))
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))

def fetch_metadata(url):
    headers = {'User-Agent': 'curl-card/1.0 (+https://localhost:8000)'}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, 'html.parser')
    except Exception as e:
        return {
            'title': '',
            'description': f'Request error: {str(e)}',
            'image': '',
            'site': urlparse(url).netloc,
            'content': '',
        }

    def get_meta(*keys):
        for key in keys:
            tag = soup.find('meta', attrs={'property': key}) or soup.find('meta', attrs={'name': key})
            if tag and tag.get('content'):
                return tag['content']
        return None

    # New content extraction logic (basic text from main or article tag)
    article = soup.find('article') or soup.find('main')
    paragraphs = []
    if article:
        for p in article.find_all('p'):
            text = p.get_text(strip=True)
            if text:
                paragraphs.append(text)
    elif soup.body:
        for p in soup.body.find_all('p'):
            text = p.get_text(strip=True)
            if text:
                paragraphs.append(text)

    content = '\n\n'.join(paragraphs[:5])  # Just the first 5 paragraphs, to keep it short

    return {
        'title': get_meta('og:title') or (soup.title.string if soup.title else ''),
        'description': get_meta('og:description', 'description') or '',
        'image': get_meta('og:image', 'twitter:image') or '',
        'site': urlparse(url).netloc,
        'content': content
    }

def run_server():
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, RequestHandler)
    webbrowser.open('http://localhost:8000')
    print('🔗 curl-card server running on http://localhost:8000')
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()
