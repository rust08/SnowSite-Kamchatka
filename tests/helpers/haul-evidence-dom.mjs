// DOM/event harness only. No browser layout, navigation, accessibility or E2E claim.
// The loader executes exact HTTP-served source via Node's synchronous module hooks.
import {registerHooks} from 'node:module';

export function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
export const tick=()=>new Promise(resolve=>setImmediate(resolve));

export async function servedLoader(base,fetcher){
  const paths=['/haul-evidence.js',...['index','validate','reconcile','report','parse','bytes'].map(n=>`/lib/haul-evidence/${n}.mjs`)];
  const sources=new Map();
  for(const path of paths){const response=await fetcher(base+path);if(!response.ok)throw new Error(`module HTTP ${response.status}: ${path}`);sources.set(path,await response.text());}
  const isLocal=url=>url?.startsWith(base+'/');
  const hook=registerHooks({
    resolve(specifier,context,next){if(isLocal(specifier)||isLocal(context.parentURL)){const url=new URL(specifier,context.parentURL??base+'/');if(!isLocal(url.href)||!sources.has(url.pathname))throw new Error('unexpected browser import: '+specifier);return {url:url.href,shortCircuit:true};}return next(specifier,context);},
    load(url,context,next){if(isLocal(url)){const source=sources.get(new URL(url).pathname);if(source===undefined)throw new Error('unexpected module');return {format:'module',source,shortCircuit:true};}return next(url,context);}
  });
  let sequence=0;
  return {load:()=>import(`${base}/haul-evidence.js?test=${++sequence}`),close:()=>hook.deregister()};
}

export function installEvidenceDom(html,base,fetcher){
  const nodes=new Map(),calls=[],downloads=[],urls=new Map(),revoked=[];
  let serial=0,active=null;
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.handlers=new Map();this.attributes=new Map();this.hidden=false;this.disabled=false;this.open=false;this._value='';this._text='';this.files=[];}
    set textContent(v){this._text=String(v??'');this.children=[];}get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
    set value(v){this._value=String(v);if(this.tagName==='INPUT'&&this._value==='')this.files=[];}get value(){return this._value;}
    set innerHTML(_){throw new Error('unsafe innerHTML');}set outerHTML(_){throw new Error('unsafe outerHTML');}insertAdjacentHTML(){throw new Error('unsafe insertAdjacentHTML');}
    append(...children){for(const child of children){if(!(child instanceof Element))throw new Error('expected element');child.parent=this;this.children.push(child);}}
    replaceChildren(...children){for(const child of this.children)child.parent=null;this.children=[];this._text='';this.append(...children);}
    remove(){if(this.parent){this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;}}
    setAttribute(k,v){this.attributes.set(k,String(v));}getAttribute(k){return this.attributes.get(k)??null;}
    addEventListener(name,fn){const list=this.handlers.get(name)??[];list.push(fn);this.handlers.set(name,list);}
    async dispatch(name){await Promise.all((this.handlers.get(name)??[]).map(fn=>fn({target:this,preventDefault(){}})));}
    click(){if(this.disabled)return Promise.resolve();if(this.tagName==='A'){const blob=urls.get(this.href);if(!blob)throw new Error('invalid download URL');downloads.push({name:this.download,blob,url:this.href});return Promise.resolve();}return this.dispatch('click');}
    focus(){active=this;}
    all(tag){return this.children.flatMap(c=>[...(c.tagName===tag.toUpperCase()?[c]:[]),...c.all(tag)]);}
  }
  for(const match of html.matchAll(/<([\w-]+)\s+([^<>]*?\bid="([^"]+)"[^<>]*?)>/g)){const e=new Element(match[1]);e.id=match[3];e.hidden=/\bhidden\b/.test(match[2]);e.disabled=/\bdisabled\b/.test(match[2]);nodes.set(e.id,e);}
  const body=new Element('body'),document={body,createElement:tag=>new Element(tag),getElementById:id=>nodes.get(id)??null,get activeElement(){return active;}};
  const original={document:Object.getOwnPropertyDescriptor(globalThis,'document'),fetch:globalThis.fetch,crypto:Object.getOwnPropertyDescriptor(globalThis,'crypto'),create:URL.createObjectURL,revoke:URL.revokeObjectURL};
  let fetchImpl=fetcher;
  globalThis.document=document;
  globalThis.fetch=(path,options={})=>{calls.push({path,options});if(!['/haul-evidence-demo/carrier.json','/haul-evidence-demo/receiver.json'].includes(path)||options.method!=='GET'||Object.hasOwn(options,'body'))throw new Error('unexpected UI fetch');return fetchImpl(base+path,options);};
  URL.createObjectURL=blob=>{const url=`blob:harness-${++serial}`;urls.set(url,blob);return url;};URL.revokeObjectURL=url=>{revoked.push(url);urls.delete(url);};
  function restoreProperty(key,desc){if(desc)Object.defineProperty(globalThis,key,desc);else delete globalThis[key];}
  return {nodes,document,calls,downloads,urls,revoked,get:id=>nodes.get(id),setFetch:fn=>{fetchImpl=fn;},setCrypto:value=>Object.defineProperty(globalThis,'crypto',{configurable:true,writable:true,value}),restore(){restoreProperty('document',original.document);restoreProperty('crypto',original.crypto);globalThis.fetch=original.fetch;URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;}};
}
