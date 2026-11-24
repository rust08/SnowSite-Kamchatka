// Minimal DOM/Leaflet harness. Covers application events/data/rendering logic,
// not CSS, browser layout, actual Leaflet, accessibility or browser navigation.
export function installMapDom(html){
 const nodes=new Map(),allLayers=[];let active=null,download=null,objectUrlBlob=null;
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attributes=new Map();this.dataset={};this.style={};this.handlers=new Map();this.hidden=false;this.disabled=false;this._value='';this._text='';this.className='';this.classList={add:c=>{this.className+=' '+c;}};this.files=[];this.offsetHeight=80;}
  set id(v){this._id=v;nodes.set(v,this);}get id(){return this._id;}
  set textContent(v){this._text=String(v??'');this.children=[];}get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  set value(v){this._value=String(v??'');}get value(){return this._value;}
  append(...children){for(const n of children){n.parent=this;this.children.push(n);}}prepend(n){n.parent=this;this.children.unshift(n);}replaceChildren(...children){this.children=[];this._text='';this.append(...children);}
  after(v){this.parent?.append(v);}remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);if(this.id)nodes.delete(this.id);}
  setAttribute(k,v){this.attributes.set(k,String(v));}getAttribute(k){return this.attributes.get(k)??null;}
  addEventListener(event,fn){const f=this.handlers.get(event)??[];f.push(fn);this.handlers.set(event,f);}
  async dispatch(event,extra={}){for(const fn of this.handlers.get(event)??[])await fn({target:this,key:'',preventDefault(){},...extra});}
  click(){if(this.tagName==='A'){download={name:this.download,blob:objectUrlBlob};return;}if(!this.disabled)return this.dispatch('click');}focus(){active=this;}
  querySelectorAll(q){const tag=q.toUpperCase();return this.children.flatMap(x=>[...(x.tagName===tag?[x]:[]),...x.querySelectorAll(q)]);}
  createCaption(){const n=new Element('caption');this.append(n);return n;}createTHead(){const n=new Element('thead');this.append(n);return n;}createTBody(){const n=new Element('tbody');this.append(n);return n;}insertRow(){const n=new Element('tr');this.append(n);return n;}insertCell(){const n=new Element('td');this.append(n);return n;}showModal(){this.open=true;}close(){this.open=false;}
 }
 for(const m of html.matchAll(/<([\w-]+)\s+([^<>]*?\bid="([^"]+)"[^<>]*?)>/g)){const node=new Element(m[1]),attrs=m[2];node.id=m[3];node.hidden=/\bhidden\b/.test(attrs);node.disabled=/\bdisabled\b/.test(attrs);const value=/\bvalue="([^"]*)"/.exec(attrs);if(value)node.value=value[1];}
 if(nodes.has('calc-mode'))nodes.get('calc-mode').value='exact';
 const legend=new Element('details');legend.open=true;
 const document={getElementById:id=>nodes.get(id)??null,createElement:tag=>new Element(tag),querySelector:q=>q==='.legend'?legend:q.startsWith('#')?nodes.get(q.slice(1))??null:null,addEventListener(){},get activeElement(){return active;}};
 const layer=(kind,coords,options={})=>({kind,coords,options,addTo(target){target.items?.push(this);return this;},bindPopup(fn){this.popup=fn;return this;},getLatLng(){return coords;},openPopup(){this.opened=this.popup?.();return this;}});
 const map={panes:new Map(),handlers:new Map(),setView(){return this;},setMaxBounds(){},createPane(k){const p={style:{}};this.panes.set(k,p);return p;},getPane(k){return this.panes.get(k);},on(k,f){this.handlers.set(k,f);},getContainer(){return nodes.get('map');},getZoom(){return 12;},fitBounds(){}};
 const L={map:()=>map,canvas:()=>({}),latLngBounds:x=>x,control:{zoom:()=>layer('control')},imageOverlay:(...x)=>layer('image',x),layerGroup:()=>{const x={...layer('group'),items:[],clearLayers(){this.items.length=0;}};allLayers.push(x);return x;},polyline:(x,o)=>layer('line',x,o),polygon:(x,o)=>layer('polygon',x,o),marker:(x,o)=>layer('marker',x,o),divIcon:o=>o};
 const original={document:globalThis.document,window:globalThis.window,L:globalThis.L,createObjectURL:URL.createObjectURL,revokeObjectURL:URL.revokeObjectURL};
 globalThis.document=document;globalThis.window={innerWidth:1366,confirm:()=>true};globalThis.L=L;URL.createObjectURL=b=>{objectUrlBlob=b;return 'blob:mock';};URL.revokeObjectURL=()=>{};
 return {nodes,allLayers,map,get download(){return download;},restore(){globalThis.document=original.document;globalThis.window=original.window;globalThis.L=original.L;URL.createObjectURL=original.createObjectURL;URL.revokeObjectURL=original.revokeObjectURL;}};
}
