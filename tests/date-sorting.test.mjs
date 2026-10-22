import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {dateValue,readPlayActivity} from '../dist/dates.js';
import {compareCatalog,catalogSortPlan,catalogSortSummary} from '../dist/catalog-sort.js';
import {library,emptyPersonal,mergeLibrary,parseImport} from '../dist/model.js';
import {emptyHistory,historySnapshot,mergeHistory} from '../dist/history.js';
import {unifiedCatalog} from '../dist/catalog.js';
const stamp='2024-04-20T10:00:00.000Z',older='2023-01-01T00:00:00.000Z';
const game=(id,platform='PS5')=>({name:'Game',entitlementId:id,platform,titleId:platform==='PS5'?'PPSA12345_00':'CUSA12345_00',conceptId:'100'});
const lib=games=>({schemaVersion:1,complete:true,syncedAt:stamp,games});
const history=games=>({kind:'ps-game-base-psnprofiles-history',schemaVersion:1,complete:true,profile:'ExampleUser',exportedAt:stamp,games:games.map((g,i)=>({name:'Game',platforms:['PS5'],platinum:false,progress:20,psnprofilesId:String(i+1),url:'https://psnprofiles.com/trophies/'+(i+1)+'-game/ExampleUser',...g}))});
const source=await readFile(new URL('../dist/scripts/ps-game-base.user.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('// PSGB_DATE_TOOLS_START'),source.indexOf('// PSGB_DATE_TOOLS_END'));
const context=vm.createContext({URL,Date,setTimeout:resolve=>{resolve();return 0;}});
vm.runInContext(helpers+'\nglobalThis.tools=psgbDateTools;globalThis.readSony=psgbReadSonyDates;',context);
const plain=value=>JSON.parse(JSON.stringify(value));

test('dates reject rollover, unzoned times, future and unknown; calendar precision stays calendar-only',()=>{
  assert.equal(dateValue('2024-02-29'),'2024-02-29');
  for(const value of [null,'','2023-02-29','2024-04-31','2024-01-01T00:00:00','2024-01-01T24:00:00Z','2099-01-01',0])assert.equal(dateValue(value),null);
  assert.equal(dateValue('2024-04-20T18:00:00+08:00'),stamp);
  for(const value of [NaN,Infinity,1e100])assert.equal(context.tools.date(value),null);
  assert.equal(context.tools.date(1713607200),stamp);
});
test('all three sorts put missing dates last in both directions and ties remain deterministic',()=>{
  for(const field of ['acquiredAt','lastPlayedAt','lastTrophyAt']){
    const cards=[{key:'z',name:'Z'},{key:'n',name:'New',[field]:stamp},{key:'o',name:'Old',[field]:older},{key:'a',name:'A'}];
    assert.deepEqual([...cards].sort((a,b)=>compareCatalog(a,b,{field,direction:'desc'})).map(c=>c.key),['n','o','a','z']);
    assert.deepEqual([...cards].sort((a,b)=>compareCatalog(a,b,{field,direction:'asc'})).map(c=>c.key),['o','n','a','z']);
  }
  assert.deepEqual([{name:'Z',key:'z'},{name:'A',key:'a'}].sort(compareCatalog).map(c=>c.key),['a','z']);
});
test('old backups remain valid; optional dates survive import and strip unrelated secrets',()=>{
  const old=lib([game('one')]);assert.equal(Object.hasOwn(library(old),'playActivity'),false);
  const input={...old,playActivity:[{titleId:'PPSA12345_00',platform:'PS5',name:'Game',lastPlayedAt:stamp,token:'secret'}],dateSync:{acquired:'complete',played:'partial',playedError:'HTTP_403',token:'secret'}};
  input.games[0]={...input.games[0],acquiredAt:older,lastPlayedAt:stamp,token:'secret'};
  const result=parseImport({kind:'ps-game-base-backup',schemaVersion:1,library:input,personal:emptyPersonal(),history:mergeHistory(emptyHistory(),history([{lastTrophyAt:stamp}]))});
  assert.equal(result.library.games[0].acquiredAt,older);assert.equal(result.history.sources.psnprofiles.games[0].lastTrophyAt,stamp);
  assert.equal(JSON.stringify(result).includes('secret'),false);
  assert.equal(result.library.playActivity[0].lastPlayedAt,stamp);
});
test('partial/no-date later sync preserves known dates and does not substitute sync timestamps',()=>{
  const previous=library({...lib([{...game('one'),acquiredAt:older,lastPlayedAt:stamp}]),playActivity:[{titleId:'PPSA12345_00',platform:'PS5',name:'Game',lastPlayedAt:stamp}]});
  const next=mergeLibrary(previous,{...lib([game('one')]),playActivity:[],dateSync:{played:'unavailable'}});
  assert.equal(next.games[0].acquiredAt,older);assert.equal(next.games[0].lastPlayedAt,stamp);assert.equal(next.playActivity.length,1);
  const before=mergeHistory(emptyHistory(),history([{lastTrophyAt:older}]));
  assert.equal(mergeHistory(before,history([{}])).sources.psnprofiles.games[0].lastTrophyAt,older);
  assert.equal(historySnapshot(history([{}])).games[0].lastTrophyAt,undefined);
});
test('card dates use earliest grant and latest trophy/activity without mixing PS4 and PS5',()=>{
  const input=library({...lib([{...game('a'),acquiredAt:stamp},{...game('b'),acquiredAt:older},{...game('ps4','PS4'),acquiredAt:'2022-01-01'}]),playActivity:[{titleId:'PPSA12345_00',platform:'PS5',name:'Game',lastPlayedAt:stamp}]});
  const h=mergeHistory(emptyHistory(),history([{lastTrophyAt:older}]));
  const cards=unifiedCatalog(input,emptyPersonal(),h,{records:{}});
  assert.equal(cards.find(c=>c.platforms[0]==='PS5').acquiredAt,older);
  assert.equal(cards.find(c=>c.platforms[0]==='PS5').lastPlayedAt,stamp);
  assert.equal(cards.find(c=>c.platforms[0]==='PS4').lastPlayedAt,null);
  assert.equal(cards.find(c=>c.platforms[0]==='PS5').lastTrophyAt,older);
});
test('physical/history-only cards receive unique same-platform activity; regional stacks stay unknown',()=>{
  const base={...lib([]),playActivity:[{titleId:'PPSA12345_00',platform:'PS5',name:'Game',lastPlayedAt:stamp}]};
  const one=unifiedCatalog(base,emptyPersonal(),mergeHistory(emptyHistory(),history([{}])),{records:{}});
  assert.equal(one[0].lastPlayedAt,stamp);
  const ambiguous=unifiedCatalog(base,emptyPersonal(),mergeHistory(emptyHistory(),history([{},{}])),{records:{}});
  assert.equal(ambiguous.every(c=>c.lastPlayedAt===null),true);
  assert.deepEqual(readPlayActivity([{titleId:'CUSA12345_00',platform:'PS5',name:'Game',lastPlayedAt:stamp}]),[]);
});
test('Sony augmentation joins exact entitlements and title IDs, with sequential pagination',async()=>{
  const games=[game('a')],calls=[];
  const response=await context.readSony({games,isCurrent:()=>true,progress(){},request:async value=>{
    const url=new URL(value);calls.push(url);
    if(url.pathname.includes('entitlement'))return {totalResults:1,entitlements:[{id:'a',activeDate:older,token:'secret'}]};
    return {totalItemCount:1,titles:[{titleId:'PPSA12345_00',category:'ps5_native_game',name:'Game',lastPlayedDateTime:stamp,token:'secret'}]};
  }});
  assert.equal(games[0].acquiredAt,older);assert.equal(games[0].lastPlayedAt,stamp);assert.equal(response.playActivity.length,1);
  assert.equal(JSON.stringify(response).includes('secret'),false);assert.equal(calls.length,2);
  assert.deepEqual(plain(response.dateSync),{acquired:'complete',played:'complete'});
});
test('Sony errors keep the digital library usable; web recent activity is explicitly partial',async()=>{
  const games=[game('a')],calls=[];
  const result=await context.readSony({games,isCurrent:()=>true,progress(){},request:async value=>{
    const url=new URL(value);calls.push(url);
    if(url.origin==='https://m.np.playstation.com')throw Error('HTTP_403');
    return {data:{gameLibraryTitlesRetrieve:{games:[{titleId:'PPSA12345_00',platform:'PS5',name:'Game',lastPlayedDateTime:stamp}]}}};
  }});
  assert.equal(games.length,1);assert.equal(games[0].acquiredAt,undefined);assert.equal(games[0].lastPlayedAt,stamp);
  assert.equal(result.dateSync.played,'partial');assert.equal(result.dateSync.acquiredError,'HTTP_403');assert.equal(calls.length,3);
});
test('cancelled Sony runs do not send additional requests or mutate dates',async()=>{
  let calls=0;
  await assert.rejects(context.readSony({games:[game('a')],isCurrent:()=>false,progress(){},request:async()=>{calls++;}}),/STOPPED/);
  assert.equal(calls,0);
});
test('trophy parser reads earned log dates, preserves day precision and ignores external game links',()=>{
  const node={textContent:'20th April 2024',querySelectorAll:()=>[],getAttribute:()=>null};
  assert.equal(context.tools.fromNode(node),'2024-04-20');
  const cells=Array.from({length:6},()=>({tagName:'TD'}));cells[5]={...node,tagName:'TD'};
  const row={children:cells,querySelector:()=>null,querySelectorAll:()=>[{getAttribute:()=>'/trophy/12345-game/1-trophy/ExampleUser'}]};
  assert.deepEqual(plain(context.tools.trophyLogRow(row)),{id:'12345',date:'2024-04-20'});
  row.querySelectorAll=()=>[{getAttribute:()=> 'https://example.com/trophy/12345-game/1-trophy'}];
  assert.equal(context.tools.trophyLogRow(row),null);
});

test('Sony paginates 201 grants and activities without skipping the second page',async()=>{
  const calls=[],games=[game('grant200')];
  const result=await context.readSony({games,isCurrent:()=>true,progress(){},request:async value=>{
    const url=new URL(value),offset=Number(url.searchParams.get('offset'));calls.push([url.pathname,offset]);
    const indices=Array.from({length:offset===0?200:1},(_,index)=>index+offset);
    if(url.pathname.includes('entitlement'))return {totalResults:201,entitlements:indices.map(i=>({id:'grant'+i,activeDate:older}))};
    return {totalItemCount:201,titles:indices.map(i=>({titleId:i===200?'PPSA12345_00':'PPSA'+String(20000+i)+'_00',name:'Game '+i,category:'ps5_native_game',lastPlayedDateTime:stamp}))};
  }});
  assert.deepEqual(calls.map(call=>call[1]),[0,200,0,200]);
  assert.equal(games[0].acquiredAt,older);assert.equal(games[0].lastPlayedAt,stamp);
  assert.equal(result.playActivity.length,201);assert.equal(result.dateSync.played,'complete');
});
test('Sony repeated pages stop as partial and keep already collected dates',async()=>{
  let grantCalls=0;
  const games=[game('a')];
  const result=await context.readSony({games,isCurrent:()=>true,progress(){},request:async value=>{
    const url=new URL(value);
    if(url.pathname.includes('entitlement')){grantCalls++;return {totalResults:400,entitlements:Array.from({length:200},(_,i)=>({id:i===0?'a':'x'+i,activeDate:older}))};}
    return {totalItemCount:0,titles:[]};
  }});
  assert.equal(grantCalls,2);assert.equal(result.dateSync.acquired,'partial');
  assert.equal(result.dateSync.acquiredError,'PARTIAL');assert.equal(games[0].acquiredAt,older);
});

test('an unrelated grant with no product ID cannot supply an acquired date',async()=>{
 const games=[game('ours')];
 await context.readSony({games,isCurrent:()=>true,progress(){},request:async value=>new URL(value).pathname.includes('entitlement')?{totalResults:1,entitlements:[{id:'unrelated',activeDate:older}]}:{totalItemCount:0,titles:[]}});
 assert.equal(games[0].acquiredAt,undefined);
});

test('cookie-only Sony login uses web recent query limit 100 and preserves the missing-token cause',async()=>{
 const games=[game('a')];let webCalls=0;
 const result=await context.readSony({games,isCurrent:()=>true,progress(){},request:async value=>{
  const url=new URL(value);if(url.origin==='https://m.np.playstation.com')throw Error('NO_TOKEN');
  webCalls++;assert.equal(JSON.parse(url.searchParams.get('variables')).limit,100);
  return {data:{gameLibraryTitlesRetrieve:{games:[{titleId:'PPSA12345',platform:'PS5',name:'Game',lastPlayedDateTime:'2024-04-20T10:00:00.000000Z'}]}}};
 }});
 assert.equal(webCalls,1);assert.equal(result.dateSync.played,'partial');assert.equal(result.dateSync.playedError,'NO_TOKEN');
 assert.equal(games[0].lastPlayedAt,stamp);assert.equal(games[0].acquiredAt,undefined);
});
test('web recent failures are safe, exported and shown instead of being silently discarded',async()=>{
 const result=await context.readSony({games:[game('a')],isCurrent:()=>true,progress(){},request:async value=>{throw Error(new URL(value).origin==='https://m.np.playstation.com'?'NO_TOKEN':'HTTP_503');}});
 assert.equal(result.dateSync.webPlayedError,'HTTP_503');
 const normalized=library({...lib([game('a')]),dateSync:plain(result.dateSync)});
 assert.equal(normalized.dateSync.webPlayedError,'HTTP_503');
 assert.match(catalogSortSummary([{name:'Game'}],'lastPlayedAt',normalized.dateSync),/HTTP 503/);
});
test('Sony acquisition order survives a merge independently of existing map insertion order',()=>{
 const previous=library(lib([{...game('older'),conceptId:'1',name:'A'},{...game('newer'),conceptId:'2',name:'Z'}]));
 const incoming={...lib([{...game('newer'),conceptId:'2',name:'Z'},{...game('older'),conceptId:'1',name:'A'}]),acquisitionOrder:['newer','older'],dateSync:{acquired:'unavailable',acquiredError:'NO_TOKEN'}};
 const merged=mergeLibrary(previous,incoming);
 assert.deepEqual(merged.games.map(game=>game.entitlementId),['older','newer']);
 assert.deepEqual(merged.acquisitionOrder,['newer','older']);
 const cards=unifiedCatalog(merged,emptyPersonal(),emptyHistory(),{records:{}}),unknown={key:'unknown',name:'Unknown',acquisitionRank:null};cards.push(unknown);
 const options=catalogSortPlan(cards,'acquiredAt');assert.equal(options.useAcquisitionOrder,true);
 assert.deepEqual([...cards].sort((a,b)=>compareCatalog(a,b,{field:'acquiredAt',direction:'desc',...options})).map(c=>c.name),['Z','A','Unknown']);
 assert.deepEqual([...cards].sort((a,b)=>compareCatalog(a,b,{field:'acquiredAt',direction:'asc',...options})).map(c=>c.name),['A','Z','Unknown']);
 assert.match(catalogSortSummary(cards,'acquiredAt'),/2 款依 Sony 取得順序/);
 assert.equal(cards.every(card=>!card.acquiredAt),true);
});
test('acquisition-order metadata rejects duplicates, foreign IDs and incomplete snapshots',()=>{
 const base=lib([game('a')]);
 for(const acquisitionOrder of [['a','a'],['foreign'],[1]])assert.equal(library({...base,acquisitionOrder}).acquisitionOrder,undefined);
 assert.equal(library({...base,complete:false,acquisitionOrder:['a']}).acquisitionOrder,undefined);
 assert.deepEqual(library({...base,acquisitionOrder:['a']}).acquisitionOrder,['a']);
});
