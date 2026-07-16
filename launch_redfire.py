#!/usr/bin/env python3
"""
REDFIRE Desktop Launcher
Starts backend + frontend servers silently, opens browser, then exits.
"""

import os
import sys
import subprocess
import time
import webbrowser
import struct
import zlib

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT, "backend")
FRONTEND_DIR = os.path.join(ROOT, "frontend")


def generate_icon_ico(path: str):
    """Generate a flame-shaped icon (multi-res 16/32/48)."""
    sizes = [(16, 16), (32, 32), (48, 48)]
    png_list = []

    def inside_flame(x, y, w, h):
        cx, cy = w // 2, int(h * 0.55)
        dx, dy = x - cx, y - cy
        # Flame profile: wider at bottom, tapered at top
        ny = dy / cy if cy else 0
        half_w = (0.55 - ny * 0.35) if ny < 0 else (0.55 + ny * 0.2)
        if half_w < 0.05:
            return False
        return abs(dx) / (cx or 1) < half_w

    for width, height in sizes:
        pixels = bytearray()
        for y in range(height):
            for x in range(width):
                if inside_flame(x, y, width, height):
                    ny = (y - height // 2) / (height * 0.55) if height else 0
                    t = (ny + 1.2) / 2.2
                    t = max(0, min(1, t))
                    if t < 0.25:
                        r, g, b = 245, 210, 110
                    elif t < 0.5:
                        r, g, b = 225, 160, 60
                    elif t < 0.75:
                        r, g, b = 195, 105, 42
                    else:
                        r, g, b = 145, 70, 32
                    a = 255
                else:
                    # glow halo
                    cx, cy = width // 2, int(height * 0.55)
                    dx2 = (x - cx) / (width * 0.45)
                    dy2 = (y - cy) / (height * 0.45)
                    d2 = dx2 * dx2 + dy2 * dy2
                    if d2 < 0.8:
                        alpha = int(max(0, min(60, (0.8 - d2) * 100)))
                        r, g, b, a = 200, 120, 40, alpha
                    else:
                        r, g, b, a = 0, 0, 0, 0
                pixels.extend([min(255, r), min(255, g), min(255, b), min(255, a)])

        png_list.append((width, height, _make_png(width, height, pixels)))

    with open(path, 'wb') as f:
        f.write(struct.pack("<HHH", 0, 1, len(png_list)))
        offset = 6 + 16 * len(png_list)
        for w, h, png_data in png_list:
            f.write(struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(png_data), offset))
            offset += len(png_data)
        for _, _, png_data in png_list:
            f.write(png_data)


def _make_png(width, height, pixels):
    def chunk(ct, d):
        c = ct + d
        crc = struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
        return struct.pack(">I", len(d)) + c + crc
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    raw = b''
    for y in range(height):
        raw += b'\x00'
        raw += pixels[y * width * 4:(y + 1) * width * 4]
    idat_data = zlib.compress(raw)
    return sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat_data) + chunk(b'IEND', b'')


def wait_for_server(url: str, max_retries: int = 40) -> bool:
    import urllib.request
    for _ in range(max_retries):
        try:
            resp = urllib.request.urlopen(url, timeout=2)
            if resp.status == 200:
                return True
        except Exception:
            pass
        time.sleep(1)
    return False


def main():
    DETACH = subprocess.DETACHED_PROCESS | 0x08000000

    icon_path = os.path.join(ROOT, "redfire.ico")
    if not os.path.exists(icon_path):
        try:
            generate_icon_ico(icon_path)
        except Exception:
            pass

    subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=BACKEND_DIR,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=DETACH,
    )

    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    subprocess.Popen(
        [npm_cmd, "run", "dev", "--", "--host", "127.0.0.1"],
        cwd=FRONTEND_DIR,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=DETACH,
    )

    backend_ok = wait_for_server("http://127.0.0.1:8000/api/health")
    frontend_ok = wait_for_server("http://127.0.0.1:5173")

    webbrowser.open("http://127.0.0.1:5173")

    with open(os.path.join(ROOT, "launch_status.txt"), "w") as f:
        f.write(f"backend={'ok' if backend_ok else 'fail'}\n")
        f.write(f"frontend={'ok' if frontend_ok else 'fail'}\n")

    sys.exit(0)


if __name__ == "__main__":
    main()
