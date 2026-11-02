"""Package only the runtime extension files; no account data or development fixtures."""
from pathlib import Path
import json
import shutil
import zipfile
import struct
import argparse
from browser_manifest import browser_manifest

root = Path(__file__).resolve().parent.parent
files = ['captcha-solver.js', 'captcha.js', 'captcha-model.json', 'licenses/vtop-captcha-solver.txt', 'extension-background.js', 'deadline-cache.js', 'deadline-cache-client.js', 'manifest.json', 'brand.js', 'combobox.js', 'search-select.js', 'form-presets.js', 'navigation.js', 'semesters.js', 'enhancements.js', 'content.js', 'dark-readability.js', 'cgpa.js', 'cgpa-ui.js', 'page-enhancements.js', 'page-actions.js', 'page-runtime.js', 'pdf-bridge.js', 'pdf-preview.js', 'extension-action.js', 'pdf-viewer.html', 'pdf-viewer.css', 'pdf-viewer.mjs', 'pptx-viewer.mjs', 'dark.css', 'README.md', 'docs/dark-mode-audit.md']
source_manifest = json.loads((root / 'manifest.json').read_text())
assert source_manifest['manifest_version'] == 3
assert source_manifest.get('background') == {'scripts': ['deadline-cache.js', 'extension-action.js']}
parser = argparse.ArgumentParser()
parser.add_argument('--browser', choices=['chrome', 'firefox', 'all'], default='all')
selected = parser.parse_args().browser
browsers = ['chrome', 'firefox'] if selected == 'all' else [selected]
for browser in browsers:
    manifest = browser_manifest(source_manifest, browser)
    package_name = 'vtop-command' if browser == 'chrome' else 'vtop-command-firefox'
    output = root / 'dist' / package_name
    shutil.rmtree(output, ignore_errors=True)
    output.mkdir(parents=True, exist_ok=True)
    for size, name in manifest.get('icons', {}).items():
        data = (root / name).read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        assert struct.unpack('>II', data[16:24]) == (int(size), int(size))
    for name in files:
        (output / name).parent.mkdir(parents=True, exist_ok=True)
        if name == 'manifest.json':
            (output / name).write_text(json.dumps(manifest, indent=2) + '\n')
        else:
            shutil.copy2(root / name, output / name)
    shutil.copytree(root / 'icons', output / 'icons', dirs_exist_ok=True)
    vendor = output / 'vendor'
    shutil.copytree(root / 'vendor', vendor, dirs_exist_ok=True)
    # Fail packaging if a declared runtime/model asset was accidentally left out.
    required = [asset for group in manifest['content_scripts'] for asset in group.get('js', []) + group.get('css', [])]
    required += [asset for group in manifest.get('web_accessible_resources', []) for asset in group['resources'] if '*' not in asset]
    required += manifest['background'].get('scripts', [])
    if manifest['background'].get('service_worker'):
        required.append(manifest['background']['service_worker'])
    for asset in required:
        assert (output / asset).is_file(), f'Missing runtime asset: {asset}'
    archive = root / 'dist' / f"{package_name}-{manifest['version']}.zip"
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
        for name in files:
            bundle.write(output / name, name)
        for directory in [vendor, output / 'icons']:
            for path in directory.rglob('*'):
                if path.is_file():
                    bundle.write(path, path.relative_to(output).as_posix())
    with zipfile.ZipFile(archive) as bundle:
        assert bundle.testzip() is None
        assert 'manifest.json' in bundle.namelist(), 'Package manifest must be at the archive root'
        for name in bundle.namelist():
            parts = Path(name).parts
            assert not any(part in {'.git', 'node_modules', 'dist'} for part in parts), name
            assert Path(name).suffix.lower() not in {'.xpi', '.zip'}, name
    for obsolete in [archive.parent / f'{package_name}.zip', *archive.parent.glob(f'{package_name}-[0-9]*.zip')]:
        if obsolete != archive and obsolete.exists():
            obsolete.unlink()
    print(f'Built {output}\nBuilt {archive}')
    print('VERDICT: PASS')
