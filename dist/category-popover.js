// A small anchored checklist shared by card organization and category filters.
export function categoryPopover({id,title,getCategories,getSelected,onToggle,onCreate}){
  const panel=document.createElement('section');panel.id=id;panel.className='category-popover';panel.hidden=true;panel.setAttribute('role','group');panel.setAttribute('aria-label',title);
  const header=document.createElement('div'),heading=document.createElement('strong'),closeButton=document.createElement('button'),list=document.createElement('div');
  header.className='popover-heading';heading.textContent=title;closeButton.type='button';closeButton.textContent='✕';closeButton.setAttribute('aria-label','關閉'+title);header.append(heading,closeButton);list.className='popover-categories';panel.append(header,list);
  let anchor=null,createInput=null;
  function position(){
    if(!anchor?.isConnected){close(false);return;}
    const rect=anchor.getBoundingClientRect(),width=Math.min(292,window.innerWidth-24);
    panel.style.width=width+'px';panel.style.maxHeight=Math.max(120,window.innerHeight-24)+'px';
    panel.style.left=Math.max(12,Math.min(rect.right-width,window.innerWidth-width-12))+'px';
    const height=panel.offsetHeight,below=rect.bottom+8;
    panel.style.top=Math.max(12,below+height<=window.innerHeight-12?below:rect.top-height-8)+'px';
  }
  function refresh(nextAnchor=anchor){
    if(panel.hidden)return;
    if(anchor!==nextAnchor)anchor?.setAttribute('aria-expanded','false');anchor=nextAnchor;anchor?.setAttribute('aria-expanded','true');
    const focused=document.activeElement?.dataset.category,scroll=list.scrollTop,selected=new Set(getSelected());list.replaceChildren();
    const categories=getCategories();
    if(!categories.length){const empty=document.createElement('p');empty.textContent='尚未建立自訂分類';empty.className='popover-empty';list.append(empty);}
    for(const name of categories){
      const row=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span');
      row.className='popover-category';check.type='checkbox';check.value=name;check.dataset.category=name;check.checked=selected.has(name);text.textContent=name;row.append(check,text);list.append(row);
      check.onchange=()=>{if(onToggle(name,check.checked)===false)check.checked=selected.has(name);};
      if(focused===name)check.focus({preventScroll:true});
    }
    list.scrollTop=scroll;position();
  }
  function close(restoreFocus=true){if(panel.hidden)return;panel.hidden=true;anchor?.setAttribute('aria-expanded','false');if(restoreFocus)anchor?.focus({preventScroll:true});anchor=null;}
  function toggle(nextAnchor){if(!panel.hidden&&anchor===nextAnchor){close();return;}close(false);anchor=nextAnchor;panel.hidden=false;refresh();(list.querySelector('input')||createInput||closeButton).focus({preventScroll:true});}
  if(onCreate){
    const form=document.createElement('form'),submit=document.createElement('button');form.className='popover-create';createInput=document.createElement('input');createInput.maxLength=100;createInput.required=true;createInput.placeholder='新增分類';createInput.setAttribute('aria-label','新增分類名稱');submit.type='submit';submit.textContent='新增並加入';form.append(createInput,submit);panel.append(form);
    form.onsubmit=event=>{event.preventDefault();if(onCreate(createInput.value.trim())!==false){createInput.value='';refresh();createInput.focus({preventScroll:true});}};
  }
  closeButton.onclick=()=>close();
  panel.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key)||document.activeElement===createInput)return;
    const items=[...list.querySelectorAll('input')];if(!items.length)return;event.preventDefault();const index=items.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowUp'?-1:1)+items.length)%items.length;items[next].focus();
  });
  document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!anchor?.contains(event.target))close(false);});
  document.addEventListener('focusin',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!anchor?.contains(event.target))close(false);});
  window.addEventListener('resize',()=>close(false));
  window.addEventListener('scroll',event=>{if(!panel.hidden&&!panel.contains(event.target))close(false);},true);
  document.body.append(panel);
  return {toggle,refresh,close,get open(){return !panel.hidden;}};
}
