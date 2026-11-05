import L from 'leaflet';import { CapacitorHttp,Capacitor } from '@capacitor/core';import 'leaflet/dist/leaflet.css';import './style.css';
const app=document.querySelector('#app'),tabs=[['home','HOME'],['map','GLOBAL MAP'],['intel','INTELLIGENCE'],['ready','PREPARE']];
const places=[['Ukraine',48.38,31.16,'CONFLICT','Ongoing war; follow verified reporting and official travel advice.'],['Gaza / Israel',31.5,34.8,'CONFLICT','Ongoing conflict and humanitarian emergency.'],['Sudan',15.5,32.5,'CONFLICT','Armed conflict and severe humanitarian needs.'],['Myanmar',21.9,95.9,'UNREST','Continuing armed conflict and instability.'],['Korean Peninsula',38.2,127.2,'TENSION','Long-running military and diplomatic tensions.'],['Taiwan Strait',24,120.4,'TENSION','Cross-strait tensions; exercises do not alone indicate imminent war.']];
let page='home',map,news=[],videos=[],videosLoading=false;const checklist=['Drinking water and non-perishable food','Essential medicines and first-aid kit','Torch, batteries and power bank','Battery or wind-up radio','Written emergency contacts','Family meeting point and contact plan','Copies of important documents','Pet supplies and basic hygiene items'];
const saved=()=>JSON.parse(localStorage.getItem('ww-checks')||'[]');
function shell(content){app.innerHTML='<header><div class="logo"><img src="/worldwatch-icon.svg" alt="WORLDWATCH globe radar logo"></div><div class="brand"><b>WORLDWATCH</b><small>GLOBAL SITUATION AWARENESS</small></div><span class="status">● OPEN SOURCE</span></header>'+content+'<nav>'+tabs.map(([id,t])=>'<button data-page="'+id+'" class="'+(page===id?'on':'')+'">'+t+'</button>').join('')+'</nav><footer>INFORMATION TOOL ONLY · NOT AN OFFICIAL GOVERNMENT OR MILITARY SERVICE. Verify urgent information with local authorities.</footer>';app.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page;render()})}
function home(){return '<main><section class="hero"><small>GLOBAL SITUATION AWARENESS</small><h1>Understand the world.<br><em>Be prepared.</em></h1><p>Track reported conflicts, international developments and practical emergency guidance — with context, sources and no sensationalism.</p><button data-page="map" class="primary">EXPLORE GLOBAL MAP ↗</button> <button data-page="ready" class="secondary">PREPARE NOW</button></section><div class="heading"><small>SITUATION BOARD</small><h2>Areas to follow</h2></div><div class="grid">'+places.slice(0,4).map(p=>'<article><span class="tag '+(p[3]==='CONFLICT'?'red':'amber')+'">'+p[3]+'</span><h3>'+p[0]+'</h3><p>'+p[4]+'</p><button class="link" data-page="map">VIEW ON MAP ↗</button></article>').join('')+'</div><div class="grid feature"><article><small>01 / INTELLIGENCE</small><h3>Latest global reporting</h3><p>Headlines with links to original sources.</p><button data-page="intel" class="secondary">OPEN INTELLIGENCE</button></article><article><small>02 / READINESS</small><h3>Emergency planning</h3><p>Practical household preparedness.</p><button data-page="ready" class="secondary">OPEN PREPARE</button></article></div></main>'}
function mapView(){return '<main><div class="heading"><small>GEOSPATIAL OVERVIEW</small><h2>Global map</h2><p>Selected ongoing conflicts and areas of tension — not a real-time threat assessment.</p></div><div id="map"></div><p class="legend">🔴 Reported conflict　 🟠 Tension / instability</p><div class="grid">'+places.map(p=>'<article><span class="tag '+(p[3]==='CONFLICT'?'red':'amber')+'">'+p[3]+'</span><h3>'+p[0]+'</h3><p>'+p[4]+'</p></article>').join('')+'</div></main>'}
function intelView(){return '<main><div class="heading"><small>OPEN-SOURCE INTELLIGENCE</small><h2>Latest reporting</h2><p>Headlines from established international news feeds. Open the original report and check its publication time.</p><button id="refresh" class="secondary">↻ REFRESH REPORTS</button></div><div id="news">'+(news.length?news.map(n=>'<article class="news"><small>'+esc(n.seendate||'RECENT REPORT')+'</small><h3>'+esc(n.title)+'</h3><p>'+esc(n.domain||'News source')+'</p><a href="'+url(n.url)+'" target="_blank" rel="noopener">READ ORIGINAL REPORT ↗</a></article>').join(''):'<div class="empty">Connect to the internet and tap refresh to load recent international reporting.</div>')+'</div><section class="video-section"><div class="heading"><small>VIDEO INTELLIGENCE</small><h2>Conflict videos</h2><p>Recent conflict-related reporting from established international news publishers. Videos open on their original YouTube channel.</p><button id="refresh-videos" class="secondary">↻ REFRESH VIDEOS</button></div><div id="videos">'+(videos.length?videoCards():'<div class="empty">Loading conflict-related video reports…</div>')+'</div></section><p class="disclaimer">Third-party news may be incomplete or inaccurate. WORLDWATCH does not independently verify every report. Footage may be outdated or graphic; check the original publisher and publication date.</p></main>'}
function readyView(){return '<main><section class="hero"><small>PERSONAL READINESS</small><h1>Prepared, not<br><em>panicked.</em></h1><p>Simple steps for power cuts, severe weather, disruption and other emergencies.</p></section><div class="heading"><small>YOUR CHECKLIST</small><h2>Household essentials</h2><p>Checklist saved on this device.</p></div><div class="checks">'+checklist.map((x,i)=>'<label><input type="checkbox" data-check="'+i+'" '+(saved().includes(i)?'checked':'')+'><span>'+x+'</span></label>').join('')+'</div><article class="notice"><h3>In an emergency</h3><p>Follow instructions from local emergency services and government authorities. In the UK, call 999 for an immediate threat to life.</p><a href="https://www.gov.uk/prepare" target="_blank">GOV.UK — PREPARE FOR EMERGENCIES ↗</a><br><a href="https://www.gov.uk/foreign-travel-advice" target="_blank">UK FOREIGN TRAVEL ADVICE ↗</a></article><button id="reset" class="secondary">RESET CHECKLIST</button></main>'}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function url(s=''){try{let u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.href:'#'}catch{return '#'}}
function render(){if(page==='home')shell(home());if(page==='map'){shell(mapView());if(map)map.remove();map=L.map('map').setView([25,15],2);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);places.forEach(p=>L.circleMarker([p[1],p[2]],{radius:8,color:p[3]==='CONFLICT'?'#ff5363':'#f4bd55',fillOpacity:.8}).addTo(map).bindPopup('<b>'+p[0]+'</b><br>'+p[3]+'<br>'+p[4]));setTimeout(()=>map.invalidateSize(),120)}if(page==='intel'){shell(intelView());document.querySelector('#refresh').onclick=loadNews;if(!news.length)loadNews();if(!videos.length&&!videosLoading)loadVideos();document.querySelector('#refresh-videos').onclick=loadVideos}if(page==='ready'){shell(readyView());document.querySelectorAll('[data-check]').forEach(el=>el.onchange=()=>{let a=saved(),i=+el.dataset.check;localStorage.setItem('ww-checks',JSON.stringify(el.checked?[...new Set([...a,i])]:a.filter(x=>x!==i)))});document.querySelector('#reset').onclick=()=>{localStorage.removeItem('ww-checks');render()}}}
async function loadNews(){
 const box=document.querySelector('#news');if(!box)return;
 const button=document.querySelector('#refresh');
 const status=message=>{const current=document.querySelector('#news');if(current)current.innerHTML='<div class="empty">'+esc(message)+'</div>'};
 if(button){button.disabled=true;button.textContent='LOADING…'}
 try{
  status('Connecting to international news feeds…');
  const feeds=[
   {name:'BBC News',url:'https://feeds.bbci.co.uk/news/world/rss.xml'},
   {name:'The Guardian',url:'https://www.theguardian.com/world/rss'},
   {name:'UN News',url:'https://news.un.org/feed/subscribe/en/news/all/rss.xml'}
  ];
  const getFeed=async feed=>{
   let response;
   if(Capacitor.isNativePlatform()){
    response=await CapacitorHttp.get({url:feed.url,connectTimeout:12000,readTimeout:15000,headers:{Accept:'application/rss+xml, application/xml, text/xml'}});
   }else{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{response=await fetch(feed.url,{cache:'no-store',signal:controller.signal});}
    finally{clearTimeout(timer)}
   }
   if(response.status<200||response.status>=300)throw new Error(feed.name+' returned HTTP '+response.status);
   const xml=typeof response.data==='string'?response.data:typeof response==='string'?response:'';
   if(!xml)throw new Error(feed.name+' returned an empty response');
   const doc=new DOMParser().parseFromString(xml,'text/xml');
   if(doc.querySelector('parsererror'))throw new Error(feed.name+' returned invalid feed data');
   return [...doc.querySelectorAll('item, entry')].map(item=>{
    const title=item.querySelector('title')?.textContent?.trim()||'';
    const linkNode=item.querySelector('link');
    const href=linkNode?.getAttribute('href')||linkNode?.textContent?.trim()||'';
    const date=item.querySelector('pubDate, published, updated')?.textContent?.trim()||'';
    return {title,url:href,seendate:date,domain:feed.name};
   }).filter(item=>item.title&&url(item.url)!=='#');
  };
  const results=await Promise.allSettled(feeds.map(getFeed));
  const conflictPattern=/\b(conflict|war|warfare|invasion|occupation|ceasefire|peace talks|airstrike|air strike|missile|drone strike|shelling|frontline|front line|battle|offensive|troops|military|armed forces|army|navy|air force|nato|ukraine|russia|gaza|israel|palestine|palestinian|hamas|hezbollah|iran|lebanon|syria|yemen|houthi|sudan|myanmar|taiwan|north korea|south china sea|terrorism|insurgency|rebel|militia|coup|geopolitic|sanction|defence|defense|security crisis|weapons|arms deal|nuclear threat|hostage|war crime|humanitarian crisis)\b/i;
  const items=results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value).filter(item=>conflictPattern.test(item.title));
  const unique=[...new Map(items.map(item=>[item.url,item])).values()];
  if(!unique.length){
   const errors=results.filter(r=>r.status==='rejected').map(r=>r.reason?.message||'Feed unavailable');
   throw new Error(errors.length?errors.join(' · '):'No conflict-related reports were returned by the news feeds.');
  }
  news=unique.slice(0,30);render();
 }catch(error){
  const current=document.querySelector('#news');
  const detail=error.message||String(error);
  if(current)current.innerHTML='<div class="empty"><b>News connection failed.</b><br>'+esc(detail)+'<br><br>Tap REFRESH REPORTS to try again.</div>';
 }finally{
  const b=document.querySelector('#refresh');if(b){b.disabled=false;b.textContent='↻ REFRESH REPORTS'}
 }
}

function videoCards(){return videos.map(v=>'<article class="video-card"><a class="video-thumb" href="'+url(v.url)+'" target="_blank" rel="noopener"><img src="'+url(v.thumbnail)+'" alt="" loading="lazy"><span>▶ WATCH VIDEO</span></a><div class="video-meta"><small>'+esc(v.source)+' · '+esc(v.date||'LATEST VIDEO')+'</small><h3>'+esc(v.title)+'</h3><a href="'+url(v.url)+'" target="_blank" rel="noopener">OPEN ORIGINAL VIDEO ↗</a></div></article>').join('')}
async function loadVideos(){
 if(videosLoading)return;
 const box=document.querySelector('#videos');if(!box)return;
 videosLoading=true;
 const button=document.querySelector('#refresh-videos');if(button){button.disabled=true;button.textContent='LOADING…'}
 const feeds=[
  {name:'BBC News',id:'UC16niRr50-MSBwiO3YDb3RA'},
  {name:'Reuters',id:'UChqUTb7kYRX8-EiaN3XFrSQ'},
  {name:'Associated Press',id:'UC52X5wxOL_s5yw0dQk7NtgA'},
  {name:'Sky News',id:'UCoMdktPbSTixAyNGwb-UYkQ'},
  {name:'DW News',id:'UCknLrEdhRCp1aegoMqRaCZg'},
  {name:'Al Jazeera English',id:'UCNye-wNBqNL5ZzHSJj3l8Bg'}
 ];
 try{
  const getFeed=async feed=>{
   const endpoint='https://www.youtube.com/feeds/videos.xml?channel_id='+feed.id;
   let xml;
   if(Capacitor.isNativePlatform()){
    const response=await CapacitorHttp.get({url:endpoint,connectTimeout:12000,readTimeout:15000,headers:{Accept:'application/atom+xml, application/xml, text/xml'}});
    if(response.status<200||response.status>=300)throw new Error(feed.name+' returned HTTP '+response.status);
    xml=typeof response.data==='string'?response.data:'';
   }else{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{const response=await fetch(endpoint,{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error(feed.name+' returned HTTP '+response.status);xml=await response.text()}
    finally{clearTimeout(timer)}
   }
   if(!xml)throw new Error(feed.name+' returned an empty feed');
   const doc=new DOMParser().parseFromString(xml,'text/xml');
   if(doc.querySelector('parsererror'))throw new Error(feed.name+' returned invalid feed data');
   return [...doc.querySelectorAll('entry')].map(entry=>{
    const title=entry.querySelector('title')?.textContent?.trim()||'';
    const link=entry.querySelector('link[rel="alternate"]')?.getAttribute('href')||entry.querySelector('link')?.getAttribute('href')||'';
    const id=entry.getElementsByTagName('yt:videoId')[0]?.textContent?.trim()||link.match(/[?&]v=([^&]+)/)?.[1]||'';
    const date=entry.querySelector('published')?.textContent?.trim()||'';
    const thumb=entry.getElementsByTagName('media:thumbnail')[0]?.getAttribute('url')||(id?'https://i.ytimg.com/vi/'+id+'/hqdefault.jpg':'');
    return {title,url:link,videoId:id,date:date?new Date(date).toLocaleDateString(): '',thumbnail:thumb,source:feed.name};
   }).filter(v=>v.title&&v.videoId&&url(v.url)!=='#');
  };
  const results=await Promise.allSettled(feeds.map(getFeed));
  const all=results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value);
  const relevant=all.filter(v=>/\b(conflict|war|warfare|invasion|occupation|ceasefire|peace talks|airstrike|air strike|missile|drone strike|shelling|frontline|front line|battle|offensive|troops|military|armed forces|army|navy|air force|nato|ukraine|russia|gaza|israel|palestine|palestinian|hamas|hezbollah|iran|lebanon|syria|yemen|houthi|sudan|myanmar|taiwan|north korea|south china sea|terrorism|insurgency|rebel|militia|coup|geopolitic|sanction|defence|defense|security crisis|weapons|arms deal|nuclear threat|hostage|war crime|humanitarian crisis)\b/i.test(v.title));
  videos=[...new Map(relevant.map(v=>[v.videoId,v])).values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,18);
  const current=document.querySelector('#videos');if(current)current.innerHTML=videos.length?videoCards():'<div class="empty">No recent conflict-related videos were returned. Try again later.</div>';
 }catch(error){
  const current=document.querySelector('#videos');if(current)current.innerHTML='<div class="empty"><b>Video feed unavailable.</b><br>'+esc(error.message||String(error))+'<br><br>Try REFRESH VIDEOS again later.</div>';
 }finally{
  videosLoading=false;
  const b=document.querySelector('#refresh-videos');if(b){b.disabled=false;b.textContent='↻ REFRESH VIDEOS'}
 }
}
render();if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));