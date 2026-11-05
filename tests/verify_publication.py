#!/usr/bin/env python3
"""Validate the published Politics site without external dependencies."""
import json
import re
import struct
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://mohdujjain.github.io/11am-politics/'
ASSETS = [
    'index.html','manifest.webmanifest','offline.js',
    'navigation.js','navigation.css',
    'icons/icon-192.png','icons/icon-512.png',
    'favicon-16.png','favicon-32.png',
    'og-image.png','404.html','sitemap.xml',
]

class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.chapters = []
        self.anchors = []
        self.links = []
        self.metas = []
    def handle_starttag(self, name, attributes):
        a = dict(attributes)
        if 'id' in a:
            self.ids.append(a['id'])
            if name == 'section' and 'chapter' in a.get('class','').split():
                self.chapters.append(a['id'])
        if name == 'a' and a.get('href','').startswith('#'):
            self.anchors.append(a['href'][1:])
        if name == 'link': self.links.append(a)
        if name == 'meta': self.metas.append(a)
        for key in ('src','href'):
            v = a.get(key,'')
            if v.startswith('./') and '#' not in v and '?' not in v:
                assert (ROOT / v).is_file(), 'Missing referenced asset: ' + v

def meta(doc, attribute, key):
    matching=[a.get('content') for a in doc.metas if a.get(attribute)==key]
    assert len(matching)==1, 'Expected exactly one '+key
    return matching[0]

def main():
    for file in ASSETS:
        assert (ROOT/file).is_file(), 'Missing: '+file
    doc=Document()
    doc.feed((ROOT/'index.html').read_text(encoding='utf-8'))
    assert doc.chapters == [f'ch{n:02}' for n in range(1,21)], '20 chapters changed'
    assert len(doc.ids) == len(set(doc.ids)), 'Duplicate HTML IDs'
    assert 'book-cover' in doc.ids and 'book-contents' in doc.ids
    assert 'closing-note' in doc.ids, 'Closing note destination missing'
    sec = [i for i in doc.ids if re.fullmatch(r'ch\d{2}-sec\d{2}',i)]
    rev = [i for i in doc.ids if re.fullmatch(r'ch\d{2}-rev\d{2}',i)]
    assert len(sec) == 140, f'Expected 140 in-chapter headings, found {len(sec)}'
    assert len(rev) == 101, f'Expected 101 chapter revision shortcuts, found {len(rev)}'
    for num in range(1,21):
        assert f'ch{num:02}-sec01' in doc.ids
        assert f'ch{num:02}-rev01' in doc.ids
    nav=(ROOT/'navigation.js').read_text(encoding='utf-8')
    nav_style=(ROOT/'navigation.css').read_text(encoding='utf-8')
    assert 'politicsNavTree' in nav and 'politicsNavSearch' in nav
    assert 'politicsNavResume' in nav and 'politicsNavFab' in nav
    assert 'aria-expanded' in nav and 'aria-current' in nav
    assert 'inert' in nav and 'Escape' in nav
    assert '@media print' in nav_style and '#politicsNavPanel' in nav_style
    assert any(link.get('rel')=='stylesheet' and link.get('href')=='./navigation.css' for link in doc.links)
    assert 'src="./navigation.js"' in (ROOT/'index.html').read_text(encoding='utf-8')
    assert 'politicsReadingFill' in doc.ids and 'politicsNavPanel' in doc.ids
    assert all(anchor in doc.ids for anchor in doc.anchors), 'Broken chapter link'
    assert any(link.get('rel')=='canonical' and link.get('href')==URL for link in doc.links)
    assert any(link.get('rel')=='manifest' and link.get('href')=='./manifest.webmanifest' for link in doc.links)
    assert any(link.get('rel')=='icon' and link.get('href')=='./favicon-32.png' for link in doc.links)
    assert meta(doc,'name','description')
    assert meta(doc,'name','twitter:card')=='summary_large_image'
    assert meta(doc,'name','twitter:image')==URL+'og-image.png'
    assert meta(doc,'property','og:site_name')=='11AM Politics'
    assert meta(doc,'property','og:image')==URL+'og-image.png'
    assert meta(doc,'property','og:image:width')=='1200'
    assert meta(doc,'property','og:image:height')=='630'
    assert meta(doc,'property','og:url')==URL
    manifest=json.loads((ROOT/'manifest.webmanifest').read_text())
    assert manifest['id']=='/11am-politics/' and manifest['scope']=='./'
    assert manifest['start_url']=='./' and manifest['display']=='standalone'
    assert {'192x192','512x512'} <= {i['sizes'] for i in manifest['icons']}
    worker=(ROOT/'service-worker.js').read_text()
    client=(ROOT/'offline.js').read_text()
    for path in ASSETS:
        assert './'+path in worker, 'Not precached: '+path
        assert './'+path in client, 'Not status checked: '+path
    assert '__CACHE_ID__' not in worker
    assert 'name.startsWith(CACHE_PREFIX)' in worker, 'Missing scoped cleanup'
    assert 'cache.addAll(SHELL)' in worker, 'Missing complete pre-cache'
    assert 'noindex' in (ROOT/'404.html').read_text().lower()
    assert '/11am-politics/' in (ROOT/'404.html').read_text()
    assert '<loc>'+URL+'</loc>' in (ROOT/'sitemap.xml').read_text()
    card=(ROOT/'og-image.png').read_bytes()
    assert card.startswith(bytes.fromhex('89504e470d0a1a0a')), 'Invalid PNG'
    assert struct.unpack('>II',card[16:24])==(1200,630), 'Wrong social image dimensions'
    print('PASS: chapters, 140 section links, 101 revision links, drawer, PWA, metadata, offline assets')

if __name__=='__main__':
    main()
