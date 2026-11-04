from pathlib import Path
import re, html

root = Path.cwd()
source = root / 'docs/船端页面内容全面审查报告-20261104.md'
lines = source.read_text(encoding='utf-8-sig').splitlines()

def inline(s):
    s = html.escape(s)
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', s)
    return re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', s)

body, toc = [], []
i = 0
while i < len(lines):
    line = lines[i]
    if not line.strip():
        i += 1
        continue
    h = re.match(r'^(#{1,3}) (.*)', line)
    if h:
        level, title = len(h[1]), h[2]
        anchor = 'section-' + str(i + 1)
        body.append(f'<h{level} id="{anchor}">{inline(title)}</h{level}>')
        if level == 2:
            toc.append(f'<a href="#{anchor}">{inline(title)}</a>')
        i += 1
    elif line.startswith('|'):
        rows = []
        while i < len(lines) and lines[i].startswith('|'):
            row = lines[i].strip('|').split('|')
            if not all(re.match(r'^\s*[-:]+\s*$', x) for x in row):
                rows.append(row)
            i += 1
        body.append('<div class="table-scroll"><table><thead><tr>' + ''.join('<th>'+inline(x.strip())+'</th>' for x in rows[0]) + '</tr></thead><tbody>' + ''.join('<tr>'+''.join('<td>'+inline(x.strip())+'</td>' for x in row)+'</tr>' for row in rows[1:])+'</tbody></table></div>')
    elif re.match(r'^(?:- |\d+\. )', line):
        ordered = bool(re.match(r'^\d+\. ', line))
        tag = 'ol' if ordered else 'ul'
        items = []
        while i < len(lines) and re.match(r'^(?:- |\d+\. )', lines[i]):
            items.append('<li>'+inline(re.sub(r'^(?:- |\d+\. )','',lines[i]))+'</li>')
            i += 1
        body.append('<'+tag+'>'+''.join(items)+'</'+tag+'>')
    else:
        block = []
        while i < len(lines) and lines[i].strip() and not re.match(r'^(?:#|\||- |\d+\. )',lines[i]):
            block.append(lines[i]); i += 1
        body.append('<p>'+inline(' '.join(block))+'</p>')

css = '''*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:28px}body{margin:0;background:#f3f5f7;color:#26384a;font:15px/1.85 "Segoe UI","Microsoft YaHei",sans-serif}.layout{display:grid;grid-template-columns:246px minmax(0,1040px);max-width:1340px;margin:auto;gap:34px;padding:32px 24px}aside{position:sticky;top:28px;height:calc(100vh - 56px);overflow:auto;font-size:13px}aside strong{display:block;font-size:17px;margin:8px 0 18px}aside a{display:block;margin:8px 0;color:#5e6e7c;text-decoration:none;padding:4px 0}aside a:hover{color:#946f39}aside small{display:block;color:#7e8c98;margin-top:24px}main{background:white;border:1px solid #e1e6e9;padding:40px 48px;border-radius:10px;min-width:0}h1{font-size:30px;line-height:1.45;margin:0 0 16px;color:#1f3449}h2{font-size:22px;margin:42px 0 18px;padding-top:22px;border-top:1px solid #dce3e8;color:#24425b}h3{font-size:18px;margin:32px 0 12px;color:#765c35}p{margin:12px 0}strong{color:#263b50}code{font-family:Consolas,monospace;font-size:.87em;background:#f1f4f6;border-radius:3px;padding:2px 4px;overflow-wrap:anywhere}a{color:#427894;text-underline-offset:3px}.table-scroll{overflow:auto;margin:20px 0}table{border-collapse:collapse;width:100%;font-size:13px;line-height:1.7}th,td{border:1px solid #dce3e8;padding:11px 12px;vertical-align:top;min-width:115px}th{background:#edf2f5;text-align:left;color:#304b60}tr:nth-child(even) td{background:#fafbfc}li{margin:10px 0}ul,ol{padding-left:24px}.actions{display:flex;gap:12px;margin-bottom:20px}.actions a,.actions button{font:inherit;font-size:12px;border:1px solid #d9e1e6;background:white;color:#4f6579;border-radius:5px;padding:6px 10px;cursor:pointer;text-decoration:none}.tag{font-size:12px;letter-spacing:.08em;color:#94703d;margin-bottom:8px}.footer{color:#7b8994;font-size:12px;border-top:1px solid #e1e7eb;padding-top:18px;margin-top:36px}@media(max-width:950px){.layout{grid-template-columns:1fr;padding:12px;gap:12px}aside{position:static;height:auto}aside a{display:inline-block;margin-right:16px}aside small{display:none}main{padding:24px 20px}}@media print{body{background:white;font-size:11px}.layout{display:block;padding:0;max-width:none}aside,.actions{display:none}main{border:0;padding:0}h2,h3{break-after:avoid}table{font-size:10px}tr{break-inside:avoid}a{color:inherit;text-decoration:none}}'''
document = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>船端页面内容全面审查报告</title><style>'+css+'</style></head><body><div class="layout"><aside><strong>内容审查 · 2026.11.04</strong>'+''.join(toc)+'<small>38项初审问题 · 按范围修正<br>61篇真实知识条目 · 190张配图<br>当前结果见第0节</small></aside><main><div class="tag">智能机舱 / 船端内容核验与修正</div><div class="actions"><a href="船端页面内容全面审查报告-20261104.md">Markdown 原稿</a><button onclick="window.print()">打印 / 保存 PDF</button></div>'+''.join(body)+'<p class="footer">初审证据保留；本轮批准的内容调整、验证结果与暂缓范围已直接记入本报告。</p></main></div></body></html>'
source.with_suffix('.html').write_text(document, encoding='utf-8')
print('Rendered',len(body),'blocks;',len(toc),'navigation links')
