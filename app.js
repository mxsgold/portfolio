const cfg=window.RAVE_CONFIG;
const supabase=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_KEY);
const f=document.querySelector("#videoFile"),n=document.querySelector("#fileName"),h=document.querySelector("#fileHint"),u=document.querySelector("#videoUrl"),up=document.querySelector("#uploadBtn"),cr=document.querySelector("#createBtn"),s=document.querySelector("#status");

const set=(m,c="")=>{s.textContent=m;s.className=c};
const formatBytes=b=>{if(!b)return"0 B";const k=1024,i=Math.floor(Math.log(b)/Math.log(k));return(b/Math.pow(k,i)).toFixed(i?1:0)+" "+["B","KB","MB","GB","TB"][i]};
const storageEndpoint=cfg.SUPABASE_URL.replace(".supabase.co",".storage.supabase.co")+"/storage/v1/upload/resumable";

f.addEventListener("change",()=>{
  const x=f.files[0];
  if(x){
    n.textContent=x.name;
    h.textContent=formatBytes(x.size)+" · "+(x.type||"video");
    set("Ready to upload.");
  }
});

up.onclick=async()=>{
  const x=f.files[0];
  if(!x)return set("Choose a video first.","error");
  if(!window.tus)return set("Upload library failed to load. Refresh the page.","error");
  up.disabled=cr.disabled=true;
  set("Starting upload…");
  try{
    const ext=(x.name.split(".").pop()||"mp4").toLowerCase().replace(/[^a-z0-9]/g,"")||"mp4";
    const path=crypto.randomUUID()+"-"+Date.now()+"."+ext;
    const upload=new tus.Upload(x,{
      endpoint:storageEndpoint,
      retryDelays:[0,3000,5000,10000,20000],
      headers:{
        authorization:"Bearer "+cfg.SUPABASE_KEY,
        apikey:cfg.SUPABASE_KEY,
        "x-upsert":"false"
      },
      uploadDataDuringCreation:true,
      removeFingerprintOnSuccess:true,
      chunkSize:6*1024*1024,
      metadata:{
        bucketName:cfg.STORAGE_BUCKET,
        objectName:path,
        contentType:x.type||"video/mp4",
        cacheControl:"3600"
      },
      onError:e=>{
        console.error("RAVE TUS upload error",e);
        set("Upload failed: "+(e?.message||"unknown error"),"error");
        up.disabled=cr.disabled=false;
      },
      onProgress:(a,b)=>{
        const p=b?Math.floor(a/b*100):0;
        set("Uploading… "+p+"% ("+formatBytes(a)+" / "+formatBytes(b)+")");
      },
      onSuccess:()=>{
        const url=supabase.storage.from(cfg.STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
        u.value=url;
        set("Uploaded successfully. Now create the room.","success");
        up.disabled=cr.disabled=false;
      }
    });
    const previous=await upload.findPreviousUploads();
    if(previous.length)upload.resumeFromPreviousUpload(previous[0]);
    upload.start();
  }catch(e){
    console.error(e);
    set("Upload failed: "+(e?.message||"unknown error"),"error");
    up.disabled=cr.disabled=false;
  }
};

cr.onclick=()=>{
  const url=u.value.trim();
  if(!url)return set("Upload a video or paste a direct video URL.","error");
  const id=crypto.randomUUID().slice(0,8);
  location.href="room.html?room="+encodeURIComponent(id)+"&video="+encodeURIComponent(url);
};
