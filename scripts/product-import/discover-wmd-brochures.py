#!/usr/bin/env python3
"""Read-only, resumable discovery of the user-approved category 9434 family.

Only follows the categories array (never navigation siblings). Keeps source
HTML and exact article IDs. No database, storage or publication writes.
"""
import argparse
import concurrent.futures
import hashlib
import gzip
import json
import pathlib
import re
import subprocess
import time
from urllib.parse import urlparse

HOST = 'www.wir-machen-druck.de'
ENTRY = f'https://{HOST}/broschuere-drahtheftung,category,9434.html'


def read_category(url, root):
    if urlparse(url).hostname != HOST or not re.search(r',category,\d+\.html$', url):
        raise ValueError(f'Outside brochure category boundary: {url}')
    category_id = re.search(r',category,(\d+)\.html$', url)[1]
    file = root / 'raw' / f'category-{category_id}.html.gz'
    previous = file.with_suffix('')
    if previous.exists():
        raw = previous.read_bytes()
        file.write_bytes(gzip.compress(raw))
        if gzip.decompress(file.read_bytes()) != raw:
            raise ValueError('Snapshot compression verification failed')
        previous.unlink()
    if file.exists():
        try:
            if len(gzip.decompress(file.read_bytes())) < 1000:
                raise EOFError('Empty supplier response')
        except (OSError, EOFError):
            file.unlink()  # incomplete snapshot from an interrupted local write
    if not file.exists():
        result = subprocess.run(['curl', '-sSL', '--fail', '--max-time', '45',
                                 '--retry', '2', url], capture_output=True, check=True)
        if len(result.stdout) < 1000:
            raise ValueError(f'Empty supplier response: {url}; retry the resumable run')
        file.write_bytes(gzip.compress(result.stdout))
        time.sleep(.15)
    raw = gzip.decompress(file.read_bytes())
    html = raw.decode()
    match = re.search(r'(?:let|var|const)\s+streamliningJson\s*=\s*(\{[^\n]*\});', html)
    if not match:
        raise ValueError(f'Missing structured category evidence: {url}')
    return json.loads(match[1]), hashlib.sha256(raw).hexdigest()


def discover(root):
    (root / 'raw').mkdir(parents=True, exist_ok=True)
    queue = [(ENTRY, [])]
    seen, categories, articles = set(), [], {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        while queue:
            current, queue = queue, []
            futures = [(url, ancestors, pool.submit(read_category, url, root))
                       for url, ancestors in current if url not in seen]
            for url, ancestors, future in futures:
                seen.add(url)
                data, sha = future.result()
                node = data['aWarengruppe']
                path = ancestors + [{'id': node['id'], 'name': node['bezeichnung'], 'url': url}]
                categories.append({'sourceUrl': url, 'sha256': sha, 'path': path})
                for article in data.get('aArtikel', []):
                    article_id = str(article['id'])
                    if article_id in articles:
                        raise ValueError(f'Duplicate article identity {article_id}')
                    article.pop('productMainIcon', None)  # do not retain irrelevant image secrets
                    articles[article_id] = {
                        'articleId': article_id,
                        'sourceUrl': f"https://{HOST}/{article.get('slug_name') or (article['url'] + ',detail,' + article_id)}.html",
                        'path': path, 'source': article,
                    }
                for child in data.get('categories', []):
                    if len(path) >= 5:
                        raise ValueError('Unexpected category depth')
                    queue.append((f"https://{HOST}/{child['bezeichnung_url']},category,{child['id']}.html", path))
                print(f"Category {node['id']}: {len(articles)} articles", flush=True)
            (root / 'discovery.json').write_text(json.dumps({
                'entryUrl': ENTRY, 'categories': categories,
                'articles': list(articles.values()), 'databaseWrites': False,
            }, ensure_ascii=False, indent=2))
    print(json.dumps({'categories': len(categories), 'articles': len(articles),
                      'pageCounts': sorted(set(a['source']['seitenanzahl'] for a in articles.values()))}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    discover(pathlib.Path(args.output))
