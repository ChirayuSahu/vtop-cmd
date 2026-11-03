// The content-script side of the background deadline cache (deadline-cache.ts), read as `VtopDeadlineCache`.
interface VtopDeadlineCacheClient {
  /** The signed-in student's cached deadlines; rejects when signed out or the cache is unreachable. */
  get(): Promise<VtopDeadlineCacheResponse>;
  update(change: VtopDeadlineCacheChange): Promise<VtopDeadlineCacheResponse>;
}
interface VtopDeadlineCacheApi {
  /** null when there is no extension runtime (page previews). */
  create(): VtopDeadlineCacheClient | null;
}
declare var VtopDeadlineCache: VtopDeadlineCacheApi;

(() => {
  'use strict';
  globalThis.VtopDeadlineCache={create(): VtopDeadlineCacheClient | null{
    const runtime=globalThis.browser?.runtime||globalThis.chrome?.runtime;
    if(!runtime?.sendMessage)return null;
    const owner=()=>document.querySelector<HTMLInputElement>('#authorizedID')?.value||document.querySelector<HTMLInputElement>('#authorizedIDX')?.value||'';
    async function request(change: Pick<VtopDeadlineCacheMessage, 'action'> & VtopDeadlineCacheChange): Promise<VtopDeadlineCacheResponse>{
      const id=owner();if(!id)throw Error('Not signed in');
      const result=await runtime.sendMessage<VtopDeadlineCacheMessage, VtopDeadlineCacheResponse | { ok: false } | undefined>({type:'vtop-deadline-cache',owner:id,...change});
      if(!result?.ok)throw Error('Session cache unavailable');
      return result;
    }
    return {get:()=>request({action:'get'}),update:change=>request({action:'update',...change})};
  }};
})();
