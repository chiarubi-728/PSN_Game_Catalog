'use strict';
const http=require('node:http');
const crypto=require('node:crypto');
const core=(()=>{
'use strict';
const API_ORIGIN='https://m.np.playstation.com';
const AUTH_BASE='https://ca.account.sony.com/api/authz/v3/oauth';
const REDIRECT_URI='com.scee.psxandroid.scecompcall://redirect';
function sessionUrl(){return 'https://ca.account.sony.com/api/v1/ssocookie';}
function sessionCredential(data){
  if(!data||data.error||typeof data.npsso!=='string'||!/^[A-Za-z0-9._~-]{32,256}$/.test(data.npsso))throw Error('SONY_LOGIN_REQUIRED');
  return data.npsso;
}
function authorizationRequest(credential){
  if(!/^[A-Za-z0-9._~-]{32,256}$/.test(credential))throw Error('SONY_LOGIN_REQUIRED');
  return {method:'GET',url:authUrl(),anonymous:true,cookie:'npsso='+credential,redirect:'manual',headers:{Accept:'application/json'}};
}
function authUrl() {
  return AUTH_BASE+'/authorize?'+new URLSearchParams({access_type:'offline',client_id:'09515159-7237-4370-9b40-3806e67c0891',redirect_uri:REDIRECT_URI,response_type:'code',scope:'psn:mobile.v2.core psn:clientapp'});
}
function authCode(headers,status) {
  if(status!==302&&status!==303)throw Error('SONY_LOGIN_REQUIRED');
  const locations=String(headers||'').split(/\r?\n/).filter(line=>/^location\s*:/i.test(line));
  if(locations.length!==1)throw Error('AUTH_REDIRECT_UNAVAILABLE');
  let target;
  try {target=new URL(locations[0].replace(/^location\s*:\s*/i,''));}catch {throw Error('AUTH_REDIRECT_UNAVAILABLE');}
  if(target.protocol!=='com.scee.psxandroid.scecompcall:'||target.hostname!=='redirect'||target.username||target.password||target.port||!['','/'].includes(target.pathname)||target.hash)throw Error('SONY_LOGIN_REQUIRED');
  if(target.searchParams.has('error'))throw Error('SONY_LOGIN_REQUIRED');
  const codes=target.searchParams.getAll('code');
  if(codes.length!==1||!/^v3\.[A-Za-z0-9._~-]{1,2000}$/.test(codes[0]))throw Error('AUTH_REDIRECT_UNAVAILABLE');
  return codes[0];
}
function tokenRequest(code) {
  if(!/^v3\.[A-Za-z0-9._~-]{1,2000}$/.test(code))throw Error('AUTH_REDIRECT_UNAVAILABLE');
  return {method:'POST',url:AUTH_BASE+'/token',anonymous:true,redirect:'error',headers:{'Content-Type':'application/x-www-form-urlencoded',Authorization:'Basic MDk1MTUxNTktNzIzNy00MzcwLTliNDAtMzgwNmU2N2MwODkxOnVjUGprYTV0bnRCMktxc1A='},data:new URLSearchParams({code,redirect_uri:REDIRECT_URI,grant_type:'authorization_code',token_format:'jwt'}).toString()};
}
function accessToken(data) {
  if(!data||data.error||typeof data.access_token!=='string'||!/^[A-Za-z0-9._~-]{10,16000}$/.test(data.access_token)||String(data.token_type).toLowerCase()!=='bearer')throw Error('INVALID_AUTH_RESPONSE');
  return 'Bearer '+data.access_token;
}
function transportInfo(response,event='error') {
  const raw=[response?.error,response?.message,response?.statusText].filter(value=>typeof value==='string').join(' ');
  const hints=[];
  if(/not permitted|not allowed|whitelist|permission|not granted/i.test(raw))hints.push('permission');
  if(/blocked.by.client|blocked by|ERR_BLOCKED/i.test(raw))hints.push('blocked');
  if(/certificate|ERR_CERT|SSL|TLS/i.test(raw))hints.push('tls');
  if(/ERR_NAME|DNS|name.not.resolved/i.test(raw))hints.push('dns');
  if(/redirect.*(beta|support|scheme)|unsupported.*(redirect|scheme)|unknown.*scheme/i.test(raw))hints.push('redirect-support');
  if(/failed to fetch|networkerror|ERR_FAILED/i.test(raw))hints.push('generic-network');
  let finalOrigin='unavailable';
  try {const u=new URL(response?.finalUrl);finalOrigin=['https://ca.account.sony.com','https://m.np.playstation.com'].includes(u.origin)?u.origin:u.protocol==='com.scee.psxandroid.scecompcall:'?'app-callback':'other';}catch{}
  return {event:['error','exception','timeout'].includes(event)?event:'error',statusSource:'extension-error-callback',...(Number.isInteger(response?.status)&&response.status>=0&&response.status<=599?{status:response.status}:{}),...(Number.isInteger(response?.readyState)&&response.readyState>=0&&response.readyState<=4?{readyState:response.readyState}:{}),finalOrigin,hasRedirectHeader:/^location\s*:/im.test(String(response?.responseHeaders||'')),hints};
}
function environment(info) {
  return {handler:['Tampermonkey','Violentmonkey','Greasemonkey','ScriptCat'].includes(info?.scriptHandler)?info.scriptHandler:'unknown',version:/^\d+(?:\.\d+){0,5}(?:[-a-z0-9.]*)?$/i.test(info?.version||'')?info.version:'unknown'};
}
function titleIds(value) {
  const ids=[...new Set(String(value).trim().toUpperCase().split(/[\s,;，]+/).filter(Boolean).map(id=>{
    if(!/^(CUSA|PPSA)\d{5}(?:_\d{2})?$/.test(id))throw Error('INVALID_TITLE_IDS');
    return id.includes('_')?id:id+'_00';
  }))];
  if(!ids.length || ids.length>5)throw Error('INVALID_TITLE_IDS');
  return ids;
}
function apiUrl(kind,ids=[]) {
  const url=new URL('/api/trophy/v1/users/me/'+(kind==='sample'?'trophyTitles':'titles/trophyTitles'),API_ORIGIN);
  if(kind==='sample')url.searchParams.set('limit','3');
  else if(kind==='mapping')url.searchParams.set('npTitleIds',titleIds(ids.join(',')).join(','));
  else throw Error('INVALID_ENDPOINT');
  return url.href;
}
function inspectRequest(rawUrl,headers,body) {
  const url=new URL(String(rawUrl),'https://library.playstation.com');
  if(url.origin!=='https://web.np.playstation.com'||url.pathname!=='/api/graphql/v1/op')return {matched:false};
  const query=Object.fromEntries(url.searchParams);
  let payload=query;
  if(body!==undefined&&body!==null&&body!=='') {
    const text=String(body).trim();
    if(text.startsWith('{')||text.startsWith('['))payload=JSON.parse(text);
    else payload={...query,...Object.fromEntries(new URLSearchParams(text))};
  }
  const matched=(Array.isArray(payload)?payload:[payload]).some(p=>p?.operationName==='getPurchasedGameList');
  if(!matched)return {matched:false};
  const header=new Headers(headers).get('authorization')||'';
  return {matched:true,token:/^Bearer\s+\S+$/i.test(header)?header:''};
}
function trophy(row) {
  if(!row||!/^NPWR\d{1,10}_\d{2}$/.test(row.npCommunicationId||'')||!['trophy','trophy2'].includes(row.npServiceName)||typeof row.trophyTitleName!=='string'||!row.trophyTitleName.trim())throw Error('INVALID_TROPHY_FORMAT');
  const earned=row.earnedTrophies?.platinum,defined=row.definedTrophies?.platinum;
  if(!Number.isSafeInteger(earned)||earned<0||!Number.isSafeInteger(defined)||defined<0||earned>defined)throw Error('INVALID_TROPHY_COUNTS');
  return {npCommunicationId:row.npCommunicationId,npServiceName:row.npServiceName,name:row.trophyTitleName.slice(0,300),earnedPlatinum:earned,definedPlatinum:defined,platinum:earned>0};
}
function sample(data) {
  if(!data||data.error||data.errors||!Array.isArray(data.trophyTitles))throw Error('INVALID_SAMPLE_FORMAT');
  return data.trophyTitles.slice(0,3).map(row=>({...trophy(row),platform:typeof row.trophyTitlePlatform==='string'?row.trophyTitlePlatform.slice(0,80):''}));
}
function mapping(data,requested) {
  if(!data||data.error||data.errors||!Array.isArray(data.titles))throw Error('INVALID_MAPPING_FORMAT');
  const valid=new Set(requested),seen=new Set();
  return data.titles.map(row=>{
    if(!row||!valid.has(row.npTitleId)||seen.has(row.npTitleId)||!Array.isArray(row.trophyTitles))throw Error('INVALID_MAPPING_FORMAT');
    seen.add(row.npTitleId);
    return {titleId:row.npTitleId,platform:row.npTitleId.startsWith('CUSA')?'PS4':'PS5',trophies:row.trophyTitles.map(trophy)};
  });
}
function httpError(status) {
  if(status===401||status===403)return 'AUTH_REJECTED';
  if(status===404)return 'TITLE_NOT_FOUND';
  if(status===429)return 'RATE_LIMITED';
  return 'HTTP_ERROR';
}
function safeUrl(url,kind,ids) {
  return url===apiUrl(kind,ids);
}
return {titleIds,apiUrl,inspectRequest,sample,mapping,httpError,safeUrl,authUrl,authCode,tokenRequest,accessToken,transportInfo,environment,sessionUrl,sessionCredential,authorizationRequest};

})();
const {createBulk}=(()=>{
'use strict';
function createBulk({core,fetchImpl,readJson}){
  const crypto=require('node:crypto');
  const {setTimeout:delay}=require('node:timers/promises');
  const jobs=new Map();let running=false;
  const safeErrors=new Set(['SONY_LOGIN_REQUIRED','AUTH_REDIRECT_UNAVAILABLE','INVALID_AUTH_RESPONSE','AUTH_REJECTED','RATE_LIMITED','HTTP_ERROR','TITLE_NOT_FOUND','INVALID_JSON','INVALID_SAMPLE_FORMAT','INVALID_MAPPING_FORMAT','INVALID_TROPHY_FORMAT','INVALID_TROPHY_COUNTS','NETWORK_ERROR','TIMEOUT','STOPPED','ACCOUNT_MISMATCH','INVALID_PAGINATION']);
  const fail=(code,status)=>Object.assign(Error(code),Number.isInteger(status)?{status}:{});
  function titleIds(values){
    if(!Array.isArray(values)||!values.length||values.length>5000||values.some(id=>typeof id!=='string'||!/^(CUSA|PPSA)\d{5}_\d{2}$/.test(id)))throw fail('INVALID_TITLE_IDS');
    return [...new Set(values)];
  }
  function profileName(value){if(typeof value!=='string'||!/^[A-Za-z0-9_-]{1,32}$/.test(value))throw fail('INVALID_PROFILE');return value;}
  async function execute(job,credential,ids,expectedProfile){
    const signal=job.controller.signal,headers={Accept:'application/json'};
    const snapshot={kind:'ps-game-base-sony-platinums',schemaVersion:1,complete:false,generatedAt:new Date().toISOString(),profile:{onlineId:null,verified:false},requestedTitleIds:ids,games:[],mappings:[],failures:[]};
    let token='',lastRequest=0,stage='authorize';
    const progress=(message,done=0)=>{job.progress={stage,message,done,total:ids.length};};
    async function sony(url,options={}){
      const u=new URL(url);
      const allowed=url===core.authUrl()||url===core.tokenRequest('v3.validation').url||u.origin==='https://m.np.playstation.com'&&(
        /^\/api\/userProfile\/v1\/internal\/users\/(?:me|\d{1,22})\/profiles$/.test(u.pathname)&&!u.search||
        u.pathname==='/api/trophy/v1/users/me/trophyTitles'&&[...u.searchParams.keys()].every(k=>['limit','offset'].includes(k))&&u.searchParams.get('limit')==='200'&&/^\d{1,5}$/.test(u.searchParams.get('offset')||'')||
        u.pathname==='/api/trophy/v1/users/me/titles/trophyTitles'&&[...u.searchParams.keys()].length===1&&u.searchParams.has('npTitleIds')&&core.apiUrl('mapping',(u.searchParams.get('npTitleIds')||'').split(','))===url
      );
      if(!allowed)throw fail('NETWORK_ERROR');
      const wait=450-(Date.now()-lastRequest);if(wait>0)await delay(wait,null,{signal});lastRequest=Date.now();
      let r;try{r=await fetchImpl(url,{...options,redirect:'manual',signal:AbortSignal.any([signal,AbortSignal.timeout(25000)])});}catch(e){throw fail(signal.aborted?'STOPPED':e.name==='TimeoutError'?'TIMEOUT':'NETWORK_ERROR');}
      if(r.status===429)throw fail('RATE_LIMITED',429);
      return r;
    }
    async function data(url){const r=await sony(url,{headers:{...headers,Authorization:token}});if(r.status!==200)throw fail(core.httpError(r.status),r.status);return readJson(r);}
    try{
      progress('向 Sony 取得授權碼');
      let auth;try{auth=await sony(core.authUrl(),{headers:{...headers,Cookie:'npsso='+credential}});}finally{credential='';}
      const code=core.authCode('Location: '+(auth.headers.get('location')||''),auth.status);await auth.body?.cancel();
      stage='token';progress('交換暫存授權');
      const options=core.tokenRequest(code);let exchanged;
      try{exchanged=await sony(options.url,{method:'POST',headers:options.headers,body:options.data});}finally{delete options.data;}
      if(exchanged.status!==200)throw fail(core.httpError(exchanged.status),exchanged.status);
      token=core.accessToken(await readJson(exchanged));
      stage='profile';progress('確認目前登入的 PSN 帳號');
      // Only the subject from Sony's own freshly returned token selects this fixed profile endpoint.
      let account='me';
      try{const claims=JSON.parse(Buffer.from(token.slice(7).split('.')[1],'base64url').toString('utf8'));if(typeof claims.sub==='string'&&/^\d{1,22}$/.test(claims.sub))account=claims.sub;}catch{}
      try{
        const profile=await data('https://m.np.playstation.com/api/userProfile/v1/internal/users/'+account+'/profiles');
        if(typeof profile.onlineId==='string'&&/^[A-Za-z0-9_-]{1,32}$/.test(profile.onlineId)&&profile.isMe!==false)snapshot.profile={onlineId:profile.onlineId,verified:true};
      }catch(e){if(signal.aborted||e.status===401||e.message==='RATE_LIMITED')throw e;}
      if(snapshot.profile.verified&&snapshot.profile.onlineId.toLowerCase()!==expectedProfile.toLowerCase())throw fail('ACCOUNT_MISMATCH');
      stage='titles';progress('讀取已取得白金的獎盃清單');
      const seen=new Set();let offset=0,total=null,titlesComplete=false;
      try{
        for(let page=0;page<50;page++){
          const raw=await data('https://m.np.playstation.com/api/trophy/v1/users/me/trophyTitles?limit=200&offset='+offset);
          if(!raw||raw.error||!Array.isArray(raw.trophyTitles)||raw.trophyTitles.length>200||!Number.isSafeInteger(raw.totalItemCount)||raw.totalItemCount<0||raw.totalItemCount>10000)throw fail('INVALID_PAGINATION');
          if(total===null)total=raw.totalItemCount;else if(total!==raw.totalItemCount)throw fail('INVALID_PAGINATION');
          for(const item of raw.trophyTitles){
            const trophy=core.sample({trophyTitles:[item]})[0],key=trophy.npServiceName+':'+trophy.npCommunicationId;
            if(seen.has(key))throw fail('INVALID_PAGINATION');seen.add(key);
            if(trophy.platinum)snapshot.games.push({...trophy,platforms:trophy.platform.toUpperCase().split(/[,/\s]+/).filter(Boolean)});
          }
          const next=offset+raw.trophyTitles.length;
          if(next===total){titlesComplete=true;break;}
          if(next>total||next<=offset||raw.nextOffset!==undefined&&raw.nextOffset!==next)throw fail('INVALID_PAGINATION');
          offset=next;
        }
        if(!titlesComplete)throw fail('INVALID_PAGINATION');
      }catch(e){if(signal.aborted||['AUTH_REJECTED','RATE_LIMITED'].includes(e.message))throw e;snapshot.failures.push({stage:'titles',error:safeErrors.has(e.message)?e.message:'NETWORK_ERROR'});}
      stage='mapping';
      for(let index=0;index<ids.length;index+=5){
        progress('比對遊戲 ID：'+index+' / '+ids.length,index);
        const batch=ids.slice(index,index+5);
        try{
          const rows=core.mapping(await data(core.apiUrl('mapping',batch)),batch);
          snapshot.mappings.push(...rows);
          const returned=new Set(rows.map(row=>row.titleId)),missing=batch.filter(id=>!returned.has(id));
          for(const titleId of missing)snapshot.mappings.push({titleId,platform:titleId.startsWith('CUSA')?'PS4':'PS5',trophies:[]});
        }catch(e){
          snapshot.failures.push({stage:'mapping',titleIds:batch,error:safeErrors.has(e.message)?e.message:'NETWORK_ERROR',...(Number.isInteger(e.status)?{httpStatus:e.status}:{})});
          if(signal.aborted||['AUTH_REJECTED','RATE_LIMITED'].includes(e.message))throw e;
        }
      }
      snapshot.complete=titlesComplete&&!snapshot.failures.length;
      progress('比對完成',ids.length);job.status='complete';job.result=snapshot;
    }catch(e){
      snapshot.failures.push({stage,error:safeErrors.has(e.message)?e.message:signal.aborted?'STOPPED':'NETWORK_ERROR',...(Number.isInteger(e.status)?{httpStatus:e.status}:{})});
      job.status=signal.aborted?'cancelled':'failed';job.result=snapshot;progress(signal.aborted?'已停止':'查詢已停止，保留已完成的結果',snapshot.mappings.length);
    }finally{credential='';token='';running=false;job.finishedAt=Date.now();job.controller=null;}
  }
  function start(credential,values,expectedProfile){
    if(running)throw fail('BUSY');
    const ids=titleIds(values);profileName(expectedProfile);core.sessionCredential({npsso:credential});
    for(const [id,job] of jobs)if(job.finishedAt&&Date.now()-job.finishedAt>1200000)jobs.delete(id);
    while(jobs.size>=3){const old=[...jobs].find(([,job])=>job.finishedAt);if(!old)break;jobs.delete(old[0]);}
    const id=crypto.randomBytes(16).toString('hex'),job={status:'running',progress:{stage:'authorize',message:'準備查詢',done:0,total:ids.length},controller:new AbortController()};
    jobs.set(id,job);running=true;
    const deadline=setTimeout(()=>job.controller?.abort(),900000);deadline.unref();
    execute(job,credential,ids,expectedProfile).finally(()=>{clearTimeout(deadline);const cleanup=setTimeout(()=>jobs.delete(id),1200000);cleanup.unref();});
    return id;
  }
  return {get running(){return running;},titleIds,profileName,start,get(id){const job=jobs.get(id);return job?{status:job.status,progress:job.progress,...(job.result?{result:job.result}:{})}:null;},cancel(id){const job=jobs.get(id);job?.controller?.abort();return !!job;}};
}
return {createBulk};

})();
const CLIENT_TEMPLATE="// ==UserScript==\n// @name         PS Game Base · PSN 獎盃 ID 驗證\n// @namespace    personal.ps-game-base.id-probe\n// @version      0.5.0\n// @description  依遊戲 ID 整批讀取 PSN 白金，透過本機助手處理授權。\n// @match        https://library.playstation.com/*\n// @run-at       document-end\n// @noframes\n// @grant        GM_xmlhttpRequest\n// @grant        GM_info\n// @connect      ca.account.sony.com\n// @connect      127.0.0.1\n// ==/UserScript==\n(() => {\n  'use strict';\n  if(location.hostname!=='library.playstation.com')return;\n  const helper='http://127.0.0.1:__LOCAL_PORT__',pairKey='__PAIR_KEY__';\n  const headers={'X-PSGB-Probe-Key':pairKey,Accept:'application/json'};\n  const labels={health:'本機助手連線',session:'Sony 登入工作階段',helper:'本機助手查詢',authorize:'Sony 授權碼',token:'暫存授權',sample:'獎盃讀取',mapping:'遊戲 ID 對應'};\n  const messages={HELPER_OFFLINE:'無法連上本機助手。請確認助手仍在執行。',HELPER_REJECTED:'配對已失效，請從本機助手頁面重新安裝腳本。',SONY_LOGIN_REQUIRED:'Sony 登入工作階段已失效，請在同一瀏覽器重新登入 PlayStation。',NETWORK_ERROR:'連線失敗，請確認腳本連線權限。',TIMEOUT:'請求逾時。',STOPPED:'已停止。',INVALID_JSON:'回應格式無法辨識。',HELPER_ERROR:'本機助手未能完成請求。',CLIENT_ERROR:'腳本執行失敗，請匯出診斷 JSON。',BUSY:'助手已有查詢正在執行，請稍後再試。'};\n  let active=null,busy=false,version=0,report=null,batch=null,jobId=null,wake=null;\n  const params=new URLSearchParams(location.hash.slice(1)),origin=params.get('psgbSonyOrigin'),sessionId=params.get('psgbSonySession');\n  const origins=new Set(['http://localhost:4175','http://127.0.0.1:4175','https://chiarubi-728.github.io']);\n  const bridge=window.opener&&origins.has(origin)&&/^[a-f0-9-]{36}$/i.test(sessionId||'')?{parent:window.opener,origin,session:sessionId,accepted:false}:null;\n  function post(type,payload={}){if(bridge?.accepted)try{bridge.parent.postMessage({type,session:bridge.session,...payload},bridge.origin);}catch{}}\n  const host=document.createElement('div');host.id='psgb-psn-id-probe';document.documentElement.append(host);\n  const root=host.attachShadow({mode:'closed'});\n  root.innerHTML=`<style>:host{all:initial;font:14px/1.7 system-ui;color:#eef3ff;color-scheme:dark}section{position:fixed;right:16px;bottom:100px;z-index:2147483647;width:min(680px,calc(100vw - 32px));box-sizing:border-box;max-height:82vh;overflow:auto;padding:20px;background:#142137;border:1px solid #75bdf6;border-radius:14px;box-shadow:0 8px 40px #0008}button,input{font:inherit;color:inherit;background:#263d60;border:1px solid #6886b1;border-radius:7px;padding:8px 11px}button{cursor:pointer;margin:4px}button:disabled{opacity:.45}input{width:100%;box-sizing:border-box}h2{font-size:18px;margin:0}p{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}#status,#request-info{color:#bddcff}#launch{position:fixed;right:20px;bottom:52px;z-index:2147483647}section[hidden]{display:none}#results p{border-top:1px solid #42577a;padding-top:8px}</style><button id=\"launch\">PSN 白金同步</button><section><h2>PSN 白金同步 · v0.5.0</h2><p>暫存 Sony 登入憑證會交給此電腦的 127.0.0.1 助手，再由助手向 Sony 查詢；憑證只存在記憶體。遊戲庫只會收到遊戲 ID、白金狀態與帳號確認結果。</p><p id=\"request-info\">整批比對：先從 Game Base 開啟 PSN 比對，或在這裡匯入比對清單。</p><div><button id=\"load\">匯入比對清單</button><button id=\"diagnostic\">改用小範圍測試</button></div><input id=\"batch-file\" type=\"file\" accept=\".json,application/json\" hidden><label>小範圍測試 ID（最多 5 個）<input id=\"ids\" value=\"PPSA01464_00\"></label><div><button id=\"run\">透過本機助手測試</button><button id=\"stop\" disabled>停止</button><button id=\"export\" disabled>匯出結果 JSON</button></div><p id=\"status\" role=\"status\">等待開始。</p><div id=\"results\"></div></section>`;\n  const q=selector=>root.querySelector(selector),fail=code=>Error(code);\n  function say(text){q('#status').textContent=text;post('PSGB_SONY_STATUS',{message:text});}\n  q('#launch').onclick=()=>{q('section').hidden=!q('section').hidden;};\n  function render(){q('#run').disabled=busy;q('#ids').disabled=busy||!!batch;q('#stop').disabled=!busy;q('#export').disabled=busy||!report;q('#load').disabled=q('#diagnostic').disabled=busy;}\n  function request(options,run,timeout=25000){return new Promise((resolve,reject)=>{\n    if(run!==version)return reject(fail('STOPPED'));\n    let ended=false,handle,timer;\n    const current={abort:()=>{finish(fail('STOPPED'));handle?.abort();}};\n    function finish(error,response){if(ended)return;ended=true;clearTimeout(timer);if(active===current)active=null;if(run!==version)return reject(fail('STOPPED'));error?reject(error):resolve(response);}\n    active=current;timer=setTimeout(()=>{finish(fail('TIMEOUT'));handle?.abort();},timeout);\n    try{handle=GM_xmlhttpRequest({...options,timeout,redirect:'error',onload:r=>{if(r.finalUrl&&r.finalUrl!==options.url)return finish(fail('NETWORK_ERROR'));finish(null,r);},onerror:()=>finish(fail('NETWORK_ERROR')),ontimeout:()=>finish(fail('TIMEOUT')),onabort:()=>finish(fail('STOPPED'))});}catch{finish(fail('NETWORK_ERROR'));}\n  });}\n  function parse(response){try{return JSON.parse(response.responseText);}catch{throw fail('INVALID_JSON');}}\n  function setBatch(value){\n    if(value?.kind!=='ps-game-base-sony-request'||value.schemaVersion!==1||typeof value.expectedProfile!=='string'||!/^[A-Za-z0-9_-]{1,32}$/.test(value.expectedProfile)||!Array.isArray(value.titleIds)||value.titleIds.length<1||value.titleIds.length>5000||value.titleIds.some(id=>typeof id!=='string'||!/^(CUSA|PPSA)\\d{5}_\\d{2}$/.test(id)))throw fail('INVALID_JSON');\n    batch={kind:value.kind,schemaVersion:1,expectedProfile:value.expectedProfile,titleIds:[...new Set(value.titleIds)]};\n    report=null;q('#results').replaceChildren();\n    q('#request-info').textContent=`已收到 ${batch.expectedProfile} 的 ${batch.titleIds.length} 個遊戲 ID。按「開始整批比對」後才會讀取登入工作階段。`;\n    q('#run').textContent='開始整批比對';say('清單已準備好。');render();\n  }\n  q('#load').onclick=()=>q('#batch-file').click();\n  q('#batch-file').onchange=async()=>{try{const file=q('#batch-file').files[0];if(!file)return;if(file.size>200000)throw fail('INVALID_JSON');if(bridge)bridge.accepted=false;setBatch(JSON.parse(await file.text()));}catch{say('比對清單格式無法辨識。請從 Game Base 匯出 Sony 比對清單。');}finally{q('#batch-file').value='';}};\n  q('#diagnostic').onclick=()=>{batch=null;if(bridge)bridge.accepted=false;q('#request-info').textContent='小範圍測試模式：最多 5 個遊戲 ID。';q('#run').textContent='透過本機助手測試';render();};\n  function cancelJob(){if(!jobId)return;const id=jobId;jobId=null;try{GM_xmlhttpRequest({method:'DELETE',url:helper+'/jobs/'+id,anonymous:true,redirect:'error',headers,timeout:5000});}catch{}}\n  function stop(){version++;active?.abort();cancelJob();wake?.();say(messages.STOPPED);}\n  q('#stop').onclick=stop;window.addEventListener('pagehide',()=>{if(busy)cancelJob();});\n  window.addEventListener('message',event=>{\n    if(!bridge||event.origin!==bridge.origin||event.source!==bridge.parent||event.data?.session!==bridge.session)return;\n    if(event.data.type==='PSGB_SONY_CANCEL'&&bridge.accepted)stop();\n    if(event.data.type==='PSGB_SONY_REQUEST'&&!busy&&!bridge.accepted){try{bridge.accepted=true;setBatch(event.data.request);}catch{bridge.accepted=false;say('收到的比對清單格式不正確。');}}\n  });\n  let readyAttempts=0;\n  const readyTimer=bridge?setInterval(()=>{if(bridge.accepted||++readyAttempts>30){clearInterval(readyTimer);return;}try{bridge.parent.postMessage({type:'PSGB_SONY_READY',session:bridge.session},bridge.origin);}catch{}},1000):null;\n  async function helperResponse(options,run){const r=await request(options,run);if(r.status===403)throw fail('HELPER_REJECTED');if(r.status===429)throw fail('BUSY');return r;}\n  q('#run').onclick=async()=>{\n    if(busy)return;\n    const ids=batch?batch.titleIds:[...new Set(q('#ids').value.trim().toUpperCase().split(/[\\s,;，]+/).filter(Boolean).map(id=>id.includes('_')?id:id+'_00'))];\n    if(!ids.length||ids.length>(batch?5000:5)||ids.some(id=>!/^(CUSA|PPSA)\\d{5}_\\d{2}$/.test(id))){say('請填入有效的 CUSA／PPSA ID，或匯入比對清單。');return;}\n    const run=++version;busy=true;report=null;render();q('#results').replaceChildren();let credential='',stage='health',httpStatus;\n    try{\n      say('確認本機助手連線…');\n      let health;try{health=await helperResponse({method:'GET',url:helper+'/health',anonymous:true,headers},run);}catch(e){if(['STOPPED','HELPER_REJECTED'].includes(e.message))throw e;throw fail('HELPER_OFFLINE');}\n      httpStatus=health.status;if(health.status!==200||parse(health).ready!==true)throw fail('HELPER_ERROR');\n      if(batch&&parse(health).version!=='0.5.0')throw fail('HELPER_ERROR');\n      stage='session';httpStatus=undefined;say('確認 Sony 登入工作階段…');\n      const session=await request({method:'GET',url:'https://ca.account.sony.com/api/v1/ssocookie',anonymous:false,nocache:true,headers:{Accept:'application/json'}},run);\n      httpStatus=session.status;if(session.status!==200)throw fail('SONY_LOGIN_REQUIRED');credential=parse(session).npsso;\n      if(typeof credential!=='string'||!/^[A-Za-z0-9._~-]{32,256}$/.test(credential))throw fail('SONY_LOGIN_REQUIRED');\n      stage='helper';httpStatus=undefined;\n      const options={method:'POST',url:helper+(batch?'/sync':'/probe'),anonymous:true,headers:{...headers,'Content-Type':'application/json'},data:JSON.stringify({npsso:credential,titleIds:ids,...(batch?{expectedProfile:batch.expectedProfile}:{})})};credential='';\n      let response;try{response=await helperResponse(options,run);}finally{delete options.data;}\n      httpStatus=response.status;\n      if(batch){\n        if(response.status!==202||!/^\\w{32}$/.test(parse(response).jobId||''))throw fail('HELPER_ERROR');\n        jobId=parse(response).jobId;say('整批比對已開始…');\n        for(;;){\n          if(run!==version)throw fail('STOPPED');\n          const stateResponse=await helperResponse({method:'GET',url:helper+'/jobs/'+jobId,anonymous:true,headers},run);\n          if(stateResponse.status!==200)throw fail('HELPER_ERROR');const state=parse(stateResponse);\n          if(state.progress&&typeof state.progress.message==='string')say(state.progress.message.slice(0,400));\n          if(state.status!=='running'){\n            const result=state.result;\n            if(result?.kind!=='ps-game-base-sony-platinums'||result.schemaVersion!==1||!Array.isArray(result.mappings)||!Array.isArray(result.games)||!Array.isArray(result.failures))throw fail('INVALID_JSON');\n            report=result;jobId=null;\n            const earned=result.mappings.filter(row=>row.trophies.some(t=>t.platinum));\n            say(`${result.complete?'整批比對完成':'已取得部分結果'}：${result.mappings.length} 個 ID 回應，${earned.length} 個 ID 有白金；${result.games.length} 筆白金清單。${result.profile?.verified?'帳號：'+result.profile.onlineId:'帳號名稱未驗證，匯入時需確認。'}`);\n            for(const failure of result.failures.slice(0,10)){const p=document.createElement('p');p.textContent=`${failure.stage}：${failure.error}${failure.httpStatus?' · HTTP '+failure.httpStatus:''}`;q('#results').append(p);}\n            for(const row of earned.slice(0,100)){const p=document.createElement('p');p.textContent=row.titleId+' · '+row.trophies.filter(t=>t.platinum).map(t=>t.name+' · '+t.npCommunicationId+' · 已白金').join('\\n');q('#results').append(p);}\n            post('PSGB_SONY_RESULT',{payload:result});break;\n          }\n          await new Promise(resolve=>{wake=resolve;setTimeout(()=>{wake=null;resolve();},1000);});\n        }\n      }else{\n        if(response.status!==200)throw fail('HELPER_ERROR');const result=parse(response);\n        if(result.kind!=='ps-game-base-psn-id-probe'||!Array.isArray(result.steps)||!Array.isArray(result.mappings))throw fail('INVALID_JSON');\n        report=result;\n        for(const step of result.steps){const p=document.createElement('p');p.textContent=`${labels[step.stage]||step.stage}：${step.httpStatus?'HTTP '+step.httpStatus+' · ':''}${step.valid?'成功':step.error}`;q('#results').append(p);}\n        for(const row of result.mappings){const p=document.createElement('p');p.textContent=row.titleId+'：'+(row.trophies.length?row.trophies.map(t=>t.name+' · '+t.npCommunicationId+' · '+(t.platinum?'已白金':'尚未白金')).join('\\n'):'尚無對應。');q('#results').append(p);}\n        say(result.outcome==='id-mapping-confirmed'?'已取得遊戲 ID 與獎盃清單對應。':'測試完成，可匯出診斷 JSON。');\n      }\n    }catch(e){\n      if(run===version){const code=Object.hasOwn(messages,e.message)?e.message:'CLIENT_ERROR';report={kind:'ps-game-base-psn-id-probe',schemaVersion:6,scriptVersion:'0.5.0',authMethod:'local-node-helper',testedAt:new Date().toISOString(),requestedTitleIds:ids,steps:[{stage,valid:false,error:code,...(Number.isInteger(httpStatus)?{httpStatus}:{})}],sample:[],mappings:[],outcome:'trophy-access-unconfirmed'};say(messages[code]+`（${labels[stage]}${Number.isInteger(httpStatus)?' · HTTP '+httpStatus:''}）`);}cancelJob();\n    }finally{credential='';busy=false;render();}\n  };\n  q('#export').onclick=()=>{if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=(report.kind==='ps-game-base-sony-platinums'?'ps-game-base-sony-platinums-':'psn-id-probe-')+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};\n})();\n";
const SAFE_ERRORS=new Set(['SONY_LOGIN_REQUIRED','AUTH_REDIRECT_UNAVAILABLE','INVALID_AUTH_RESPONSE','AUTH_REJECTED','RATE_LIMITED','TITLE_NOT_FOUND','HTTP_ERROR','INVALID_JSON','INVALID_SAMPLE_FORMAT','INVALID_MAPPING_FORMAT','INVALID_TROPHY_FORMAT','INVALID_TROPHY_COUNTS','NETWORK_ERROR','TIMEOUT','STOPPED','RESPONSE_TOO_LARGE','INVALID_TITLE_IDS']);
const fail=(code,status)=>Object.assign(Error(code),Number.isInteger(status)?{status}:{});
async function jsonBody(response){
  let size=0;const parts=[];
  for await(const chunk of response.body){size+=chunk.length;if(size>1048576)throw fail('RESPONSE_TOO_LARGE');parts.push(chunk);}
  try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw fail('INVALID_JSON');}
}
async function probe(npsso,ids,signal,fetchImpl){
  const result={kind:'ps-game-base-psn-id-probe',schemaVersion:5,scriptVersion:'0.5.0',authMethod:'local-node-helper',testedAt:new Date().toISOString(),requestedTitleIds:ids,steps:[],sample:[],mappings:[],outcome:'trophy-access-unconfirmed'};
  const allowed=new Set([core.authUrl(),core.tokenRequest('v3.validation').url,core.apiUrl('sample'),core.apiUrl('mapping',ids)]);
  async function sony(url,options){
    if(!allowed.has(url))throw fail('NETWORK_ERROR');
    try{return await fetchImpl(url,{...options,redirect:'manual',signal:AbortSignal.any([signal,AbortSignal.timeout(25000)])});}
    catch(e){throw fail(signal.aborted?'STOPPED':e.name==='TimeoutError'?'TIMEOUT':'NETWORK_ERROR');}
  }
  let stage='authorize',status,token='';
  try{
    let auth;
    try{auth=await sony(core.authUrl(),{headers:{Cookie:'npsso='+npsso,Accept:'application/json'}});}finally{npsso='';}
    status=auth.status;
    const code=core.authCode('Location: '+(auth.headers.get('location')||''),status);await auth.body?.cancel();
    result.steps.push({stage,httpStatus:status,valid:true});
    stage='token';status=undefined;
    const options=core.tokenRequest(code);
    let exchanged;try{exchanged=await sony(options.url,{method:'POST',headers:options.headers,body:options.data});}finally{delete options.data;}
    status=exchanged.status;if(status!==200)throw fail(core.httpError(status),status);
    token=core.accessToken(await jsonBody(exchanged));result.steps.push({stage,httpStatus:status,valid:true});
    stage='sample';status=undefined;
    const sample=await sony(core.apiUrl('sample'),{headers:{Authorization:token,Accept:'application/json'}});status=sample.status;
    if(status!==200)throw fail(core.httpError(status),status);
    result.sample=core.sample(await jsonBody(sample));result.steps.push({stage,httpStatus:status,valid:true});
    stage='mapping';status=undefined;
    const mapped=await sony(core.apiUrl('mapping',ids),{headers:{Authorization:token,Accept:'application/json'}});status=mapped.status;
    if(status!==200)throw fail(core.httpError(status),status);
    result.mappings=core.mapping(await jsonBody(mapped),ids);result.steps.push({stage,httpStatus:status,valid:true});
    result.outcome=result.mappings.some(row=>row.trophies.length)?'id-mapping-confirmed':'trophy-access-only';
  }catch(e){
    if(signal.aborted)throw fail('STOPPED');
    result.steps.push({stage,...(Number.isInteger(e.status??status)?{httpStatus:e.status??status}:{}),valid:false,error:SAFE_ERRORS.has(e.message)?e.message:'NETWORK_ERROR'});
    result.outcome=stage==='mapping'?'trophy-access-only':'trophy-access-unconfirmed';
  }finally{npsso='';token='';}
  return result;
}
function createHelper({port=4176,key=crypto.randomBytes(32).toString('hex'),fetchImpl=globalThis.fetch,clientSource=CLIENT_TEMPLATE}={}){
  let busy=false;
  const bulk=createBulk({core,fetchImpl,readJson:jsonBody});
  const server=http.createServer(async(req,res)=>{
    const bound=server.address();
    const expected='127.0.0.1:'+bound.port;
    for(const [name,value] of Object.entries({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}))res.setHeader(name,value);
    const reply=(status,data,type='application/json')=>{if(res.destroyed)return;res.writeHead(status,{'Content-Type':type+'; charset=utf-8'});res.end(typeof data==='string'?data:JSON.stringify(data));};
    if(req.headers.host!==expected)return reply(403,{error:'FORBIDDEN'});
    if(req.method==='GET'&&req.url==='/')return reply(200,'<!doctype html><meta charset="utf-8"><title>PSN 本機助手</title><h1>PSN 本機助手 v0.5.0 已啟動</h1><p>只監聽 127.0.0.1。暫存登入憑證只存在記憶體；只向 Sony 查詢。</p><p><a href="/local-probe.user.js">安裝 / 更新整批白金腳本 v0.5.0</a></p><p>安裝後回到 Game Base，點「PSN 白金比對」，再開啟官方分頁。若分頁無法自動傳送，從 Game Base 匯出比對清單，再在官方分頁助手面板匯入。</p><p>官方分頁查詢結果不會修改遊戲庫；回到 Game Base 才會依已確認對應加入白金，並可復原本次標記。</p><p>關閉助手程序即可停止服務。</p>','text/html');
    if(req.method==='GET'&&req.url==='/local-probe.user.js')return reply(200,clientSource.replace('__PAIR_KEY__',key).replace('__LOCAL_PORT__',String(bound.port)),'application/javascript');
    const supplied=req.headers['x-psgb-probe-key'];
    if(typeof supplied!=='string'||!/^[a-f0-9]{64}$/.test(supplied)||supplied.length!==key.length||!crypto.timingSafeEqual(Buffer.from(supplied),Buffer.from(key)))return reply(403,{error:'FORBIDDEN'});
    if(req.method==='GET'&&req.url==='/health')return reply(200,{ready:true,version:'0.5.0',busy:busy||bulk.running});
    const jobMatch=/^\/jobs\/([a-f0-9]{32})$/.exec(req.url||'');
    if(jobMatch&&req.method==='GET'){const job=bulk.get(jobMatch[1]);return reply(job?200:404,job||{error:'NOT_FOUND'});}
    if(jobMatch&&req.method==='DELETE')return reply(bulk.cancel(jobMatch[1])?200:404,{cancelled:true});
    if(req.method!=='POST'||!['/probe','/sync'].includes(req.url))return reply(404,{error:'NOT_FOUND'});
    if(req.headers['content-type']?.split(';')[0].trim().toLowerCase()!=='application/json')return reply(415,{error:'CONTENT_TYPE'});
    if(busy||bulk.running)return reply(429,{error:'BUSY'});
    busy=true;
    const controller=new AbortController();
    const bodyTimer=setTimeout(()=>controller.abort(),10000),totalTimer=setTimeout(()=>controller.abort(),105000);
    const onClosed=()=>controller.abort();res.on('close',onClosed);
    let body='',payload;
    try{
      const chunks=[];let bytes=0;
      for await(const chunk of req){if(controller.signal.aborted)throw fail('STOPPED');bytes+=chunk.length;if(bytes>(req.url==='/sync'?131072:8192))throw fail('INVALID_TITLE_IDS');chunks.push(chunk);}
      clearTimeout(bodyTimer);body=Buffer.concat(chunks).toString('utf8');
      try{payload=JSON.parse(body);}catch{throw fail('INVALID_JSON');}finally{body='';}
      const fields=req.url==='/sync'?['titleIds','npsso','expectedProfile']:['titleIds','npsso'];
      if(!payload||!Array.isArray(payload.titleIds)||payload.titleIds.some(id=>typeof id!=='string')||Object.keys(payload).some(k=>!fields.includes(k)))throw fail('INVALID_TITLE_IDS');
      if(req.url==='/sync'){
        const jobId=bulk.start(payload.npsso,payload.titleIds,payload.expectedProfile);payload.npsso='';
        return reply(202,{jobId});
      }
      const ids=core.titleIds(payload.titleIds.join(',')),npsso=core.sessionCredential({npsso:payload.npsso});
      const pending=probe(npsso,ids,controller.signal,fetchImpl);payload.npsso='';
      reply(200,await pending);
    }catch(e){if(!res.destroyed)reply(controller.signal.aborted?408:400,{error:SAFE_ERRORS.has(e.message)?e.message:'INVALID_JSON'});}
    finally{clearTimeout(bodyTimer);clearTimeout(totalTimer);res.off('close',onClosed);body='';if(payload)payload.npsso='';busy=false;}
  });
  server.headersTimeout=10000;server.requestTimeout=15000;server.maxHeadersCount=32;
  return {server,key,listen:()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve(server.address()));})};
}
module.exports={createHelper,probe};
if(require.main===module){
  const existingKey=process.env.PSGB_PROBE_PAIR_KEY;delete process.env.PSGB_PROBE_PAIR_KEY;
  const helper=createHelper(/^[a-f0-9]{64}$/.test(existingKey||'')?{key:existingKey}:{});
  helper.listen().then(address=>process.stdout.write('PSN 本機助手 v0.5.0\nhttp://127.0.0.1:'+address.port+'/\n不記錄登入憑證或請求內容；關閉助手程序即可停止。\n')).catch(()=>{process.stderr.write('無法啟動：請確認 Node.js 版本，以及 4176 連接埠是否被占用。\n');process.exitCode=1;});
}
