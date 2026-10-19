import {test} from 'node:test';
import assert from 'node:assert/strict';
import {profileName,platinumSnapshot,planPlatinums,markPlatinum} from '../dist/platinums.js';
import {emptyPersonal,blankRecord,groupGames,workRecordFor,personal} from '../dist/model.js';
const trophy=(name,id='1',platforms=['PS5'],extra={})=>({name,psnprofilesId:id,platforms,url:`https://psnprofiles.com/trophies/${id}-test/chiarubi`,...extra});
const snapshot=games=>({kind:'ps-game-base-platinums',schemaVersion:1,profile:'chiarubi',complete:true,games});
const game=(name,id='one',extra={})=>({name,entitlementId:id,conceptId:id,platform:'PS5',...extra});
const lib=games=>({games});

test('snapshot rejects partial, duplicate, wrong profile, foreign URL and malformed data',()=>{
  const value=snapshot([trophy('Human Fall Flat')]);
  assert.equal(platinumSnapshot(value,'CHIARUBI').games.length,1);
  for(const bad of [{...value,complete:false},{...value,kind:'other'},snapshot([trophy('A'),trophy('B')]),snapshot([trophy('A','1',['PS6'])]),snapshot([trophy('A','1',['PS5'],{url:'https://evil.example/trophies/1-test/chiarubi'})]),snapshot([trophy('A','1',['PS5'],{url:'https://psnprofiles.com/trophies/1-test/another'})]),snapshot([trophy('A','1',['PS5'],{psnprofilesId:1})])])assert.throws(()=>platinumSnapshot(bad));
  assert.throws(()=>platinumSnapshot(value,'other'));
});
test('profile accepts username or an exact personal page URL',()=>{
  assert.equal(profileName('https://psnprofiles.com/chiarubi/'),'chiarubi');
  for(const bad of ['https://evil.example/chiarubi','https://psnprofiles.com/trophies/1-test/chiarubi','a/b',''])assert.throws(()=>profileName(bad));
});
test('one exact title and platform maps automatically; trademark and spaces are harmless',()=>{
  const plan=planPlatinums(lib([game('Human Fall Flat™')]),emptyPersonal(),snapshot([trophy(' human  fall flat ')]));
  assert.equal(plan.automatic.length,1);assert.equal(plan.review.length,0);
});
test('completion percentage is not a requirement for an earned platinum',()=>{
  const checked=platinumSnapshot(snapshot([trophy('Human Fall Flat','1',['PS5'],{completion:72})]));
  assert.equal(planPlatinums(lib([game('Human Fall Flat')]),emptyPersonal(),checked).automatic.length,1);
});
test('PS4 platinum never automatically marks a separate PS5-only work',()=>{
  const plan=planPlatinums(lib([game('Game')]),emptyPersonal(),snapshot([trophy('Game','1',['PS4'])]));
  assert.equal(plan.automatic.length,0);assert.equal(plan.review.length,1);
});
test('name and platform must match the same entitlement, not different versions',()=>{
  const plan=planPlatinums(lib([game('English','a',{conceptId:'shared',platform:'PS4'}),game('中文','b',{conceptId:'shared'})]),emptyPersonal(),snapshot([trophy('English')]));
  assert.equal(plan.automatic.length,0);
});
test('two different works with identical names require manual selection',()=>{
  const plan=planPlatinums(lib([game('Game','a'),game('Game','b')]),emptyPersonal(),snapshot([trophy('Game')]));
  assert.equal(plan.automatic.length,0);assert.equal(plan.review[0].candidates.length,2);
});
test('editions, remasters, subtitles, sequels and translated names do not fuzzy auto-match',()=>{
  for(const name of ['Game II','Game Remastered','Game Deluxe Edition','Game: Sequel','遊戲']) {
    const plan=planPlatinums(lib([game(name)]),emptyPersonal(),snapshot([trophy('Game')]));
    assert.equal(plan.automatic.length,0);assert.equal(plan.review.length,1);
  }
});
test('explicit trophy regions require compatible known product region',()=>{
  const snap=snapshot([trophy('Game','1',['PS5'],{region:'AS'})]);
  for(const productId of ['UP0001-TEST','EP0001-TEST','',undefined])assert.equal(planPlatinums(lib([game('Game','a',{productId})]),emptyPersonal(),snap).automatic.length,0);
  assert.equal(planPlatinums(lib([game('Game','a',{productId:'HP0001-TEST'})]),emptyPersonal(),snap).automatic.length,1);
});
test('a grouped work may receive platinum from any matching owned version',()=>{
  const library=lib([game('Game','a',{conceptId:'shared',platform:'PS4'}),game('Game','b',{conceptId:'shared'})]);
  const plan=planPlatinums(library,emptyPersonal(),snapshot([trophy('Game','1',['PS4']),trophy('Game','2',['PS5'])]));
  assert.equal(plan.automatic.length,2);assert.equal(new Set(plan.automatic.map(e=>e.work.key)).size,1);
});
test('conflicting legacy records require manual confirmation',()=>{
  const library=lib([game('Game','a',{conceptId:'shared',platform:'PS4'}),game('Game','b',{conceptId:'shared'})]),p=emptyPersonal();
  p.records.a={...blankRecord(),note:'PS4 note'};p.records.b={...blankRecord(),note:'PS5 note'};
  assert.equal(planPlatinums(library,p,snapshot([trophy('Game')])).review.length,1);
});
test('marking platinum preserves notes/tags/categories and backup round-trip',()=>{
  const work=groupGames([game('Game')])[0],p=emptyPersonal();p.categories=['週末'];p.records.one={...blankRecord(),status:'想玩',note:'私人筆記',tags:['雙人'],categories:['週末']};
  const before=JSON.stringify(p),next=markPlatinum(p,work,'2026-10-17T00:00:00Z'),r=workRecordFor(next,work);
  assert.equal(r.status,'已白金');assert.equal(r.note,'私人筆記');assert.deepEqual(r.categories,['週末']);assert.deepEqual(r.tags,['雙人']);assert.equal(JSON.stringify(p),before);
  assert.equal(workRecordFor(personal(JSON.parse(JSON.stringify(next))),work).status,'已白金');
});
test('already platinum and unsupported platforms are counted without new writes',()=>{
  const library=lib([game('Game')]),p=markPlatinum(emptyPersonal(),groupGames(library.games)[0]);
  const plan=planPlatinums(library,p,snapshot([trophy('Game'),trophy('PS3 Game','2',['PS3'])]));
  assert.equal(plan.automatic.length,0);assert.equal(plan.already.length,1);assert.equal(plan.unsupported.length,1);
});
test('a complete empty or unmatched trophy list never clears existing classifications',()=>{
  const p=emptyPersonal();p.works['concept:one']={...blankRecord(),status:'已白金'};const before=JSON.stringify(p);
  const plan=planPlatinums(lib([game('Game')]),p,snapshot([]));
  assert.equal(plan.automatic.length,0);assert.equal(JSON.stringify(p),before);
});
