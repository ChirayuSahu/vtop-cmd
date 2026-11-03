// Deadline records cached per signed-in student for the session, shared by the background relay
// and its content-script client (deadline-cache-client.ts).
interface VtopDeadlineRecord { title: string; time: number; dateOnly: boolean; submitted: boolean }
interface VtopDeadlineEntry { records: VtopDeadlineRecord[]; expires: number }
/** Entries keyed by class id. */
type VtopDeadlineEntries = Record<string, VtopDeadlineEntry>;
/** What a client may change: drop everything, drop some class ids, then add or replace entries. */
interface VtopDeadlineCacheChange { clear?: boolean; remove?: string[]; put?: VtopDeadlineEntries }
interface VtopDeadlineCacheMessage extends VtopDeadlineCacheChange { type: 'vtop-deadline-cache'; action: 'get' | 'update'; owner: string }
interface VtopDeadlineCacheResponse { ok: true; deadlineCache: VtopDeadlineEntries }

// Firefox does not expose storage.session to content scripts. Keep it privileged and relay only deadline data.
(() => {
  'use strict';
  const api=globalThis.browser||chrome;
  const memory=new Map<string, VtopDeadlineEntries>();let queue: Promise<unknown>=Promise.resolve();
  // Untyped storage or message data; every field is checked before it is copied.
  function sanitize(entries: unknown): VtopDeadlineEntries{
    const result: VtopDeadlineEntries=Object.create(null),now=Date.now();
    for(const [id,entry] of Object.entries<any>(entries||{}).slice(0,500)){
      if(['__proto__','constructor','prototype'].includes(id)||!/^[A-Za-z0-9_-]{1,100}$/.test(id)||!Number.isFinite(entry?.expires)||entry.expires<=now||entry.expires>now+5*3600000+5000||!Array.isArray(entry.records)||entry.records.length>100)continue;
      const records=entry.records.filter((r: any)=>typeof r?.title==='string'&&r.title.length<=500&&Number.isFinite(r.time)&&typeof r.submitted==='boolean')
        .map((r: any): VtopDeadlineRecord=>({title:r.title,time:r.time,dateOnly:!!r.dateOnly,submitted:r.submitted}));
      result[id]={records,expires:entry.expires};
    }
    return result;
  }
  async function update(message: VtopDeadlineCacheMessage): Promise<VtopDeadlineCacheResponse>{
    const key=`deadlineCache:${message.owner}`;
    let entries: VtopDeadlineEntries=memory.get(key)||{};
    try{entries=(await api.storage.session?.get<Record<string, VtopDeadlineEntries | undefined>>(key))?.[key]||entries;}catch{/* Background-memory fallback; never write deadlines to disk. */}
    entries=sanitize(entries);
    if(message.action==='update'){
      if(message.clear===true)entries={};
      for(const id of Array.isArray(message.remove)?message.remove:[])delete entries[id];
      Object.assign(entries,sanitize(message.put));
      memory.set(key,entries);
      try{await api.storage.session?.set({[key]:entries});}catch{/* Memory remains usable. */}
    }
    return {ok:true,deadlineCache:entries};
  }
  api.runtime.onMessage.addListener((message,sender,reply)=>{
    if(message?.type!=='vtop-deadline-cache')return;
    if(sender.id!==api.runtime.id||!/^https:\/\/vtop\.vit\.ac\.in\/vtop\//.test(sender.url||'')||
       !['get','update'].includes(message.action)||typeof message.owner!=='string'||!message.owner||message.owner.length>200||/[\x00-\x1f]/.test(message.owner)){
      reply({ok:false});return;
    }
    queue=queue.catch(()=>{}).then(()=>update(message));
    queue.then(reply,()=>reply({ok:false}));return true;
  });
})();
