import {icon} from './icons.js';
import {personalPlatinum} from './model.js';
import {dateValue,displayDate} from './dates.js';
import {dateSorts} from './catalog-sort.js';

function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
function cell(label,className){const node=el('div',undefined,className);if(label)node.append(el('span',label,'catalog-cell-label'));return node;}
function badge(name,label,className){const node=el('span',undefined,'catalog-list-flag '+className);node.title=label;node.setAttribute('role','img');node.setAttribute('aria-label',label);node.append(icon(name));return node;}

// Uses the same catalog records and callbacks as cards; no separate data or save path.
export function renderCatalogList({games,getRecord,selected,missing,sortField,onSelect,onEdit,renderActions}){
  const fragment=document.createDocumentFragment();
  if(!games.length)return fragment;
  const heading=el('div',undefined,'catalog-list-heading');heading.setAttribute('aria-hidden','true');
  for(const label of ['', '遊戲','平台','獎盃進度','分類／標籤','操作'])heading.append(el('span',label));
  fragment.append(heading);
  for(const game of games){
    const record=getRecord(game),row=el('article',undefined,'catalog-list-row');
    row.classList.toggle('is-selected',selected.has(game.key));
    const selection=cell('', 'catalog-row-select'),check=el('input',undefined,'catalog-list-check');
    check.type='checkbox';check.checked=selected.has(game.key);check.setAttribute('aria-label','選取 '+game.name+' · '+game.platforms.join(' / '));
    check.onchange=()=>{onSelect(game,check.checked);row.classList.toggle('is-selected',check.checked);};selection.append(check);

    const identity=cell('', 'catalog-row-game'),cover=el('div',undefined,'catalog-list-cover'),copy=el('div',undefined,'catalog-row-copy');
    cover.setAttribute('aria-hidden','true');cover.append(el('div',game.name.split(/\s/).map(part=>part[0]).slice(0,3).join(''),'cover-placeholder'));
    if(game.imageUrl){const image=el('img');image.src=game.imageUrl;image.alt='';image.loading='lazy';image.referrerPolicy='no-referrer';image.onerror=()=>image.remove();cover.append(image);}
    const titleHeading=el('h2',undefined,'catalog-row-heading'),title=el('button',game.name,'game-title catalog-row-title');
    title.type='button';title.title=game.name;title.setAttribute('aria-label','編輯 '+game.name+' · '+game.platforms.join(' / '));title.onclick=()=>onEdit(game);titleHeading.append(title);copy.append(titleHeading);
    const flags=el('div',undefined,'catalog-list-flags');
    if(game.platinum||personalPlatinum(record))flags.append(badge('trophy',game.platinum?'已取得白金':'個人白金標記','catalog-list-platinum'));
    const plus=game.digitalMembers.filter(member=>member.membership==='PS_PLUS');
    if(plus.length){const historical=plus.every(member=>missing.has(member.entitlementId)),plusBadge=badge('ps-plus',historical?'歷史 PS Plus 授權（未出現在最近完整同步）':'授權來源：PS Plus','catalog-list-plus');plusBadge.dataset.historical=String(historical);flags.append(plusBadge);}
    if(flags.childNodes.length)copy.append(flags);
    if(sortField!=='name'&&dateValue(game[sortField]))copy.append(el('p',dateSorts[sortField]+' · '+displayDate(game[sortField]),'catalog-row-date'));
    if(game.missingCount)copy.append(el('p','部分或全部數位授權未出現在最近完整同步','missing'));
    identity.append(cover,copy);

    const platform=cell('平台','catalog-row-platform');platform.append(el('span',game.platforms.join(' / ')||'PS','catalog-list-platform'));
    const trophies=cell('獎盃進度','catalog-row-trophies'),trophyContent=el('div',undefined,'catalog-list-trophies');
    if(game.played){
      const text=[game.progress!==null?game.progress+'%':'獎盃紀錄已同步',game.earnedTotal!==null?game.earnedTotal+(game.definedTotal!==null?' / '+game.definedTotal:'')+' 個獎盃':''].filter(Boolean).join(' · ');
      const summary=el('p',text,'catalog-list-trophy-summary');summary.title=text;trophyContent.append(summary);
      if(game.progress!==null){const progress=el('progress');progress.max=100;progress.value=game.progress;progress.setAttribute('aria-label','獎盃進度 '+game.progress+'%');trophyContent.append(progress);}
    }else{const empty=el('span','—','catalog-list-muted');empty.setAttribute('aria-label','尚無獎盃紀錄');trophyContent.append(empty);}
    trophies.append(trophyContent);

    const categories=cell('分類與標籤','catalog-row-categories'),tags=el('div',undefined,'catalog-list-tags');
    const labels=[...record.categories,...record.tags.map(tag=>'#'+tag)];tags.title=labels.join(' · ');
    for(const label of labels){const tag=el('span',label,'catalog-list-tag');tag.title=label;tags.append(tag);}
    if(!labels.length)tags.append(el('span','—','catalog-list-muted'));categories.append(tags);
    const actions=cell('', 'catalog-row-actions');actions.append(renderActions(game,record));
    row.append(selection,identity,platform,trophies,categories,actions);fragment.append(row);
  }
  return fragment;
}
