/* 멘트 관리(관리자, 웹) — 상담 데스크 3.4.17 ‘멘트 관리’ 창을 옮긴 것.
   바뀐 곳: 창구 대신 깃허브(admin-backend.js) · 공지 · 요청시트 연결 · 깃허브 연결 화면(admin-extra.js) · 안내 문구.
   (원래 설명) 3.4.17 관리자용 ‘멘트 관리’ 창
   - 왼쪽 분류 · 가운데 멘트 목록 · 오른쪽 고치는 칸. 고치는 즉시 이 PC에 임시로 남음(rgScriptDraft) → 창을 닫거나 앱을 꺼도 그대로
   - 위쪽 [상담사에게 보내기]를 눌러야 창구에 저장돼 모든 PC에 반영(1분 안). 보내기 전에 ‘바뀐 곳’을 한눈에 보고 하나씩 되돌릴 수 있음
   - 그 사이 다른 PC에서 멘트가 바뀌면 최신 판 위에 내 수정만 다시 얹음(script-diff.js rebase) */
(function(){'use strict';
 const $=id=>document.getElementById(id);
 const send=m=>KBAdmin.handle(m);
 const SD=globalThis.ScriptDiff;
 const HG=globalThis.DeskHangul||{cho:()=>'',tester:t=>({t,choOnly:false,test:x=>String(x||'').includes(t)})};
 ReplyTheme.watch({apply:m=>{document.documentElement.dataset.theme=m;}});
 const DRAFT_KEY='rgScriptDraft';
 const T_GUIDE='[접수 후 처리 안내]',T_URL='[인입 채널별 접수 경로]';
 const ICON={
  edit:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16l.6-3.2L13 4.4a1.4 1.4 0 0 1 2 0l.6.6a1.4 1.4 0 0 1 0 2L7.2 15.4 4 16Z"/></svg>',
  trash:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 6h11M8 6V4.5h4V6M6 6l.6 9.5h6.8L14 6M8.5 9v4M11.5 9v4"/></svg>'
 };
 function mk(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;}
 function btn(label,cls,fn){const b=mk('button','btn '+(cls||'ghost'),label);b.type='button';if(fn)b.addEventListener('click',fn);return b;}
 const rid=p=>p+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-3);
 const norm=s=>String(s||'').toLowerCase();

 /* ───── 상태 ───── */
 let pubVer=0,minVer=0,fromServer=false,status={},base=null,draft=null,D=null,B=null;   // D: 바뀐 곳(diff) · B: base 색인
 let view='cards',catId='',sel='',composing=false,busy=false,histItems=null,knowVer='',svcUrl='https://as.apps.spigen.com/';
 const cats=()=>draft?draft.categories:[];
 const catOf=id=>cats().find(c=>c.id===id)||null;
 function findCard(id){for(const c of cats()){const i=c.cards.findIndex(k=>k.id===id);if(i>=0)return{c,i,k:c.cards[i]};}return null;}
 const isNew=id=>!B.cards.has(id);

 /* ───── 알림 · 대화 창 ───── */
 let toastT=0;
 function say(text,kind,act){const t=$('toast');t.replaceChildren(mk('span',null,text));t.className='toast'+(kind?' '+kind:'');
  if(act){const b=mk('button',null,act.label);b.type='button';b.addEventListener('click',()=>{t.hidden=true;act.fn();});t.append(b);}
  t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>{t.hidden=true;},act?8000:4200);}
 function dialog(build){
  return new Promise(res=>{
   const d=mk('dialog','dlg');let out=null;const close=v=>{out=v;d.close();};
   build(d,close);document.body.append(d);
   d.addEventListener('close',()=>{d.remove();res(out);});
   d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close(null);});
   d.showModal();
  });
 }
 function confirmDlg(title,text,ok,danger){
  return dialog((d,close)=>{d.append(mk('h3',null,title));if(text)d.append(mk('p',null,text));
   const a=mk('div','acts');const y=btn(ok||'확인',danger?'danger':'primary',()=>close(true));a.append(btn('취소','ghost',()=>close(null)),y);d.append(a);setTimeout(()=>y.focus(),0);}).then(v=>!!v);
 }

 /* ───── 불러오기 · 임시 저장 ───── */
 let saveT=0;
 function persist(now){clearTimeout(saveT);const run=()=>{if(!draft||!base)return;
   if(D&&D.count)chrome.storage.local.set({[DRAFT_KEY]:{baseVer:pubVer,base,draft,at:Date.now(),count:D.count}}).catch(()=>{});
   else chrome.storage.local.remove(DRAFT_KEY).catch(()=>{});};
  if(now)run();else saveT=setTimeout(run,250);}
 window.addEventListener('blur',()=>persist(true));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)persist(true);});
 function banner(html,canDiscard){const b=$('banner');b.replaceChildren();if(!html){b.hidden=true;return;}
  const s=mk('span');s.innerHTML=html;b.append(s);
  const x=mk('button','x','닫기');x.type='button';x.addEventListener('click',()=>{b.hidden=true;});b.append(x);b.hidden=false;void canDiscard;}
 async function load(first){
  const r=await send({type:'KNOW_DATA',since:knowVer}).catch(()=>null);
  if(r&&r.ok&&r.unchanged){status=r.status||status;if(base)renderTop();return;} // 멘트·문의 자료는 그대로(상태만 바뀜) — 큰 자료를 매번 다시 받지 않음
  if(r&&r.ok)knowVer=r.version||'';
  if(!r||!r.ok){if(first)$('edit').replaceChildren(mk('div','hello','멘트를 불러오지 못했어요. '+((r&&r.error)||'인터넷 연결을 확인하고')+' 창을 닫고 다시 열어 주세요.\n(왼쪽 아래 ‘깃허브 연결’에서 연결 상태를 볼 수 있어요)'));KBAdminExtra.offline&&KBAdminExtra.offline(r&&r.error);return;}
  status=r.status||{};const sc=r.scripts||{};const ver=Number(sc.version)||0;
  if(sc.config&&sc.config.serviceUrl)svcUrl=String(sc.config.serviceUrl);
  if(!status.admin){KBAdminExtra.connectScreen();return;}
  if(ver<minVer)return; // 방금 보낸 판보다 옛 자료는 무시(받는 중)
  const pub=SD.clean(sc);
  if(!base){
   pubVer=ver;fromServer=!!sc.fromServer;base=pub;B=SD.index(base);draft=SD.clone(pub);
   const st=(await chrome.storage.local.get(DRAFT_KEY).catch(()=>({})))[DRAFT_KEY];
   if(st&&st.draft&&st.base&&Array.isArray(st.draft.categories)){
    if(Number(st.baseVer)===ver){draft=SD.clean(st.draft);const n=SD.diff(base,draft).count;if(n)banner('<b>보내지 않은 수정 '+n+'개</b>를 이어서 불러왔어요. 다 고쳤으면 위쪽 <b>[상담사에게 보내기]</b>를 눌러 주세요.');}
    else{const rb=SD.rebase(SD.clean(st.base),SD.clean(st.draft),pub);draft=rb.data;rebased(ver,rb.both);}
   }
  }else if(ver!==pubVer){
   const had=D&&D.count;
   if(had){const rb=SD.rebase(base,draft,pub);draft=rb.data;rebased(ver,rb.both);}else draft=SD.clone(pub);
   pubVer=ver;fromServer=!!sc.fromServer;base=pub;B=SD.index(base);
   if(sel&&!findCard(sel))sel='';if(catId&&!catOf(catId))catId='';
  }else{fromServer=!!sc.fromServer;renderTop();return;}
  changed();render();
 }
 function rebased(ver,both){banner('그 사이 다른 PC에서 멘트가 바뀌었어요(<b>'+ver+'판</b>). 내 수정은 최신 판 위에 그대로 얹어 두었어요.'+(both&&both.length?' 같은 멘트를 둘 다 고친 것: <b>'+both.slice(0,3).map(esc).join(', ')+(both.length>3?' 외 '+(both.length-3)+'개':'')+'</b> — 내 것으로 두었으니 한 번 확인해 주세요.':''));}
 const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 function changed(){D=SD.diff(base,draft);persist();renderTop();}

 /* ───── 위쪽 막대 ───── */
 function renderTop(){
  const at=String(status.scriptsAt||'').slice(5,16),by=status.scriptsBy||'';
  $('live').textContent=fromServer?('상담사가 지금 보는 멘트 · '+pubVer+'판'+(at?' · '+at:'')+(by?' '+by:'')):'상담사는 지금 기본 멘트를 보고 있어요 · 아직 보낸 적 없음';
  const n=D?D.count:0,c=$('chg');c.textContent=n?('바뀐 곳 '+n+'개 · 아직 안 보냄'):'바뀐 곳 없음';c.classList.toggle('on',!!n);
  $('review').hidden=!n;$('publish').disabled=!n||busy;
  const cl=document.querySelector('.navx[data-view="closings"]'),gd=document.querySelector('.navx[data-view="guide"]');
  if(cl)cl.classList.toggle('mod',!!(D&&D.closings));if(gd)gd.classList.toggle('mod',!!(D&&(D.guide||D.phrases)));
  $('nClosings').textContent=draft?String((draft.closings||[]).length):'';
  document.title=(n?'● ':'')+'멘트 관리';
 }

 /* ───── 왼쪽: 분류 ───── */
 let renaming='';
 function total(){let n=0;for(const c of cats())n+=c.cards.length;return n;}
 function catDirty(c){if(!B.cats.has(c.id))return true;const b=B.cats.get(c.id).cat;if(b.name!==c.name)return true;
  if(c.cards.length!==b.cards.length)return true;return c.cards.some(k=>SD.cardState(B,k,c.id))||SD.orderChanged(base,draft,c.id);}
 function renderCats(){
  const box=$('catList');box.replaceChildren();
  const all=mk('div','cat all');all.setAttribute('role','button');all.tabIndex=0;all.setAttribute('aria-current',String(view==='cards'&&catId===''));
  all.append(mk('span','grip',''),mk('span','nm','전체'),mk('span','n',String(total())));
  all.addEventListener('click',()=>pickCat(''));all.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pickCat('');}});box.append(all);
  for(const c of cats()){
   const row=mk('div','cat'+(catDirty(c)?' mod':''));row.dataset.id=c.id;row.setAttribute('role','button');row.tabIndex=0;row.setAttribute('aria-current',String(view==='cards'&&catId===c.id));
   const grip=mk('span','grip','⋮⋮');grip.title='끌어서 순서 바꾸기';row.append(grip);
   if(renaming===c.id){
    const i=mk('input');i.type='text';i.value=c.name;i.maxLength=30;i.setAttribute('aria-label','분류 이름');
    const done=ok=>{if(renaming!==c.id)return;renaming='';if(ok){const n=i.value.trim().slice(0,30);if(!n){say('분류 이름을 적어 주세요','err');}else if(cats().some(x=>x!==c&&x.name===n)){say('같은 이름의 분류가 있어요','err');}else if(n!==c.name){c.name=n;changed();}}renderCats();renderRows();renderEdit();};
    i.addEventListener('keydown',e=>{if(e.isComposing)return;if(e.key==='Enter'){e.preventDefault();done(true);}else if(e.key==='Escape'){e.preventDefault();done(false);}e.stopPropagation();});
    i.addEventListener('blur',()=>done(true));i.addEventListener('click',e=>e.stopPropagation());
    row.append(i);box.append(row);setTimeout(()=>{i.focus();i.select();},0);continue;
   }
   row.append(mk('span','nm',c.name||'(이름 없음)'),mk('span','n',String(c.cards.length)));
   const tools=mk('span','tools');
   const e1=mk('button','tb');e1.type='button';e1.innerHTML=ICON.edit;e1.title='이름 바꾸기';e1.setAttribute('aria-label',c.name+' 이름 바꾸기');e1.addEventListener('click',ev=>{ev.stopPropagation();renaming=c.id;renderCats();});
   const e2=mk('button','tb');e2.type='button';e2.innerHTML=ICON.trash;e2.title='분류 지우기';e2.setAttribute('aria-label',c.name+' 지우기');e2.addEventListener('click',ev=>{ev.stopPropagation();removeCat(c);});
   tools.append(e1,e2);row.append(tools);
   row.addEventListener('click',()=>pickCat(c.id));row.addEventListener('dblclick',()=>{renaming=c.id;renderCats();});
   row.addEventListener('keydown',e=>{if(e.target!==row)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();pickCat(c.id);}else if(e.key==='F2'){e.preventDefault();renaming=c.id;renderCats();}});
   // 끌기: 분류 순서 바꾸기 · 멘트를 이 분류로 옮기기
   row.draggable=true;
   row.addEventListener('dragstart',e=>{if(renaming){e.preventDefault();return;}drag={kind:'cat',id:c.id};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',c.name);row.classList.add('dragging');});
   row.addEventListener('dragend',()=>{drag=null;clearOver();});
   row.addEventListener('dragover',e=>{if(!drag)return;e.preventDefault();clearOver();if(drag.kind==='card')row.classList.add('drop');else if(drag.id!==c.id)row.classList.add(half(e,row)?'over-top':'over-bot');});
   row.addEventListener('dragleave',()=>row.classList.remove('drop','over-top','over-bot'));
   row.addEventListener('drop',e=>{if(!drag)return;e.preventDefault();const top=half(e,row);const g=drag;drag=null;clearOver();
    if(g.kind==='card')moveCard(g.id,c.id,0,true);else moveCat(g.id,c.id,top);});
   box.append(row);
  }
  for(const b of document.querySelectorAll('.navx'))b.setAttribute('aria-current',String(view===b.dataset.view));
 }
 let drag=null;
 const half=(e,el)=>{const r=el.getBoundingClientRect();return e.clientY<r.top+r.height/2;};
 function clearOver(){for(const x of document.querySelectorAll('.over-top,.over-bot,.drop,.dragging'))x.classList.remove('over-top','over-bot','drop','dragging');}
 function leaveCard(){ // 아무것도 안 적은 새 멘트는 다른 곳으로 가면 조용히 치움
  if(!sel)return;const f=findCard(sel);if(f&&isNew(sel)&&!String(f.k.title).trim()&&!String(f.k.script).trim()){f.c.cards.splice(f.i,1);sel='';changed();}}
 function pickCat(id){leaveCard();view='cards';catId=id;$('q').value='';const f=sel&&findCard(sel);if(f&&id&&f.c.id!==id)sel='';render();}
 function moveCat(id,beforeId,top){const a=cats(),i=a.findIndex(c=>c.id===id);if(i<0||id===beforeId)return;const [c]=a.splice(i,1);let j=a.findIndex(x=>x.id===beforeId);if(j<0)j=a.length;a.splice(top?j:j+1,0,c);changed();render();}
 function uniqueName(n){let i=1,x=n;while(cats().some(c=>c.name===x))x=n+' '+(++i);return x;}
 $('addCat').addEventListener('click',()=>{leaveCard();const c={id:rid('c_'),name:uniqueName('새 분류'),cards:[]};cats().push(c);view='cards';catId=c.id;sel='';renaming=c.id;changed();render();const el=$('catList').lastElementChild;if(el)el.scrollIntoView({block:'nearest'});});
 async function removeCat(c){
  const i=cats().indexOf(c);if(i<0)return;
  if(!c.cards.length){cats().splice(i,1);if(catId===c.id)catId='';changed();render();say('‘'+c.name+'’ 분류를 지웠어요','',{label:'되돌리기',fn:()=>{cats().splice(Math.min(i,cats().length),0,c);changed();render();}});return;}
  const others=cats().filter(x=>x!==c);
  const r=await dialog((d,close)=>{
   d.append(mk('h3',null,'‘'+c.name+'’ 분류를 지울까요?'),mk('p',null,'이 분류에 멘트가 '+c.cards.length+'개 있어요. 멘트를 어떻게 할지 골라 주세요.'));
   let s=null;if(others.length){const l=mk('div','lab','멘트를 옮길 분류');s=mk('select','sel');for(const o of others)s.append(new Option(o.name,o.id));d.append(l,s);}
   const a=mk('div','acts');a.append(btn('취소','ghost',()=>close(null)),btn('멘트까지 모두 지우기','danger-ghost',()=>close({del:true})));
   if(s)a.append(btn('옮기고 분류 지우기','primary',()=>close({to:s.value})));d.append(a);});
  if(!r)return;
  if(r.to){const to=catOf(r.to);if(!to)return;to.cards.push(...c.cards);c.cards=[];}
  cats().splice(cats().indexOf(c),1);if(catId===c.id)catId=r.to||'';if(sel&&!findCard(sel))sel='';changed();render();
  say(r.to?'멘트를 옮기고 분류를 지웠어요':'분류와 멘트를 지웠어요');
 }

 /* ───── 가운데: 멘트 목록 ───── */
 const tokens=()=>norm($('q').value).split(/\s+/).filter(Boolean).slice(0,8);
 function listRows(){
  const toks=tokens();let rows=[];
  for(const c of cats())for(const k of c.cards)rows.push({k,c});
  if(toks.length){const tm=toks.map((t,i)=>HG.tester(t,{partial:composing&&i===toks.length-1}));
   rows=rows.filter(r=>{const hay=norm([r.k.title,r.k.group,r.k.script,r.c.name].join(' ')),hc=hay.replace(/\s+/g,''),ch=HG.cho(r.k.title||'');return tm.every(m=>m.test(hay)||(m.t.length>=2&&m.test(hc))||(m.choOnly&&ch.includes(m.t)));});
  }else if(catId)rows=rows.filter(r=>r.c.id===catId);
  if(expiredOnly)rows=rows.filter(r=>isExpired(r.k));
  if(unusedOnly&&window.KBTeam&&KBTeam.usage.map){const U=KBTeam.usage.map;rows=rows.filter(r=>!U[r.k.id]);}
  return {rows,toks};
 }
 function hl(el,text,toks){text=String(text||'');const low=text.toLowerCase();let i=0;const t=toks.filter(Boolean);if(!t.length){el.append(text);return el;}
  while(i<text.length){let best=-1,bl=0;for(const k of t){const j=low.indexOf(k,i);if(j>=0&&(best<0||j<best||(j===best&&k.length>bl))){best=j;bl=k.length;}}
   if(best<0){el.append(text.slice(i));break;}if(best>i)el.append(text.slice(i,best));el.append(mk('mark',null,text.slice(best,best+bl)));i=best+bl;}return el;}
 function renderRows(){
  const box=$('rows');const keep=box.scrollTop;box.replaceChildren();if(view!=='cards')return;
  const {rows,toks}=listRows();const searching=toks.length>0;
  const c0=catOf(catId);
  $('midinfo').replaceChildren(mk('span',null,searching?('모든 분류에서 '+rows.length+'개 찾음'):((c0?c0.name:'전체')+' · 멘트 '+rows.length+'개')),mk('span',null,searching||!rows.length||expiredOnly?'':'· 끌어서 순서 바꾸기'));
  {let ex=0;for(const c of cats())for(const k of c.cards)if(isExpired(k))ex++;
   const U=window.KBTeam&&KBTeam.usage.map;if(U){let un=0;for(const c of cats())for(const k of c.cards)if(!U[k.id])un++;
    const b2=mk('button','exbtn use'+(unusedOnly?' on':''),unusedOnly?'30일 안 쓴 것만 보는 중 · 모두 보기':'30일 안 쓴 멘트 '+un+'개');b2.type='button';b2.title='최근 30일 동안 아무도 담거나 교체하지 않은 멘트예요. 지울지 살펴보세요';b2.addEventListener('click',()=>{unusedOnly=!unusedOnly;renderRows();});$('midinfo').append(mk('span','sp'),b2);}
   if(ex||expiredOnly){const b=mk('button','exbtn'+(expiredOnly?' on':''),expiredOnly?'기간 끝난 것만 보는 중 · 모두 보기':'기간 끝난 멘트 '+ex+'개');b.type='button';b.title='끝나는 날이 지나 상담사 화면에서 숨겨진 멘트예요. 지우거나 날짜를 바꿔 주세요';b.addEventListener('click',()=>{expiredOnly=!expiredOnly;renderRows();});if(!$('midinfo').querySelector('.sp'))$('midinfo').append(mk('span','sp'));$('midinfo').append(b);}}
  if(!rows.length){box.append(mk('div','empty',searching?'찾는 멘트가 없어요.\n다른 말로 찾아보세요.':c0?'이 분류에는 아직 멘트가 없어요.\n위쪽 [+ 새 멘트]로 만들어 보세요.':'멘트가 없어요.\n[+ 새 멘트]로 만들어 보세요.'));return;}
  let lastCat='';
  for(const {k,c} of rows){
   if(!catId&&!searching&&c.id!==lastCat){box.append(mk('div','rowsep',c.name));lastCat=c.id;}
   const row=mk('div','row');row.dataset.id=k.id;row.setAttribute('role','button');row.tabIndex=0;row.setAttribute('aria-current',String(sel===k.id));
   const grip=mk('span','grip',searching?'':'⋮⋮');if(!searching)grip.title='끌어서 순서 바꾸기 · 왼쪽 분류에 놓으면 그 분류로 옮겨요';
   const tx=mk('div','tx'),t=mk('div','t');const title=String(k.title||'').trim();
   t.append(hl(mk('b',title?null:'none'),title||'(제목 없음)',toks));
   const st=SD.cardState(B,k,c.id);if(st==='new')t.append(mk('span','chip new','새 멘트'));else if(st==='changed')t.append(mk('span','chip chg','고침'));
   if(!String(k.script||'').trim())t.append(mk('span','chip err','내용 없음'));
   {const U=window.KBTeam&&KBTeam.usage.map;if(U){const n=U[k.id]||0,uc=mk('span','chip '+(n?'use':'unused'),n?'30일 '+n+'회':'30일 안 씀');uc.title='최근 30일 동안 상담사가 담거나 교체한 횟수(팀 서버 사용 통계)';t.append(uc);}}
   if(k.until){const ex=isExpired(k),u=mk('span','chip '+(ex?'err':'cat'),ex?'기간 끝남':'~'+String(k.until).slice(5).replace('-','/'));u.title=ex?k.until+'에 끝났어요. 상담사 화면에서는 숨겨져 있어요':k.until+'까지 보여요';t.append(u);}
   if(searching)t.append(mk('span','chip cat',c.name));
   let sn=String(k.script||'').replace(/\s+/g,' ').trim();
   if(toks.length){const low=sn.toLowerCase();let at=-1;for(const x of toks){const j=low.indexOf(x);if(j>=0&&(at<0||j<at))at=j;}if(at>40)sn='… '+sn.slice(at-16);}
   tx.append(t,hl(mk('div','s'),sn.slice(0,160),toks));row.append(grip,tx);
   row.addEventListener('click',()=>pickCard(k.id));
   row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pickCard(k.id,true);}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const n=e.key==='ArrowDown'?row.nextElementSibling:row.previousElementSibling;let x=n;while(x&&!x.classList.contains('row'))x=e.key==='ArrowDown'?x.nextElementSibling:x.previousElementSibling;if(x){x.focus();}}});
   if(!searching){row.draggable=true;
    row.addEventListener('dragstart',e=>{drag={kind:'card',id:k.id};e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',k.title||'');row.classList.add('dragging');});
    row.addEventListener('dragend',()=>{drag=null;clearOver();});
    row.addEventListener('dragover',e=>{if(!drag||drag.kind!=='card'||drag.id===k.id)return;e.preventDefault();clearOver();row.classList.add(half(e,row)?'over-top':'over-bot');});
    row.addEventListener('dragleave',()=>row.classList.remove('over-top','over-bot'));
    row.addEventListener('drop',e=>{if(!drag||drag.kind!=='card')return;e.preventDefault();const top=half(e,row);const g=drag;drag=null;clearOver();const f=findCard(k.id);if(!f||g.id===k.id)return;moveCard(g.id,f.c.id,k.id,top);});}
   box.append(row);
  }
  box.scrollTop=keep;
 }
 /* 멘트 옮기기: (id)를 분류 toCat의 ref 멘트 앞(top)·뒤로. ref가 0이면 맨 위 */
 function moveCard(id,toCat,ref,top){
  const f=findCard(id),to=catOf(toCat);if(!f||!to)return;
  const from=f.c;from.cards.splice(f.i,1);
  let j=0;if(ref){j=to.cards.findIndex(k=>k.id===ref);if(j<0)j=to.cards.length;else if(!top)j++;}
  to.cards.splice(j,0,f.k);changed();
  if(from!==to){say('‘'+(f.k.title||'멘트')+'’를 ‘'+to.name+'’(으)로 옮겼어요');if(catId&&catId!==to.id&&sel===id)sel='';}
  render();
 }
 function pickCard(id,focus){if(sel!==id)leaveCard();sel=id;renderRows();renderEdit();if(focus){const t=document.querySelector('#edit .ta');if(t)t.focus();}}
 function newCard(){
  leaveCard();if(view!=='cards')view='cards';
  let c=catOf(catId)||(sel&&findCard(sel)?findCard(sel).c:null)||cats()[0];
  if(!c){c={id:rid('c_'),name:'새 분류',cards:[]};cats().push(c);}
  const k={id:rid('k_'),title:'',group:'',script:'',note:''};c.cards.unshift(k);$('q').value='';if(catId)catId=c.id;sel=k.id;changed();render();
  const r0=document.querySelector('#rows .row[aria-current="true"]');if(r0)r0.scrollIntoView({block:'nearest'});const t=document.querySelector('#edit .in.title');if(t)t.focus();
 }
 $('addCard').addEventListener('click',newCard);
 const q=$('q');
 q.addEventListener('input',()=>{renderRows();});
 q.addEventListener('compositionstart',()=>{composing=true;});q.addEventListener('compositionend',()=>{composing=false;renderRows();});
 q.addEventListener('keydown',e=>{if(e.key==='Escape'&&q.value){e.preventDefault();q.value='';renderRows();}else if(e.key==='ArrowDown'){const r=document.querySelector('#rows .row');if(r){e.preventDefault();r.focus();}}});

 /* ───── 오른쪽: 고치는 칸 ───── */
 const guide=()=>String((draft.config||{}).processingGuide||'').trim();
 const phrases=()=>{const c=draft.config||(draft.config={});if(!Array.isArray(c.phrases))c.phrases=[];return c.phrases;};
 const phraseOf=key=>phrases().find(p=>String(p.key).trim()===String(key).trim()&&String(p.text).trim())||null;
 const usesOf=key=>{let n=0;const t='{'+key+'}';for(const c of cats())for(const k of c.cards)if(String(k.script).includes(t))n++;return n;};
 /* 비슷한 멘트: 글자 3개씩 묶어 겹치는 정도(띄어쓰기 무시) */
 const grams=s=>{s=String(s||'').replace(/\s+/g,'');const g=new Set();for(let i=0;i<s.length-2;i++)g.add(s.slice(i,i+3));return g;};
 function similarTo(k){const a=grams(k.script);if(a.size<15)return [];const out=[];
  for(const c of cats())for(const x of c.cards){if(x.id===k.id)continue;const b=grams(x.script);if(!b.size)continue;let both=0;for(const g of a)if(b.has(g))both++;
   const jac=both/(a.size+b.size-both),cont=both/Math.min(a.size,b.size);if(jac>=0.5||cont>=0.8)out.push({k:x,c,score:Math.round(Math.max(jac,cont)*100)});}
  return out.sort((p,q)=>q.score-p.score).slice(0,3);}
 const today=()=>KBData.todayKey();
 const isExpired=k=>/^\d{4}-\d{2}-\d{2}$/.test(String(k.until||''))&&String(k.until)<today();
 let expiredOnly=false,unusedOnly=false;
 function previewInto(el,raw){
  el.replaceChildren();const text=String(raw||'').replace(/\r\n?/g,'\n');
  const parts=text.split(/(\[접수 후 처리 안내\]|\[인입 채널별 접수 경로\]|\{[^{}\n]{1,20}\})/);
  for(const p of parts){
   if(p===T_GUIDE&&guide()){const s=mk('span','auto',guide());s.title='‘공통 문구 → 접수 후 처리 안내’가 들어간 자리예요';el.append(s);continue;}
   if(p===T_URL){const s=mk('span','auto',svcUrl);s.title='접수 주소가 들어간 자리예요';el.append(s);continue;}
   if(/^\{[^{}\n]{1,20}\}$/.test(p)){const ph=phraseOf(p.slice(1,-1));const s=mk('span',ph?'auto':'auto bad',ph?ph.text:p+' (없는 공통 문구)');s.title=ph?'공통 문구 {'+ph.key+'}가 들어간 자리예요':'공통 문구에 이 이름이 없어요. 왼쪽 ‘공통 문구’에서 만들어 주세요';el.append(s);continue;}
   let pos=0;for(const b of DraftCheck.find(p)){el.append(p.slice(pos,b.start));const m=mk('mark',null,b.text);m.title='상담사가 채우는 빈칸(작성 공간에서 F2)';el.append(m);pos=b.end;}el.append(p.slice(pos));
  }
 }
 function renderEdit(){
  const box=$('edit');$('mid').hidden=view!=='cards';box.hidden=view!=='cards';$('wide').hidden=view==='cards';
  if(view!=='cards'){renderWide();return;}
  const f=sel?findCard(sel):null;
  if(!f){box.replaceChildren(hello());return;}
  const k=f.k,form=mk('div','form');
  // 머리: 상태 + 어디에 있는지
  const head=mk('div','fhead');let headSt=null;
  const paintHead=()=>{const x=findCard(k.id);const st=x?SD.cardState(B,k,x.c.id):'';if(st===headSt)return;headSt=st;head.replaceChildren();
   if(st==='new')head.append(mk('span','chip new','새 멘트'));else if(st==='changed')head.append(mk('span','chip chg','고침'));
   head.append(mk('span','where',st?'아직 상담사에게 보내지 않았어요':'상담사가 보는 것과 같아요'),mk('span','sp'));
   if(st==='changed'){const r=btn('원래대로','ghost sm',()=>{draft=SD.revert(base,draft,{kind:'changed',id:k.id});changed();if(!findCard(k.id))sel='';render();say('원래대로 되돌렸어요');});r.id='revertCard';r.title='상담사가 지금 보는 내용으로 되돌려요';r.addEventListener('mousedown',e=>e.preventDefault());head.append(r);}};
  paintHead();form.append(head);
  // 제목 + 분류
  const two=mk('div','two');
  const fT=mk('div');const title=mk('input','in title');title.type='text';title.value=k.title;title.placeholder='예: 교환 접수 안내';title.maxLength=80;title.setAttribute('aria-label','제목');
  fT.append(lab('제목','상담사가 목록에서 보고 찾는 이름'),title);
  const fC=mk('div');const cs=mk('select','sel');cs.setAttribute('aria-label','분류');for(const c of cats())cs.append(new Option(c.name,c.id));cs.value=f.c.id;
  fC.append(lab('분류'),cs);two.append(fT,fC);form.append(two);
  // 내용
  const fB=mk('div');const lb=lab('멘트 내용','고객에게 보낼 글 그대로');const cnt=mk('span','cnt');lb.append(cnt);
  const ta=mk('textarea','ta');ta.value=k.script;ta.placeholder='안녕하세요, 고객님. 슈피겐입니다.\n\n…';ta.setAttribute('aria-label','멘트 내용');ta.spellcheck=false;
  const ins=mk('div','ins');ins.append(mk('span',null,'눌러서 넣기'));
  const chip=(label,text,tip)=>{const b=mk('button',null,label);b.type='button';b.title=tip;b.addEventListener('mousedown',e=>e.preventDefault());b.addEventListener('click',()=>{const s=ta.selectionStart,e=ta.selectionEnd;ta.setRangeText(text,s,e,'end');ta.focus();ta.dispatchEvent(new Event('input'));});ins.append(b);};
  chip('접수 주소',T_URL,'교환·반품·A/S 접수 주소('+svcUrl+')로 바뀌어요');
  for(const ph of phrases())if(String(ph.key).trim())chip('{'+ph.key+'}','{'+ph.key+'}','공통 문구 ‘'+ph.key+'’ — 상담사 화면에서는 왼쪽 ‘공통 문구’에 적은 글로 바뀌어요');
  chip('빈칸: O월 O일','O월 O일','상담사가 채워야 하는 자리. 작성 공간에서 F2로 바로 찾아가고, 안 채우고 복사하면 알려 줘요');
  chip('빈칸: OOO님','OOO님','상담사가 채워야 하는 자리(고객 이름)');
  const sim=mk('div','sim');sim.hidden=true;
  fB.append(lb,ta,ins,sim);form.append(fB);
  // 미리보기
  const pv=mk('div','pv'),pb=mk('div','pb');pv.append(mk('div','ph','상담사 화면에서는 이렇게 보여요'),pb);form.append(pv);
  // 더 적기
  const more=mk('details','more');const sum=mk('summary',null,'대분류 · 주의사항 · 끝나는 날 (선택)');const inner=mk('div','inner');
  const g=mk('input','in');g.type='text';g.value=k.group;g.placeholder='예: 필름, 교환·반품';g.maxLength=40;g.setAttribute('aria-label','검색용 꼬리표');
  const n=mk('input','in');n.type='text';n.value=k.note;n.placeholder='상담사 화면에만 보이는 주의사항 (고객에게는 안 보내요)';n.maxLength=1000;n.setAttribute('aria-label','주의사항');
  const d1=mk('div');d1.append(lab('대분류 · 검색용 꼬리표','상담사 화면 문안 위에 작게 보이고, 이 말로 찾아도 나와요'),g);const d2=mk('div');d2.append(lab('주의사항','상담사 화면 문안 아래에 보여요'),n);
  const u=mk('input','in');u.type='date';u.value=k.until||'';u.setAttribute('aria-label','끝나는 날');u.style.maxWidth='200px';
  const uc=mk('button','btn ghost sm','지우기');uc.type='button';uc.hidden=!k.until;
  const d3=mk('div');const uw=mk('div','urow');uw.append(u,uc);d3.append(lab('끝나는 날','행사·이슈처럼 기간이 있는 멘트만. 이 날이 지나면 상담사 화면에서 저절로 숨겨지고, 여기 목록에는 ‘기간 끝남’으로 남아요'),uw);
  inner.append(d1,d2,d3);more.append(sum,inner);if(k.group||k.note||k.until)more.open=true;form.append(more);
  // 아래 버튼
  const acts=mk('div','facts');
  const up=btn('위로','ghost sm',()=>step(-1)),dn=btn('아래로','ghost sm',()=>step(1));up.title='목록에서 한 칸 위로 (Alt+↑)';dn.title='목록에서 한 칸 아래로 (Alt+↓)';
  const step=dir=>{const x=findCard(k.id);if(!x)return;const j=x.i+dir;if(j<0||j>=x.c.cards.length)return;x.c.cards.splice(x.i,1);x.c.cards.splice(j,0,k);changed();renderCats();renderRows();const r=document.querySelector('#rows .row[aria-current="true"]');if(r)r.scrollIntoView({block:'nearest'});};
  form.rgStep=step;
  acts.append(up,dn,btn('복제','ghost sm',()=>{const x=findCard(k.id);const c2={...SD.clone(k),id:rid('k_'),title:(k.title?k.title+' ':'')+'(복사)'};x.c.cards.splice(x.i+1,0,c2);sel=c2.id;changed();render();say('복제했어요. 제목과 내용을 고쳐 주세요');}),mk('span','sp'),
   btn('이 멘트 지우기','danger-ghost sm',()=>{const x=findCard(k.id);if(!x)return;x.c.cards.splice(x.i,1);sel='';changed();render();
    say('‘'+(k.title||'멘트')+'’를 지웠어요','',{label:'되돌리기',fn:()=>{const c=catOf(x.c.id)||cats()[0];if(!c)return;c.cards.splice(Math.min(x.i,c.cards.length),0,k);sel=k.id;changed();render();}});}));
  form.append(acts);
  box.replaceChildren(form);
  // 값 바뀜
  const paint=()=>{cnt.textContent=k.script.length?k.script.length.toLocaleString()+'자':'';previewInto(pb,k.script);ta.classList.toggle('bad',!k.script.trim()&&(!!k.title.trim()||!isNew(k.id)));};
  const on=()=>{changed();renderCats();renderRows();paint();paintHead();};
  title.addEventListener('input',()=>{k.title=title.value;on();});
  ta.addEventListener('input',()=>{k.script=ta.value.replace(/\r\n?/g,'\n');on();});
  g.addEventListener('input',()=>{k.group=g.value;on();});n.addEventListener('input',()=>{k.note=n.value;on();});
  u.addEventListener('change',()=>{k.until=u.value||'';uc.hidden=!k.until;on();});uc.addEventListener('click',()=>{u.value='';k.until='';uc.hidden=true;on();});
  let simT=0;const paintSim=()=>{const list=similarTo(k);sim.replaceChildren();sim.hidden=!list.length;if(!list.length)return;
   sim.append(mk('span','sl','비슷한 멘트가 있어요'));
   for(const x of list){const b=mk('button','sb');b.type='button';b.append(mk('b',null,x.k.title||'(제목 없음)'),mk('span',null,x.c.name+' · '+x.score+'%'));b.title='눌러서 그 멘트 보기';b.addEventListener('click',()=>pickCard(x.k.id));sim.append(b);}};
  ta.addEventListener('input',()=>{clearTimeout(simT);simT=setTimeout(paintSim,350);});paintSim();
  for(const el of [title,g,n])el.addEventListener('blur',()=>{const v=el.value.trim();if(v!==el.value){el.value=v;el.dispatchEvent(new Event('input'));}});
  cs.addEventListener('change',()=>{const to=catOf(cs.value);if(!to)return;const x=findCard(k.id);x.c.cards.splice(x.i,1);to.cards.unshift(k);if(catId)catId=to.id;changed();render();say('‘'+to.name+'’(으)로 옮겼어요');});
  paint();
 }
 function lab(t,hint){const l=mk('div','lab',t);if(hint)l.append(mk('small',null,hint));return l;}
 function hello(){
  const h=mk('div','hello');h.append(mk('h2',null,'고칠 멘트를 골라 주세요'));
  const ul=mk('ul');for(const t of ['가운데 목록에서 멘트를 누르면 여기서 바로 고칠 수 있어요. 따로 [완료]를 누를 필요가 없어요.','고친 내용은 이 PC에 임시로 남아요. 창을 닫아도 사라지지 않아요.','다 고쳤으면 오른쪽 위 [상담사에게 보내기]를 눌러 주세요. 2분 안에 모든 상담사 PC에 반영돼요.','멘트와 분류는 끌어서 순서를 바꾸고, 멘트를 왼쪽 분류에 놓으면 그 분류로 옮겨져요.'])ul.append(mk('li',null,t));
  h.append(ul);return h;
 }

 /* ───── 넓은 화면: 끝인사 · 공통 문구 · 이전 판 ───── */
 for(const b of document.querySelectorAll('.navx'))b.addEventListener('click',()=>{leaveCard();view=b.dataset.view;render();if(view==='history')loadHistory();});
 function renderWide(){
  const w=$('wide');w.replaceChildren();
  if(view==='closings'){
   w.append(mk('h2',null,'끝인사'),mk('p','desc','대화를 마칠 때 쓰는 인사예요. 작성 공간의 초성 단축어를 처음 만들 때 기본값으로 들어가요. 이름과 내용을 고치면 바로 임시 저장돼요.'));
   const p=mk('div','panel');const list=draft.closings;
   list.forEach((c,i)=>{const r=mk('div','clrow');const t=mk('input','in');t.type='text';t.value=c.title;t.placeholder='이름 (예: 일반 끝인사)';t.setAttribute('aria-label','끝인사 이름');
    const b=mk('textarea','ta');b.value=c.body;b.placeholder='끝인사 내용';b.setAttribute('aria-label','끝인사 내용');
    const x=mk('button','tb');x.type='button';x.innerHTML=ICON.trash;x.title='이 끝인사 지우기';x.setAttribute('aria-label','끝인사 지우기');
    t.addEventListener('input',()=>{c.title=t.value;changed();});b.addEventListener('input',()=>{c.body=b.value.replace(/\r\n?/g,'\n');changed();});
    x.addEventListener('click',()=>{list.splice(i,1);changed();renderWide();say('끝인사를 지웠어요','',{label:'되돌리기',fn:()=>{list.splice(Math.min(i,list.length),0,c);changed();renderWide();}});});
    r.append(t,b,x);p.append(r);});
   if(!list.length)p.append(mk('div','empty','끝인사가 없어요.'));
   const add=btn('+ 끝인사 추가','ghost',()=>{list.push({id:rid('closing_'),title:'',body:''});changed();renderWide();const all=w.querySelectorAll('.clrow .in');if(all.length)all[all.length-1].focus();});add.style.alignSelf='flex-start';p.append(add);
   if(D&&D.closings){const rv=btn('끝인사 원래대로','ghost sm',()=>{draft=SD.revert(base,draft,{kind:'closings'});changed();renderWide();});rv.style.alignSelf='flex-start';p.append(rv);}
   w.append(p);return;
  }
  if(view==='guide'){
   let uses=0;for(const c of cats())for(const k of c.cards)if(String(k.script).includes(T_GUIDE))uses++;
   w.append(mk('h2',null,'공통 문구'),mk('p','desc','계좌번호·매장 안내·카톡 링크처럼 여러 멘트에 똑같이 들어가는 글을 여기 한 곳에 적어 두세요. 멘트 내용에 {이름}을 넣으면(고치는 칸의 단추로 넣을 수 있어요) 상담사 화면에서는 아래 글로 바뀌어 보여요. 여기만 고치면 그 멘트가 모두 바뀌어요.'));
   const p=mk('div','panel');const list=phrases();
   list.forEach((ph,i)=>{const r=mk('div','phrow');
    const key=mk('input','in');key.type='text';key.value=ph.key||'';key.placeholder='이름 (예: 계좌)';key.maxLength=20;key.setAttribute('aria-label','공통 문구 이름');
    const body=mk('textarea','ta');body.value=ph.text||'';body.placeholder='들어갈 글 (예: 기업은행 666-005246-01-014 (주)슈피겐코리아)';body.setAttribute('aria-label','공통 문구 내용');
    const n=usesOf(String(ph.key||'').trim()),info=mk('div','phinfo');const paintInfo=()=>{const kk=String(ph.key||'').trim();info.textContent=kk?('멘트에 {'+kk+'} 로 넣기 · 지금 멘트 '+usesOf(kk)+'개에 들어가 있어요'):'이름을 적어 주세요';};paintInfo();
    let was=String(ph.key||'').trim();
    key.addEventListener('change',()=>{const nk=key.value.replace(/[{}]/g,'').trim().slice(0,20);key.value=nk;
     if(nk&&list.some(x=>x!==ph&&String(x.key).trim()===nk)){say('같은 이름의 공통 문구가 있어요','err');key.value=was;return;}
     // 이름을 바꾸면 멘트 안의 {옛 이름}도 함께 바꿈
     if(was&&nk&&was!==nk){let m=0;for(const c of cats())for(const k of c.cards){const t='{'+was+'}';if(String(k.script).includes(t)){k.script=String(k.script).split(t).join('{'+nk+'}');m++;}}if(m)say('멘트 '+m+'개의 {'+was+'}도 {'+nk+'}로 바꿨어요');}
     ph.key=nk;was=nk;changed();paintInfo();});
    body.addEventListener('input',()=>{ph.text=body.value.replace(/\r\n?/g,'\n');changed();});
    const x=mk('button','tb');x.type='button';x.innerHTML=ICON.trash;x.title='이 공통 문구 지우기';x.setAttribute('aria-label','공통 문구 지우기');
    x.addEventListener('click',()=>{const kk=String(ph.key||'').trim(),used=kk?usesOf(kk):0;if(used){say('멘트 '+used+'개에 {'+kk+'}가 들어가 있어요. 먼저 그 멘트에서 빼 주세요(찾아 바꾸기로 한 번에 바꿀 수 있어요)','err');return;}
     list.splice(i,1);changed();renderWide();say('공통 문구를 지웠어요','',{label:'되돌리기',fn:()=>{list.splice(Math.min(i,list.length),0,ph);changed();renderWide();}});});
    const left=mk('div','phl');left.append(key,info);r.append(left,body,x);p.append(r);});
   if(!list.length)p.append(mk('div','empty','아직 공통 문구가 없어요. 자주 바뀌는 글(계좌번호, 매장 운영시간 등)부터 만들어 보세요.'));
   const add=btn('+ 공통 문구 추가','ghost',()=>{list.push({key:'',text:''});changed();renderWide();const all=w.querySelectorAll('.phrow .in');if(all.length)all[all.length-1].focus();});add.style.alignSelf='flex-start';p.append(add);
   const d2=mk('div');const u=mk('input','in');u.type='text';u.value=svcUrl;u.readOnly=true;u.setAttribute('aria-label','접수 주소');d2.append(lab('접수 주소 [인입 채널별 접수 경로]','교환·반품·A/S 접수는 이 주소 하나로 통일했어요'),u);p.append(d2);
   if(uses){const d1=mk('div');const l=lab('접수 후 처리 안내 [접수 후 처리 안내]','지금 멘트 '+uses+'개에 들어가 있어요');const ta=mk('textarea','ta');ta.value=String((draft.config||{}).processingGuide||'');ta.style.minHeight='120px';ta.setAttribute('aria-label','접수 후 처리 안내');
    ta.addEventListener('input',()=>{draft.config={...(draft.config||{}),processingGuide:ta.value.replace(/\r\n?/g,'\n')};changed();});d1.append(l,ta);p.append(d1);}
   if(D&&(D.guide||D.phrases)){const rv=btn('공통 문구 원래대로','ghost sm',()=>{if(D.phrases)draft=SD.revert(base,draft,{kind:'phrases'});if(D.guide)draft=SD.revert(base,draft,{kind:'guide'});changed();renderWide();});rv.style.alignSelf='flex-start';p.append(rv);}
   w.append(p);return;
  }
  if(KBAdminExtra.views[view]){KBAdminExtra.views[view](w);return;}
  // 이전 판
  w.append(mk('h2',null,'이전 판 · 되돌리기'),mk('p','desc','[상담사에게 보내기]를 누를 때마다 그 전 멘트가 한 판씩 남아요(최근 60판). 잘못 보냈다면 예전 판으로 되돌릴 수 있어요. 되돌린 것도 새 판으로 남아서 다시 되돌릴 수 있어요.'));
  const p=mk('div','panel');
  if(histItems===null)p.append(mk('div','empty','불러오는 중…'));
  else if(histItems==='err')p.append(mk('div','empty','이전 판을 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.'));
  else if(!histItems.length)p.append(mk('div','empty','아직 보낸 적이 없어요.\n처음 보내면 여기에 쌓여요.'));
  else for(const h of histItems){const r=mk('div','hrow'+(h.version===pubVer?' cur':''));
   r.append(mk('span','v',h.version+'판'),mk('span','muted',String(h.at||'').slice(0,16)),mk('span',null,h.by||''),mk('span','muted',h.count!=null?'멘트 '+h.count+'개':''),mk('span','note',h.note||''));r.lastChild.title=h.note||'';
   if(h.version===pubVer)r.append(mk('span','now','지금 판'));
   else if(h.version<pubVer){const b=btn('이 판으로 되돌리기','ghost sm',()=>restore(h));r.append(b);}else r.append(mk('span'));
   p.append(r);}
  w.append(p);
 }
 async function loadHistory(){histItems=null;renderWide();const r=await send({type:'ADMIN_CALL',action:'scripts.history'}).catch(()=>null);histItems=r&&r.ok?(r.items||[]):'err';if(view==='history')renderWide();}
 async function restore(h){
  if(D&&D.count){say('보내지 않은 수정이 있어요. 먼저 보내거나 [바뀐 곳 보기]에서 버린 뒤 되돌려 주세요.','err');return;}
  if(!(await confirmDlg(h.version+'판으로 되돌릴까요?','상담사가 보는 멘트가 '+h.version+'판('+String(h.at||'').slice(0,16)+') 내용으로 바뀌어요. 2분 안에 모든 PC에 반영돼요.','되돌리기')))return;
  const r=await send({type:'ADMIN_CALL',action:'scripts.restore',params:{version:h.version,baseVersion:pubVer}}).catch(e=>({ok:false,error:e.message}));
  if(!r||!r.ok){say(r&&r.conflict?'그 사이 멘트가 바뀌었어요. 잠시 뒤 다시 해 주세요.':((r&&r.error)||'되돌리지 못했어요'),'err');if(r&&r.conflict){await send({type:'KNOW_REFRESH'}).catch(()=>{});await load();loadHistory();}return;}
  minVer=Number(r.version)||0;say(h.version+'판으로 되돌렸어요('+r.version+'판). 2분 안에 모두에게 반영돼요.','ok');
  await send({type:'KNOW_REFRESH'}).catch(()=>{});await load();loadHistory();
 }

 /* ───── 바뀐 곳 보기 · 보내기 ───── */
 function changeList(items,withRevert,close){
  const ul=mk('ul','chlist');
  for(const it of items){const li=mk('li');const cls=it.kind==='added'||it.kind==='catAdded'?'added':it.kind==='removed'||it.kind==='catRemoved'?'removed':'changed';
   li.append(mk('span','tg '+cls,it.tag));const tt=mk('span','tt');tt.append(mk('b',null,it.text));if(it.sub)tt.append(mk('small',null,it.sub));li.append(tt);
   if(withRevert){const b=mk('button',null,'원래대로');b.type='button';b.addEventListener('click',()=>{const before=JSON.stringify(draft);draft=SD.revert(base,draft,it);
     if(JSON.stringify(draft)===before){say('이 분류 안의 멘트를 먼저 원래대로 해 주세요','err');return;}
     if(sel&&!findCard(sel))sel='';if(catId&&!catOf(catId))catId='';changed();render();close('again');});li.append(b);}
   ul.append(li);}
  return ul;
 }
 async function review(){
  for(;;){
   if(!D||!D.count)return;
   const r=await dialog((d,close)=>{d.style.width='520px';d.append(mk('h3',null,'바뀐 곳 '+D.count+'개'),mk('p',null,'아직 상담사에게 보내지 않은 수정이에요. 잘못 고친 것은 [원래대로]로 하나씩 되돌릴 수 있어요.'),changeList(D.items,true,close));
    const a=mk('div','acts');const all=btn('모두 버리기','danger-ghost',()=>close('discard'));all.style.marginRight='auto';a.append(all,btn('닫기','ghost',()=>close(null)),btn('상담사에게 보내기','primary',()=>close('publish')));d.append(a);});
   if(r==='again')continue;
   if(r==='discard'){if(await confirmDlg('고친 것을 모두 버릴까요?','바뀐 곳 '+D.count+'개가 모두 사라지고 상담사가 지금 보는 멘트로 돌아가요.','모두 버리기',true)){draft=SD.clone(base);sel='';if(catId&&!catOf(catId))catId='';changed();render();banner('');say('고친 것을 모두 버렸어요');}return;}
   if(r==='publish')publish();
   return;
  }
 }
 $('review').addEventListener('click',review);
 function goTo(e){view='cards';$('q').value='';if(e.id){const f=findCard(e.id);if(f){catId=f.c.id;sel=e.id;}}else if(e.catId){catId=e.catId;sel='';if(e.kind==='catName'||e.kind==='catDup')renaming=e.catId;}render();const r=document.querySelector('#rows .row[aria-current="true"]');if(r)r.scrollIntoView({block:'center'});
  if(e.kind==='closing'){view='closings';render();}}
 async function publish(){
  if(busy||!D||!D.count)return;leaveCard();if(!D.count){renderTop();return;}
  const ck=SD.check(draft);
  if(ck.errors.length){
   await dialog((d,close)=>{d.style.width='500px';d.append(mk('h3',null,'보내기 전에 고쳐 주세요'),mk('p',null,'아래를 고치면 보낼 수 있어요. 눌러서 바로 갈 수 있어요.'));
    const ul=mk('ul','chlist');for(const e of ck.errors.slice(0,20)){const li=mk('li','err');li.append(mk('span','tg','확인'));const tt=mk('span','tt');tt.append(mk('b',null,e.text));li.append(tt);const b=mk('button',null,'가기');b.type='button';b.addEventListener('click',()=>{close(null);goTo(e);});li.append(b);ul.append(li);}
    d.append(ul);const a=mk('div','acts');a.append(btn('닫기','primary',()=>close(null)));d.append(a);});
   return;
  }
  const note=await dialog((d,close)=>{d.style.width='520px';
   d.append(mk('h3',null,'상담사에게 보낼까요?'),mk('p',null,'바뀐 곳 '+D.count+'개가 2분 안에 모든 상담사 PC에 반영돼요. 잘못 보내도 [이전 판 · 되돌리기]에서 되돌릴 수 있어요.'),changeList(D.items,false,close));
   if(ck.warns.length)d.append(mk('p','muted','참고: '+ck.warns[0].text+(ck.warns.length>1?' 외 '+(ck.warns.length-1)+'건':'')));
   const l=lab('메모','이전 판 목록에 남아요 · 그대로 둬도 돼요');l.style.marginTop='12px';const i=mk('input','in');i.type='text';i.maxLength=190;i.value=SD.summary(D);i.setAttribute('aria-label','메모');
   i.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();close(i.value);}});
   const a=mk('div','acts');const y=btn('보내기','primary',()=>close(i.value));y.id='doPublish';a.append(btn('취소','ghost',()=>close(null)),y);d.append(l,i,a);setTimeout(()=>y.focus(),0);});
  if(note===null||note===undefined)return;
  busy=true;renderTop();$('publish').textContent='보내는 중…';
  const r=await send({type:'ADMIN_CALL',action:'scripts.save',params:{baseVersion:pubVer,data:draft,note:String(note||'').trim()||SD.summary(D)}}).catch(e=>({ok:false,error:e.message}));
  busy=false;$('publish').textContent='상담사에게 보내기';
  if(r&&r.conflict){await send({type:'KNOW_REFRESH'}).catch(()=>{});await load();renderTop();say('그 사이 다른 PC에서 멘트가 바뀌었어요. 최신 판 위에 내 수정을 다시 얹었으니 한 번 더 [상담사에게 보내기]를 눌러 주세요.','err');return;}
  if(!r||!r.ok){renderTop();say((r&&r.error)||'보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. 고친 내용은 그대로 남아 있어요.','err');return;}
  pubVer=Number(r.version)||pubVer+1;minVer=pubVer;fromServer=true;base=SD.clean(draft);B=SD.index(base);draft=SD.clone(base);status={...status,scriptsAt:'',scriptsBy:''};
  histItems=null;changed();persist(true);banner('');render();
  say('보냈어요('+pubVer+'판). 상담사 PC에는 2분 안에 반영돼요.','ok');
  send({type:'KNOW_REFRESH'}).then(()=>load()).catch(()=>{});
 }
 $('publish').addEventListener('click',publish);

 /* ───── 찾아 바꾸기: 모든 멘트 내용에서 한 번에(보내기 전까지는 이 PC에만) ───── */
 async function findReplace(){
  leaveCard();
  const before=SD.clone(draft);
  const r=await dialog((d,close)=>{d.style.width='560px';
   d.append(mk('h3',null,'찾아 바꾸기'),mk('p',null,'모든 멘트 내용(제목 빼고)에서 글자를 한 번에 바꿔요. 바꾼 뒤에도 [상담사에게 보내기] 전까지는 상담사에게 안 보여요.'));
   const f=mk('input','in');f.type='text';f.placeholder='찾을 글 (예: 6,000원)';f.setAttribute('aria-label','찾을 글');
   const t=mk('textarea','ta');t.placeholder='바꿀 글 (비워 두면 지워요)';t.style.minHeight='64px';t.setAttribute('aria-label','바꿀 글');
   const ins=mk('div','ins');if(phrases().some(p=>String(p.key).trim())){ins.append(mk('span',null,'공통 문구로 바꾸기'));for(const ph of phrases()){const kk=String(ph.key).trim();if(!kk)continue;const b=mk('button',null,'{'+kk+'}');b.type='button';b.addEventListener('click',()=>{t.value='{'+kk+'}';t.dispatchEvent(new Event('input'));});ins.append(b);}}
   const res=mk('div','frres');
   const hits=()=>{const q=f.value;const out=[];if(!q)return out;for(const c of cats())for(const k of c.cards){const n=String(k.script).split(q).length-1;if(n)out.push({k,c,n});}return out;};
   const paint=()=>{const h=hits(),n=h.reduce((a,x)=>a+x.n,0);res.replaceChildren();go.disabled=!h.length;
    if(!f.value){res.append(mk('div','muted','찾을 글을 적으면 들어 있는 멘트가 여기 보여요.'));return;}
    res.append(mk('div','frsum',h.length?('멘트 '+h.length+'개 · '+n+'곳'):'들어 있는 멘트가 없어요'));
    const ul=mk('ul','frl');for(const x of h.slice(0,40)){const li=mk('li');li.append(mk('b',null,x.k.title||'(제목 없음)'),mk('span',null,x.c.name+(x.n>1?' · '+x.n+'곳':'')));ul.append(li);}if(h.length>40)ul.append(mk('li','muted','외 '+(h.length-40)+'개'));res.append(ul);};
   const a=mk('div','acts');const go=btn('모두 바꾸기','primary',()=>close({q:f.value,to:t.value.replace(/\r\n?/g,'\n')}));go.disabled=true;a.append(btn('취소','ghost',()=>close(null)),go);
   f.addEventListener('input',paint);t.addEventListener('input',paint);
   d.append(lab('찾을 글'),f,lab('바꿀 글'),t,ins,res,a);paint();setTimeout(()=>f.focus(),0);});
  if(!r||!r.q)return;
  let m=0,n=0;for(const c of cats())for(const k of c.cards){const parts=String(k.script).split(r.q);if(parts.length>1){k.script=parts.join(r.to);m++;n+=parts.length-1;}}
  changed();render();
  say('멘트 '+m+'개에서 '+n+'곳을 바꿨어요. [상담사에게 보내기]를 눌러야 상담사에게 보여요','ok',{label:'되돌리기',fn:()=>{draft=before;changed();render();}});
 }
 $('findRep').addEventListener('click',findReplace);

 /* ───── 전체 ───── */
 function render(){renderTop();renderCats();renderRows();renderEdit();}
 document.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]'))return;
  const mod=e.ctrlKey||e.metaKey;
  if(mod&&!e.altKey&&(e.key==='s'||e.key==='S'||e.code==='KeyS')){e.preventDefault();if(D&&D.count)publish();else say('바뀐 곳이 없어요');}
  else if(mod&&!e.altKey&&(e.code==='KeyN')){e.preventDefault();newCard();}
  else if(mod&&!e.altKey&&(e.code==='KeyH')){e.preventDefault();findReplace();}
  else if(mod&&!e.altKey&&(e.code==='KeyF')){e.preventDefault();if(view!=='cards'){view='cards';render();}q.focus();q.select();}
  else if(e.altKey&&!mod&&(e.key==='ArrowUp'||e.key==='ArrowDown')&&view==='cards'&&sel){const f=document.querySelector('#edit .form');if(f&&f.rgStep){e.preventDefault();f.rgStep(e.key==='ArrowUp'?-1:1);}}
 });
 chrome.storage.onChanged.addListener((ch,area)=>{if(area==='local'&&ch.kbContent&&!busy&&!KBAdminExtra.connecting)load();});
 window.KBAdminApp={refresh:()=>{if(base)render();},say,dialog,confirmDlg,btn,mk,lab:(...a)=>lab(...a),reload:()=>load(),current:()=>({draft,base,pubVer,D}),setView:v=>{leaveCard();view=v;render();}};
 load(true);
})();
