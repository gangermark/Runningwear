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
function chooseWeather(){
 if(!state.forecast)return;
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
  if(effective < -8){top='Underställ och varmt mellanlager';bottom='Varmare vintertights';}
  else if(effective < 0){top='Tunt underställ och löparväst';bottom='Långa löpartights';}
  else if(effective < 7){top='Långärmad funktionströja och löparväst';bottom='Långa löpartights';}
  else if(effective < 9){top='T-shirt eller tunn långärmad tröja';bottom='Shorts (eller tunna tights om du fryser lätt)';}
  else {top='T-shirt eller linne';bottom='Shorts';}
  if(rain){
    top=top.replace(' och löparväst','');
    top += ' + lätt regnjacka';
  } else if(windy){
    top=top.replace(' och löparväst','');
    top += ' + tunn vindjacka';
  }
  const hands = effective < 3 ? 'Tunna löparhandskar' : 'Inga handskar';
  const head = effective < -4 ? 'Använd jackans huva om du fryser' : 'Inget behövs';
  let tip = type === 'tempo' ? 'Du blir snabbt varm under intervaller. Klä dig lätt, men håll dig varm under uppvärmningen.' : type === 'long' ? 'Vid längre pass kan du bli kall när tempot sjunker. Ett extra tunt lager kan vara klokt.' : 'Det är normalt att känna sig lite sval de första 5–10 minuterna.';
  if(rain) tip += ' Det finns tecken på nederbörd – välj gärna plagg som fungerar när de blir fuktiga.';
  if(windy) tip += ' Vinden gör utsatta sträckor kallare.';
  return {top,bottom,hands,head,tip};
}
function render(){
  if(!state.weather)return;
  const w=state.weather, c=clothing(w,runType.value);
  $('weather').hidden=false; $('results').hidden=false;
  $('temp').textContent=Math.round(w.temperature_2m)+'°';
  $('feels').textContent=Math.round(w.apparent_temperature)+'°';
  $('wind').textContent=Math.round(w.wind_speed_10m/3.6)+' m/s';
  for(const key of ['top','bottom','hands','head','tip']) $(key).textContent=c[key];
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