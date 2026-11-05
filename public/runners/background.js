const NEWS_FEEDS=[
 {name:'BBC News',url:'https://feeds.bbci.co.uk/news/world/rss.xml'},
 {name:'The Guardian',url:'https://www.theguardian.com/world/rss'},
 {name:'UN News',url:'https://news.un.org/feed/subscribe/en/news/all/rss.xml'}
];
const VIDEO_CHANNELS=[
 {name:'BBC News',id:'UC16niRr50-MSBwiO3YDb3RA'},
 {name:'Reuters',id:'UChqUTb7kYRX8-EiaN3XFrSQ'},
 {name:'Associated Press',id:'UC52X5wxOL_s5yw0dQk7NtgA'},
 {name:'Sky News',id:'UCoMdktPbSTixAyNGwb-UYkQ'},
 {name:'DW News',id:'UCknLrEdhRCp1aegoMqRaCZg'},
 {name:'Al Jazeera English',id:'UCNye-wNBqNL5ZzHSJj3l8Bg'}
];
const TOPICS=/\b(conflict|war|warfare|invasion|occupation|ceasefire|peace talks|airstrike|air strike|missile|drone strike|shelling|frontline|front line|battle|offensive|troops|military|armed forces|army|navy|air force|nato|ukraine|russia|gaza|israel|palestine|palestinian|hamas|hezbollah|iran|lebanon|syria|yemen|houthi|sudan|myanmar|taiwan|north korea|south china sea|terrorism|insurgency|rebel|militia|coup|geopolitic|sanction|defence|defense|security crisis|weapons|arms deal|nuclear threat|hostage|war crime|humanitarian crisis)\b/i;
function decode(s){return String(s||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").trim()}
function field(block,name){const re=new RegExp('<(?:[A-Za-z0-9_.-]+:)?'+name+'\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_.-]+:)?'+name+'>','i');return decode((block.match(re)||[])[1]||'')}
function entries(xml,kind){const blocks=xml.match(kind==='video'?/<entry\b[\s\S]*?<\/entry>/gi:/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi)||[];return blocks.map(b=>{const title=field(b,'title');let link=(b.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i)||[])[1]||field(b,'link');const id=field(b,'videoId')||(link.match(/[?&]v=([^&]+)/)||[])[1]||'';return {title,url:decode(link),id}}).filter(x=>x.title&&x.url&&TOPICS.test(x.title))}
async function read(url){const response=await fetch(url,{headers:{Accept:'application/rss+xml, application/atom+xml, application/xml, text/xml'}});if(!response.ok)throw new Error('Feed HTTP '+response.status);return await response.text()}
function kv(key){try{return JSON.parse(CapacitorKV.get(key).value||'[]')}catch{return[]}}
function save(key,value){CapacitorKV.set(key,JSON.stringify(value))}
async function notify(id,title,body){CapacitorNotifications.schedule([{id,title,body,scheduleAt:new Date(Date.now()+1200)}])}
async function check(){const newsOn=CapacitorKV.get('ww-alert-news').value!=='false';const videosOn=CapacitorKV.get('ww-alert-videos').value!=='false';
 if(newsOn){const all=(await Promise.allSettled(NEWS_FEEDS.map(async f=>(await read(f.url)).split(/(?=<item\b|<entry\b)/i).flatMap(x=>entries(x,'news'))))).filter(x=>x.status==='fulfilled').flatMap(x=>x.value);const ids=all.map(x=>x.url);const previous=kv('ww-bg-news-seen');if(previous.length){const fresh=all.filter(x=>!previous.includes(x.url));if(fresh.length)await notify(8201,'WORLDWATCH · New intelligence',fresh.length===1?fresh[0].title:fresh.length+' new reports detected. Latest: '+fresh[0].title)}save('ww-bg-news-seen',ids.slice(0,120))}
 if(videosOn){const all=(await Promise.allSettled(VIDEO_CHANNELS.map(async f=>(await read('https://www.youtube.com/feeds/videos.xml?channel_id='+f.id)).split(/(?=<entry\b)/i).flatMap(x=>entries(x,'video').map(v=>({...v,source:f.name})))))).filter(x=>x.status==='fulfilled').flatMap(x=>x.value);const ids=all.map(x=>x.id||x.url);const previous=kv('ww-bg-videos-seen');if(previous.length){const fresh=all.filter(x=>!previous.includes(x.id||x.url));if(fresh.length)await notify(8202,'WORLDWATCH · New video briefing',fresh.length===1?fresh[0].title:fresh.length+' new videos detected. Latest: '+fresh[0].title)}save('ww-bg-videos-seen',ids.slice(0,120))}
}
addEventListener('settingsChanged',(resolve,reject,args)=>{try{CapacitorKV.set('ww-alert-news',String(args.news));CapacitorKV.set('ww-alert-videos',String(args.videos));resolve()}catch(e){reject(e)}});
addEventListener('checkForUpdates',(resolve,reject)=>{check().then(resolve).catch(reject)});
