#!/usr/bin/env python3
"""Regenerate/check Politics' deterministic, content-hashed service worker."""
import argparse
import hashlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCES = (
    'index.html', 'manifest.webmanifest', 'offline.js',
    'navigation.js', 'navigation.css',
    'icons/icon-192.png', 'icons/icon-512.png',
    'favicon-16.png', 'favicon-32.png', 'og-image.png',
    '404.html', 'sitemap.xml', 'scripts/service-worker.template.js',
)
TARGET = ROOT / 'service-worker.js'


def blob_sha(data: bytes) -> str:
    raw = b'blob ' + str(len(data)).encode('ascii') + bytes([0]) + data
    return hashlib.sha1(raw).hexdigest()


def render() -> tuple[str, str]:
    entries = []
    for name in SOURCES:
        entries.append(name + '=' + blob_sha((ROOT / name).read_bytes()) + chr(10))
    version = blob_sha(''.join(entries).encode('ascii'))[:12]
    template = (ROOT / 'scripts/service-worker.template.js').read_text(encoding='utf-8')
    if template.count('__CACHE_ID__') != 1:
        raise ValueError('Expected exactly one __CACHE_ID__ placeholder')
    return template.replace('__CACHE_ID__', version), version


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    content, version = render()
    if args.check:
        if not TARGET.is_file() or TARGET.read_text(encoding='utf-8') != content:
            print(f'ERROR: stale service-worker.js (expected cache revision {version}); run python scripts/build.py', file=sys.stderr)
            for name in SOURCES:
                print(f'  {name}: {blob_sha((ROOT / name).read_bytes())}', file=sys.stderr)
            return 1
        print(f'PASS: content-hashed service worker {version}')
    else:
        TARGET.write_text(content, encoding='utf-8')
        print(f'Wrote service-worker.js (revision {version})')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
