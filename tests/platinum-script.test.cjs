const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../dist/scripts/ps-game-base-psnprofiles.user.js'),'utf8');
function harness({origin='http://127.0.0.1:4175',filter='Platform (All)',search='',rows=[{name:'Human Fall Flat',id:'1',platinum:true,earned:true},{name:'Not earned',id:'2',platinum:false,earned:false}]}={}) {
 const messages=[],created=[];
 const make=tag=>{const e={tag,append(){},setAttribute(){},attachShadow(){return make('shadow');}};created.push(e);return e;};
 const tableRows=rows.map(r=>({
  classList:{contains:()=>r.platinum},
  querySelector:s=>s==='a.title'?{textContent:r.name,getAttribute:()=>`/trophies/${r.id}-game/chiarubi`,closest:()=>({textContent:r.name})}:s==='.completion-status .platinum-18.earned'&&r.earned?{}:null,
  querySelectorAll:()=>[{textContent:'PS5'}],
 }));
 const document={body:make('body'),createElement:make,querySelector:s=>({'#gamesTable':{},'#search':{value:search},'.dropdown-toggle.platform':{textContent:filter},'.dropdown-toggle.completion':{textContent:'Completion (All)'}}[s]||null),querySelectorAll:s=>s==='#gamesTable tr'?tableRows:[]};
 const location={pathname:'/chiarubi',origin:'https://psnprofiles.com',search:'',hash:'#'+new URLSearchParams({psgbOrigin:origin,psgbSession:'12345678-1234-1234-1234-123456789012'})};
 const context={document,location,URL,URLSearchParams,Set,MutationObserver:class{},setTimeout,clearTimeout,window:{opener:{postMessage:(message,target)=>messages.push({message,target})}}};
 vm.runInNewContext(source,context);
 return {messages,created};
}
test('collector reads earned platinum flags and excludes an unearned rarity icon',()=>{
 const {messages}=harness();const result=messages.find(m=>m.message.type==='PSGB_PLATINUM_RESULT');
 assert.equal(result.target,'http://127.0.0.1:4175');assert.equal(result.message.payload.games.length,1);assert.equal(result.message.payload.games[0].name,'Human Fall Flat');assert.equal(result.message.payload.complete,true);
});
test('collector never sends to an arbitrary opener origin',()=>{assert.equal(harness({origin:'https://untrusted.example'}).messages.length,0);});
test('collector rejects a filtered/searched profile rather than claiming complete results',()=>{
 for(const config of [{filter:'Platform (PS5)'},{search:'Human'}]) {
  const {messages}=harness(config);assert.equal(messages.some(m=>m.message.type==='PSGB_PLATINUM_RESULT'),false);assert.ok(messages.some(m=>m.message.message?.includes('All')));
 }
});
test('collector fails closed if row and earned icon disagree',()=>{
 const {messages}=harness({rows:[{name:'Game',id:'1',platinum:true,earned:false}]});
 assert.equal(messages.some(m=>m.message.type==='PSGB_PLATINUM_RESULT'),false);assert.ok(messages.some(m=>m.message.message?.includes('格式已變更')));
});
test('collector requires unique trophy list IDs',()=>{
 const {messages}=harness({rows:[{name:'Game',id:'1',platinum:true,earned:true},{name:'Game',id:'1',platinum:true,earned:true}]});
 assert.equal(messages.some(m=>m.message.type==='PSGB_PLATINUM_RESULT'),false);assert.ok(messages.some(m=>m.message.message?.includes('重複')));
});
