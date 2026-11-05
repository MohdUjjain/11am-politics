import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const code=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
const scope='https://mohdujjain.github.io/11am-politics/';
const path=p=>new URL(p,scope).href;

function simulate(fail=false){
  const listeners={},stores=new Map();
  let skipped=0,claimed=0,networkCalls=0;
  const caches={
    open:async name=>{
      if(!stores.has(name)){
        const records=new Map();
        stores.set(name,{
          records,
          async addAll(files){
            if(fail)throw Error('Simulated interrupted download');
            for(const f of files) records.set(path(f),{body:f});
          },
          async match(request){
            const url=typeof request==='string'?path(request):request.url;
            return records.get(url);
          },
          async put(request,response){
            records.set(typeof request==='string'?path(request):request.url,response);
          }
        });
      }
      return stores.get(name);
    },
    keys:async()=>[...stores.keys()],
    delete:async name=>stores.delete(name)
  };
  const self={
    registration:{scope},
    location:{origin:'https://mohdujjain.github.io'},
    skipWaiting:async()=>{skipped++},
    clients:{claim:async()=>{claimed++}},
    addEventListener:(name,fn)=>{listeners[name]=fn}
  };
  runInContext(code,createContext({
    self,caches,URL,Promise,Set,
    Response:{error:()=>({body:'ERROR'})},
    fetch:async()=>{networkCalls++;throw Error('offline')}
  }));
  async function lifecycle(kind){
    let task;
    listeners[kind]({waitUntil:p=>task=p});
    return task;
  }
  async function navigate(url){
    let result;
    listeners.fetch({
      request:{url,method:'GET',mode:'navigate'},
      respondWith:p=>{result=p},
      waitUntil:()=>{}
    });
    return result?await result:null;
  }
  return {listeners,stores,caches,lifecycle,navigate,
    stats:()=>({skipped,claimed,networkCalls})};
}

const good=simulate();
await good.caches.open('11am-hikam-reader-untouched');
await good.caches.open('11am-politics-reader-prior');
await good.lifecycle('install');
assert.equal(good.stats().skipped,1);
const version=[...good.stores.keys()].find(n=>n.startsWith('11am-politics-reader-') && !n.endsWith('prior'));
assert.ok(version);
assert.equal(good.stores.get(version).records.size,12,'Entire app shell cached');
assert.ok(good.stores.get(version).records.has(path('./navigation.js')),'Navigation JS cached');
assert.ok(good.stores.get(version).records.has(path('./navigation.css')),'Navigation CSS cached');
await good.lifecycle('activate');
assert.ok(good.stores.has('11am-hikam-reader-untouched'),'Sibling app cache must remain');
assert.ok(!good.stores.has('11am-politics-reader-prior'),'Old Politics edition cleaned');
assert.equal(good.stats().claimed,1);
assert.equal((await good.navigate(scope)).body,'./index.html','Offline reopen uses cached book');
assert.equal(good.stats().networkCalls,0,'No offline network request needed');
assert.equal(await good.navigate('https://mohdujjain.github.io/11am-hikam/'),null,'Sibling navigation unaffected');

const broken=simulate(true);
await broken.caches.open('11am-politics-reader-prior');
await assert.rejects(broken.lifecycle('install'));
assert.equal(broken.stats().skipped,0,'Failed update cannot activate');
assert.ok(broken.stores.has('11am-politics-reader-prior'),'Prior edition must survive');
console.log('PASS: offline reopening, full shell, atomic failed update, app cache isolation');
