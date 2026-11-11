"""Import the supplied RT-flex50 wiki without inventing document bodies or metadata.

Run from phase2-demo: python scripts/import-wiki-knowledge.py [source-directory]
Uses only the Python standard library. Markdown originals and SHA-256 are retained.
"""
from pathlib import Path
import hashlib
import html
import json
import re
import shutil
import sys
from urllib.parse import quote

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'wiki_rt-flex50'
paths = sorted(p for folder in ('chapters', 'concepts', 'sources') for p in (source / folder).glob('*.md'))
ids = {p.stem: 'RTF-' + hashlib.sha256(p.relative_to(source).as_posix().encode()).hexdigest()[:10].upper() for p in paths}
assets = root / 'public/wiki_rt-flex50'
images = set()
missing_images = set()

def inline(value):
    tokens = []
    def token(markup):
        tokens.append(markup)
        return f'\x00{len(tokens)-1}\x00'
    value = re.sub(r'`([^`]+)`', lambda m: token('<code>'+html.escape(m[1])+'</code>'), value)
    def image(m):
        filename = Path(m[2]).name
        if not (source / 'images' / filename).is_file():
            missing_images.add(filename)
            return token('<span>'+html.escape(m[1])+'（原资料缺少图文件）</span>')
        images.add(filename)
        return token(f'<img src="/wiki_rt-flex50/images/{quote(filename)}" alt="{html.escape(m[1],quote=True)}" loading="lazy" style="max-width:100%;height:auto">')
    value = re.sub(r'!\[([^]]*)\]\(([^)]+)\)', image, value)
    def wikilink(m):
        target, _, label = m[1].partition('|')
        target = target.split('#')[0].split('/')[-1].removesuffix('.md')
        label = label or m[1].split('#')[0].split('/')[-1]
        return token(f'<a href="/#/knowledge?doc={ids[target]}">{html.escape(label)}</a>') if target in ids else label
    value = re.sub(r'\[\[([^]]+)\]\]', wikilink, value)
    def link(m):
        url = m[2]
        if not url.startswith(('https://', 'http://', '#')):
            return m[1] + '（' + url + '）'
        return token(f'<a href="{html.escape(url,quote=True)}" rel="noopener noreferrer">{html.escape(m[1])}</a>')
    value = re.sub(r'\[([^]]+)\]\(([^)]+)\)', link, value)
    value = html.escape(value).replace('&lt;br&gt;', '<br>').replace('&lt;br/&gt;', '<br>')
    value = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', value)
    value = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<em>\1</em>', value)
    return re.sub(r'\x00(\d+)\x00', lambda m: tokens[int(m[1])], value)

def render(markdown):
    lines = markdown.splitlines()
    out, i = [], 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith('```'):
            language, block = line[3:].strip(), []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                block.append(lines[i]); i += 1
            out.append('<pre><code data-language="'+html.escape(language)+'">'+html.escape('\n'.join(block))+'</code></pre>')
            i += 1
        elif re.match(r'^#{1,6} ', line):
            heading = re.match(r'^(#{1,6}) (.*)', line)
            level = min(len(heading[1])+1, 6)
            out.append(f'<h{level}>{inline(heading[2])}</h{level}>'); i += 1
        elif line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                # An Obsidian link alias is not a table cell separator.
                protected = re.sub(r'\[\[[^]]+\]\]', lambda m: m[0].replace('|', '\x01'), lines[i].strip().strip('|'))
                cells = [c.replace('\x01', '|').replace('\\|', '|') for c in re.split(r'(?<!\\)\|', protected)]
                if not all(re.match(r'^\s*[-:]+\s*$', cell) for cell in cells): rows.append(cells)
                i += 1
            out.append('<table><thead><tr>'+''.join('<th>'+inline(c.strip())+'</th>' for c in rows[0])+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+inline(c.strip())+'</td>' for c in row)+'</tr>' for row in rows[1:])+'</tbody></table>')
        elif re.match(r'^\s*(?:[-*+] |\d+\. )', line):
            # Keep the source order and indentation in the existing content panel.
            items = []
            while i < len(lines) and re.match(r'^\s*(?:[-*+] |\d+\. )', lines[i]):
                match = re.match(r'^(\s*)([-*+] |\d+\. )(.*)', lines[i])
                prefix = match[2] if match[2][0].isdigit() else ''
                items.append('<li style="margin-left:'+str(len(match[1])*8)+'px">'+inline(prefix+match[3])+'</li>'); i += 1
            out.append('<ul>'+''.join(items)+'</ul>')
        elif line.startswith('>'):
            block = []
            while i < len(lines) and lines[i].startswith('>'):
                block.append(lines[i].lstrip('> ')); i += 1
            out.append('<blockquote>'+inline('<br>'.join(block))+'</blockquote>')
        elif re.match(r'^\s*[-*_]{3,}\s*$', line):
            out.append('<hr>'); i += 1
        else:
            block = [line]; i += 1
            while i < len(lines) and lines[i].strip() and not re.match(r'^(?:#|\||>|```|\s*[-*+] |\s*\d+\. )',lines[i]):
                block.append(lines[i]); i += 1
            out.append('<p>'+inline('\n'.join(block))+'</p>')
    return '\n'.join(out)

docs = []
for path in paths:
    raw = path.read_bytes()
    text = raw.decode('utf-8-sig')
    front = re.match(r'^---\s*\n([\s\S]*?)\n---\s*\n', text)
    metadata = front[1] if front else ''
    body = text[front.end():] if front else text
    body = re.sub(r'^# [^\n]+\n', '', body, count=1, flags=re.M)
    name = path.stem
    doc_type = '故障案例' if '案例' in name or '故障报告' in name else '技术通告' if re.search('服务通报|服务函',name) else '操作规程' if re.search('操作规程|维护检查清单|操作维护提示|运行管理要点|工作介质规格',name) else '设备手册'
    description = re.search(r'^description:\s*(.+)$', metadata, re.M)
    updated = re.search(r'^(?:updated|updated_at|updatedAt):\s*(\d{4}-\d{2}-\d{2})', metadata, re.M)
    rel = path.relative_to(source)
    for target in (root / 'wiki_rt-flex50' / rel, assets / rel):
        target.parent.mkdir(parents=True, exist_ok=True)
        if path.resolve() != target.resolve(): shutil.copyfile(path, target)
    source_path = 'wiki_rt-flex50/' + rel.as_posix()
    doc_html = render(body) + f'<p><a href="/{quote(source_path)}">查看知识原文</a></p>'
    docs.append(dict(id=ids[name],title=name,device='主机',docType=doc_type,category='RT-flex50',subcategory=description[1] if description else name,chapterHTML=doc_html,version='未注明',updatedAt=updated[1] if updated else '未注明',sourcePath=source_path,sourceKind='wiki-source',sha256=hashlib.sha256(raw).hexdigest()))
for filename in images:
    for target in (root / 'wiki_rt-flex50/images' / filename, assets / 'images' / filename):
        target.parent.mkdir(parents=True, exist_ok=True)
        original = source / 'images' / filename
        if original.resolve() != target.resolve(): shutil.copyfile(original, target)
(root / 'src/mock/wikiKnowledge.json').write_text(json.dumps(docs,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
manifest = dict(sourceRoot=str(source),documents=len(docs),images=len(images),missingImages=sorted(missing_images),entries=[{k:d[k] for k in ('id','title','docType','sourcePath','sha256')} for d in docs])
(root / 'docs/审查附件-20261104/wiki导入清单.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(dict(documents=len(docs),images=len(images),missingImages=len(missing_images)),ensure_ascii=False))
