import os
import sys
import socket
import subprocess
import time
import webview

webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = False
webview.settings["REMOTE_DEBUGGING_PORT"] = 9222

DEFAULT_BACKEND = os.environ.get("BACKEND_URL", "http://pietro.tail83d918.ts.net:8002/")
DEFAULT_APP_URL = DEFAULT_BACKEND.rstrip("/") + "/app.html"

STORAGE_PATH = os.path.join(os.path.expanduser("~"), ".forexbacktestlab", "webview_profile")
os.makedirs(STORAGE_PATH, exist_ok=True)

INSTALLED_APP = os.path.join(os.path.expanduser("~"), "AppData", "Local", "Programs", "Forex Backtest LAB")
BRIDGE_EXE = os.path.join(INSTALLED_APP, "ForexBacktestLAB.exe")


def _is_port_open(port, host="127.0.0.1", timeout=1.0):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (OSError, socket.timeout):
        return False


def _ensure_backend():
    if _is_port_open(8000):
        return "http://127.0.0.1:8000/app.html"
    if os.path.isfile(BRIDGE_EXE):
        subprocess.Popen(
            [BRIDGE_EXE],
            cwd=INSTALLED_APP,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        for _ in range(30):
            time.sleep(1)
            if _is_port_open(8000):
                return "http://127.0.0.1:8000/app.html"
    return None


def _patch_zoom_and_popups():
    try:
        import webview.platforms.edgechromium as ec

        _orig = ec.EdgeChrome.on_webview_ready

        def _patched(self, sender, args):
            _orig(self, sender, args)
            try:
                s = sender.CoreWebView2.Settings
                s.AreBrowserAcceleratorKeysEnabled = True
                s.IsZoomControlEnabled = True
            except Exception:
                pass

        ec.EdgeChrome.on_webview_ready = _patched

        def _allow_native_popup(self, sender, args):
            args.set_Handled(False)

        ec.EdgeChrome.on_new_window_request = _allow_native_popup
    except Exception as exc:
        print("patch fallita:", exc)


def main():
    app_url = DEFAULT_APP_URL
    # Se il server Oracle non è raggiungibile, prova il bridge locale
    try:
        import urllib.request
        urllib.request.urlopen("http://pietro.tail83d918.ts.net:8002/health", timeout=3)
    except Exception:
        url = _ensure_backend()
        if url:
            app_url = url

    _patch_zoom_and_popups()
    debug = os.environ.get("DESKTOP_SHELL_DEBUG") == "1"
    window = webview.create_window(
        "Forex Backtest LAB",
        url=app_url,
        width=1280,
        height=820,
        min_size=(960, 580),
    )
    try:
        webview.start(
            debug=debug,
            private_mode=False,
            storage_path=STORAGE_PATH,
        )
    except Exception as exc:
        print("avvio fallito:", exc)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
