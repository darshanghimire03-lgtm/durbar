const calRoot=()=>db.ref("calendar");
const NAMES=["Baisakh","Jestha","Asadh","Shrawan","Bhadra","Ashwin","Kartik","Mangsir","Poush","Magh","Falgun","Chaitra"];
const SUBJECTS=["Economic","Account","Computer Science","English","Nepali","Social"];
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
const params=new URLSearchParams(location.search);
const pYear=parseInt(params.get("year"),10)||0;
const pMonth=parseInt(params.get("month"),10)||1;
const pDay=parseInt(params.get("day"),10)||1;
const monthLens=(params.get("ml")||"").split(",").map(n=>parseInt(n,10));
const editPath=params.get("edit")||"";

const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const typeOf=k=>TYPES.find(t=>t.key===k)||TYPES[2];
const mName=m=>NAMES[m-1]||"";
const bsKey=(y,m,d)=>y*10000+m*100+d;
const fromKey=k=>({year:Math.floor(k/10000),month:Math.floor(k/100)%100,day:k%100});
const endOf=e=>Math.max(e.startKey,e.endKey);
const pad=n=>String(n).padStart(2,"0");
const txt=(v,k)=>typeof v[k]==="string"?v[k]:"";
const num=(v,k)=>typeof v[k]==="number"?Math.trunc(v[k]):null;
const monthLength=m=>monthLens[m-1]||32;

function toast(msg){
  const t=document.createElement("div");
  t.className="toast";t.textContent=msg;document.body.appendChild(t);
  setTimeout(()=>t.remove(),2600);
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
function denied(msg){
  $("form").classList.add("h");
  $("gate").style.display="block";
  $("gate").innerHTML=`${esc(msg)}<br><br><a href="calendar.html">Back to calendar</a>`;
}

function buildEvent(year,month,typeKey,id,v,path){
  if(!v||typeof v!=="object")return null;
  const base={id,type:typeKey,title:"",description:"",subjects:[],startTime:"",endTime:"",photoUrl:"",path};
  if(typeKey==="vacation"){
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
  if(typeKey==="exam"){
    const subject=txt(v,"subject");
    return {...base,subjects:subject?[subject]:[],startTime:txt(v,"startTime"),endTime:txt(v,"endTime"),startKey:key,endKey:key};
  }
  if(typeKey==="test"){
    const subs=Object.values(v.subjects||{}).filter(s=>typeof s==="string");
    return {...base,subjects:subs,startKey:key,endKey:key};
  }
  if(typeKey==="festival"){
    return {...base,title:txt(v,"title"),description:txt(v,"description"),photoUrl:txt(v,"photoUrl"),startKey:key,endKey:key};
  }
  if(typeKey==="school_event"||typeKey==="emergency"){
    return {...base,title:txt(v,"title"),description:txt(v,"description"),startKey:key,endKey:key};
  }
  return null;
}
async function loadEditing(){
  if(!editPath)return null;
  const snap=await db.ref("calendar/"+editPath).once("value");
  const v=snap.val();
  if(!v)return null;
  const parts=editPath.split("/");
  if(parts[0]===NATIONAL_NODE){
    const m=num(v,"month"),d=num(v,"day");
    if(m==null||d==null)return null;
    const k=bsKey(pYear,m,d);
    return {id:parts[1],type:"national_day",title:txt(v,"title"),description:txt(v,"description"),subjects:[],startTime:"",endTime:"",photoUrl:txt(v,"photoUrl"),startKey:k,endKey:k,path:editPath};
  }
  return buildEvent(parseInt(parts[0],10),parseInt(parts[1],10),parts[2],parts[3],v,editPath);
}
function pathFor(ev){
  const s=fromKey(ev.startKey);
  if(ev.type==="national_day")return `${NATIONAL_NODE}/${pad(s.month)}-${pad(s.day)}`;
  return `${s.year}/${s.month}/${ev.type}/${ev.id}`;
}
function toDbMap(ev){
  const s=fromKey(ev.startKey),n=fromKey(endOf(ev));
  switch(ev.type){
    case "exam":return {id:ev.id,day:s.day,subject:ev.subjects[0]||"",startTime:ev.startTime,endTime:ev.endTime};
    case "test":return {id:ev.id,day:s.day,subjects:ev.subjects};
    case "festival":return {id:ev.id,day:s.day,title:ev.title,description:ev.description,photoUrl:ev.photoUrl};
    case "school_event":
    case "emergency":return {id:ev.id,day:s.day,title:ev.title,description:ev.description};
    case "vacation":return {id:ev.id,title:ev.title,description:ev.description,startMonth:s.month,startDay:s.day,endMonth:n.month,endDay:n.day};
    default:return {id:ev.id,title:ev.title,description:ev.description,photoUrl:ev.photoUrl,month:s.month,day:s.day};
  }
}
function saveEvent(ev,previousPath){
  const newPath=pathFor(ev);
  const updates={};
  if(previousPath&&previousPath!==newPath)updates[previousPath]=null;
  updates[newPath]=toDbMap(ev);
  return calRoot().update(updates);
}

function pickMonthDay(m0,d0,cb){
  const layer=openLayer(`<div class="dlg">
    <div class="hd"><div class="t"><b>Select month and day</b></div></div>
    <div class="pick"><select id="pm">${NAMES.map((n,i)=>`<option value="${i+1}"${i+1===m0?" selected":""}>${n}</option>`).join("")}</select><select id="pd"></select></div>
    <div class="btns"><button class="btn" data-c>Cancel</button><button class="btn p" id="pOk">OK</button></div>
  </div>`);
  const pm=layer.el.querySelector("#pm"),pd=layer.el.querySelector("#pd");
  function fillDays(keep){
    const max=monthLength(parseInt(pm.value,10));
    pd.innerHTML=Array.from({length:max},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join("");
    pd.value=String(Math.min(keep,max));
  }
  fillDays(d0);
  pm.onchange=()=>fillDays(parseInt(pd.value,10));
  layer.el.querySelector("[data-c]").onclick=()=>layer.close();
  layer.el.querySelector("#pOk").onclick=()=>{layer.close();cb(parseInt(pm.value,10),parseInt(pd.value,10))};
}
function pickSubjects(type,selected,cb){
  const single=type==="exam";
  const layer=openLayer(`<div class="dlg">
    <div class="hd"><div class="t"><b>Subject</b></div></div>
    <div class="sl">${SUBJECTS.map(s=>`<label class="si"><input type="${single?"radio":"checkbox"}" name="sub" value="${esc(s)}"${selected.includes(s)?" checked":""}>${esc(s)}</label>`).join("")}</div>
    <div class="btns"><button class="btn" data-c>Cancel</button><button class="btn p" id="sOk">Done</button></div>
  </div>`);
  layer.el.querySelector("[data-c]").onclick=()=>layer.close();
  layer.el.querySelector("#sOk").onclick=()=>{
    const vals=[...layer.el.querySelectorAll("input:checked")].map(i=>i.value);
    layer.close();
    cb(vals);
  };
}
function prepareImage(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onerror=()=>rej(new Error("Could not read image"));
    r.onload=()=>{
      const img=new Image();
      img.onerror=()=>rej(new Error("Could not read image"));
      img.onload=()=>{
        const max=1280,sc=Math.min(1,max/Math.max(img.width,img.height));
        const c=document.createElement("canvas");
        c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
        c.getContext("2d").drawImage(img,0,0,c.width,c.height);
        c.toBlob(b=>b?res({blob:b,preview:c.toDataURL("image/jpeg",.7)}):rej(new Error("Could not process image")),"image/jpeg",.85);
      };
      img.src=r.result;
    };
    r.readAsDataURL(file);
  });
}
async function uploadImage(blob){
  if(!storage)throw new Error("Storage is not available");
  const ref=storage.ref(`calendar_photos/${auth.currentUser.uid}/img_${Date.now()}.jpg`);
  await ref.put(blob,{contentType:"image/jpeg"});
  return ref.getDownloadURL();
}

function initForm(editing,role){
  $("gate").style.display="none";
  $("form").classList.remove("h");
  $("sRole").textContent=role;
  $("sTitle").textContent=editing?"Edit event":"Add event";
  $("sTypes").innerHTML=TYPES.map((t,i)=>`<button class="chip" data-t="${i}">${esc(t.label)}</button>`).join("");
  const saveLabel=editing?"Update event":"Save event";
  $("fSave").textContent=saveLabel;
  let type=editing?editing.type:"festival";
  let date=editing?fromKey(editing.startKey):{year:pYear,month:pMonth,day:pDay};
  const eventYear=date.year;
  const es=editing?fromKey(editing.startKey):null,ee=editing?fromKey(endOf(editing)):null;
  let rsM=es?es.month:pMonth,rsD=es?es.day:pDay,reM=ee?ee.month:pMonth,reD=ee?ee.day:pDay;
  let startTime=editing?editing.startTime:"",endTime=editing?editing.endTime:"";
  let photoUrl=editing?editing.photoUrl:"";
  let pickedBlob=null,pickedPreview="";
  let selected=editing?editing.subjects.slice():[];
  if(editing){$("fTitle").value=editing.title;$("fDesc").value=editing.description}

  function renderDates(){
    $("fStart").textContent=`${mName(date.month)} ${date.day}`;
    $("fRs").textContent=`${mName(rsM)} ${rsD}`;
    $("fRe").textContent=`${mName(reM)} ${reD}`;
    $("fTs").value=startTime;$("fTe").value=endTime;
  }
  function renderSubjects(){$("fSubj").textContent=selected.length?selected.join(", "):"Subject"}
  function renderPhoto(){
    const box=$("fPhoto");
    const src=pickedPreview||photoUrl;
    box.querySelectorAll("img").forEach(i=>i.remove());
    $("fHint").style.display=src?"none":"block";
    if(src){const im=document.createElement("img");im.src=src;box.appendChild(im)}
  }
  function applyType(){
    const usesSubjects=type==="test"||type==="exam";
    const usesText=!usesSubjects;
    const usesPhoto=type==="festival"||type==="national_day";
    if(type==="exam"&&selected.length>1)selected=[selected[0]];
    $("fSubj").style.display=usesSubjects?"block":"none";
    $("fTitle").style.display=usesText?"block":"none";
    $("fMedia").style.display=usesText?"grid":"none";
    $("fMedia").classList.toggle("has",usesPhoto);
    $("fPhoto").style.display=usesPhoto?"flex":"none";
    $("fDesc").style.height=(usesPhoto||type==="vacation")?"":"96px";
    $("fDate").style.display=type==="vacation"?"none":"block";
    $("fRange").style.display=type==="vacation"?"block":"none";
    $("fTime").style.display=type==="exam"?"block":"none";
    $("fSave").style.background=typeOf(type).color;
    document.querySelectorAll(".chip").forEach(c=>{
      const t=TYPES[parseInt(c.dataset.t,10)];
      const on=t.key===type;
      c.style.background=on?t.color:"";
      c.style.color=on?"#fff":"";
    });
    renderSubjects();renderDates();renderPhoto();
  }
  applyType();

  $("back").onclick=()=>{location.href="calendar.html"};
  $("sTypes").onclick=ev=>{
    const c=ev.target.closest(".chip");
    if(!c)return;
    type=TYPES[parseInt(c.dataset.t,10)].key;
    applyType();
  };
  $("fSubj").onclick=()=>pickSubjects(type,selected,v=>{selected=type==="exam"?v.slice(0,1):v;renderSubjects()});
  $("fStart").onclick=()=>pickMonthDay(date.month,date.day,(m,d)=>{date={year:date.year,month:m,day:d};renderDates()});
  $("fRs").onclick=()=>pickMonthDay(rsM,rsD,(m,d)=>{rsM=m;rsD=d;renderDates()});
  $("fRe").onclick=()=>pickMonthDay(reM,reD,(m,d)=>{reM=m;reD=d;renderDates()});
  $("fTs").onchange=e=>{startTime=e.target.value};
  $("fTe").onchange=e=>{endTime=e.target.value};
  $("fPhoto").onclick=()=>$("fFile").click();
  $("fFile").onchange=async e=>{
    const f=e.target.files[0];
    if(!f)return;
    try{
      const p=await prepareImage(f);
      pickedBlob=p.blob;pickedPreview=p.preview;
      renderPhoto();
    }catch(err){toast(err.message)}
  };

  function validate(){
    const title=$("fTitle").value.trim();
    switch(type){
      case "test":return selected.length?null:"Choose a subject";
      case "exam":
        if(!selected.length)return "Choose a subject";
        if(!startTime)return "Select the starting time";
        if(!endTime)return "Select the ending time";
        if(endTime<=startTime)return "Ending time must be after the starting time";
        return null;
      case "festival":
      case "national_day":
        if(!title)return "Enter a title";
        if(!pickedBlob&&!photoUrl)return "Upload a photo";
        return null;
      case "school_event":
      case "emergency":return title?null:"Enter a title";
      case "vacation":
        if(!title)return "Enter a title";
        if(reM*100+reD<rsM*100+rsD)return "End must be after the start";
        return null;
    }
    return null;
  }
  function commit(finalPhoto){
    const btn=$("fSave");
    const usesSubjects=type==="test"||type==="exam";
    const usesText=!usesSubjects;
    const usesPhoto=type==="festival"||type==="national_day";
    let startKey,endKey;
    if(type==="vacation"){startKey=bsKey(eventYear,rsM,rsD);endKey=bsKey(eventYear,reM,reD)}
    else if(type==="national_day"){startKey=bsKey(pYear||eventYear,date.month,date.day);endKey=startKey}
    else{startKey=bsKey(date.year,date.month,date.day);endKey=startKey}
    const id=type==="national_day"?`${pad(date.month)}-${pad(date.day)}`:(editing&&editing.type!=="national_day"?editing.id:calRoot().push().key);
    const ev={
      id,type,
      title:usesText?$("fTitle").value.trim():"",
      description:usesText?$("fDesc").value.trim():"",
      subjects:usesSubjects?selected.slice():[],
      startTime:type==="exam"?startTime:"",
      endTime:type==="exam"?endTime:"",
      photoUrl:usesPhoto?finalPhoto:"",
      startKey,endKey
    };
    saveEvent(ev,editing?editing.path:null).then(()=>{
      toast(editing?"Event updated":"Event added");
      setTimeout(()=>{location.href="calendar.html"},700);
    }).catch(err=>{
      btn.disabled=false;
      btn.textContent=saveLabel;
      toast("Couldn't save: "+err.message);
    });
  }
  $("fSave").onclick=async()=>{
    const err=validate();
    if(err){toast(err);return}
    const btn=$("fSave");
    btn.disabled=true;
    const usesPhoto=type==="festival"||type==="national_day";
    if(usesPhoto&&pickedBlob){
      btn.textContent="Uploading photo...";
      try{
        const url=await uploadImage(pickedBlob);
        photoUrl=url;pickedBlob=null;
        commit(url);
      }catch(e){
        btn.disabled=false;
        btn.textContent=saveLabel;
        toast("Photo upload failed: "+e.message);
      }
    }else{
      commit(photoUrl);
    }
  };
}

auth.onAuthStateChanged(async user=>{
  if(!user){denied("Please sign in as captain or professor.");return}
  let role="";
  try{
    const snap=await db.ref("roles/"+user.uid).once("value");
    const v=snap.val();
    role=typeof v==="string"?v:"";
  }catch(e){role=""}
  if(!ROLES.includes(role)){denied("Only captain or professor can add or edit events.");return}
  if(!pYear){denied("Missing date. Open this page from the calendar.");return}
  let editing=null;
  try{editing=await loadEditing()}catch(e){editing=null}
  if(editPath&&!editing){denied("This event could not be loaded.");return}
  initForm(editing,role);
});