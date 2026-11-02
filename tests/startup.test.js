import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setupExtras,renderExtras} from '../extras.js';

test('galeria inicial exibe 130 prévias bloqueadas mesmo antes do IndexedDB',()=>{
  const former=globalThis.document;
  const selectors=['#awards-category','#awards-summary','#awards-fill','#awards-grid','#awards-history'];
  const dom=Object.fromEntries(selectors.map(s=>[s,{value:'all',innerHTML:'',textContent:'',style:{}}]));
  globalThis.document={querySelector:selector=>dom[selector]??null,addEventListener:()=>{}};
  try{
    setupExtras({state:{entries:[],foods:[],recipes:[],date:'2026-11-02',meals:[]}});
    renderExtras('medalhas');
    assert.equal((dom['#awards-grid'].innerHTML.match(/achievement-card/g)||[]).length,130);
    assert.equal((dom['#awards-grid'].innerHTML.match(/\blocked\b/g)||[]).length,130);
    assert.match(dom['#awards-summary'].textContent,/0 \/ 130/);
  }finally{globalThis.document=former}
});

test('IndexedDB bloqueado apresenta aviso sem tentar gravar antes da abertura',async()=>{
  const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const start=app.indexOf('function setStorageStatus('),end=app.indexOf('async function refresh()');
  assert.ok(start>0&&end>start);
  const openSource=app.slice(start,end);
  const elements=Object.fromEntries(['#storage-warning','#storage-warning-title','#storage-warning-text','#storage-reload'].map(s=>[s,{hidden:true,dataset:{},textContent:''}]));
  const request={};
  const connection={
    closed:false,close(){this.closed=true},objectStoreNames:{contains:()=>true},
    createObjectStore(){}
  };
  const idb={open(){return request}};
  const run=new Function('indexedDB','document','request','connection',\`
    return (async()=>{
      let db,appReady=true;
      const $=sel=>document.querySelector(sel);
      const DB_NAME='nutri-diario-v1',DB_VERSION=2;
      \${openSource}
      const pending=openDb();
      request.onblocked();
      const blocked=document.querySelector('#storage-warning').dataset.status==='blocked';
      request.result=connection;request.onsuccess();
      db=await pending;
      db.onversionchange();
      return {blocked,closed:connection.closed,ready:appReady,stale:document.querySelector('#storage-warning').dataset.status==='stale'};
    })();
  \`);
  const result=await run(idb,{querySelector:x=>elements[x]},request,connection);
  assert.deepEqual(result,{blocked:true,closed:true,ready:false,stale:true});
});
