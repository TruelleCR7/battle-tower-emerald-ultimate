"""Site Battle Tower v0.5.0 : serveur Web statique, accès PC et LAN."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import webbrowser
import threading
import argparse
import socket

SITE = Path(__file__).resolve().parent / 'dist'
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,directory=str(SITE),**kwargs)
    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Cache-Control','no-cache')
        super().end_headers()

def local_ip():
    try:
        with socket.socket(socket.AF_INET,socket.SOCK_DGRAM) as sock:
            sock.connect(('192.0.2.1',1))
            return sock.getsockname()[0]
    except OSError:
        try:return socket.gethostbyname(socket.gethostname())
        except OSError:return 'ADRESSE_IP_DU_PC'

if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Battle Tower Web')
    parser.add_argument('--lan',action='store_true',help='autoriser les appareils du Wi-Fi local')
    parser.add_argument('--no-open',action='store_true',help='ne pas lancer Chrome sur le PC')
    parser.add_argument('--port',type=int,default=8765)
    args=parser.parse_args()
    host='0.0.0.0' if args.lan else '127.0.0.1'
    with ThreadingHTTPServer((host,args.port),Handler) as server:
        print('BATTLE TOWER WEB 0.5 — ZERO ROM')
        print(f'PC : http://127.0.0.1:{args.port}/')
        if args.lan:
            print(f'GALAXY S22 (MEME WI-FI) : http://{local_ip()}:{args.port}/')
            print('Si le S22 ne se connecte pas : autoriser Python sur le reseau prive dans le pare-feu Windows.')
            print('HTTP local : PWA et mode hors ligne necessitent un hebergement HTTPS.')
        if not args.no_open:
            threading.Timer(0.5,lambda:webbrowser.open(f'http://127.0.0.1:{args.port}/')).start()
        try:server.serve_forever()
        except KeyboardInterrupt:pass
