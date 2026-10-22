import {access,readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Parse source and check references only; never import application code or run tests.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function filesIn(directory){
  const files=[];
  for(const entry of await readdir(path.join(root,directory),{withFileTypes:true})){
    const name=path.join(directory,entry.name);
    if(entry.isDirectory())files.push(...await filesIn(name));else files.push(name);
  }
  return files;
}
async function localReference(from,reference){
  if(/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference))return;
  const relative=decodeURIComponent(reference.split(/[?#]/)[0]);
  if(!relative)return;
  const target=relative.startsWith('/')?path.resolve(root,'dist','.'+relative):path.resolve(root,path.dirname(from),relative);
  if(!target.startsWith(root+path.sep))throw Error(`${from}: reference outside project`);
  try{await access(target);}catch{throw Error(`${from}: missing ${reference}`);}
}
const files=[...await filesIn('dist'),...await filesIn('tools'),'server.mjs'];
const scripts=files.filter(file=>/\.(?:js|mjs|cjs)$/.test(file));
for(const file of scripts){
  const syntax=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});
  if(syntax.status!==0)throw Error(`${file}\n${syntax.stderr||syntax.error||'Syntax check failed'}`);
  const source=await readFile(path.join(root,file),'utf8');
  for(const match of source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?(['"])(\.\.?\/[^'"]+)\1/g))await localReference(file,match[2]);
}
for(const file of files.filter(file=>file.endsWith('.html'))){
  const html=await readFile(path.join(root,file),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  if(ids.length!==new Set(ids).size)throw Error(`${file}: duplicate HTML id`);
  for(const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g))await localReference(file,match[1]);
}
const html=await readFile(path.join(root,'dist/index.html'),'utf8');
const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));
for(const file of ['app','sync-ui','history-ui','store-names-ui','cloud-sync']){
  const source=await readFile(path.join(root,`dist/${file}.js`),'utf8');
  for(const match of source.matchAll(/\$\('([^']+)'\)/g))if(!ids.has(match[1]))throw Error(`${file}: missing HTML id ${match[1]}`);
}
console.log(`靜態檢查完成：${scripts.length} 個 JavaScript 檔案語法、模組引用、HTML 本機連結與主要介面 ID。未啟動應用程式或執行測試。`);
