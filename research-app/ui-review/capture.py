"""Exercise the real Compose screens on an Android 11 emulator and capture their rendering.

This uses a separate UI-only debug application with no models or inference binaries. It never
connects to an AI service, starts a reading job, downloads models, or changes the release APK.
"""
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

APP = 'com.orbis.research.ui'
OUT = Path('ui-review-output')
OUT.mkdir(exist_ok=True)

def adb(*args):
    return subprocess.check_output(['adb', *args])

def shell(*args):
    return adb('shell', *args).decode()

def tree():
    shell('uiautomator', 'dump', '/sdcard/ui.xml')
    return ET.fromstring(shell('cat', '/sdcard/ui.xml'))

def tap(text):
    for node in tree().iter('node'):
        if node.get('text') == text:
            x1, y1, x2, y2 = map(int, re.findall(r'\d+', node.get('bounds')))
            shell('input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
            time.sleep(1)
            return
    raise AssertionError('Missing visible control: ' + text)

def capture(name, expected):
    root = tree()
    assert any(expected in n.get('text', '') for n in root.iter('node')), (name, expected)
    (OUT / (name + '.xml')).write_bytes(ET.tostring(root, encoding='utf-8'))
    (OUT / (name + '.png')).write_bytes(adb('exec-out', 'screencap', '-p'))
    print('Captured', name, flush=True)

def launch():
    shell('am', 'force-stop', APP)
    shell('am', 'start', '-W', '-f', '0x10008000', '-n', APP + '/com.orbis.research.MainActivity')
    time.sleep(2)

try:
    shell('wm', 'size', '1080x2160')
    shell('wm', 'density', '440')
    shell('settings', 'put', 'system', 'font_scale', '1.0')
    shell('cmd', 'uimode', 'night', 'no')
    adb('install', '-r', 'research-app/app/build/outputs/apk/debug/app-debug.apk')
    launch()
    capture('01-search-light', 'Bir yargının izini sür.')
    tap('Kaynak ve tarih seç · Tüm kaynaklar')
    capture('02-search-filters', 'Tarih aralığı:')
    for tab, name, expected in [
        ('Kaynaklar', '03-sources-light', 'Araştırmanın dayanağı.'),
        ('Topla', '04-collect-light', 'Bilgiyi bir araya getir.'),
        ('Model', '05-models-light', 'Araştırmanın motoru.'),
    ]:
        tap(tab)
        capture(name, expected)
    shell('cmd', 'uimode', 'night', 'yes')
    launch()
    capture('06-search-dark', 'Bir yargının izini sür.')
    tap('Model')
    capture('07-models-dark', 'Araştırmanın motoru.')
    # Narrow display with enlarged type: all four navigation destinations remain reachable.
    shell('wm', 'size', '960x1920')
    shell('wm', 'density', '480')
    shell('settings', 'put', 'system', 'font_scale', '1.3')
    shell('cmd', 'uimode', 'night', 'no')
    launch()
    capture('08-search-large-type', 'Bir yargının izini sür.')
    tap('Kaynaklar')
    capture('09-sources-large-type', 'Araştırmanın dayanağı.')
finally:
    (OUT / 'logcat.txt').write_bytes(adb('logcat', '-d', '-t', '1500'))
