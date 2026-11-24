const input=document.querySelector('#input'),run=document.querySelector('#run'),status=document.querySelector('#status'),output=document.querySelector('#output'),download=document.querySelector('#download-result');
let resultJson=null;
download.addEventListener('click',()=>{if(resultJson===null)return;const url=URL.createObjectURL(new Blob([resultJson],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='snowsite-result-v1.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
input.addEventListener('change',()=>{run.disabled=!input.files.length;resultJson=null;download.disabled=true;output.textContent='Результат появится после расчёта.';status.textContent=input.files.length?'Файл выбран. Нажмите «Рассчитать».':'Выберите файл запроса размером до 1 МБ.';});
run.addEventListener('click',async()=>{
 run.disabled=true;input.disabled=true;download.disabled=true;resultJson=null;output.textContent='';status.textContent='Выполняется MILP…';
 try{
  const file=input.files[0];if(file.size>1024*1024)throw Error('Файл больше 1 МБ');
  const request=JSON.parse(await file.text());request.policy.preset='preserve_existing';
  const res=await fetch('/api/v1/optimize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
  const result=await res.json();if(!res.ok)throw Error(res.status===503?'Оптимизатор занят (503).':res.status===500?'Solver недоступен или внутренний сбой. Проверьте Python и solver/requirements.txt.':`${res.status}: ${result.error}`);
  status.textContent=`${result.search.rankingStatus} / ${result.solver.status}. ${result.search.rankingStatus==='exact_top_k'?'Доказано в заданной модели.':'Точный рейтинг не доказан или нет допустимых наборов.'}`;
  resultJson=JSON.stringify(result,null,2);output.textContent=resultJson;download.disabled=false;
 }catch(e){status.textContent=e.message+' Автоматического перехода на эвристику нет.';}finally{run.disabled=!input.files.length;input.disabled=false;}
});
