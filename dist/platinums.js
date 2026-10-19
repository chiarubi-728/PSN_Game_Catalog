import {platformGames as groupGames, workRecordFor, hasWorkConflicts} from './model.js';
import {titleKey,titleMatch,rememberTitle} from './title-aliases.js';
export {titleKey} from './title-aliases.js';

export function profileName(value) {
  let name = String(value).trim();
  if (/^https:\/\//i.test(name)) {
    const url = new URL(name);
    if (url.origin !== 'https://psnprofiles.com' || !/^\/[\w-]+\/?$/.test(url.pathname)) throw Error('請輸入 PSNProfiles 個人頁網址或帳號。');
    name = url.pathname.split('/')[1];
  }
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(name)) throw Error('PSNProfiles 帳號格式不正確。');
  return name;
}

export function platinumSnapshot(input, expectedProfile) {
  if (input?.kind !== 'ps-game-base-platinums' || input.schemaVersion !== 1 || input.complete !== true || !Array.isArray(input.games) || input.games.length > 5000) throw Error('需要完整的 PSNProfiles 白金 JSON。');
  const profile = profileName(input.profile);
  if (expectedProfile && profile.toLowerCase() !== profileName(expectedProfile).toLowerCase()) throw Error('回傳帳號與本次指定帳號不同。');
  const ids = new Set();
  const games = input.games.map(g => {
    if (!g || typeof g.name !== 'string' || !g.name.trim() || g.name.length > 500 || typeof g.psnprofilesId !== 'string' || !/^\d{1,10}$/.test(g.psnprofilesId) || !Array.isArray(g.platforms) || !g.platforms.length || g.platforms.some(p => !['PS3','PS4','PS5','PSVITA','PSVITATV'].includes(p))) throw Error('白金紀錄格式不正確。');
    if (ids.has(g.psnprofilesId)) throw Error('白金紀錄含重複的獎盃清單 ID。');
    ids.add(g.psnprofilesId);
    const url = new URL(g.url);
    if (url.origin !== 'https://psnprofiles.com' || !url.pathname.startsWith('/trophies/' + g.psnprofilesId + '-') || url.pathname.split('/').length !== 4 || url.pathname.split('/')[3].toLowerCase() !== profile.toLowerCase() || url.search || url.hash || url.username || url.password) throw Error('白金紀錄的來源網址不正確。');
    if (g.region !== undefined && (typeof g.region !== 'string' || !/^[A-Z]{2,5}$/.test(g.region))) throw Error('白金紀錄的區域格式不正確。');
    return {name:g.name.trim(), platforms:[...new Set(g.platforms)], psnprofilesId:g.psnprofilesId, url:url.href, ...(g.region ? {region:g.region} : {})};
  });
  return {kind:'ps-game-base-platinums', schemaVersion:1, complete:true, profile, games};
}

const productRegion = g => ({UP:'NA',EP:'EU',JP:'JP',HP:'AS'})[/^([A-Z]{2})\d/.exec(g.productId || '')?.[1]];
function exact(work, trophy, personal) {
  return !!titleMatch(work,trophy.name,workRecordFor(personal,work))&&work.members.some(g => trophy.platforms.includes(g.platform?.toUpperCase()) && (!trophy.region || productRegion(g) === trophy.region));
}
function similarity(work, trophy) {
  const target = new Set(titleKey(trophy.name).match(/[\p{L}\p{N}]+/gu) || []);
  return Math.max(...work.members.map(g => {
    const tokens = new Set(titleKey(g.name).match(/[\p{L}\p{N}]+/gu) || []);
    const common = [...tokens].filter(t => target.has(t)).length;
    return 2 * common / Math.max(1, tokens.size + target.size);
  }));
}

export function planPlatinums(library, personal, snapshot) {
  const works = groupGames(library.games, library.missingIds);
  const automatic = [], review = [], already = [], unsupported = [];
  for (const trophy of snapshot.games) {
    if (!trophy.platforms.some(p => ['PS4','PS5'].includes(p))) { unsupported.push(trophy); continue; }
    const candidates = works.filter(w => exact(w, trophy, personal));
    if (candidates.length === 1 && !hasWorkConflicts(personal, candidates[0])) {
      const entry = {trophy, work:candidates[0]};
      (workRecordFor(personal, entry.work).status === '已白金'&&Object.hasOwn(personal.works,entry.work.key) ? already : automatic).push(entry);
    } else {
      const suggested = works.filter(work=>work.platforms.some(p=>trophy.platforms.includes(p))).map(work => ({work,score:similarity(work,trophy)})).filter(x => x.score >= .45).sort((a,b) => b.score-a.score || a.work.name.localeCompare(b.work.name));
      review.push({trophy, reason:candidates.length > 1 ? '同名、同平台對應多部作品' : candidates.length === 1 ? '原版本的整理紀錄不同' : '名稱、平台或區域未能唯一配對', candidates:candidates.length ? candidates : suggested.slice(0,5).map(x=>x.work)});
    }
  }
  return {automatic, review, already, unsupported};
}

export function markPlatinum(personal, work, now = new Date().toISOString(), matchedName) {
  const record=rememberTitle({...workRecordFor(personal,work),status:'已白金',updatedAt:now},matchedName);delete record.platinumReview;
  return {...personal, works:Object.assign(Object.create(null), personal.works, {[work.key]:record})};
}
