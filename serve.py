import os
from http.server import HTTPServer, SimpleHTTPRequestHandler

os.chdir("public")  # Nos movemos a la carpeta que contiene el HTML

server = HTTPServer(("localhost", 8000), SimpleHTTPRequestHandler)
print("Servidor iniciado en http://localhost:8000")
server.serve_forever()
