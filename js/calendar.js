const calRoot=()=>db.ref("calendar");
const BASE_URL="https://raw.githubusercontent.com/darshanghimire03-lgtm/Nepali_Bs_Calender/main/";
const NAMES=["Baisakh","Jestha","Asadh","Shrawan","Bhadra","Ashwin","Kartik","Mangsir","Poush","Magh","Falgun","Chaitra"];
const ENG=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const NATIONAL_NODE="national_day";
const ROLES=["captain","professor"];
const TYPES=[
{key:"test",label:"Test",color:"#EF6C00"},
{key:"exam",label:"Exam",color:"#1A4FBF"},
{key:"festival",label:"Festival",color:"#D32F2F"},
{key:"national_day",label:"National Day",color:"#C2185B"},
{key:"school_event",label:"School Event",color:"#2E7D32"},
{key:"vacation",label:"Vacation",color:"#0288D1"},
{key:"emergency",label:"Holiday",color:"#212121"}
];
const MONTH_ALIASES=[
[1,["baisakh","baishakh","vaisakh","baisak"]],[2,["jestha","jyestha","jeth"]],[3,["asadh","ashadh","asar","asad"]],
[4,["shrawan","srawan","shravan","saun"]],[5,["bhadra","bhadau","bhado"]],[6,["ashwin","ashoj","asoj","aswin"]],
[7,["kartik","kattik"]],[8,["mangsir","mangshir","margashirsha"]],[9,["poush","paush","push"]],
[10,["magh"]],[11,["falgun","phalgun","fagun"]],[12,["chaitra","chait"]]
];
let canManage=false,role="",currentUser=null;
const cache={};
const state={year:0,month:1,today:null};
let yearEvents=[],national=[];
let shownMonth=[],shownAll=[];
let listenedYear=0,yearRef=null,yearCb=null;
let allCb=null,scrolledToUpcoming=false;

const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const typeOf=k=>TYPES.find(t=>t.key===k)||TYPES[2];
const ord=e=>TYPES.indexOf(typeOf(e.type));
const mName=m=>NAMES[m-1]||"";
const bsKey=(y,m,d)=>y*10000+m*100+d;
const fromKey=k=>({year:Math.floor(k/10000),month:Math.floor(k/100)%100,day:k%100});
const endOf=e=>Math.max(e.startKey,e.endKey);
const covers=(e,k)=>k>=e.startKey&&k<=endOf(e);
const pad=n=>String(n).padStart(2,"0");
function alpha(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
function clock(v){const p=String(v).split(":");const h=parseInt(p[0],10),m=parseInt(p[1],10);if(isNaN(h)||isNaN(m))return v;const s=h>=12?"PM":"AM";const t=h%12===0?12:h%12;return `${t}:${pad(m)} ${s}`}
function timeText(e){if(!e.startTime)return"";if(!e.endTime)return clock(e.startTime);return `${clock(e.startTime)} - ${clock(e.endTime)}`}
function rangeText(e){
  const s=fromKey(e.startKey),n=fromKey(endOf(e));
  const part=d=>`${mName(d.month)} ${d.day}`;
  if(e.startKey===endOf(e))return `${part(s)}, ${s.year}`;
  if(s.year===n.year)return `${part(s)} - ${part(n)}, ${s.year}`;
  return `${part(s)}, ${s.year} - ${part(n)}, ${n.year}`;
}
function rangeNoYear(e){
  const s=fromKey(e.startKey),n=fromKey(endOf(e));
  const part=d=>`${mName(d.month)} ${d.day}`;
  return e.startKey===endOf(e)?part(s):`${part(s)} - ${part(n)}`;
}
function toast(msg){
  const t=document.createElement("div");
  t.className="toast";t.textContent=msg;document.body.appendChild(t);
  setTimeout(()=>t.remove(),2600);
}
function progress(on){$("progress").style.display=on?"flex":"none"}

const txt=(v,k)=>typeof v[k]==="string"?v[k]:"";
const num=(v,k)=>typeof v[k]==="number"?Math.trunc(v[k]):null;
function buildEvent(year,month,type,snap){
  const v=snap.val();
  if(!v||typeof v!=="object")return null;
  const id=snap.key||"";
  const path=`${year}/${month}/${type.key}/${id}`;
  const base={id,type:type.key,title:"",description:"",subjects:[],startTime:"",endTime:"",photoUrl:"",path};
  if(type.key==="vacation"){
    const sm=num(v,"startMonth")??month;
    const sd=num(v,"startDay");
    if(sd==null)return null;
    const em=num(v,"endMonth")??sm;
    const ed=num(v,"endDay")??sd;
    return {...base,title:txt(v,"title"),description:txt(v,"description"),startKey:bsKey(year,sm,sd),endKey:bsKey(year,em,ed)};
  }
  const day=num(v,"day");
  if(day==null)return null;
  const key=bsKey(year,month,day);
  if(type.key==="exam"){
    const subject=txt(v,"subject");
    return {...base,title:subject?`${subject} Exam`:"Exam",subjects:subject?[subject]:[],startTime:txt(v,"startTime"),endTime:txt(v,"endTime"),startKey:key,endKey:key};
  }
  if(type.key==="test"){
    const subs=Object.values(v.subjects||{}).filter(s=>typeof s==="string");
    return {...base,title:subs.length?`${subs.join(" · ")} Test`:"Test",subjects:subs,startKey:key,endKey:key};
  }
  if(type.key==="festival"){
    return {...base,title:txt(v,"title"),description:txt(v,"description"),photoUrl:txt(v,"photoUrl"),startKey:key,endKey:key};
  }
  if(type.key==="school_event"||type.key==="emergency"){
    return {...base,title:txt(v,"title"),description:txt(v,"description"),startKey:key,endKey:key};
  }
  return null;
}
function parseYearSnap(year,snap){
  const out=[];
  snap.forEach(ms=>{
    const month=parseInt(ms.key,10);
    if(isNaN(month))return false;
    ms.forEach(ts=>{
      const type=TYPES.find(t=>t.key===ts.key);
      if(!type||type.key===NATIONAL_NODE)return false;
      ts.forEach(es=>{
        const e=buildEvent(year,month,type,es);
        if(e)out.push(e);
        return false;
      });
      return false;
    });
    return false;
  });
  return out;
}
function parseNationalSnap(snap){
  const out=[];
  snap.forEach(c=>{
    const v=c.val();
    if(!v||typeof v!=="object")return false;
    const month=num(v,"month"),day=num(v,"day");
    if(month==null||day==null)return false;
    out.push({id:txt(v,"id")||c.key||"",month,day,title:txt(v,"title"),description:txt(v,"description"),photoUrl:txt(v,"photoUrl"),path:`${NATIONAL_NODE}/${c.key||""}`});
    return false;
  });
  return out;
}
function nationalToEvent(n,year){
  const k=bsKey(year,n.month,n.day);
  return {id:n.id,type:"national_day",title:n.title,description:n.description,subjects:[],startTime:"",endTime:"",photoUrl:n.photoUrl||"",startKey:k,endKey:k,path:n.path};
}
function removeEvent(path){
  if(!canManage)return Promise.reject(new Error("Not allowed"));
  if(!path)return Promise.reject(new Error("Invalid event"));
  return calRoot().child(path).remove();
}
function listenNational(){
  db.ref("calendar/"+NATIONAL_NODE).on("value",snap=>{
    national=parseNationalSnap(snap);
    render();
  },err=>toast("Calendar sync failed: "+err.message));
}
function ensureYearListener(year){
  if(listenedYear===year)return;
  if(yearRef&&yearCb)yearRef.off("value",yearCb);
  yearEvents=[];
  listenedYear=year;
  yearRef=db.ref("calendar/"+year);
  yearCb=yearRef.on("value",snap=>{
    yearEvents=parseYearSnap(year,snap);
    render();
  },err=>toast("Calendar sync failed: "+err.message));
}

function monthFromName(name){
  if(!name)return null;
  const l=String(name).trim().toLowerCase();
  for(const [i,al] of MONTH_ALIASES){if(al.some(a=>l.startsWith(a)))return i}
  return null;
}
function firstInt(o,keys){
  for(const k of keys){
    if(!(k in o)||o[k]===null)continue;
    const v=o[k];
    if(typeof v==="number")return Math.trunc(v);
    if(typeof v==="string"&&/^\s*-?\d+\s*$/.test(v))return parseInt(v,10);
  }
  return null;
}
function firstString(o,keys){
  for(const k of keys){
    if(!(k in o)||o[k]===null)continue;
    const v=o[k];
    if(typeof v==="string"&&v.trim()!=="")return v;
  }
  return null;
}
function parseTriple(text){
  const m=/(\d+)\D+(\d+)\D+(\d+)/.exec(text);
  if(!m)return null;
  const a=parseInt(m[1],10),b=parseInt(m[2],10),c=parseInt(m[3],10);
  if(a>31)return [a,b,c];
  if(c>31)return [c,b,a];
  return null;
}
function adFromParts(n){
  const y=firstInt(n,["adYear","ad_year","engYear"]);if(y==null)return null;
  const m=firstInt(n,["adMonth","ad_month","engMonth"]);if(m==null)return null;
  const d=firstInt(n,["adDay","ad_day","engDay"]);if(d==null)return null;
  return [y,m,d];
}
function weekdayFrom(n){
  const text=firstString(n,["weekday","dayOfWeek","day_of_week","dow","dayName","day_name"]);
  if(text!=null){
    const l=text.trim().toLowerCase();
    const i=["sun","mon","tue","wed","thu","fri","sat"].findIndex(s=>l.startsWith(s));
    if(i>=0)return i;
  }
  const number=firstInt(n,["weekday","dayOfWeek","day_of_week","dow"]);
  return number!=null&&number>=0&&number<=6?number:null;
}
function walk(node,year,month,dayHint,out){
  if(Array.isArray(node)){
    for(const item of node)walk(item,year,month,null,out);
    return;
  }
  if(node===null||typeof node!=="object")return;
  const ny=firstInt(node,["year","bsYear","bs_year"])??year;
  const nm=firstInt(node,["month","bsMonth","bs_month","monthIndex"])??monthFromName(firstString(node,["monthName","month_name","month"]))??month;
  const nd=firstInt(node,["day","bsDay","bs_day","nepaliDay","np_day","dayNumber"])??dayHint;
  const bsStr=firstString(node,["bs","bsDate","bs_date","nepaliDate","nepali_date","np","npDate"]);
  const bsTriple=bsStr?parseTriple(bsStr):null;
  const resolved=bsTriple??((ny!=null&&nm!=null&&nd!=null)?[ny,nm,nd]:null);
  if(resolved){
    const adStr=firstString(node,["ad","adDate","ad_date","english","englishDate","english_date","eng","engDate","gregorian","date"]);
    const adTriple=(adStr?parseTriple(adStr):null)??adFromParts(node);
    out.push({year:resolved[0],month:resolved[1],day:resolved[2],ad:adTriple?{year:adTriple[0],month:adTriple[1],day:adTriple[2]}:null,weekday:weekdayFrom(node)});
    return;
  }
  for(const key of Object.keys(node)){
    const value=node[key];
    if(value===null||typeof value!=="object")continue;
    let cy=ny,cm=nm,cd=null;
    const number=/^-?\d+$/.test(key)?parseInt(key,10):null;
    if(number!=null){
      if(number>=1000&&number<=9999)cy=number;
      else if(cy!=null&&cm==null&&number>=1&&number<=12)cm=number;
      else if(cm!=null&&number>=1&&number<=32)cd=number;
    }else{
      const mf=monthFromName(key);
      if(mf!=null)cm=mf;
    }
    walk(value,cy,cm,cd,out);
  }
}
function weekdayOf(entry){
  if(entry.weekday!=null)return entry.weekday;
  if(!entry.ad)return null;
  return new Date(entry.ad.year,entry.ad.month-1,entry.ad.day).getDay();
}
function parseYearData(text,year){
  const root=JSON.parse(text);
  const entries=[];
  walk(root,null,null,null,entries);
  const groups={};
  entries.filter(e=>e.year===year).forEach(e=>{(groups[e.month]=groups[e.month]||[]).push(e)});
  const result={};
  Object.keys(groups).forEach(k=>{
    const month=parseInt(k,10);
    const sorted=groups[k].sort((a,b)=>a.day-b.day);
    const ref=sorted.find(e=>weekdayOf(e)!=null);
    const start=ref?((((weekdayOf(ref)||0)-(ref.day-1))%7)+7)%7:0;
    const adDays={};
    sorted.forEach(e=>{if(e.ad)adDays[e.day]=e.ad});
    result[month]={year,month,days:sorted[sorted.length-1].day,startWeekday:start,adDays};
  });
  return result;
}
function buildOffline(year){
  const lens=[31,31,32,31,31,31,30,29,30,29,30,30];
  let d=new Date(year-57,3,14);
  const result={};
  lens.forEach((len,i)=>{
    const adDays={};
    const startWeekday=d.getDay();
    for(let day=1;day<=len;day++){
      adDays[day]={year:d.getFullYear(),month:d.getMonth()+1,day:d.getDate()};
      d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1);
    }
    result[i+1]={year,month:i+1,days:len,startWeekday,adDays};
  });
  return result;
}
async function loadYear(year){
  if(cache[year])return cache[year];
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),15000);
  try{
    const res=await fetch(`${BASE_URL}${year}.json`,{signal:ctl.signal});
    if(!res.ok)throw new Error("HTTP "+res.status);
    const parsed=parseYearData(await res.text(),year);
    if(Object.keys(parsed).length)cache[year]=parsed;
  }catch(e){}
  clearTimeout(timer);
  return cache[year]||null;
}
function findToday(){
  const now=new Date();
  const y=now.getFullYear(),m=now.getMonth()+1,d=now.getDate();
  for(const year of Object.keys(cache)){
    const months=cache[year];
    for(const month of Object.keys(months)){
      const ad=months[month].adDays;
      for(const day of Object.keys(ad)){
        const a=ad[day];
        if(a.year===y&&a.month===m&&a.day===d)return {year:parseInt(year,10),month:parseInt(month,10),day:parseInt(day,10)};
      }
    }
  }
  return null;
}

function svgClip(){return '<svg viewBox="0 0 24 24"><path d="M9 4h6v3H9zM7 5H5v15h14V5h-2M8 12l2.5 2.5L16 9"/></svg>'}
function dayCells(){
  const month=cache[state.year][state.month];
  const all=yearEvents.concat(national.map(n=>nationalToEvent(n,state.year)));
  const cells=[];
  for(let i=0;i<month.startWeekday;i++)cells.push({day:0});
  for(let day=1;day<=month.days;day++){
    const key=bsKey(state.year,state.month,day);
    const idx=(month.startWeekday+day-1)%7;
    cells.push({
      day,key,
      eng:month.adDays[day]?month.adDays[day].day:null,
      isToday:state.today&&bsKey(state.today.year,state.today.month,state.today.day)===key,
      isSaturday:idx===6,isSunday:idx===0,
      events:all.filter(e=>covers(e,key)).sort((a,b)=>ord(a)-ord(b))
    });
  }
  return {cells,all,month};
}
function cellHtml(cell,i){
  if(cell.day===0)return '<div class="cell empty"></div>';
  const isWeekend=cell.isSaturday||cell.isSunday;
  const shown=cell.events.filter(e=>!(isWeekend&&e.type==="vacation"));
  const hasExam=cell.events.some(e=>e.type==="exam");
  const styled=shown.filter(e=>e.type!=="exam");
  const top=styled.length?typeOf(styled[0].type):null;
  const withPhoto=styled.find(e=>e.photoUrl);
  const photoUrl=withPhoto?withPhoto.photoUrl:"";
  const hasPhoto=!!photoUrl&&!!top;
  let fill,dayColor,engColor,stroke=null,strokeW=1.5,dot=null;
  if(hasPhoto){
    fill="transparent";dayColor="#fff";engColor="rgba(255,255,255,.85)";
    stroke=cell.isToday?"#2F6BFF":top.color;strokeW=2;dot=cell.isToday?"#fff":top.color;
  }else if(cell.isToday){
    fill="#1F3F7F";dayColor="#fff";engColor="rgba(255,255,255,.7)";
  }else if(top){
    fill=alpha(top.color,.141);dayColor=top.color;engColor=alpha(top.color,.6);stroke=top.color;dot=top.color;
  }else if(isWeekend){
    fill="#FDECEE";dayColor="#E5484D";engColor=alpha("#E5484D",.6);stroke="#E5484D";
  }else{
    fill="#EEF3FD";dayColor="#14224A";engColor="#9AA3B5";
  }
  return `<div class="cell${cell.isToday?" today":""}" data-i="${i}" style="background:${fill}">`+
    (hasPhoto?`<img class="ph" src="${esc(photoUrl)}" alt=""><span class="sh"></span>`:"")+
    (stroke?`<span class="bd" style="border:${strokeW}px solid ${stroke}"></span>`:"")+
    (dot?`<span class="dot" style="background:${dot}"></span>`:"")+
    `<span class="d" style="color:${dayColor};${hasPhoto?"text-shadow:0 1px 6px rgba(0,0,0,.6)":""}">${cell.day}</span>`+
    `<span class="e" style="color:${engColor}">${cell.eng==null?"":cell.eng}</span>`+
    (hasExam?`<span class="ex">${svgClip()}</span>`:"")+
  `</div>`;
}
function englishRange(month){
  const keys=Object.keys(month.adDays).map(Number).sort((a,b)=>a-b);
  if(!keys.length)return"";
  const f=month.adDays[keys[0]],l=month.adDays[keys[keys.length-1]];
  const fn=ENG[f.month-1]||"",ln=ENG[l.month-1]||"";
  if(f.year!==l.year)return `${fn} ${f.year} - ${ln} ${l.year}`;
  if(f.month!==l.month)return `${fn} - ${ln} ${f.year}`;
  return `${fn} ${f.year}`;
}
function eventItem(e,todayKey,i){
  const t=typeOf(e.type);
  const time=timeText(e);
  const base=`${t.label} · ${rangeText(e)}`;
  const sub=e.type==="exam"&&time?`${base} · ${time}`:base;
  const s=fromKey(e.startKey),n=fromKey(endOf(e));
  let day="";
  if(e.type==="vacation"&&todayKey!=null){
    if(todayKey===e.startKey)day="Start";
    else if(todayKey===endOf(e))day="End";
  }else{
    day=(endOf(e)!==e.startKey&&n.month===s.month&&n.year===s.year)?`${s.day}-${n.day}`:String(s.day);
  }
  return `<div class="ev" data-i="${i}">
    <div class="bg" style="background:${t.color}">${e.photoUrl?`<img src="${esc(e.photoUrl)}" alt="">`:esc(t.label.charAt(0).toUpperCase())}</div>
    <div class="m"><b>${esc(e.title)}</b><span>${esc(sub)}</span></div>
    ${day?`<div class="dy" style="background:${alpha(t.color,.12)};color:${t.color}">${day}</div>`:""}
  </div>`;
}
function render(){
  if(!state.year||!cache[state.year]||!cache[state.year][state.month])return;
  const {cells,all,month}=dayCells();
  $("mLabel").textContent=`${mName(state.month)} ${state.year}`;
  $("mSub").textContent=englishRange(month);
  const grid=$("grid");
  grid.innerHTML=cells.map(cellHtml).join("");
  grid.onclick=ev=>{
    const c=ev.target.closest(".cell");
    if(!c||c.classList.contains("empty"))return;
    showDayDialog(cells[parseInt(c.dataset.i,10)]);
  };
  const first=bsKey(state.year,state.month,1),last=bsKey(state.year,state.month,32);
  const monthEvents=all.filter(e=>e.startKey<=last&&endOf(e)>=first).sort((a,b)=>a.startKey-b.startKey||ord(a)-ord(b));
  const today=state.today;
  const isCurrent=today&&today.year===state.year&&today.month===state.month;
  const todayKey=today?bsKey(today.year,today.month,today.day):null;
  const relevant=isCurrent?monthEvents.filter(e=>endOf(e)>=todayKey):monthEvents;
  shownMonth=relevant.slice(0,3);
  $("monthList").innerHTML=shownMonth.map((e,i)=>eventItem(e,todayKey,i)).join("");
  $("monthList").onclick=ev=>{
    const c=ev.target.closest(".ev");
    if(c)showEventDetail(shownMonth[parseInt(c.dataset.i,10)]);
  };
  $("emptyT").textContent=isCurrent?"No upcoming events this month":"No events this month";
  $("emptyT").style.display=relevant.length?"none":"block";
  $("seeAll").style.display=all.length?"inline-block":"none";
}
function show(year,month){
  state.year=year;state.month=month;
  ensureYearListener(year);
  render();
}
async function changeMonth(delta){
  if(!state.year)return;
  let year=state.year,month=state.month+delta;
  if(month>12){month=1;year++}else if(month<1){month=12;year--}
  if(year===state.year){show(year,month);return}
  progress(true);
  const data=await loadYear(year);
  progress(false);
  if(data&&data[month])show(year,month);
  else toast(`Calendar data for ${year} isn't available`);
}
async function startCalendar(){
  const now=new Date();
  const estimate=now.getFullYear()+(now.getMonth()>=3?57:56);
  const years=[estimate,estimate-1,estimate+1];
  progress(true);
  listenNational();
  let fallback=null;
  for(const y of years){
    const data=await loadYear(y);
    if(!data)continue;
    const today=findToday();
    if(today){
      state.today=today;
      progress(false);
      show(today.year,today.month);
      return;
    }
    if(fallback==null)fallback=y;
  }
  if(fallback!=null){
    progress(false);
    show(fallback,1);
    return;
  }
  cache[estimate]=buildOffline(estimate);
  state.today=findToday()||{year:estimate,month:1,day:1};
  progress(false);
  toast("Offline: showing approximate dates");
  show(state.today.year,state.today.month);
}

function openLayer(html){
  const scrim=document.createElement("div");
  scrim.className="scrim";
  scrim.innerHTML=html;
  document.body.appendChild(scrim);
  const api={el:scrim,close(){scrim.remove()}};
  scrim.addEventListener("mousedown",e=>{if(e.target===scrim)api.close()});
  return api;
}
function monthLengths(year){
  return Array.from({length:12},(_,i)=>cache[year]&&cache[year][i+1]?cache[year][i+1].days:32).join(",");
}
function goAdd(month,day,editPath){
  if(!canManage){toast("Only captain or professor can do this");return}
  const p=new URLSearchParams({year:String(state.year),month:String(month),day:String(day),ml:monthLengths(state.year)});
  if(editPath)p.set("edit",editPath);
  location.href="add-event.html?"+p.toString();
}
function showDayDialog(cell){
  const month=cache[state.year][state.month];
  const ad=month.adDays[cell.day];
  const eng=ad?` · ${ENG[ad.month-1]||""} ${ad.day}`:"";
  const n=cell.events.length;
  const sub=n===0?"No events":n===1?"1 event":`${n} events`;
  const todayKey=state.today?bsKey(state.today.year,state.today.month,state.today.day):null;
  const layer=openLayer(`<div class="dlg">
    <div class="hd"><div class="t"><b>${mName(state.month)} ${cell.day}${eng}</b><span>${sub}</span></div><button class="x" data-c>×</button></div>
    ${n?`<div class="dl" id="dl">${cell.events.map((e,i)=>eventItem(e,todayKey,i)).join("")}</div>`:`<div class="dempty">No events on this day</div>`}
    <div class="btns"><button class="btn" data-c>Close</button>${canManage?`<button class="btn p" id="dAdd">Add event</button>`:""}</div>
  </div>`);
  layer.el.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>layer.close());
  const add=layer.el.querySelector("#dAdd");
  if(add)add.onclick=()=>{layer.close();goAdd(state.month,cell.day)};
  const dl=layer.el.querySelector("#dl");
  if(dl)dl.onclick=ev=>{
    const c=ev.target.closest(".ev");
    if(!c)return;
    const e=cell.events[parseInt(c.dataset.i,10)];
    layer.close();
    showEventDetail(e);
  };
}
function ic(path){return `<svg viewBox="0 0 24 24">${path}</svg>`}
function showEventDetail(e,manage){
  const can=(manage===undefined?canManage:manage)&&canManage;
  const t=typeOf(e.type);
  const dateText=e.type==="national_day"?`${rangeNoYear(e)} · every year`:rangeNoYear(e);
  const time=timeText(e);
  const layer=openLayer(`<div class="dlg flush">
    <div class="dh" style="background:${alpha(t.color,.141)}">
      <div class="row">
        <div class="bg" style="background:${t.color}">${e.photoUrl?`<img src="${esc(e.photoUrl)}" alt="">`:esc(t.label.charAt(0).toUpperCase())}</div>
        <span class="pill" style="color:${t.color}">${esc(t.label)}</span>
      </div>
      <button class="x" data-c>✕</button>
    </div>
    <div class="db">
      <h3>${esc(e.title)}</h3>
      <div class="ir"><div class="tl">${ic('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>')}</div><div><small>Date</small><span>${esc(dateText)}</span></div></div>
      ${time?`<div class="ir"><div class="tl">${ic('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>')}</div><div><small>Time</small><span>${esc(time)}</span></div></div>`:""}
      ${e.subjects&&e.subjects.length?`<div class="ir"><div class="tl">${ic('<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3zM5 17a3 3 0 013-3h11"/>')}</div><div><small>${e.subjects.length===1?"Subject":"Subjects"}</small><span>${esc(e.subjects.join(", "))}</span></div></div>`:""}
      ${e.description?`<div class="desc">${esc(e.description)}</div>`:""}
    </div>
    <div class="dft"><div class="btns">${can?`<button class="btn d" id="eDel">Delete</button><button class="btn p" id="eEdit">Edit</button>`:`<button class="btn p" data-c>Done</button>`}</div></div>
  </div>`);
  layer.el.querySelectorAll("[data-c]").forEach(b=>b.onclick=()=>layer.close());
  const ed=layer.el.querySelector("#eEdit"),del=layer.el.querySelector("#eDel");
  if(ed)ed.onclick=()=>{layer.close();const s=fromKey(e.startKey);goAdd(s.month,s.day,e.path)};
  if(del)del.onclick=()=>{layer.close();confirmDelete(e)};
}
function confirmDelete(e){
  if(!canManage)return;
  const layer=openLayer(`<div class="dlg">
    <div class="hd"><div class="t"><b>Delete event?</b><span>${esc(e.title)}</span></div></div>
    <div class="dempty">This can't be undone.</div>
    <div class="btns"><button class="btn" data-c>Cancel</button><button class="btn d" id="cDel">Delete</button></div>
  </div>`);
  layer.el.querySelector("[data-c]").onclick=()=>layer.close();
  const btn=layer.el.querySelector("#cDel");
  btn.onclick=()=>{
    btn.disabled=true;
    btn.textContent="Deleting...";
    removeEvent(e.path).then(()=>{
      layer.close();
      toast("Event deleted");
    }).catch(err=>{
      btn.disabled=false;
      btn.textContent="Delete";
      toast("Couldn't delete: "+err.message);
    });
  };
}
function showAccount(){
  if(currentUser){
    const layer=openLayer(`<div class="dlg">
      <div class="hd"><div class="t"><b>Account</b><span>${esc(currentUser.email||"")}</span></div><button class="x" data-c>×</button></div>
      <div class="rolebadge">${role?"Role: "+esc(role):"Viewer (no edit access)"}</div>
      <div class="btns" style="margin-top:16px"><button class="btn d" id="so">Sign out</button></div>
    </div>`);
    layer.el.querySelector("[data-c]").onclick=()=>layer.close();
    layer.el.querySelector("#so").onclick=()=>{auth.signOut();layer.close()};
    return;
  }
  const layer=openLayer(`<div class="dlg">
    <div class="hd"><div class="t"><b>Sign in</b><span>Captain or professor</span></div><button class="x" data-c>×</button></div>
    <input class="fld" id="lEmail" type="email" placeholder="Email" autocomplete="username">
    <input class="fld" id="lPass" type="password" placeholder="Password" autocomplete="current-password">
    <div class="btns" style="margin-top:16px"><button class="btn p" id="lGo">Sign in</button></div>
  </div>`);
  layer.el.querySelector("[data-c]").onclick=()=>layer.close();
  const go=layer.el.querySelector("#lGo");
  go.onclick=async()=>{
    const email=layer.el.querySelector("#lEmail").value.trim();
    const pass=layer.el.querySelector("#lPass").value;
    if(!email||!pass){toast("Enter email and password");return}
    go.disabled=true;go.textContent="Signing in...";
    try{
      await auth.signInWithEmailAndPassword(email,pass);
      layer.close();
    }catch(e){
      go.disabled=false;go.textContent="Sign in";
      toast(e.message);
    }
  };
}

function openAll(){
  $("allPage").style.display="block";
  scrolledToUpcoming=false;
  allCb=calRoot().on("value",snap=>{
    const list=[];
    let latestYear=0;
    let nat=[];
    snap.forEach(child=>{
      const key=child.key||"";
      if(key===NATIONAL_NODE){nat=parseNationalSnap(child);return false}
      const year=parseInt(key,10);
      if(isNaN(year))return false;
      latestYear=Math.max(latestYear,year);
      list.push(...parseYearSnap(year,child));
      return false;
    });
    const nationalYear=state.today?state.today.year:latestYear;
    if(nationalYear>0)list.push(...nat.map(n=>nationalToEvent(n,nationalYear)));
    list.sort((a,b)=>a.startKey-b.startKey||ord(a)-ord(b));
    shownAll=list;
    const todayKey=state.today?bsKey(state.today.year,state.today.month,state.today.day):null;
    $("allList").innerHTML=list.map((e,i)=>eventItem(e,todayKey,i)).join("");
    $("allCount").textContent=list.length===1?"1 event":`${list.length} events`;
    $("allCount").style.display=list.length?"block":"none";
    $("allEmpty").style.display=list.length?"none":"block";
    if(!scrolledToUpcoming&&list.length&&todayKey!=null){
      scrolledToUpcoming=true;
      const idx=list.findIndex(e=>endOf(e)>=todayKey);
      if(idx>0){
        const node=$("allList").children[idx];
        if(node)setTimeout(()=>$("allPage").scrollTo({top:node.offsetTop-80}),0);
      }
    }
  },()=>{
    $("allEmpty").textContent="Couldn't load events";
    $("allEmpty").style.display="block";
  });
}
function closeAll(){
  $("allPage").style.display="none";
  if(allCb){calRoot().off("value",allCb);allCb=null}
}
function applyRole(){
  canManage=ROLES.includes(role);
  $("addBtn").style.display=canManage?"flex":"none";
  render();
}
auth.onAuthStateChanged(async user=>{
  currentUser=user;
  role="";
  if(user){
    try{
      const snap=await db.ref("roles/"+user.uid).once("value");
      const v=snap.val();
      role=typeof v==="string"?v:"";
    }catch(e){role=""}
  }
  applyRole();
});
$("allList").onclick=ev=>{
  const c=ev.target.closest(".ev");
  if(c)showEventDetail(shownAll[parseInt(c.dataset.i,10)],false);
};
$("prev").onclick=()=>changeMonth(-1);
$("next").onclick=()=>changeMonth(1);
$("seeAll").onclick=openAll;
$("allBack").onclick=closeAll;
$("userBtn").onclick=showAccount;
$("addBtn").onclick=()=>{
  const t=state.today;
  const dd=t&&t.year===state.year&&t.month===state.month?t.day:1;
  goAdd(state.month,dd);
};
startCalendar();