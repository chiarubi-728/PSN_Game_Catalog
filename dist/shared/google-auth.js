// Reusable GIS Token Flow. Tokens exist only in this instance's memory.
(function(global){
 'use strict';
 const scopes=['https://www.googleapis.com/auth/drive.appdata','openid','https://www.googleapis.com/auth/userinfo.email'],scope=scopes.join(' ');
 class AuthError extends Error {constructor(message,code='auth'){super(message);this.code=code;}}
 let loading;
 function loadGIS(){
  if(global.google?.accounts?.oauth2)return Promise.resolve();
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
   const timer=setTimeout(()=>fail(),15000);
   function fail(){clearTimeout(timer);script.remove();reject(new AuthError('Google 授權服務無法載入，請確認網路後重試。','load'));}
   script.onload=()=>{clearTimeout(timer);if(global.google?.accounts?.oauth2)resolve();else fail();};script.onerror=fail;
   document.head.append(script);
  }).catch(e=>{loading=null;throw e;});return loading;
 }
 class GoogleAuth {
  #token='';#expires=0;#client;#pending;#timer;
  constructor(clientId,onChange=()=>{}){this.clientId=clientId;this.onChange=onChange;}
  async prepare(){
   if(!this.clientId)throw new AuthError('尚未設定 Google OAuth Client ID。','config');
   await loadGIS();
   if(this.#client)return;
   this.#client=global.google.accounts.oauth2.initTokenClient({client_id:this.clientId,scope,include_granted_scopes:false,
    callback:r=>{
     if(!this.#pending)return;
     if(r.error||!r.access_token)return this.#finish(new AuthError('Google 授權未完成，請重新連接。','denied'));
     if(!global.google.accounts.oauth2.hasGrantedAllScopes(r,...scopes))return this.#finish(new AuthError('請允許 Google 帳號識別與 Drive 應用程式資料權限。','scope'));
     const lifetime=Number(r.expires_in);if(!Number.isFinite(lifetime)||lifetime<=0)return this.#finish(new AuthError('Google 授權期限無效，請重新連接。'));
     this.#token=r.access_token;this.#expires=Date.now()+lifetime*1000;
     this.#timer=setTimeout(()=>this.invalidate(),Math.min(lifetime*1000,2147483647));
     this.#finish();this.onChange();
    },error_callback:e=>this.#finish(new AuthError(e.type==='popup_failed_to_open'?'授權視窗無法開啟，請允許彈出視窗後重試。':'授權視窗已關閉，尚未連接 Google Drive。','popup'))
   });
  }
  // Call directly from a click handler after prepare(), retaining the user gesture.
  connect(){
   if(!this.#client)return Promise.reject(new AuthError('Google 授權服務尚未就緒。','load'));
   if(this.#pending)return Promise.reject(new AuthError('授權正在進行中。'));
   this.invalidate();
   return new Promise((resolve,reject)=>{
    this.#pending={resolve,reject,timer:setTimeout(()=>this.#finish(new AuthError('授權逾時，請重新連接。')),120000)};
    try{this.#client.requestAccessToken({prompt:'select_account'});}catch{this.#finish(new AuthError('無法開啟 Google 授權視窗，請重試。','popup'));}
   });
  }
  #finish(error){const p=this.#pending;if(!p)return;clearTimeout(p.timer);this.#pending=null;error?p.reject(error):p.resolve();}
  get connected(){return !!this.#token&&Date.now()<this.#expires;}
  token(){if(!this.connected){this.invalidate();throw new AuthError('Google 授權已過期，請重新授權。','expired');}return this.#token;}
  async profile(){
   const token=this.token(),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
   try{
    const response=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{cache:'no-store',signal:controller.signal,headers:{Authorization:'Bearer '+token}});
    if(response.status===401){this.invalidate();throw new AuthError('Google 授權已過期，請重新連接。','expired');}
    if(!response.ok)throw new AuthError('無法確認 Google 帳號，未啟動雲端同步。','identity');
    const data=await response.json();
    if(token!==this.#token)throw new AuthError('Google 連接已變更。','cancelled');
    if(typeof data.sub!=='string'||!data.sub||typeof data.email!=='string'||!data.email)throw new AuthError('Google 帳號識別資料不完整，未啟動雲端同步。','identity');
    return {sub:data.sub,email:data.email};
   }finally{clearTimeout(timer);}
  }
  invalidate(){clearTimeout(this.#timer);this.#token='';this.#expires=0;this.onChange();}
  disconnect(){this.#finish(new AuthError('已取消連接。','cancelled'));this.invalidate();}
 }
 global.SideProjectAuth={GoogleAuth,AuthError,scope};
})(window);
