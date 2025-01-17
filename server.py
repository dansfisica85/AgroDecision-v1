import http.server
import socketserver

PORT = 8000

Handler = http.server.SimpleHTTPRequestHandler

Handler.extensions_map = {
    '.manifest': 'text/cache-manifest',
    '.html': 'text/html',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.svg': 'image/svg+xml',
    '.css': 'text/css',
    '.js': 'application/x-javascript',
    '': 'application/octet-stream',
}

httpd = socketserver.TCPServer(("", PORT), Handler)

print(f"Servidor rodando na porta {PORT}...")
httpd.serve_forever()