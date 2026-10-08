const cfg=window.RAVE_CONFIG;
const supabase=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_KEY);

const f=document.querySelector("#videoFile");
const n=document.querySelector("#fileName");
const h=document.querySelector("#fileHint");
const u=document.querySelector("#videoUrl");
const up=document.querySelector("#uploadBtn");
const cr=document.querySelector("#createBtn");
const s=document.querySelector("#status");

const set=(m,c="")=>{s.textContent=m;s.className=c};
const formatBytes=b=>{
  if(!b)return"0 B";
  const k=1024,i=Math.floor(Math.log(b)/Math.log(k));
  return(b/Math.pow(k,i)).toFixed(i?1:0)+" "+["B","KB","MB","GB","TB"][i];
};

f.addEventListener("change",()=>{
  const x=f.files[0];
  if(!x)return;
  n.textContent=x.name;
  h.textContent=formatBytes(x.size)+" · "+(x.type||"video");
  set("Ready to upload.");
});

up.onclick=async()=>{
  const x=f.files[0];
  if(!x)return set("Choose a video first.","error");

  up.disabled=cr.disabled=true;
  set("Uploading… 0%");

  try{
    const ext=(x.name.split(".").pop()||"mp4").toLowerCase().replace(/[^a-z0-9]/g,"")||"mp4";
    const path=crypto.randomUUID()+"-"+Date.now()+"."+ext;

    // Direct browser -> Supabase Storage upload.
    // No Vercel proxy and no TUS auth/session dependency.
    const {data,error}=await supabase.storage
      .from(cfg.STORAGE_BUCKET)
      .upload(path,x,{
        cacheControl:"3600",
        contentType:x.type||"video/mp4",
        upsert:false
      });

    if(error){
      console.error("RAVE storage upload error",error);
      const code=error.statusCode||error.status||"";
      throw new Error((code?"HTTP "+code+": ":"")+error.message);
    }

    const publicUrl=supabase.storage.from(cfg.STORAGE_BUCKET).getPublicUrl(data.path).data.publicUrl;
    u.value=publicUrl;
    set("Uploaded successfully. Now create the room.","success");
  }catch(e){
    console.error("RAVE upload failed",e);
    set("Upload failed: "+(e?.message||"unknown error"),"error");
  }finally{
    up.disabled=cr.disabled=false;
  }
};

cr.onclick=()=>{
  const url=u.value.trim();
  if(!url)return set("Upload a video or paste a direct video URL.","error");
  const id=crypto.randomUUID().slice(0,8);
  location.href="room.html?room="+encodeURIComponent(id)+"&video="+encodeURIComponent(url);
};
