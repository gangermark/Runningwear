'use strict';
const $ = id => document.getElementById(id);
const state = { weather: null, place: '', last: null, forecast: null, latitude: null, longitude: null };
const runType = $('runType');
runType.value = localStorage.getItem('runready-run') || 'easy';
runType.addEventListener('change', () => { localStorage.setItem('runready-run',runType.value); render(); });
$('locate').addEventListener('click', locate);
$('refresh').addEventListener('click', locate);
const dateInput=$('runDate'),hourInput=$('runHour');
function localDate(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
const today=new Date();
dateInput.innerHTML=Array.from({length:8},(_,i)=>{
 const d=new Date(today.getFullYear(),today.getMonth(),today.getDate()+i);
 const value=localDate(d);
 const label=i===0?'Idag':i===1?'Imorgon':new Intl.DateTimeFormat('sv-SE',{weekday:'long',day:'numeric',month:'short'}).format(d);
 return '<option value="'+value+'">'+label+'</option>';
}).join('');
hourInput.innerHTML='<option value="now">Just nu</option>'+Array.from({length:24},(_,h)=>'<option value="'+String(h).padStart(2,'0')+'">'+String(h).padStart(2,'0')+':00</option>').join('');
function syncHours(){
 const isToday=dateInput.value===localDate(new Date());
 hourInput.options[0].hidden=!isToday;
 if(!isToday&&hourInput.value==='now')hourInput.value='09';
}
function weatherSymbol(code){
 if([0].includes(code))return '☀️';
 if([1,2].includes(code))return '🌤️';
 if([3].includes(code))return '☁️';
 if([45,48].includes(code))return '🌫️';
 if([51,53,55,56,57,61,63,65,66,67,80,81,82].includes(code))return '🌧️';
 if([71,73,75,77,85,86].includes(code))return '❄️';
 if([95,96,99].includes(code))return '⛈️';
 return '🌥️';
}
function renderHourly(){
 const el=$('hourlyForecast');
 if(!state.forecast){el.innerHTML='<p class="hourly-empty">Hämta väder för att se prognosen.</p>';return;}
 const h=state.forecast.hourly, day=dateInput.value, now=new Date();
 const selected=hourInput.value;
 const hours=h.time.map((t,i)=>({t,i})).filter(x=>x.t.startsWith(day)&&
 (day!==localDate(now)||Number(x.t.slice(11,13))>=now.getHours()));
 el.innerHTML='';
 for(const {t,i} of hours){
  const hour=t.slice(11,13);
  const btn=document.createElement('button');
  btn.type='button';btn.className='hour-card'+(selected===hour?' selected':'');
  btn.setAttribute('aria-pressed',String(selected===hour));
  btn.innerHTML='<span class="hour-time">'+hour+':00</span><span class="hour-icon">'+weatherSymbol(h.weather_code[i])+'</span><strong>'+Math.round(h.temperature_2m[i])+'°</strong><span class="hour-detail">💨 '+Math.round(h.wind_speed_10m[i]/3.6)+' m/s</span>';
  btn.addEventListener('click',()=>{hourInput.value=hour;chooseWeather();});
  el.appendChild(btn);
 }
 if(!hours.length)el.innerHTML='<p class="hourly-empty">Inga kommande timmar idag.</p>';
}
function chooseWeather(){
 if(!state.forecast)return;
 renderHourly();
 const currentDay=localDate(new Date());
 if(dateInput.value===currentDay&&hourInput.value==='now'){state.weather=state.forecast.current;render();return;}
 const target=dateInput.value+'T'+hourInput.value+':00';
 const h=state.forecast.hourly;const idx=h.time.indexOf(target);
 if(idx<0){$('status').textContent='Prognosen saknas för vald tid.';return;}
 state.weather=Object.fromEntries(['temperature_2m','apparent_temperature','wind_speed_10m','precipitation','weather_code'].map(k=>[k,h[k][idx]]));
 render();
}
dateInput.addEventListener('change',()=>{syncHours();chooseWeather();});
hourInput.addEventListener('change',chooseWeather);
syncHours();
function clothing(w, type) {
  const effective = w.apparent_temperature + (type === 'tempo' ? 4 : type === 'long' ? -1 : 2);
  const rain = w.precipitation > 0.2 || [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(w.weather_code);
  const windy = w.wind_speed_10m >= 20;
  let top, bottom;
  if(effective < -8){top='Underställströja och tjock löpartröja';bottom='Underställsbyxa och löpartights';}
  else if(effective < 0){top='Underställströja och löparväst';bottom='Löpartights';}
  else if(effective < 7){top='Långärmad funktionströja och löparväst';bottom='Löpartights';}
  else if(effective < 9){top='Långärmad funktionströja';bottom='Shorts';}
  else {top='T-shirt';bottom='Shorts';}
  if(rain){
    top=top.replace(' och löparväst','');
    top += ' + vindjacka';
  } else if(windy){
    top=top.replace(' och löparväst','');
    top += ' + vindjacka';
  }
  const hands = effective < 3 ? 'Handskar' : 'Inga handskar';
  const head = effective < -4 ? 'Mössa och halsbuff vid behov' : effective < 2 ? 'Halsbuff vid behov' : 'Inget behövs';
  let tip = type === 'tempo' ? 'Du blir snabbt varm under intervaller. Klä dig lätt, men håll dig varm under uppvärmningen.' : type === 'long' ? 'Vid längre pass kan du bli kall när tempot sjunker. Ett extra tunt lager kan vara klokt.' : 'Det är normalt att känna sig lite sval de första 5–10 minuterna.';
  if(rain) tip += ' Det finns tecken på nederbörd – välj gärna plagg som fungerar när de blir fuktiga.';
  if(windy) tip += ' Vinden gör utsatta sträckor kallare.';
  return {top,bottom,hands,head,tip};
}
const LOG_KEY='runready-clothing-log-v1';
function readLog(){try{const data=JSON.parse(localStorage.getItem(LOG_KEY)||'[]');return Array.isArray(data)?data:[];}catch{return [];}}
function recordedOutfit(entry){return Array.isArray(entry.clothes)?entry.clothes.join(', '):entry.top+(entry.outer?' och '+entry.outer:'');}
function nearestExperience(w,type){
 const matches=readLog().filter(e=>e.runType===type&&Number.isFinite(e.feels)&&
 Math.abs(e.feels-w.apparent_temperature)<=4&&Math.abs(e.wind-w.wind_speed_10m)<=15&&
 Boolean(e.rain)===(w.precipitation>0.2||[51,53,55,61,63,65,80,81,82,95].includes(w.weather_code)));
 matches.sort((a,b)=>(Math.abs(a.feels-w.apparent_temperature)+Math.abs(a.wind-w.wind_speed_10m)/8)-
 (Math.abs(b.feels-w.apparent_temperature)+Math.abs(b.wind-w.wind_speed_10m)/8));
 return matches[0]||null;
}
function updateFeedbackHistory(){
 const entries=readLog(),container=$('feedbackHistory');
 $('feedbackCount').textContent=entries.length+' pass';
 container.replaceChildren();
 if(!entries.length){container.textContent='Inga pass sparade ännu.';return;}
 for(const e of entries.slice().reverse().slice(0,5)){
  const item=document.createElement('div');item.className='history-item';
  const comfort={cold:'🥶 Kallt',good:'🙂 Lagom',warm:'🥵 Varmt'}[e.comfort]||'';
  const heading=document.createElement('strong');
  heading.textContent=e.date+' · '+Math.round(e.feels)+'° · '+comfort;
  const detail=document.createElement('p');
  detail.textContent=recordedOutfit(e)+(e.bottom?' · '+e.bottom:'');
  item.append(heading,detail);container.appendChild(item);
 }
}
function fillFeedbackDefaults(c){
 const wanted=[...c.top.split(/\s*\+\s*| och /),...c.bottom.split(/\s*\+\s*| och /)];
 if(c.hands==='Handskar')wanted.push('Handskar');
 if(c.head.includes('Mössa'))wanted.push('Mössa');
 if(c.head.includes('Halsbuff'))wanted.push('Halsbuff');
 document.querySelectorAll('input[name="clothes"]').forEach(input=>{
  input.checked=wanted.some(part=>part.toLowerCase()===input.value.toLowerCase());
 });
}
$('feedbackForm').addEventListener('submit',event=>{
 event.preventDefault();
 if(!state.weather){$('feedbackStatus').textContent='Hämta väder innan du sparar, så kan passet kopplas till väderförhållandena.';return;}
 if(dateInput.value!==localDate(new Date())){$('feedbackStatus').textContent='Välj Idag i datumfältet innan du sparar ett genomfört pass.';return;}
 const comfort=document.querySelector('input[name="comfort"]:checked');
 if(!comfort){$('feedbackStatus').textContent='Välj hur klädseln kändes.';return;}
 const w=state.weather;
 const rain=w.precipitation>0.2||[51,53,55,61,63,65,80,81,82,95].includes(w.weather_code);
 const clothes=[...document.querySelectorAll('input[name="clothes"]:checked')].map(x=>x.value);
 if(!clothes.length){$('feedbackStatus').textContent='Välj minst ett plagg.';return;}
 const entry={date:localDate(new Date()),recordedAt:new Date().toISOString(),runType:runType.value,
 clothes,
 comfort:comfort.value,feels:w.apparent_temperature,wind:w.wind_speed_10m,rain};
 try{const entries=readLog();entries.push(entry);localStorage.setItem(LOG_KEY,JSON.stringify(entries));}
 catch{$('feedbackStatus').textContent='Kunde inte spara på enheten. Kontrollera webbläsarens lagringsinställningar.';return;}
 $('feedbackStatus').textContent='Sparat! RunReady använder dina erfarenheter vid liknande väder.';
 $('feedbackForm').reset();updateFeedbackHistory();
});
updateFeedbackHistory();
function render(){
  if(!state.weather)return;
  const w=state.weather, c=clothing(w,runType.value);
  const experience=nearestExperience(w,runType.value);
  if(experience){
    if(experience.comfort==='good' && !Array.isArray(experience.clothes)){
      c.top=recordedOutfit(experience);
      c.bottom=experience.bottom;
      c.tip='Anpassat efter ett tidigare pass då du tyckte klädseln var lagom vid liknande väder. '+c.tip;
    } else if(experience.comfort!=='good'){
      const direction=experience.comfort==='warm'?'lättare':'varmare';
      c.tip='Du upplevde ett tidigare pass i liknande väder som '+(experience.comfort==='warm'?'för varmt':'för kallt')+
       ' med '+recordedOutfit(experience)+(experience.bottom?' och '+experience.bottom:'')+
       '. Välj gärna '+direction+' kläder än då. '+c.tip;
    }
    if(experience.comfort==='good' && Array.isArray(experience.clothes)){
      const tops=experience.clothes.filter(x=>['Underställströja','Långärmad funktionströja','T-shirt','Tjock löpartröja','Löparväst','Vindjacka'].includes(x));
      const bottoms=experience.clothes.filter(x=>['Underställsbyxa','Löpartights','Tunna löparbyxor','Shorts'].includes(x));
      if(tops.length)c.top=tops.join(' + ');
      if(bottoms.length)c.bottom=bottoms.join(' + ');
      c.hands=experience.clothes.includes('Handskar')?'Handskar':'Inga handskar';
      c.head=experience.clothes.filter(x=>['Mössa','Halsbuff'].includes(x)).join(' + ')||'Inget behövs';
      c.tip='Baserat på ett tidigare pass där du var lagom klädd vid liknande väder. '+c.tip;
    }
  }
  $('weather').hidden=false; $('results').hidden=false;
  $('temp').textContent=Math.round(w.temperature_2m)+'°';
  $('feels').textContent=Math.round(w.apparent_temperature)+'°';
  $('wind').textContent=Math.round(w.wind_speed_10m/3.6)+' m/s';
  for(const key of ['top','bottom','hands','head','tip']) $(key).textContent=c[key];
  if(!document.querySelector('input[name="clothes"]:checked'))fillFeedbackDefaults(c);
  $('place').textContent=state.place;
  const future=!(dateInput.value===localDate(new Date())&&hourInput.value==='now');
  $('status').textContent=future?'Väderprognos för '+dateInput.value+' kl. '+hourInput.value+':00':'Aktuellt väder för din position';
  $('updated').textContent=(future?'Prognos hämtad ':'Väder hämtat ')+state.last.toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'})+' · Normal temperaturpreferens';
}
async function fetchWeather(lat,lon){
  const url=new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude',lat);url.searchParams.set('longitude',lon);
  const fields='temperature_2m,apparent_temperature,wind_speed_10m,precipitation,weather_code';
  url.searchParams.set('current',fields);url.searchParams.set('hourly',fields);url.searchParams.set('forecast_days','8');
  url.searchParams.set('wind_speed_unit','kmh');url.searchParams.set('timezone','auto');
  const res=await fetch(url);if(!res.ok)throw new Error('Vädertjänsten svarar inte. Försök igen.');
  const data=await res.json();if(!data.current || typeof data.current.apparent_temperature!=='number')throw new Error('Väderdata saknas just nu.');
  if(!data.hourly || !data.hourly.time)throw new Error('Prognosdata saknas just nu.');
  return data;
}
function gps(){return new Promise((resolve,reject)=>{
  if(!navigator.geolocation){reject(new Error('Din webbläsare stöder inte platsinformation.'));return;}
  navigator.geolocation.getCurrentPosition(p=>resolve(p.coords),e=>reject(new Error(e.code===1?'Platsåtkomst nekades. Tillåt plats i webbläsarens inställningar.':'Kunde inte hitta din plats. Försök igen utomhus.')),{enableHighAccuracy:false,timeout:15000,maximumAge:300000});
});}
async function locate(){
  $('locate').disabled=true;$('status').textContent='Hämtar plats och aktuellt väder…';
  try{
    const {latitude,longitude}=await gps();
    const forecast=await fetchWeather(latitude,longitude);
    state.forecast=forecast;state.latitude=latitude;state.longitude=longitude;
    state.place='📍 Din nuvarande plats';state.last=new Date();
    chooseWeather();
  }catch(e){$('status').textContent=e.message || 'Något gick fel. Försök igen.';}
  finally{$('locate').disabled=false;}
}
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));