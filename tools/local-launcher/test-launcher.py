import json, os, pathlib, shutil, subprocess, tempfile, urllib.request

root = pathlib.Path(__file__).resolve().parent
fixture = pathlib.Path(tempfile.mkdtemp(prefix='ship launcher check '))
app = fixture / 'ship-maintenance' / 'phase2-demo'
for name in ('server', 'dist', 'node_modules/vite/bin', '.local-data'):
    (app / name).mkdir(parents=True, exist_ok=True)
(app / 'node_modules/vite/bin/vite.js').write_text('// dependency presence fixture', encoding='utf-8')
(app / 'dist/index.html').write_text('<html>Launcher fixture</html>', encoding='utf-8')
(app / 'server/local-server.mjs').write_text('''import {createServer} from 'node:http';
createServer((req,res)=>{res.setHeader('Content-Type',req.url.startsWith('/api/')?'application/json':'text/html');if(req.url==='/api/auth/me'&&req.headers['x-engine-room-client']!=='local-ui'){res.statusCode=403;return res.end('{}')}res.end(req.url==='/api/auth/me'?JSON.stringify({user:null}):'<html>Launcher fixture</html>')}).listen(Number(process.env.PORT),'127.0.0.1');
''', encoding='utf-8')
for name in ('start-local.ps1', 'stop-local.ps1'):
    text = (root / name).read_text(encoding='utf-8-sig').replace('5173', '19173').replace('5174', '19174')
    (fixture / name).write_text(text, encoding='utf-8-sig')

def run(name):
    log = fixture / (name + '.log')
    with log.open('w', encoding='utf-8') as output:
        completed = subprocess.run(['powershell.exe', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(fixture / name), '-Side', 'ship'], cwd=fixture, stdout=output, stderr=subprocess.STDOUT, timeout=120)
    print(log.read_text(encoding='utf-8', errors='replace'), flush=True)
    if completed.returncode:
        raise RuntimeError('Launcher failed: ' + str(log))

try:
    run('start-local.ps1')
    state = json.loads((fixture / '.runtime/pid.json').read_text(encoding='utf-8-sig'))
    record = state['processes'][0]
    assert record['mode'] == 'backend'
    first = record['pid']
    assert json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:19173/api/auth/me', headers={'X-Engine-Room-Client': 'local-ui'}))) == {'user': None}
    run('start-local.ps1')
    state = json.loads((fixture / '.runtime/pid.json').read_text(encoding='utf-8-sig'))
    assert state['processes'][0]['pid'] == first, 'Duplicate process'
    assert len(state['processes'][0]['sourceFingerprint']) == 64
    (app / '.local-data/report.json').write_text('{"status":"complete"}', encoding='utf-8')
    run('start-local.ps1')
    state = json.loads((fixture / '.runtime/pid.json').read_text(encoding='utf-8-sig'))
    assert state['processes'][0]['pid'] == first, 'Runtime report must not trigger restart'
    with (app / 'server/local-server.mjs').open('a', encoding='utf-8') as output:
        output.write('\n// changed backend contract\n')
    run('start-local.ps1')
    state = json.loads((fixture / '.runtime/pid.json').read_text(encoding='utf-8-sig'))
    second = state['processes'][0]['pid']
    assert second != first, 'Changed backend must restart'
    run('start-local.ps1')
    state = json.loads((fixture / '.runtime/pid.json').read_text(encoding='utf-8-sig'))
    assert state['processes'][0]['pid'] == second, 'Unchanged updated server must be reused'
    del state['processes'][0]['sourceFingerprint']
    (fixture / '.runtime/pid.json').write_text(json.dumps(state), encoding='utf-8-sig')
    run('start-local.ps1')
    state = json.loads((fixture / '.runtime/pid.json').read_text(encoding='utf-8-sig'))
    assert state['processes'][0]['pid'] != second, 'Legacy record must be refreshed once'
    run('stop-local.ps1')
    assert not json.loads((fixture / '.runtime/pid.json').read_text(encoding='utf-8-sig'))['processes']
    assert not (app / '.local-data/server-active.json').exists()
    try:
        urllib.request.urlopen('http://127.0.0.1:19173/', timeout=2)
    except OSError:
        pass
    else:
        raise AssertionError('Server still running')
    print(json.dumps({'ok': True, 'fixture': str(fixture), 'checks': ['path with spaces', 'backend and API startup', 'unchanged source reuses PID', 'runtime report ignored', 'changed backend restarts', 'legacy record refreshed', 'stop removes listener and active record']}, ensure_ascii=False))
finally:
    run('stop-local.ps1')
