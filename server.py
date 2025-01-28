from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        return super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def guess_type(self, path):
        mimetype = super().guess_type(path)
        if mimetype == None:
            if path.endswith('.js'):
                return 'application/javascript'
            elif path.endswith('.css'):
                return 'text/css'
            elif path.endswith('.json'):
                return 'application/json'
            elif path.endswith('.html'):
                return 'text/html'
        return mimetype

def run_server(port=8000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, CORSRequestHandler)
    
    print(f'Iniciando servidor em http://localhost:{port}')
    print('Para acessar, abra o navegador e digite: http://localhost:8000')
    print('Para parar o servidor, pressione Ctrl+C')
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor encerrado.')
        httpd.server_close()

if __name__ == '__main__':
    run_server()