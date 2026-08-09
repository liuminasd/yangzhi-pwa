# -*- coding: utf-8 -*-
"""APK 局域网下载服务器"""
import http.server
import socket
import os
import sys
import subprocess
import io

# 强制 UTF-8 输出
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

APK_PATH = os.path.join(os.path.dirname(__file__), '..', 'apk-output', '仰止AI-v1.0.0.apk')

# 获取本机局域网 IP
def get_local_ip():
    try:
        result = subprocess.run(['ipconfig'], capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0)
        for line in result.stdout.split('\n'):
            if 'IPv4' in line and '192.168' in line:
                return line.split(':')[-1].strip()
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return '127.0.0.1'

IP = get_local_ip()
PORT = 8888

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.dirname(APK_PATH), **kwargs)

    def log_message(self, format, *args):
        print(f"[{self.address_string()}] {args[0]}")

os.chdir(os.path.dirname(APK_PATH))

print(f"""
+==========================================+
|  APK Download Server                     |
+==========================================+
|                                          |
|  http://{IP}:{PORT}/仰止AI-v1.0.0.apk
|                                          |
|  Connect phone to same WiFi network      |
|  Press Ctrl+C to stop server             |
+==========================================+
""")

with http.server.HTTPServer(('0.0.0.0', PORT), Handler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
