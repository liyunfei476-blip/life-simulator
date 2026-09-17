const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function environment(fetchImpl = async () => { throw new Error('Network must be mocked'); }) {
  const values = new Map();
  const context = vm.createContext({ console, URL, AbortController, DOMException,
    TextDecoder, TextEncoder, setTimeout, clearTimeout, fetch: fetchImpl,
    localStorage: { get length() { return values.size; }, key: i => [...values.keys()][i],
      getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) } });
  for (const file of ['config', 'worlds', 'adventure', 'engine', 'round', 'storage', 'events', 'network', 'ai']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8'), context, { filename: file });
  }
  return { context, values, run: source => vm.runInContext(source, context) };
}
const cfg = { baseURL: 'https://api.deepseek.com', model: 'deepseek-v4-flash', apiKey: 'test-only-not-a-secret' };
const jsonResponse = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
const packet = text => 'data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\r\n\r\n';

 test('every JavaScript file parses and referenced runtime files exist', () => {
  for (const file of fs.readdirSync(path.join(root, 'js'))) new vm.Script(fs.readFileSync(path.join(root, 'js', file), 'utf8'));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const file of ['style', 'journey']) {
    const css = fs.readFileSync(path.join(root, 'css', file + '.css'), 'utf8');
    for (const match of css.matchAll(/url\(['"]?\.\.\/(assets\/[^'"\)]+)['"]?\)/g)) assert.ok(fs.existsSync(path.join(root, match[1])), 'Missing asset ' + match[1]);
  }
  for (const match of html.matchAll(/(?:src|href)="((?:js|css)\/[^\"]+)"/g)) assert.ok(fs.existsSync(path.join(root, match[1])));
  const app = ['app', 'interface'].map(file => fs.readFileSync(path.join(root, 'js', file + '.js'), 'utf8')).join('\n');
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  for (const match of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.has(match[1]), 'Missing DOM id: ' + match[1]);
});

test('provider options are not sent to incompatible services', () => {
  const env = environment();
  const transport = env.run('ModelTransport');
  assert.equal(transport.body(cfg, [], 100, true).thinking.type, 'disabled');
  const body = transport.body({ ...cfg, baseURL: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }, [], 100, true);
  assert.equal(body.thinking, undefined);
  assert.equal(body.reasoning_effort, undefined);
  assert.equal(body.enable_thinking, undefined);
});

test('unsafe network destinations are rejected', () => {
  const transport = environment().run('ModelTransport');
  for (const value of ['http://example.com', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://name:pass@example.com', 'https://service.local']) {
    assert.throws(() => transport.validateBase(value));
  }
});

test('JSON response with a body is not mistaken for SSE', async () => {
  const env = environment(async () => jsonResponse({ choices: [{ message: { content: '完整正文' }, finish_reason: 'stop' }] }));
  assert.equal(await env.run('ModelTransport').request(cfg, '/chat/completions', {}), '完整正文');
});

test('SSE handles split UTF-8 and stops at DONE without waiting for connection close', async () => {
  const bytes = new TextEncoder().encode(packet('你好，旅人') + 'data: [DONE]\r\n\r\n');
  let cancelled = false;
  const env = environment(async () => new Response(new ReadableStream({ start(c) {
    for (let i = 0; i < bytes.length; i += 2) c.enqueue(bytes.slice(i, i + 2));
  }, cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'text/event-stream' } }));
  let output = '';
  const result = await env.run('ModelTransport').request(cfg, '/chat/completions', {}, delta => { output += delta; });
  assert.equal(result, '你好，旅人');
  assert.equal(output, result);
  assert.equal(cancelled, true);
});

test('SSE processes trailing event without final newline', async () => {
  const body = packet('尾部').trimEnd();
  const env = environment(async () => new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }));
  assert.equal(await env.run('ModelTransport').request(cfg, '/chat/completions', {}), '尾部');
});

test('reasoning-only and truncated responses are rejected', async () => {
  for (const choice of [{ message: { reasoning_content: 'not game text' } }, { message: { content: 'partial' }, finish_reason: 'length' }]) {
    const transport = environment(async () => jsonResponse({ choices: [choice] })).run('ModelTransport');
    await assert.rejects(transport.request(cfg, '/chat/completions', {}));
  }
});

test('timeout and explicit cancellation release requests', async () => {
  const mock = (_url, opts) => new Promise((_resolve, reject) => opts.signal.addEventListener('abort', () => reject(new DOMException('abort', 'AbortError'))));
  const transport = environment(mock).run('ModelTransport');
  transport.idleMs = 10;
  await assert.rejects(transport.request(cfg, '/chat/completions', {}), /超时/);
  transport.idleMs = 1000;
  const promise = transport.request(cfg, '/chat/completions', {});
  transport.cancelAll();
  await assert.rejects(promise, { name: 'AbortError' });
  assert.equal(transport.active.size, 0);
});

test('invalid metadata never becomes a safe successful action', () => {
  const ai = environment().run('AI');
  for (const raw of ['只有正文', '正文###META###{bad}', '###META###{}']) assert.throws(() => ai.splitNarrativeMeta(raw));
  assert.equal(ai.splitNarrativeMeta('正文###META###{"options":[]}').narrative, '正文');
});

test('result numeric changes and option shapes are validated', async () => {
  const env = environment();
  env.run(`AI.callChatStream = async () => '正文###META###' + JSON.stringify({ effects: { '财富': 9999, '气运': true, age: 100 }, danger: 'none', combat: false, options: [{text: 42}, {text: '观察'}] });`);
  const result = await env.run(`AI.generateResult(createInitialState('xiuxian', '旅人'), [], '观察', true)`);
  assert.equal(result.effects['财富'], 40);
  assert.equal(result.effects.age, undefined);
  assert.equal(result.effects['气运'], undefined);
  assert.equal(result.options.length, 1);
});

test('talent health increases capacity and random recovery never damages health', () => {
  const env = environment();
  assert.equal(env.run(`createInitialState('xiuxian', '旅人', {name:'体魄',effects:{'生命':25}}).player.maxHp`), 125);
  assert.equal(env.run(`createInitialState('xiuxian', '旅人', {name:'体魄',effects:{'生命':25}}).player.hp`), 125);
  assert.equal(env.run(`(() => { const s = createInitialState('xiuxian'); applyTwistGain(s); return s.player.hp; })()`), 100);
});

test('settlement is atomic and aging death happens in the same turn', () => {
  const env = environment();
  const result = env.run(`(() => { const old = createInitialState('wuxia', '旅人'); old.player.age = 99; old.calendarDays = 350; const result = settleAction(old, {effects:{},danger:'none',combat:false}, '休息'); return {old, result}; })()`);
  assert.equal(result.old.turn, 0);
  assert.equal(result.old.player.age, 99);
  assert.equal(result.result.state.status, 'ended');
  assert.equal(result.result.state.turn, 1);
  assert.equal(result.result.state.log[0].choice, '休息');
});

test('API key is not persisted and all six worlds roundtrip through saves', () => {
  const env = environment();
  env.run(`Storage.saveModelConfig({name:'test',baseURL:'https://api.deepseek.com',model:'test',apiKey:'test-only-not-a-secret'})`);
  assert.ok(![...env.values.values()].join('').includes('test-only-not-a-secret'));
  assert.equal(env.run('Storage.loadModelConfig().apiKey'), 'test-only-not-a-secret');
  assert.equal(env.run(`WORLDS.every(w => { const state = createInitialState(w.id, '旅人'); const options = [{text:'观察',risk:''}]; Storage.saveGame(w.id, state, w.name, [], options, [{text:'当前场景',cls:'narrative'}]); const saved = Storage.loadGame(w.id); return saved.state.worldId === w.id && saved.options[0].text === '观察' && saved.messages[0].text === '当前场景'; })`), true);
});

test('corrupt saves and disabled storage fail gracefully', () => {
  const env = environment();
  env.values.set('crossing_sim_save_bad', '{bad}');
  assert.equal(env.run(`Storage.loadGame('bad')`), null);
  env.run(`Object.defineProperty(localStorage, 'length', {get(){throw new Error('disabled')}})`);
  assert.equal(env.run('Storage.listSaves().length'), 0);
});

test('publication defaults contain no key and workflow uploads only runtime files', () => {
  assert.equal(environment().run('CONFIG.defaultModel.apiKey'), '');
  const patterns = [/\bsk-[A-Za-z0-9_-]{20,}/, /\bgh[pousr]_[A-Za-z0-9]{20,}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
  for (const file of fs.readdirSync(path.join(root, 'js'))) {
    const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
    assert.ok(!patterns.some(pattern => pattern.test(source)), 'Suspected credential in ' + file);
  }
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/pages.yml'), 'utf8');
  assert.match(workflow, /path: _site/);
  assert.doesNotMatch(workflow, /path: ['"]?\.['"]?\s*$/m);
  const ignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8');
  for (const rule of ['.env', '.codebuddy/', 'saves/', '*.key']) assert.ok(ignore.includes(rule));
});

test('local gameplay works without network in every world', () => {
  const env = environment();
  assert.equal(env.run(`WORLDS.every(w => {
    const initial = createInitialState(w.id, '旅人');
    const trained = Adventure.act(initial, 'train').state;
    const rested = Adventure.act(trained, 'rest').state;
    const worked = Adventure.act(rested, 'work').state;
    return initial.turn === 0 && trained.player.main > initial.player.main && rested.adventure.energy === 100 && worked.player.wealth > 0 && worked.turn === 3 && worked.player.age === 16;
  })`), true);
});

test('local costs and unknown actions fail without mutating state', () => {
  const env = environment();
  assert.equal(env.run(`(() => { const s=createInitialState('xiuxian'); const before=JSON.stringify(s); const invalid=['buy','brew','sell','use','explore:2','encounter:0','claim:first-step','__proto__',null]; for(const id of invalid){ let threw=false; try{Adventure.act(s,id)}catch{threw=true} if(!threw || JSON.stringify(s)!==before)return false; } return true; })()`), true);
});

test('pending exploration survives save and cannot be consumed twice', () => {
  const env = environment();
  assert.equal(env.run(`(() => { const first=createInitialState('magic','旅人'); const start=Adventure.act(first,'explore:0'); Storage.saveGame('pending',start.state,'',[],start.options,[]); const loaded=Storage.loadGame('pending'); if(loaded.options.length!==3 || loaded.options[0].actionId!=='encounter:0')return false; const done=Adventure.act(loaded.state,'encounter:2'); try{Adventure.act(done.state,'encounter:2');return false;}catch{} return done.state.adventure.pending===null && done.state.adventure.explored===1 && first.adventure.energy===100; })()`), true);
});

test('inventory crafting trading and healing have real costs', () => {
  const env = environment();
  assert.equal(env.run(`(() => { let s=createInitialState('wuxia','旅人'); s.player.hp=20;s.player.wealth=40;s.adventure.inventory.herb=3;s.adventure.inventory.relic=1; s=Adventure.act(s,'brew').state; if(s.adventure.inventory.herb!==0 || s.adventure.inventory.tonic!==3)return false; s=Adventure.act(s,'use').state;if(s.player.hp!==60 || s.adventure.inventory.tonic!==2)return false; s=Adventure.act(s,'buy').state;if(s.player.wealth!==20)return false;s=Adventure.act(s,'sell').state;return s.player.wealth===45 && s.adventure.inventory.relic===0; })()`), true);
});

test('optional goal claims are idempotent and cost no time', () => {
  const env = environment();
  assert.equal(env.run(`(() => { const s=createInitialState('xiuxian');s.adventure.explored=3;const done=Adventure.act(s,'claim:first-step').state;try{Adventure.act(done,'claim:first-step');return false;}catch{}return done.player.wealth===35 && done.turn===s.turn && done.calendarDays===s.calendarDays; })()`), true);
});

test('all exploration events and choices resolve and advance exactly once', () => {
  const env = environment();
  assert.equal(env.run(`WORLDS.every(w=>Adventure.events.every((event,i)=>event.choices.every((_,choice)=>{const s=createInitialState(w.id);s.player.wealth=100;s.adventure.pending={route:0,event:i}; const result=Adventure.act(s,'encounter:'+choice);return result.state.turn===1 && result.state.adventure.pending===null && result.state.adventure.explored===1;})))`), true);
});

test('old saves migrate and invalid inventory values are normalized', () => {
  const env = environment();
  assert.equal(env.run(`(() => { const s=createInitialState('xiuxian');delete s.adventure;delete s.calendarDays;const old=Storage.normalizeSave({version:2,state:s,history:[]});if(old.state.adventure.energy!==100 || old.state.calendarDays!==0)return false;s.adventure={energy:-10,inventory:{tonic:-1,herb:'500',relic:Infinity},pending:{route:8,event:0},claimed:['made-up']};const result=Storage.normalizeSave({state:s}).state.adventure;return result.energy===100 && result.inventory.tonic===2 && result.pending===null && result.claimed.length===0; })()`), true);
});

test('growth remains reachable without random windfalls', () => {
  const env = environment();
  assert.equal(env.run(`WORLDS.every(w=>{let s=createInitialState(w.id);for(let i=0;i<600 && s.status==='playing';i++){const action=s.adventure.energy<18?'rest':'train';s=Adventure.act(s,action).state;}return s.player.stageIndex===w.stages.length-1 && s.endingType==='peak';})`), true);
});

test('first streamed characters are not needlessly buffered', () => {
  const env = environment();
  assert.equal(env.run(`(() => {let text='';const write=makeNarrativeDeltaHandler(chunk=>text+=chunk);write('你','你');if(text!=='你')return false;write('好###ME','你好###ME');if(text!=='你好')return false;write('TA###{}','你好###META###{}');return text==='你好';})()`), true);
});

test('safe rest does not randomly trigger fatal events', () => {
  const env = environment();
  assert.equal(env.run(`WORLDS.every(w=>{let s=createInitialState(w.id);s.player.hp=1;for(let i=0;i<20;i++)s=Adventure.act(s,'rest').state;return s.status==='playing' && s.player.hp===s.player.maxHp;})`), true);
});
