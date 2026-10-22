// ==UserScript==
// @name         PSN Game Catalog
// @namespace    personal.ps-game-base
// @version      0.3.3
// @description  線上整合數位遊戲庫、PSNProfiles 全部遊玩紀錄與 Sony 官方中英文名稱。
// @match        https://library.playstation.com/*
// @match        https://store.playstation.com/*
// @match        https://psnprofiles.com/*
// @match        https://chiarubi-728.github.io/PSN_Game_Catalog/*
// @run-at       document-start
// @noframes
// @grant        unsafeWindow
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @connect      store.playstation.com
// @sandbox      raw
// @license      MIT
// ==/UserScript==

/* Library query/pagination adapted from psn-mcp, Copyright (c) 2026 TMRP.
 * MIT license: see LICENSE in this script's distribution directory.
 */
// A per-run extension mailbox survives sites that sever window.opener on navigation.
// Only public PSNProfiles history crosses it; Sony/Google credentials never enter it.
const psgbHistoryRelay=(() => {
  'use strict';
  const prefix='psgb.history-relay.v1.',lifetime=20*60*1000;
  const sessionPattern=/^[a-f0-9-]{36}$/i,profilePattern=/^[A-Za-z0-9_-]{1,32}$/;
  const sourceOrigin='https://psnprofiles.com';
  const allowed=new Set(['http://127.0.0.1:4175','http://localhost:4175','https://chiarubi-728.github.io']);
  const manager=(location.origin==='https://chiarubi-728.github.io'&&location.pathname.startsWith('/PSN_Game_Catalog/'))||['http://127.0.0.1:4175','http://localhost:4175'].includes(location.origin);
  const supported=typeof GM_getValue==='function'&&typeof GM_setValue==='function'&&typeof GM_deleteValue==='function'&&typeof GM_listValues==='function'&&typeof GM_addValueChangeListener==='function'&&typeof GM_removeValueChangeListener==='function';
  const key=(session,part)=>prefix+session+'.'+part;
  const messageTypes=new Set(['PSGB_HISTORY_STATUS','PSGB_HISTORY_RESULT','PSGB_HISTORY_ERROR']);
  function erase(session){for(const part of ['request','message','ack'])GM_deleteValue(key(session,part));}
  if(manager){
    const jobs=new Map();
    function release(session){
      const job=jobs.get(session);if(!job)return;
      jobs.delete(session);clearTimeout(job.timer);clearTimeout(job.releaseTimer);
      GM_removeValueChangeListener(job.listener);erase(session);
    }
    if(supported){
      // Interrupted browser sessions are cleaned on the next manager load.
      try{for(const name of GM_listValues()){
        if(!name.startsWith(prefix)||!name.endsWith('.request'))continue;
        const session=name.slice(prefix.length,-'.request'.length);if(!sessionPattern.test(session))continue;
        const request=GM_getValue(name);
        if(!request||!Number.isFinite(request.expiresAt)||request.expiresAt<=Date.now()||request.expiresAt>Date.now()+lifetime)erase(session);
        else setTimeout(()=>erase(session),request.expiresAt-Date.now());
      }}catch{}
    }
    window.addEventListener('message',event=>{
      if(event.origin!==location.origin||(event.source!==window&&event.source!==(typeof unsafeWindow==='undefined'?window:unsafeWindow)))return;
      const data=event.data;if(!data||!sessionPattern.test(data.session||''))return;
      const reply=available=>window.postMessage({type:'PSGB_HISTORY_RELAY_READY',session:data.session,available},location.origin);
      if(data.type==='PSGB_HISTORY_RELAY_START'){
        if(!supported||!profilePattern.test(data.profile||'')){reply(false);return;}
        try{
          if(jobs.has(data.session))release(data.session);
          if(jobs.size>=4){reply(false);return;}
          erase(data.session);
          const request={managerOrigin:location.origin,sourceOrigin,profile:data.profile,expiresAt:Date.now()+lifetime};
          const job={request,listener:null,timer:null,releaseTimer:null};jobs.set(data.session,job);
          job.listener=GM_addValueChangeListener(key(data.session,'message'),(_name,_old,message)=>{
            if(jobs.get(data.session)!==job||request.expiresAt<=Date.now()||!message||message.session!==data.session||message.sourceOrigin!==sourceOrigin||!messageTypes.has(message.type))return;
            GM_deleteValue(key(data.session,'message'));
            window.postMessage({type:'PSGB_HISTORY_RELAY_MESSAGE',session:data.session,sourceOrigin,message},location.origin);
          });
          job.timer=setTimeout(()=>release(data.session),lifetime);
          GM_setValue(key(data.session,'request'),request);reply(true);
        }catch{try{release(data.session);}catch{}reply(false);}
      }else if(data.type==='PSGB_HISTORY_RELAY_ACK'&&jobs.has(data.session)){
        GM_setValue(key(data.session,'ack'),{saved:true,session:data.session});
      }else if(data.type==='PSGB_HISTORY_RELAY_STOP'&&jobs.has(data.session)){
        const job=jobs.get(data.session);clearTimeout(job.releaseTimer);
        if(data.saved)job.releaseTimer=setTimeout(()=>release(data.session),2000);else release(data.session);
      }
    });
    window.addEventListener('pagehide',()=>{for(const session of [...jobs.keys()])try{release(session);}catch{}});
  }
  return {
    source({origin,session,profile,onSaved}){
      if(!supported||location.origin!==sourceOrigin||!allowed.has(origin)||!sessionPattern.test(session||''))return null;
      try{
        const request=GM_getValue(key(session,'request'));
        if(!request||request.managerOrigin!==origin||request.sourceOrigin!==sourceOrigin||!profilePattern.test(request.profile||'')||request.profile.toLowerCase()!==profile.toLowerCase()||!Number.isFinite(request.expiresAt)||request.expiresAt<=Date.now()||request.expiresAt>Date.now()+lifetime)return null;
        let listener,timer;
        const dispose=()=>{clearTimeout(timer);if(listener!==undefined){GM_removeValueChangeListener(listener);listener=undefined;}};
        listener=GM_addValueChangeListener(key(session,'ack'),(_name,_old,ack)=>{
          if(ack?.saved&&ack.session===session){dispose();onSaved();}
        });
        timer=setTimeout(()=>{dispose();erase(session);},Math.max(0,request.expiresAt-Date.now()));
        window.addEventListener('pagehide',dispose,{once:true});
        return {send(type,payload){
          if(!messageTypes.has(type))return;
          const active=GM_getValue(key(session,'request'));
          if(!active||active.managerOrigin!==origin||active.profile!==request.profile||active.expiresAt<=Date.now())return;
          GM_setValue(key(session,'message'),{...payload,type,session,sourceOrigin,nonce:crypto.randomUUID()});
        }};
      }catch{return null;}
    }
  };
})();

(() => {
  'use strict';
  if(!['library.playstation.com','store.playstation.com'].includes(location.hostname))return;
  const pageWindow=typeof unsafeWindow==='undefined'?window:unsafeWindow;
  const LIBRARY = 'https://library.playstation.com/recently-purchased';
  const ENDPOINT = 'https://web.np.playstation.com/api/graphql/v1/op';
  const OPERATION = 'getPurchasedGameList';
  // Add a deployed manager origin here only after you explicitly trust it.
  const MANAGER_ORIGINS = new Set(['http://127.0.0.1:4175', 'http://localhost:4175', 'https://chiarubi-728.github.io']);
  // Only library data crosses the bridge; bearer tokens stay in this tab.
  let bridge = null, bridgeStarted = false;
  try {
    const params = new URLSearchParams(location.hash.slice(1));
    const origin = params.get('psgbOrigin'), session = params.get('psgbSession');
    if (origin && session && /^[a-f0-9-]{36}$/i.test(session) && window.opener && location.hostname === 'library.playstation.com') {
      const target = new URL(origin);
      const profile=params.get('psgbProfile');
      if(target.origin===origin&&MANAGER_ORIGINS.has(origin)&&/^[A-Za-z0-9_-]{1,32}$/.test(profile||''))bridge={origin,session,profile};
    }
  } catch {}
  function sendBridge(type, payload) {
    if (!bridge) return;
    try { window.opener?.postMessage({type, session:bridge.session, ...payload}, bridge.origin); } catch {}
  }
  const networkFetch = pageWindow.fetch.bind(pageWindow);
  const diagnostics = { fetch: 0, xhr: 0, graphql: 0, purchased: 0, noBearer: 0, noHash: 0, parseError: 0 };
  const operations = new Set();
  let parseStage = '', lastParseError = '';
  let authorization = '', queryHash = '', generation = 0, pending = null;
  let games = [], complete = false, syncedAt = '', busy = false, message = '等待官方遊戲庫請求。請登入並切換到「已購買」，再開啟面板。';
  let host,root,sourceProfile=bridge?.profile||'',accountConfirmedAt='',dataAccount=null;

  function parsePayload(body, url) {
    const query = Object.fromEntries(url.searchParams);
    if (body === undefined || body === null || body === '') return query;
    const text = String(body).trim();
    if (text.startsWith('{') || text.startsWith('[')) return JSON.parse(text);
    const form = Object.fromEntries(new URLSearchParams(text));
    if (typeof form.operationName === 'string' || typeof form.extensions === 'string') return { ...query, ...form };
    throw new Error('unrecognized-body');
  }

  function inspect(rawUrl, headers, body) {
    try {
      const url = new URL(String(rawUrl), location.href);
      if (url.origin !== 'https://web.np.playstation.com' || url.pathname !== '/api/graphql/v1/op') return;
      diagnostics.graphql++;
      parseStage = '請求本文（JSON／表單）';
      const payload = parsePayload(body, url);
      if (Array.isArray(payload)) {
        for (const operation of payload) inspect(rawUrl, headers, JSON.stringify(operation));
        return;
      }
      if (typeof payload?.operationName === 'string' && /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(payload.operationName) && operations.size < 6) operations.add(payload.operationName);
      if (payload?.operationName !== OPERATION) return;
      diagnostics.purchased++;
      parseStage = 'extensions JSON';
      const extensions = typeof payload.extensions === 'string' ? JSON.parse(payload.extensions) : payload.extensions;
      const hash = extensions?.persistedQuery?.sha256Hash;
      parseStage = '請求標頭';
      const header = new pageWindow.Headers(headers).get('authorization');
      const token = /^Bearer\s+\S+$/i.test(header || '') ? header : '';
      if (!token) diagnostics.noBearer++;
      if (!/^[a-f0-9]{64}$/i.test(hash || '')) { diagnostics.noHash++; return; }
      if (queryHash && authorization !== token) {
        generation++;
        pending?.abort();
        games=[];complete=false;syncedAt='';accountConfirmedAt='';dataAccount=null;
      }
      authorization = token; queryHash = hash;
      if (bridge && !bridgeStarted && accountConfirmedAt) {
        bridgeStarted = true;
        sendBridge('PSGB_STATUS', {message:'已取得官方查詢，正在同步遊戲庫…'});
        queueMicrotask(sync);
      }
      if(bridge&&!accountConfirmedAt){message='已取得官方查詢。請在面板確認 Sony 登入帳號為 '+bridge.profile+'，再讀取數位遊戲庫。';sendBridge('PSGB_STATUS',{message});}
      else if (!busy) message = token
        ? '已取得官方查詢碼與 Bearer，可以同步。登入憑證僅保留於本分頁。'
        : '已取得官方查詢碼，該請求未帶 Bearer。可以使用目前網頁登入工作階段嘗試同步。';
      render();
    } catch { diagnostics.parseError++; lastParseError = parseStage; }
    finally { render(); }
  }

  // Read only the headers of the official purchased-library request.
  // Credentials never enter DOM, console, persistent storage or exports.
  if (location.hostname === 'library.playstation.com') {
    const page = pageWindow;
    const originalFetch = page.fetch;
    page.fetch = function (input, init) {
      diagnostics.fetch++;
      try {
        const url = typeof input === 'string' || input instanceof pageWindow.URL ? input : input.url;
        const headers = init?.headers ?? input?.headers;
        // Clone before forwarding; reading the clone must not consume the real request.
        const hasBody = init?.body !== undefined || (input?.body && input?.clone);
        if (hasBody && typeof init?.body !== 'string' && typeof Request !== 'undefined') {
          const copy = new pageWindow.Request(typeof input?.clone === 'function' ? input.clone() : input, init);
          copy.text().then(body => inspect(url, headers, body)).catch(() => { diagnostics.parseError++; lastParseError = 'Request 本文複本'; render(); });
        } else inspect(url, headers, typeof init?.body === 'string' ? init.body : undefined);
      } catch { diagnostics.parseError++; lastParseError = 'fetch 請求複本'; }
      render();
      return Reflect.apply(originalFetch, this, arguments);
    };
    const proto = page.XMLHttpRequest.prototype;
    const originalOpen = proto.open, originalHeader = proto.setRequestHeader, originalSend = proto.send;
    const requests = new WeakMap();
    proto.open = function (_method, url) {
      requests.set(this, { url, headers: {} });
      return Reflect.apply(originalOpen, this, arguments);
    };
    proto.setRequestHeader = function (name, value) {
      const req = requests.get(this);
      if (req) {
        const key = String(name).toLowerCase();
        req.headers[key] = req.headers[key] ? `${req.headers[key]}, ${value}` : String(value);
      }
      return Reflect.apply(originalHeader, this, arguments);
    };
    proto.send = function (body) {
      diagnostics.xhr++;
      const req = requests.get(this);
      if (req) inspect(req.url, req.headers, typeof body === 'string' || body instanceof URLSearchParams ? String(body) : undefined);
      return Reflect.apply(originalSend, this, arguments);
    };
  }

  async function request(url, token) {
    const controller = new AbortController(); pending = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 25000);
    try {
      const r = await networkFetch(url, {
        method: 'GET', credentials: 'include', signal: controller.signal,
        headers: { ...(token ? {Authorization: token} : {}), 'Content-Type': 'application/json', 'Accept-Language': 'zh-Hant-TW' },
      });
      if (r.status === 401 || r.status === 403) throw new Error(`授權失效或無權存取（HTTP ${r.status}）。請重新登入／重新整理官方遊戲庫。`);
      if (r.status !== 200) throw new Error(`查詢失敗（HTTP ${r.status}）。請稍後手動重試。`);
      const data = await r.json();
      if (data.errors?.length) throw new Error('官方 GraphQL 回報錯誤；查詢可能已變更或授權失效。');
      let result; resolvePage(data, value => { result = value; }); return result;
    } catch (e) {
      if (controller.signal.aborted) throw new Error(timedOut ? '查詢逾時，請手動重試。' : '已停止同步。');
      if (e instanceof TypeError) throw new Error('網頁原生查詢連線失敗，可能為網路或 CORS 限制。請回報此提示。');
      throw e;
    } finally { clearTimeout(timer); if (pending === controller) pending = null; }
  }

  function resolvePage(data, resolve) {
    const page = data?.data?.purchasedTitlesRetrieve;
    if (!page || !Array.isArray(page.games)) throw new Error('無法辨識官方遊戲庫格式，沒有當成空遊戲庫。');
    for (const g of page.games) {
      if (!g || typeof g.name !== 'string' || typeof g.entitlementId !== 'string' || !g.entitlementId) throw new Error('遊戲授權資料格式已變更。');
    }
    resolve(page);
  }

  function nextOffset(page, offset, size) {
    const p = page.pageInfo;
    if (p) {
      if (typeof p.isLast !== 'boolean' || p.offset !== offset || !Number.isSafeInteger(p.size) || p.size < 0 || !Number.isSafeInteger(p.totalCount) || p.totalCount < 0) throw new Error('官方分頁資訊不正確。');
      if (p.isLast) return null;
      const next = p.offset + p.size;
      if (!page.games.length || next <= offset || next >= p.totalCount) throw new Error('官方分頁未前進，已停止。');
      return next;
    }
    return page.games.length < size ? null : offset + page.games.length;
  }

  async function sync() {
    if (busy) return;
    if(!accountConfirmedAt||!/^[A-Za-z0-9_-]{1,32}$/.test(sourceProfile)){message='請先確認目前登入 Sony 的 PSN 帳號。';render();return;}
    if(bridge&&sourceProfile.toLowerCase()!==bridge.profile.toLowerCase()){message='來源帳號與遊戲庫預期帳號不同，未開始讀取。';render();return;}
    if (!queryHash) { message = '尚未取得官方查詢碼。請在官方遊戲庫登入，切到其他分類再切回「已購買」。仍無反應時重新整理該頁。'; render(); return; }
    busy = true; complete = false; syncedAt = ''; games = [];
    const run=++generation,token=authorization,hash=queryHash;
    dataAccount={profile:sourceProfile,method:'user',confirmedAt:accountConfirmedAt};
    const seen = new Map(); let offset = 0;
    try {
      for (let count = 0; count < 1000; count++) {
        if (run !== generation) throw new Error('已停止同步。');
        message = `同步中：已讀取 ${games.length} 筆授權，起點 ${offset}…`; render();
        const url = new URL(ENDPOINT);
        url.searchParams.set('operationName', OPERATION);
        url.searchParams.set('variables', JSON.stringify({ isActive: true, platform: ['ps4', 'ps5'], size: 100, start: offset, sortBy: 'ACTIVE_DATE', sortDirection: 'desc' }));
        url.searchParams.set('extensions', JSON.stringify({ persistedQuery: { version: 1, sha256Hash: hash } }));
        const page = await request(url.href, token);
        if (run !== generation) throw new Error('登入授權已變更或同步已停止，請重新同步。');
        const next = nextOffset(page, offset, 100);
        let added = 0;
        for (const game of page.games) {
          if (!seen.has(game.entitlementId)) added++;
          seen.set(game.entitlementId, normalize(game));
        }
        games = [...seen.values()];
        if (next === null) {
          complete = true; syncedAt = new Date().toISOString();
          message = `同步完成：${games.length} 筆有效數位授權（不是付款紀錄）。`; break;
        }
        if (!added) throw new Error('官方重複回傳同一批授權，已停止，結果尚未完整。');
        offset = next;
        if (count === 999) throw new Error('已達分頁上限，結果尚未完整。');
        await new Promise(resolve => setTimeout(resolve, 350));
      }
    } catch (e) { message = `${e.message} 目前 ${games.length} 筆為部分結果。`; }
    finally {
      busy = false; render();
      if (complete) sendBridge('PSGB_RESULT', {payload:{schemaVersion:1, scope:'active-ps4-ps5-digital-entitlements', complete, syncedAt, games,account:dataAccount}});
      else {sendBridge('PSGB_STATUS', {message:'官方同步未完整完成，請查看官方分頁提示。'});sendBridge('PSGB_ERROR',{message:'官方同步未完整完成，請查看來源分頁後重試。'});}
    }
  }

  function normalize(g) {
    const out = {};
    for (const key of ['name', 'platform', 'productId', 'titleId', 'entitlementId', 'conceptId', 'membership']) {
      if (typeof g[key] === 'string') out[key] = g[key];
    }
    for (const key of ['isActive', 'isDownloadable', 'isPreOrder']) if (typeof g[key] === 'boolean') out[key] = g[key];
    if (typeof g.image?.url === 'string' && /^https:\/\//i.test(g.image.url)) out.imageUrl = g.image.url;
    return out;
  }
  function csvCell(value) {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  }
  function exportData(format) {
    if (!games.length || busy) return;
    const fields = ['name', 'platform', 'membership', 'productId', 'titleId', 'entitlementId', 'isActive', 'isDownloadable', 'isPreOrder'];
    const body = format === 'json'
      ? JSON.stringify({ schemaVersion: 1, scope: 'active-ps4-ps5-digital-entitlements', complete, syncedAt: syncedAt || null, exportedAt: new Date().toISOString(), games,account:dataAccount }, null, 2)
      : '\uFEFF' + [['complete', 'syncedAt', ...fields], ...games.map(g => [complete, syncedAt, ...fields.map(k => g[k])])].map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([body], { type: format === 'json' ? 'application/json' : 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `ps-game-base-${complete ? 'complete' : 'partial'}-${new Date().toISOString().slice(0, 10)}.${format}`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function el(tag, text, parent) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; parent?.append(node); return node; }
  function render() {
    if (!root) return;
    root.querySelector('#status').textContent = message;
    root.querySelector('#diagnostics').textContent = `v0.3.3 · fetch ${diagnostics.fetch} / XHR ${diagnostics.xhr} / GraphQL ${diagnostics.graphql} / 已購買 ${diagnostics.purchased} / 無 Bearer ${diagnostics.noBearer} / 缺查詢碼 ${diagnostics.noHash} / 格式錯誤 ${diagnostics.parseError} · 操作：${[...operations].join(', ') || '尚未辨識'}${lastParseError ? ` · 最近解析失敗：${lastParseError}` : ''}`;
    root.querySelector('#sync').disabled=busy||!queryHash||!accountConfirmedAt;
    root.querySelector('#source-profile').disabled=busy;root.querySelector('#account-confirm').disabled=busy;root.querySelector('#account-confirm').checked=!!accountConfirmedAt;
    root.querySelector('#stop').disabled = !busy;
    for (const button of root.querySelectorAll('[data-export]')) button.disabled = busy || !games.length;
    const search = root.querySelector('#search').value.trim().toLocaleLowerCase();
    const platform = root.querySelector('#platform').value, membership = root.querySelector('#membership').value;
    const filtered = games.filter(g => (!search || g.name.toLocaleLowerCase().includes(search)) && (!platform || g.platform?.toUpperCase() === platform) && (!membership || g.membership === membership)).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
    root.querySelector('#count').textContent = `顯示 ${filtered.length} / ${games.length} 筆授權${complete ? '（完整）' : '（尚未完整）'}；匯出包含全部已讀取授權。`;
    const list = root.querySelector('#list'); list.replaceChildren();
    // Render a bounded list; search/filter still apply to every fetched entitlement.
    for (const g of filtered.slice(0, 200)) {
      const row = el('article', undefined, list);
      if (g.imageUrl) { const img = el('img', undefined, row); img.src = g.imageUrl; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; }
      const details = el('div', undefined, row);
      el('strong', g.name, details);
      el('p', `${g.platform || '平台未提供'} · ${g.membership === 'PS_PLUS' ? 'PS Plus 授權' : g.membership === 'NONE' ? '非 PS Plus（可能包含免費）' : '來源未分類'}${g.isPreOrder ? ' · 預購' : ''}`, details);
      el('small', g.productId || g.titleId || '商品 ID 未提供', details);
      if (/^[A-Z0-9_-]+$/i.test(g.productId || '')) {
        const a = el('a', '查看商店', details); a.href = `https://store.playstation.com/zh-hant-tw/product/${encodeURIComponent(g.productId)}`; a.target = '_blank'; a.rel = 'noopener noreferrer';
      }
    }
    if (filtered.length > 200) el('p', '目前呈現前 200 筆，請搜尋或篩選；匯出不受此上限影響。', list);
  }
  function mount() {
    host = document.createElement('div'); host.id = 'ps-game-base'; document.documentElement.append(host);
    root = host.attachShadow({ mode: 'closed' });
    const style = el('style', undefined, root);
    style.textContent = ':host{all:initial;color-scheme:dark;font:14px/1.6 system-ui;color:#eef3ff}button,input,select{font:inherit;padding:7px 10px;border:1px solid #586680;border-radius:7px;color:#eef3ff;background:#24324c}button{cursor:pointer}button:disabled{opacity:.45;cursor:default}#launch{position:fixed;right:20px;bottom:20px;z-index:2147483646;background:#164ca5}#panel{position:fixed;right:16px;bottom:72px;z-index:2147483647;width:min(760px,calc(100vw - 32px));max-height:80vh;overflow:auto;background:#121e33;border:1px solid #60789d;border-radius:14px;padding:18px;box-sizing:border-box;box-shadow:0 10px 60px #0008}#panel[hidden]{display:none}h2{margin:0 0 8px}.controls{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}#status{white-space:pre-wrap;color:#bcd3ff}article{display:flex;gap:12px;border-top:1px solid #34425b;padding:12px 0}article img{width:62px;height:62px;object-fit:cover}p{margin:4px 0}small{display:block;overflow-wrap:anywhere;color:#aab9d2}a{color:#8fc5ff}input{min-width:150px;flex:1}';
    const launch = el('button', 'PSN Game Catalog', root); launch.id = 'launch';
    const panel = el('section', undefined, root); panel.id = 'panel'; panel.hidden = !bridge; panel.setAttribute('aria-label', 'PSN Game Catalog');
    launch.onclick = () => { panel.hidden = !panel.hidden; render(); };
    el('h2', 'PSN Game Catalog · 遊戲庫 v0.3.3', panel);
    if (bridge) el('p', `由 ${bridge.origin} 開啟：完整同步後，遊戲資料將自動回傳該管理頁供確認。登入憑證不會回傳。`, panel);
    el('p', '僅查詢有效的 PS4／PS5 數位授權，包含免費與 PS Plus。未包含付款紀錄、實體收藏及遊玩時數。權杖與資料僅暫存本分頁，重新整理即清除。', panel);
    const library = el('a', '開啟官方遊戲庫（登入後選「已購買」）', panel); library.href = LIBRARY; library.target = '_blank'; library.rel = 'noopener noreferrer';
    const status = el('p', message, panel); status.id = 'status'; status.setAttribute('role', 'status');
    el('small', undefined, panel).id = 'diagnostics';
    const accountLabel=el('label','Sony 目前登入的 PSN Online ID',panel);
    const profileInput=el('input',undefined,accountLabel);profileInput.id='source-profile';profileInput.value=sourceProfile;profileInput.maxLength=32;profileInput.placeholder='輸入目前登入的 PSN Online ID';profileInput.readOnly=!!bridge;
    const confirmLabel=el('label',undefined,panel);confirmLabel.style.display='flex';confirmLabel.style.gap='8px';confirmLabel.style.alignItems='center';
    const accountCheck=el('input',undefined,confirmLabel);accountCheck.id='account-confirm';accountCheck.type='checkbox';accountCheck.style.minWidth='0';accountCheck.style.flex='none';
    el('span','我已核對 PlayStation 右上角的登入帳號，確認與上方 PSN Online ID 相同。',confirmLabel);
    el('p','帳號確認由你完成，腳本無法自動驗證 Sony 登入者。確認後才會讀取並回傳這個帳號的數位授權。',panel);
    profileInput.oninput=()=>{sourceProfile=profileInput.value.trim();accountConfirmedAt='';accountCheck.checked=false;render();};
    accountCheck.onchange=()=>{
      if(accountCheck.checked&&!/^[A-Za-z0-9_-]{1,32}$/.test(sourceProfile)){accountCheck.checked=false;message='請先填寫正確的 PSN Online ID。';render();return;}
      accountConfirmedAt=accountCheck.checked?new Date().toISOString():'';render();
      if(bridge&&accountConfirmedAt&&queryHash&&!busy){bridgeStarted=true;void sync();}
    };
    const controls = el('div', undefined, panel); controls.className = 'controls';
    const syncButton = el('button', '同步遊戲庫', controls); syncButton.id = 'sync'; syncButton.onclick = sync;
    const stop = el('button', '停止', controls); stop.id = 'stop'; stop.onclick = () => { generation++; pending?.abort(); };
    for (const format of ['json', 'csv']) { const b = el('button', `匯出 ${format.toUpperCase()}`, controls); b.dataset.export = format; b.onclick = () => exportData(format); }
    const clear = el('button', '清除本分頁資料', controls); clear.onclick = () => { generation++; pending?.abort(); authorization='';queryHash='';games=[];complete=false;syncedAt='';accountConfirmedAt='';dataAccount=null; message = '已清除。請切換官方分類再回「已購買」以重新取得授權。'; render(); };
    const filters = el('div', undefined, panel); filters.className = 'controls';
    const search = el('input', undefined, filters); search.id = 'search'; search.placeholder = '搜尋遊戲名稱'; search.setAttribute('aria-label', '搜尋遊戲名稱'); search.oninput = render;
    for (const [id, options] of [['platform', [['', '全部平台'], ['PS4', 'PS4'], ['PS5', 'PS5']]], ['membership', [['', '全部來源'], ['PS_PLUS', 'PS Plus'], ['NONE', '非 PS Plus']]]]) {
      const select = el('select', undefined, filters); select.id = id; select.setAttribute('aria-label', id === 'platform' ? '平台' : '授權來源');
      for (const [value, label] of options) { const option = el('option', label, select); option.value = value; }
      select.onchange = render;
    }
    el('p', undefined, panel).id = 'count'; el('div', undefined, panel).id = 'list';
    render();
    document.addEventListener('keydown', event => { if (event.key === 'Escape') panel.hidden = true; });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
})();

// Integrated full played history; initialize after the profile DOM is ready.
if(location.hostname==='psnprofiles.com'){const initialize=()=>{
  'use strict';
  const allowed = new Set(['http://127.0.0.1:4175','http://localhost:4175','https://chiarubi-728.github.io']);
  const profile = /^\/([A-Za-z0-9_-]{1,32})\/?$/.exec(location.pathname)?.[1];
  if (!profile || !document.querySelector('#gamesTable') || document.getElementById('psgb-platinum-collector')) return;
  const params = new URLSearchParams(location.hash.slice(1));
  const origin = params.get('psgbOrigin'), session = params.get('psgbSession');
  let busy = false, snapshot = null, acknowledged=false, diagnostic=null;
  const saved=()=>{acknowledged=true;status.textContent='Game Base 已確認保存完整遊玩紀錄，可以回到遊戲庫查看。';};
  const relay=psgbHistoryRelay.source({origin,session,profile,onSaved:saved});
  const bridge = !!(allowed.has(origin) && /^[a-f0-9-]{36}$/i.test(session || '') && (relay||window.opener));
  const host = document.createElement('div'); host.id = 'psgb-platinum-collector'; document.body.append(host);
  const root = host.attachShadow({mode:'closed'});
  const style = document.createElement('style');
  style.textContent = ':host{all:initial;color-scheme:dark;font:14px/1.7 system-ui}section{position:fixed;right:16px;bottom:16px;z-index:2147483647;width:min(390px,calc(100vw - 32px));box-sizing:border-box;padding:18px;border:1px solid #75bdf6;border-radius:12px;color:#eef3ff;background:#121e33;box-shadow:0 8px 35px #0008}h2{font-size:16px;margin:0}p{font-size:12px;overflow-wrap:anywhere}button{font:inherit;padding:7px 12px;margin-right:8px;color:#eef3ff;background:#243e62;border:1px solid #60789d;border-radius:6px;cursor:pointer}button:disabled{opacity:.5}';
  root.append(style);
  const panel = document.createElement('section');root.append(panel);
  function el(tag,text) { const n=document.createElement(tag);n.textContent=text;panel.append(n);return n; }
  el('h2','PSN Game Catalog · 完整遊玩紀錄 v0.3.3');
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
  function send(type,payload) { if(!bridge)return;if(relay)relay.send(type,payload);else window.opener?.postMessage({type,session,...payload},origin); }
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
    saved();
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
        diagnostic={kind:'ps-game-base-psnprofiles-diagnostic',schemaVersion:1,scriptVersion:'0.3.3',profile,createdAt:new Date().toISOString(),stage,expectedTotal,pageCount,totalRows:rows.length,parsedRows:games.length,failedRows:failed.length,samples:failed.slice(0,8)};
        diagnosticButton.disabled=false;const first=failed[0];throw Error(`已辨識 ${games.length} / ${rows.length} 筆；第 ${first.row} 筆「${first.name||'名稱空白'}」：${first.reasons.join('、')}。請按「匯出讀取診斷」提供檔案；目前未匯入不完整清單。`);
      }
      if(new Set(games.map(g=>g.psnprofilesId)).size!==games.length)throw Error('清單有重複紀錄，請重新整理後再試。');
      snapshot={kind:'ps-game-base-psnprofiles-history',schemaVersion:1,complete:true,profile,exportedAt:new Date().toISOString(),games};
      report(`已讀取全部 ${games.length} 筆遊戲：${games.filter(game=>game.platinum).length} 筆白金、${games.filter(game=>!game.platinum).length} 筆尚未白金。${bridge?'等待 Game Base 確認保存。':'可匯出完整遊玩紀錄。'}`);
      send('PSGB_HISTORY_RESULT',{payload:snapshot});download.disabled=false;
      if(bridge)setTimeout(()=>{if(!acknowledged)status.textContent=`已讀取 ${games.length} 筆遊戲，但尚未收到 Game Base 保存確認。可按「匯出遊玩紀錄 JSON」，回遊戲庫匯入。`;},5000);
    } catch(e) {
      if(!diagnostic){const control=moreControl();diagnostic={kind:'ps-game-base-psnprofiles-diagnostic',schemaVersion:1,scriptVersion:'0.3.3',profile,createdAt:new Date().toISOString(),stage,expectedTotal,pageCount,totalRows:gameRows().length,remaining:remainingGames(control),controlText:controlText(control),samples:[],error:String(e.message).slice(0,600)};}
      diagnosticButton.disabled=false;report(e.message);send('PSGB_HISTORY_ERROR',{message:String(e.message).slice(0,500)});
    } finally {busy=false;collect.disabled=false;}
  }
  collect.onclick=run;
  download.onclick=()=>{
    if(!snapshot)return;
    saveJson(snapshot,`ps-game-base-history-${profile}.json`);
  };
  if(bridge)run();

};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();}
(() => {
  'use strict';
  const manager=location.origin==='https://chiarubi-728.github.io'&&location.pathname.startsWith('/PSN_Game_Catalog/');
  if(!manager)return;
  const jobs=new Map(),productPattern=/^[A-Z]{2}\d{4}-[A-Z0-9]{9}_\d{2}-[A-Z0-9_]{1,32}$/;
  const error=code=>Object.assign(Error(code),{code});
  const validUrl=value=>{const url=new URL(value);if(url.origin!=='https://store.playstation.com'||!/^\/(en-tw|en-hk|en-us|en-gb|ja-jp)\/(product|concept)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)||url.search||url.hash||url.username||url.password)throw error('STORE_UNAVAILABLE');return url;};
  function request(url,job){return new Promise((resolve,reject)=>{
    validUrl(url);if(job.stopped)return reject(error('STOPPED'));
    let ended=false,handle;
    function finish(err,value){if(ended)return;ended=true;clearTimeout(timer);job.aborters.delete(abort);err?reject(err):resolve(value);}
    function abort(){finish(error('STOPPED'));handle?.abort();}
    const timer=setTimeout(()=>{finish(error('STORE_UNAVAILABLE'));handle?.abort();},15000);job.aborters.add(abort);
    try{handle=GM_xmlhttpRequest({method:'GET',url,anonymous:true,redirect:'manual',headers:{Accept:'text/html'},onload:response=>finish(null,response),onerror:()=>finish(error('STORE_UNAVAILABLE')),ontimeout:()=>finish(error('STORE_UNAVAILABLE')),onabort:()=>finish(error('STOPPED'))});}catch{finish(error('STORE_UNAVAILABLE'));}
  });}
  async function publicHtml(url,job){
    let current=url;
    for(let redirect=0;redirect<3;redirect++){
      validUrl(current);const response=await request(current,job);
      if(response.finalUrl)validUrl(response.finalUrl);
      if([301,302,303,307,308].includes(response.status)){const location=/^location:\s*(.+)$/im.exec(response.responseHeaders||'')?.[1]?.trim();if(!location)throw error('STORE_UNAVAILABLE');current=new URL(location,current).href;continue;}
      if(response.status===429){job.rateLimited=true;throw error('RATE_LIMITED');}
      if(response.status===404)throw error('NOT_FOUND');
      if(response.status!==200)throw error('STORE_UNAVAILABLE');
      if(typeof response.responseText!=='string'||response.responseText.length>6000000)throw error('STORE_RESPONSE_TOO_LARGE');
      return {html:response.responseText,url:response.finalUrl||current};
    }
    throw error('STORE_UNAVAILABLE');
  }
  // The public product parser is embedded here by the release preparation script.
  function parseCatalog(html,item,mode){
  const cache={},products=[];
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    if(!/\btype\s*=\s*["']application\/json["']/i.test(match[1]))continue;
    let data;try{data=JSON.parse(match[2]);}catch{continue;}
    const scope=mode==='product'?data.args?.productId===item.productId:String(data.args?.conceptId||'')===item.conceptId;
    if(!scope)continue;
    for(const [key,node] of Object.entries(data.cache||{}))if(node&&typeof node==='object')cache[key]={...cache[key],...node};
  }
  const product=Object.values(cache).find(node=>node.__typename==='Product'&&node.id===item.productId);
  if(mode==='product'&&!product)throw error('STORE_FORMAT_CHANGED');
  const conceptId=mode==='product'?/^Concept:(\d+)$/.exec(product.concept?.__ref||'')?.[1]:item.conceptId;
  const concept=conceptId?Object.values(cache).find(node=>node.__typename==='Concept'&&String(node.id)===conceptId):null;
  if(mode==='concept'&&(!concept||!concept.name))throw error('STORE_FORMAT_CHANGED');
  if(product)products.push(product);
  const special=product&&/friend.?s\s*pass|\btrial\b|\bdemo\b|\bupgrade\b|\bcollection\b|\bbundle\b|通行證|試玩|升級|合輯|合集|同捆/i.test([product.invariantName,product.name].filter(Boolean).join(' '));
  const names=[];
  if(product?.name)names.push({name:product.name,type:'product'});
  if(product?.invariantName)names.push({name:product.invariantName,type:'invariant'});
  if(concept?.name&&!special)names.push({name:concept.name,type:'concept'});
  if(!names.length)throw error('STORE_FORMAT_CHANGED');
  const platforms=[...new Set(products.flatMap(node=>node.platforms||[]))].filter(value=>['PS3','PS4','PS5','PSVITA','PC'].includes(value));
  return {productId:item.productId,...(conceptId?{conceptId}:{}),names,platforms};
}

  async function resolve(item,job){
    const locale=({UP:'en-us',EP:'en-gb',HP:'en-hk',JP:'ja-jp'})[item.productId.slice(0,2)]||'en-tw';
    let firstError;
    try{const page=await publicHtml('https://store.playstation.com/'+locale+'/product/'+item.productId,job);return {...parseCatalog(page.html,item,'product'),locale:new URL(page.url).pathname.split('/')[1],sourceUrls:[page.url],updatedAt:new Date().toISOString()};}catch(err){firstError=err;if(job.stopped||job.rateLimited)throw err;}
    if(item.conceptId){const page=await publicHtml('https://store.playstation.com/en-tw/concept/'+item.conceptId,job);return {...parseCatalog(page.html,item,'concept'),locale:new URL(page.url).pathname.split('/')[1],sourceUrls:[page.url],updatedAt:new Date().toISOString()};}
    throw firstError;
  }
  const reply=(requestId,payload,error)=>window.postMessage({type:'PSGB_CATALOG_REPLY',requestId,payload,error},location.origin);
  window.addEventListener('message',async event=>{
    if(event.origin!==location.origin||(event.source!==window&&event.source!==(typeof unsafeWindow==='undefined'?window:unsafeWindow)))return;
    const data=event.data;if(!data||!/^[a-f0-9-]{36}$/i.test(data.requestId||''))return;
    if(data.type==='PSGB_CATALOG_PING'){reply(data.requestId,{version:'0.3.3',onlineNames:true});return;}
    if(data.type==='PSGB_CATALOG_CANCEL'){const job=jobs.get(data.requestId);if(job){job.stopped=true;for(const abort of [...job.aborters])abort();}return;}
    if(data.type!=='PSGB_CATALOG_NAMES')return;
    if(jobs.size||!Array.isArray(data.products)||!data.products.length||data.products.length>4||data.products.some(item=>!item||!productPattern.test(item.productId||'')||item.conceptId!==undefined&&!/^\d{1,12}$/.test(item.conceptId))){reply(data.requestId,null,'INVALID_REQUEST');return;}
    const job={stopped:false,rateLimited:false,aborters:new Set()},records=[],failures=[];jobs.set(data.requestId,job);
    let offset=0;
    async function worker(){while(offset<data.products.length&&!job.stopped&&!job.rateLimited){const item=data.products[offset++];try{records.push(await resolve(item,job));}catch(err){if(job.stopped)return;failures.push({productId:item.productId,error:['NOT_FOUND','RATE_LIMITED','STORE_UNAVAILABLE','STORE_FORMAT_CHANGED','STORE_RESPONSE_TOO_LARGE'].includes(err.code)?err.code:'STORE_UNAVAILABLE'});}}}
    try{await Promise.all([worker(),worker()]);if(!job.stopped)reply(data.requestId,{schemaVersion:1,records,failures});}finally{jobs.delete(data.requestId);}
  });
})();
