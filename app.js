'use strict';
const $ = id => document.getElementById(id);
const state = { weather: null, place: '', last: null };
const runType = $('runType');
runType.value = localStorage.getItem('runready-run') || 'easy';
runType.addEventListener('change', () => { localStorage.setItem('runready-run',runType.value); render(); });
$('locate').addEventListener('click', locate);
$('refresh').addEventListener('click', locate);
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
  const head = effective < -4 ? 'Tunn löparmössa' : effective < 4 ? 'Pannband vid behov' : 'Ingen mössa';
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
  $('updated').textContent='Väder hämtat '+state.last.toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'})+' · Normal temperaturpreferens';
}
async function fetchWeather(lat,lon){
  const url=new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude',lat);url.searchParams.set('longitude',lon);
  url.searchParams.set('current','temperature_2m,apparent_temperature,wind_speed_10m,precipitation,weather_code');
  url.searchParams.set('wind_speed_unit','kmh');url.searchParams.set('timezone','auto');
  const res=await fetch(url);if(!res.ok)throw new Error('Vädertjänsten svarar inte. Försök igen.');
  const data=await res.json();if(!data.current || typeof data.current.apparent_temperature!=='number')throw new Error('Väderdata saknas just nu.');
  return data.current;
}
function gps(){return new Promise((resolve,reject)=>{
  if(!navigator.geolocation){reject(new Error('Din webbläsare stöder inte platsinformation.'));return;}
  navigator.geolocation.getCurrentPosition(p=>resolve(p.coords),e=>reject(new Error(e.code===1?'Platsåtkomst nekades. Tillåt plats i webbläsarens inställningar.':'Kunde inte hitta din plats. Försök igen utomhus.')),{enableHighAccuracy:false,timeout:15000,maximumAge:300000});
});}
async function locate(){
  $('locate').disabled=true;$('status').textContent='Hämtar plats och aktuellt väder…';
  try{
    const {latitude,longitude}=await gps();
    const w=await fetchWeather(latitude,longitude);
    state.weather=w;state.place='📍 Din nuvarande plats';state.last=new Date();
    $('status').textContent='Aktuellt väder för din position';render();
  }catch(e){$('status').textContent=e.message || 'Något gick fel. Försök igen.';}
  finally{$('locate').disabled=false;}
}
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));