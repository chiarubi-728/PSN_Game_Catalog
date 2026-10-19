// ==UserScript==
// @name         PS Game Base 白金比對 · PSNProfiles
// @namespace    personal.ps-game-base
// @version      0.2.3
// @description  讀取公開 PSNProfiles 的全部遊玩紀錄、獎盃進度與白金狀態，傳回 PS Game Base。
// @match        https://psnprofiles.com/*
// @run-at       document-idle
// @noframes
// @grant        none
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';
  const allowed = new Set(['http://127.0.0.1:4175','http://localhost:4175','https://chiarubi-728.github.io']);
  const profile = /^\/([A-Za-z0-9_-]{1,32})\/?$/.exec(location.pathname)?.[1];
  if (!profile || !document.querySelector('#gamesTable')) return;
  const params = new URLSearchParams(location.hash.slice(1));
  const origin = params.get('psgbOrigin'), session = params.get('psgbSession');
  const bridge = !!(allowed.has(origin) && /^[a-f0-9-]{36}$/i.test(session || '') && window.opener);
  let busy = false, snapshot = null, acknowledged=false, diagnostic=null;
  const host = document.createElement('div'); host.id = 'psgb-platinum-collector'; document.body.append(host);
  const root = host.attachShadow({mode:'closed'});
  const style = document.createElement('style');
  style.textContent = ':host{all:initial;color-scheme:dark;font:14px/1.7 system-ui}section{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:min(390px,calc(100vw - 32px));box-sizing:border-box;padding:18px;border:1px solid #75bdf6;border-radius:12px;color:#eef3ff;background:#121e33;box-shadow:0 8px 35px #0008}h2{font-size:16px;margin:0}p{font-size:12px;overflow-wrap:anywhere}button{font:inherit;padding:7px 12px;margin-right:8px;color:#eef3ff;background:#243e62;border:1px solid #60789d;border-radius:6px;cursor:pointer}button:disabled{opacity:.5}';
  root.append(style);
  const panel = document.createElement('section');root.append(panel);
  function el(tag,text) { const n=document.createElement(tag);n.textContent=text;panel.append(n);return n; }
  el('h2','PS Game Base · 完整遊玩紀錄 v0.2.3');
  el('p',bridge ? `將 ${profile} 的全部公開遊戲、獎盃進度與白金狀態傳回 ${origin}。數位版與實體版的遊玩紀錄都會加入主清單，不需逐款配對。` : '請使用全部平台、全部完成狀態並清空搜尋。讀取後可匯出完整遊玩紀錄 JSON，再匯入 Game Base。');
  const status=el('p','準備讀取。');status.setAttribute('role','status');
  const collect=el('button','讀取全部遊戲'), download=el('button','匯出遊玩紀錄 JSON');download.disabled=true;
  const diagnosticButton=el('button','匯出讀取診斷');diagnosticButton.disabled=true;
  function saveJson(value,name){
    const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  function publicPath(value){try{const url=new URL(value,location.origin);return url.origin+url.pathname;}catch{return '';}}
  function platformNames(row){
    const nodes=[...row.querySelectorAll('.platforms, .platform, [data-platform], [class*="platform"]')];
    const labels=nodes.flatMap(node=>[node.textContent,node.getAttribute('title'),node.getAttribute('data-platform'),...[...node.querySelectorAll('img')].flatMap(img=>[img.alt,img.title])]).filter(Boolean).join(' ');
    return [...new Set((labels.match(/\bPS\s*[345]\b|\bPS\s*VITA(?:\s*TV)?\b|\bPS\s*PC\b|\bPC\b/gi)||[]).map(value=>value.replace(/\s+/g,'').toUpperCase()))];
  }
  function rowSource(row){
    const title=row.querySelector('a.title');
    let url;try{url=new URL(title?.getAttribute('href'),location.origin);}catch{return null;}
    if(url.origin!==location.origin||url.username||url.password)return null;
    // Some profile rows link to the game's base trophy page, while others
    // include the player name. Keep the current profile explicitly in exports.
    const match=/^\/trophies\/(\d+)-([^/]+)(?:\/([A-Za-z0-9_-]+))?\/?$/.exec(url.pathname);
    if(!match||match[3]&&match[3].toLowerCase()!==profile.toLowerCase())return null;
    url.pathname='/trophies/'+match[1]+'-'+match[2]+'/'+profile;url.search='';url.hash='';
    return {id:match[1],url:url.href};
  }
  function rowDiagnostic(row,index,reasons){
    const title=row.querySelector('a.title');
    return {row:index+1,name:(title?.textContent||'').trim().slice(0,500),href:publicPath(title?.getAttribute('href')),reasons,
      platformNodes:[...row.querySelectorAll('[class*="platform"], [data-platform]')].slice(0,12).map(node=>({tag:node.tagName,className:node.className,text:node.textContent.trim().slice(0,120),title:node.getAttribute('title'),dataPlatform:node.getAttribute('data-platform')})),
      cells:[...row.children].filter(node=>node.tagName==='TD').slice(0,12).map(node=>({className:node.className,text:node.textContent.replace(/\s+/g,' ').trim().slice(0,220)})),
      links:[...row.querySelectorAll('a')].slice(0,6).map(link=>({text:link.textContent.trim().slice(0,100),path:publicPath(link.getAttribute('href'))}))};
  }
  diagnosticButton.onclick=()=>{if(diagnostic)saveJson(diagnostic,'ps-game-base-psnprofiles-diagnostic-'+profile+'.json');};
  function send(type,payload) { if(bridge) window.opener.postMessage({type,session,...payload},origin); }
  function report(message) { status.textContent=message;send('PSGB_HISTORY_STATUS',{message}); }
  const morePattern=/^Show\s+([\d,]+)\s+more\s+games?$/i;
  const controlText=node=>(node?.textContent||'').replace(/\s+/g,' ').trim();
  function isMoreControl(node){
    return morePattern.test(controlText(node))||node.matches('.load-more, .load-more a, .load-more button');
  }
  function gameRows(){
    return [...document.querySelectorAll('#gamesTable tr')].filter(row=>{const title=row.querySelector('a.title');return title&&!isMoreControl(title)&&!row.matches('.load-more');});
  }
  function moreControl(){
    // The live page uses a.title with the text "Show 109 more games", without
    // a .load-more class. It is a paging control, never a game record.
    return [...document.querySelectorAll('#gamesTable a, #gamesTable button')].find(node=>isMoreControl(node)&&node.getClientRects().length>0)||null;
  }
  function remainingGames(control){
    const match=morePattern.exec(controlText(control));
    if(!match)return null;
    const count=Number(match[1].replace(/,/g,''));return Number.isSafeInteger(count)&&count>=0?count:null;
  }
  window.addEventListener('message',event=>{
    if(!bridge||event.source!==window.opener||event.origin!==origin||event.data?.session!==session||event.data.type!=='PSGB_HISTORY_SAVED')return;
    acknowledged=true;status.textContent='Game Base 已確認保存完整遊玩紀錄，可以回到遊戲庫查看。';
  });
  function progressFor(row){
    const bar=row.querySelector('.progress-bar');
    for(const node of [bar,bar?.parentElement,row.querySelector('[class*="progress"]')]){
      const values=[...new Set((node?.textContent?.match(/\b\d{1,3}(?:\.\d+)?\s*%/g)||[]).map(value=>Number(value.replace(/[\s%]/g,''))))];
      if(values.length===1&&values[0]>=0&&values[0]<=100)return values[0];
    }
    return null;
  }
  function waitForMore(previous) {
    return new Promise((resolve,reject) => {
      const observer=new MutationObserver(check);
      const timer=setTimeout(()=>{observer.disconnect();reject(Error('展開遊戲逾時，目前清單尚未完整；請匯出讀取診斷。'));},25000);
      function check() {
        if(gameRows().length>previous) {
          clearTimeout(timer);observer.disconnect();resolve();
        }
      }
      observer.observe(document.querySelector('#gamesTable').parentElement,{childList:true,subtree:true});check();
    });
  }
  async function run() {
    if(busy)return;busy=true;collect.disabled=true;download.disabled=true;diagnosticButton.disabled=true;diagnostic=null;snapshot=null;acknowledged=false;
    let stage='filters',expectedTotal=null,pageCount=0;
    try {
      if(location.search || document.querySelector('#search')?.value.trim() || !/\(All\)/i.test(document.querySelector('.dropdown-toggle.platform')?.textContent || '') || !/\(All\)/i.test(document.querySelector('.dropdown-toggle.completion')?.textContent || '')) throw Error('請清空搜尋、將 Platform 與 Completion 都設為 All，再重新讀取。');
      stage='pagination';
      for(let i=0;moreControl();i++) {
        if(i>=100)throw Error('展開次數超過上限，請手動檢查。');
        const link=moreControl(),previous=gameRows().length,remaining=remainingGames(link);
        if(remaining!==null){
          const total=previous+remaining;
          if(total>10000||expectedTotal!==null&&total!==expectedTotal)throw Error('展開前後的遊戲總數不一致，未傳送不完整清單。');
          expectedTotal=total;
        }
        report(`正在展開全部遊戲，目前 ${previous}${expectedTotal!==null?' / '+expectedTotal:''} 筆…`);
        const loaded=waitForMore(previous);link.click();await loaded;
        pageCount++;
        if(gameRows().length<=previous)throw Error('遊戲清單未增加，目前尚未完成讀取。');
        await new Promise(resolve=>setTimeout(resolve,400));
      }
      const rows=gameRows();
      if(expectedTotal!==null&&rows.length!==expectedTotal)throw Error(`只讀到 ${rows.length} / ${expectedTotal} 款遊戲，未傳送不完整清單。`);
      if(!rows.length)throw Error('沒有讀到遊戲清單，請確認個人頁已載入。');
      stage='rows';
      const games=[],failed=[];
      for(const [index,row] of rows.entries()) {
        // Rarity icons are present even when unearned: require the earned flag.
        const earned=!!row.querySelector('.completion-status .platinum-18.earned');
        const title=row.querySelector('a.title'),source=rowSource(row),platforms=platformNames(row),reasons=[];
        if(row.classList.contains('platinum')!==earned)reasons.push('白金標記不一致');
        if(!title?.textContent.trim())reasons.push('名稱空白');
        if(!source)reasons.push('獎盃連結格式不同');
        if(!platforms.length)reasons.push('無法讀取平台標籤');
        if(reasons.length){failed.push(rowDiagnostic(row,index,reasons));continue;}
        const region=/•\s*([A-Z]{2,5})\b/.exec(title.closest('.ellipsis')?.textContent || '')?.[1];
        const totals=/([\d,]+)\s*(?:of|\/)\s*([\d,]+)\s*Trophies/i.exec(row.textContent);
        const image=row.querySelector('td:first-child img'),imageUrl=image?.src;
        const earnedTotal=totals?Number(totals[1].replace(/,/g,'')):null,definedTotal=totals?Number(totals[2].replace(/,/g,'')):null;
        games.push({name:title.textContent.trim(),platforms,psnprofilesId:source.id,url:source.url,platinum:earned,progress:progressFor(row),earnedTotal,definedTotal,...(imageUrl?.startsWith('https://')?{imageUrl}:{}),...(region?{region}:{})});
      }
      if(failed.length){
        diagnostic={kind:'ps-game-base-psnprofiles-diagnostic',schemaVersion:1,scriptVersion:'0.2.2',profile,createdAt:new Date().toISOString(),stage,expectedTotal,pageCount,totalRows:rows.length,parsedRows:games.length,failedRows:failed.length,samples:failed.slice(0,8)};
        diagnosticButton.disabled=false;const first=failed[0];throw Error(`已辨識 ${games.length} / ${rows.length} 筆；第 ${first.row} 筆「${first.name||'名稱空白'}」：${first.reasons.join('、')}。請按「匯出讀取診斷」提供檔案；目前未匯入不完整清單。`);
      }
      if(new Set(games.map(g=>g.psnprofilesId)).size!==games.length)throw Error('清單有重複紀錄，請重新整理後再試。');
      snapshot={kind:'ps-game-base-psnprofiles-history',schemaVersion:1,complete:true,profile,exportedAt:new Date().toISOString(),games};
      report(`已讀取全部 ${games.length} 筆遊戲：${games.filter(game=>game.platinum).length} 筆白金、${games.filter(game=>!game.platinum).length} 筆尚未白金。${bridge?'等待 Game Base 確認保存。':'可匯出完整遊玩紀錄。'}`);
      send('PSGB_HISTORY_RESULT',{payload:snapshot});download.disabled=false;
      if(bridge)setTimeout(()=>{if(!acknowledged)status.textContent=`已讀取 ${games.length} 筆遊戲，但尚未收到 Game Base 保存確認。可按「匯出遊玩紀錄 JSON」，回遊戲庫匯入。`;},5000);
    } catch(e) {
      if(!diagnostic){const control=moreControl();diagnostic={kind:'ps-game-base-psnprofiles-diagnostic',schemaVersion:1,scriptVersion:'0.2.2',profile,createdAt:new Date().toISOString(),stage,expectedTotal,pageCount,totalRows:gameRows().length,remaining:remainingGames(control),controlText:controlText(control),samples:[],error:String(e.message).slice(0,600)};}
      diagnosticButton.disabled=false;report(e.message);
    } finally {busy=false;collect.disabled=false;}
  }
  collect.onclick=run;
  download.onclick=()=>{
    if(!snapshot)return;
    saveJson(snapshot,`ps-game-base-history-${profile}.json`);
  };
  if(bridge)run();
})();
