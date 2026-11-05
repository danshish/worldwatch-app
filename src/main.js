import L from 'leaflet';import { CapacitorHttp,Capacitor } from '@capacitor/core';import { LocalNotifications } from '@capacitor/local-notifications';import { registerPlugin } from '@capacitor/core';import 'leaflet/dist/leaflet.css';import './style.css';
const BackgroundAlerts=registerPlugin('BackgroundAlerts');
const app=document.querySelector('#app'),tabs=[['home','HOME'],['map','GLOBAL MAP'],['intel','INTELLIGENCE'],['videos','VIDEO BRIEF'],['ready','PREPARE'],['settings','SETTINGS']];
const places=[['Ukraine',48.38,31.16,'CONFLICT','Ongoing war; follow verified reporting and official travel advice.'],['Gaza / Israel',31.5,34.8,'CONFLICT','Ongoing conflict and humanitarian emergency.'],['Sudan',15.5,32.5,'CONFLICT','Armed conflict and severe humanitarian needs.'],['Myanmar',21.9,95.9,'UNREST','Continuing armed conflict and instability.'],['Korean Peninsula',38.2,127.2,'TENSION','Long-running military and diplomatic tensions.'],['Taiwan Strait',24,120.4,'TENSION','Cross-strait tensions; exercises do not alone indicate imminent war.']];
let page='home',map,mapLayer,activeMapFilter='all',news=[],videos=[],videosLoading=false,activeRegion='all',showSaved=false,lastNewsUpdate='',breakingOnly=false;const checklist=['Drinking water and non-perishable food','Essential medicines and first-aid kit','Torch, batteries and power bank','Battery or wind-up radio','Written emergency contacts','Family meeting point and contact plan','Copies of important documents','Pet supplies and basic hygiene items'];
const saved=()=>JSON.parse(localStorage.getItem('ww-checks')||'[]');
function shell(content){app.innerHTML='<header><div class="logo"><img src="/worldwatch-icon.svg" alt="WORLDWATCH globe radar logo"></div><div class="brand"><b>WORLDWATCH</b><small>GLOBAL SITUATION AWARENESS</small></div><span class="status">● OPEN SOURCE</span></header>'+content+'<nav>'+tabs.map(([id,t])=>'<button data-page="'+id+'" class="'+(page===id?'on':'')+'">'+t+'</button>').join('')+'</nav><footer>INFORMATION TOOL ONLY · NOT AN OFFICIAL GOVERNMENT OR MILITARY SERVICE. Verify urgent information with local authorities.</footer>';app.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page;render()})}
function notificationSettings(){
const n=localStorage.getItem('ww-alert-news')==='true',v=localStorage.getItem('ww-alert-videos')==='true';
return '<article class="notice notification-settings"><small>PERSONAL ALERTS</small><h3>Phone notifications</h3><p>Choose which new reports WORLDWATCH should notify you about while the app is open and checking feeds.</p><label><input id="alert-news" type="checkbox" '+(n?'checked':'')+'><span>New intelligence reports</span></label><label><input id="alert-videos" type="checkbox" '+(v?'checked':'')+'><span>New video briefings</span></label><button id="enable-alerts" class="secondary">SAVE ALERT SETTINGS</button><p class="alert-note">Android permission is required. Android checks periodically in the background. Android may delay checks to save battery.</p><div id="alert-status" class="intel-meta"></div></article>'
}
function bindNotificationSettings(){
const button=document.querySelector('#enable-alerts');if(!button)return;
button.onclick=async()=>{const status=document.querySelector('#alert-status');try{if(!Capacitor.isNativePlatform()){if(status)status.textContent='Install the Android app to enable phone notifications.';return;}const newsOn=document.querySelector('#alert-news').checked,videosOn=document.querySelector('#alert-videos').checked;if(newsOn||videosOn){const permission=await LocalNotifications.requestPermissions();if(permission.display!=='granted'){if(status)status.textContent='Notifications are not permitted. Enable them in Android settings.';return;}await LocalNotifications.createChannel({id:'worldwatch-alerts',name:'WORLDWATCH alerts',description:'New conflict-related news and video reports',importance:4});}localStorage.setItem('ww-alert-news',String(newsOn));localStorage.setItem('ww-alert-videos',String(videosOn));await BackgroundAlerts.configureAlerts({news:newsOn,videos:videosOn});if(status)status.textContent='Alert preferences saved. Background checks are scheduled.';}catch(error){if(status)status.textContent='Could not save alerts: '+(error.message||String(error));}}
}
async function sendAlert(title,body,tag){if(!Capacitor.isNativePlatform())return;try{const id=Math.abs([...String(tag)].reduce((h,ch)=>((h*31+ch.charCodeAt(0))|0),0))%2147483647;await LocalNotifications.schedule({notifications:[{id,title,body,channelId:'worldwatch-alerts',schedule:{at:new Date(Date.now()+1000)}}]});}catch(error){console.warn('WORLDWATCH notification failed',error)}}
function notifyNewItems(items,type){const enabled=localStorage.getItem(type==='news'?'ww-alert-news':'ww-alert-videos')==='true';if(!enabled||!items.length)return;const newest=items.slice(0,3);sendAlert(type==='news'?'WORLDWATCH · New intelligence':'WORLDWATCH · New video briefing',newest.length===1?newest[0].title:newest.length+' new reports, including: '+newest[0].title,type+':'+newest.map(x=>x.url||x.videoId).join('|'))}
function home(){return '<main><section class="hero"><small>GLOBAL SITUATION AWARENESS</small><h1>Understand the world.<br><em>Be prepared.</em></h1><p>Track reported conflicts, international developments and practical emergency guidance — with context, sources and no sensationalism.</p><button data-page="map" class="primary">EXPLORE GLOBAL MAP ↗</button> <button data-page="ready" class="secondary">PREPARE NOW</button></section><div class="heading"><small>SITUATION BOARD</small><h2>Areas to follow</h2></div><div class="grid">'+places.slice(0,4).map(p=>'<article><span class="tag '+(p[3]==='CONFLICT'?'red':'amber')+'">'+p[3]+'</span><h3>'+p[0]+'</h3><p>'+p[4]+'</p><button class="link" data-page="map">VIEW ON MAP ↗</button></article>').join('')+'</div><div class="grid feature"><article><small>01 / INTELLIGENCE</small><h3>Latest global reporting</h3><p>Headlines with links to original sources.</p><button data-page="intel" class="secondary">OPEN INTELLIGENCE</button></article><article><small>02 / READINESS</small><h3>Emergency planning</h3><p>Practical household preparedness.</p><button data-page="ready" class="secondary">OPEN PREPARE</button></article></div></main>'}
function settingsView(){return '<main><div class="heading"><small>APP PREFERENCES</small><h2>Settings</h2><p>Manage WORLDWATCH notifications and app preferences.</p></div>'+notificationSettings()+'</main>'}
function mapPlaces(){return places.filter(p=>activeMapFilter==='all'||(activeMapFilter==='conflict'?p[3]==='CONFLICT':activeMapFilter==='tension'?p[3]==='TENSION':p[3]==='UNREST'))}function mapCards(){return mapPlaces().map(p=>'<article><span class="tag '+(p[3]==='CONFLICT'?'red':'amber')+'">'+p[3]+'</span><h3>'+p[0]+'</h3><p>'+p[4]+'</p></article>').join('')}function drawMapMarkers(){if(!map)return;if(mapLayer)map.removeLayer(mapLayer);mapLayer=L.layerGroup();mapPlaces().forEach(p=>L.circleMarker([p[1],p[2]],{radius:8,color:p[3]==='CONFLICT'?'#ff5363':p[3]==='UNREST'?'#d69cff':'#f4bd55',fillColor:p[3]==='CONFLICT'?'#ff5363':p[3]==='UNREST'?'#d69cff':'#f4bd55',fillOpacity:.85,weight:2}).addTo(mapLayer).bindPopup('<b>'+p[0]+'</b><br>'+p[3]+'<br>'+p[4]));mapLayer.addTo(map)}function bindMapFilters(){document.querySelectorAll('[data-map-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.mapFilter===activeMapFilter);b.onclick=()=>{activeMapFilter=b.dataset.mapFilter;document.querySelectorAll('[data-map-filter]').forEach(x=>x.classList.toggle('active',x.dataset.mapFilter===activeMapFilter));const list=document.querySelector('#map-places');if(list)list.innerHTML=mapCards();drawMapMarkers();const count=document.querySelector('#map-count');if(count)count.textContent=mapPlaces().length+' locations shown';}})}function mapView(){return '<main><div class="heading"><small>GEOSPATIAL OVERVIEW</small><h2>Global map</h2><p>Selected open-source situation points. These are not live military positions or a real-time threat assessment.</p><div class="map-filters"><button data-map-filter="all" class="secondary">ALL</button><button data-map-filter="conflict" class="secondary">CONFLICT</button><button data-map-filter="unrest" class="secondary">UNREST</button><button data-map-filter="tension" class="secondary">TENSIONS</button></div><div id="map-count" class="intel-meta">'+mapPlaces().length+' locations shown</div></div><div id="map"></div><p class="legend">🔴 Reported conflict　 🟣 Unrest　 🟠 Tension</p><div id="map-places" class="grid">'+mapCards()+'</div></main>'}
function intelView(){return '<main><div class="heading"><small>REGIONAL INTELLIGENCE</small><h2>Situation dashboard</h2><p>Filter open-source conflict reporting by region. Severity labels are automated topic indicators, not official threat assessments.</p><div class="breaking-panel"><div><small>PRIORITY MONITOR</small><h3>Breaking watch</h3><p>'+news.filter(n=>severityFor(n.title)==='HIGH').length+' high-priority headlines detected</p></div><button id="breaking-filter" class="secondary">'+(breakingOnly?'SHOW ALL REPORTS':'VIEW HIGH PRIORITY')+'</button></div><div class="intel-controls"><label>REGION <select id="region-filter"><option value="all">All regions</option><option value="europe">Europe</option><option value="middle-east">Middle East</option><option value="africa">Africa</option><option value="asia">Asia-Pacific</option></select></label><button id="saved-filter" class="secondary">'+(showSaved?'★ SHOWING SAVED':'☆ SAVED REPORTS')+'</button></div><div class="intel-meta">'+(lastNewsUpdate?'LAST UPDATED '+esc(lastNewsUpdate):'AWAITING FEED UPDATE')+'</div><button id="refresh" class="secondary">↻ REFRESH REPORTS</button></div><div id="news">'+renderNewsCards()+'</div><p class="disclaimer">Third-party news may be incomplete or inaccurate. Severity labels are generated from headline wording and do not represent verified assessments.</p></main>'}
function regionFor(item){const t=(item.title+' '+item.domain).toLowerCase();if(/ukraine|russia|belarus|moldova|europe|nato|poland|baltic|balkans/.test(t))return'europe';if(/gaza|israel|palestin|hamas|hezbollah|iran|lebanon|syria|yemen|houthi|iraq|middle east/.test(t))return'middle-east';if(/sudan|somalia|ethiopia|eritrea|sahel|mali|niger|burkina|congo|dr congo|libya|africa/.test(t))return'africa';if(/myanmar|burma|taiwan|china|north korea|south korea|korean|japan|philippines|south china sea|indo.pacific|asia/.test(t))return'asia';return'other'}
function severityFor(title){if(/invasion|airstrike|air strike|missile|shelling|offensive|massacre|attack|battle|bombard|troops killed|war crime/i.test(title))return'HIGH';if(/military|tension|sanction|ceasefire|weapons|drone|armed|clash|threat|mobilis/i.test(title))return'ELEVATED';return'MONITOR'}
function reportKey(item){return item.url}
function savedReports(){try{return JSON.parse(localStorage.getItem('ww-saved-reports')||'[]')}catch{return[]}}
function renderNewsCards(){const saved=savedReports();let items=news.filter(n=>(activeRegion==='all'||regionFor(n)===activeRegion)&&(!showSaved||saved.includes(reportKey(n)))&&(!breakingOnly||severityFor(n.title)==='HIGH'));items.sort((a,b)=>({HIGH:0,ELEVATED:1,MONITOR:2}[severityFor(a.title)]-({HIGH:0,ELEVATED:1,MONITOR:2}[severityFor(b.title)])));if(!items.length)return '<div class="empty">'+(showSaved?'No saved reports yet. Tap ☆ SAVE on a report to keep it here.':'No reports match this region right now. Try another region or refresh.')+'</div>';return items.map(n=>'<article class="news"><div class="report-top"><span class="severity '+severityFor(n.title).toLowerCase()+'">'+severityFor(n.title)+'</span><small>'+esc(n.seendate||'RECENT REPORT')+'</small></div><h3>'+esc(n.title)+'</h3><p>'+esc(n.domain||'News source')+' · '+regionFor(n).replace('-',' ').toUpperCase()+'</p><div class="report-actions"><a href="'+url(n.url)+'" target="_blank" rel="noopener">READ ORIGINAL REPORT ↗</a><button class="save-report" data-save="'+esc(reportKey(n))+'">'+(saved.includes(reportKey(n))?'★ SAVED':'☆ SAVE')+'</button></div></article>').join('')}
function bindIntel(){const breaking=document.querySelector('#breaking-filter');if(breaking)breaking.onclick=()=>{breakingOnly=!breakingOnly;const box=document.querySelector('#news');if(box)box.innerHTML=renderNewsCards();breaking.textContent=breakingOnly?'SHOW ALL REPORTS':'VIEW HIGH PRIORITY';bindSaveButtons()};const region=document.querySelector('#region-filter');if(region){region.value=activeRegion;region.onchange=()=>{activeRegion=region.value;const box=document.querySelector('#news');if(box)box.innerHTML=renderNewsCards();bindSaveButtons()}}const saved=document.querySelector('#saved-filter');if(saved)saved.onclick=()=>{showSaved=!showSaved;render()};const refresh=document.querySelector('#refresh');if(refresh)refresh.onclick=loadNews;bindSaveButtons()}
function bindSaveButtons(){document.querySelectorAll('[data-save]').forEach(button=>button.onclick=()=>{const key=button.dataset.save;let list=savedReports();list=list.includes(key)?list.filter(x=>x!==key):[...list,key];localStorage.setItem('ww-saved-reports',JSON.stringify(list));const box=document.querySelector('#news');if(box)box.innerHTML=renderNewsCards();bindSaveButtons()})}
function videosView(){return '<main><div class="heading"><small>VISUAL INTELLIGENCE</small><h2>Video briefing</h2><p>Recent conflict-related reporting from established international news publishers. Videos open on their original YouTube channel. Check the publisher and date; footage may be outdated or graphic.</p><button id="refresh-videos" class="secondary">↻ REFRESH VIDEOS</button></div><div id="videos">'+(videos.length?videoCards():'<div class="empty">Loading conflict-related video reports…</div>')+'</div><p class="disclaimer">Third-party footage is not independently verified by WORLDWATCH. Viewer discretion advised.</p></main>'}
function readyView(){return '<main><section class="hero"><small>PERSONAL READINESS</small><h1>Prepared, not<br><em>panicked.</em></h1><p>Simple steps for power cuts, severe weather, disruption and other emergencies.</p></section><div class="heading"><small>YOUR CHECKLIST</small><h2>Household essentials</h2><p>Checklist saved on this device.</p></div><div class="checks">'+checklist.map((x,i)=>'<label><input type="checkbox" data-check="'+i+'" '+(saved().includes(i)?'checked':'')+'><span>'+x+'</span></label>').join('')+'</div><article class="notice"><h3>In an emergency</h3><p>Follow instructions from local emergency services and government authorities. In the UK, call 999 for an immediate threat to life.</p><a href="https://www.gov.uk/prepare" target="_blank">GOV.UK — PREPARE FOR EMERGENCIES ↗</a><br><a href="https://www.gov.uk/foreign-travel-advice" target="_blank">UK FOREIGN TRAVEL ADVICE ↗</a></article><button id="reset" class="secondary">RESET CHECKLIST</button></main>'}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}function url(s=''){try{let u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.href:'#'}catch{return '#'}}
function render(){if(page==='home'){shell(home());}if(page==='map'){shell(mapView());if(map)map.remove();map=L.map('map').setView([25,15],2);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);drawMapMarkers();bindMapFilters();setTimeout(()=>map.invalidateSize(),120)}if(page==='intel'){shell(intelView());bindIntel();if(!news.length)loadNews()}if(page==='videos'){shell(videosView());document.querySelector('#refresh-videos').onclick=loadVideos;if(!videos.length&&!videosLoading)loadVideos()}if(page==='settings'){shell(settingsView());bindNotificationSettings()}if(page==='ready'){shell(readyView());document.querySelectorAll('[data-check]').forEach(el=>el.onchange=()=>{let a=saved(),i=+el.dataset.check;localStorage.setItem('ww-checks',JSON.stringify(el.checked?[...new Set([...a,i])]:a.filter(x=>x!==i)))});document.querySelector('#reset').onclick=()=>{localStorage.removeItem('ww-checks');render()}}}
async function loadNews(){
 const box=document.querySelector('#news');
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
  const previous=localStorage.getItem('ww-known-news');if(previous!==null){const known=new Set(JSON.parse(previous));notifyNewItems(unique.filter(item=>!known.has(item.url)),'news');}localStorage.setItem('ww-known-news',JSON.stringify(unique.map(item=>item.url).slice(0,100)));news=unique.slice(0,30);lastNewsUpdate=new Date().toLocaleString();render();
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
 const box=document.querySelector('#videos');
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
  const nextVideos=[...new Map(relevant.map(v=>[v.videoId,v])).values()].sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)).slice(0,18);const previous=localStorage.getItem('ww-known-videos');if(previous!==null){const known=new Set(JSON.parse(previous));notifyNewItems(nextVideos.filter(item=>!known.has(item.videoId)),'videos');}localStorage.setItem('ww-known-videos',JSON.stringify(nextVideos.map(item=>item.videoId).slice(0,100)));videos=nextVideos;
  const current=document.querySelector('#videos');if(current)current.innerHTML=videos.length?videoCards():'<div class="empty">No recent conflict-related videos were returned. Try again later.</div>';
 }catch(error){
  const current=document.querySelector('#videos');if(current)current.innerHTML='<div class="empty"><b>Video feed unavailable.</b><br>'+esc(error.message||String(error))+'<br><br>Try REFRESH VIDEOS again later.</div>';
 }finally{
  videosLoading=false;
  const b=document.querySelector('#refresh-videos');if(b){b.disabled=false;b.textContent='↻ REFRESH VIDEOS'}
 }
}
render();if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
loadNews();loadVideos();
setInterval(()=>{if(document.visibilityState!=='visible')return;loadNews();loadVideos()},15*60*1000);
