/* Frontend for server (works with sql.js backend) */
(function(){
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const todayStr = () => new Date().toISOString().slice(0,10);
  const toYMD = (d) => d.toISOString().slice(0,10);
  function startOfWeek(d){ const day=d.getDay(); const diff=(day===0?-6:1)-day; const res=new Date(d); res.setDate(d.getDate()+diff); return res; }
  function endOfWeek(d){ const s=startOfWeek(d); const res=new Date(s); res.setDate(s.getDate()+6); return res; }
  function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
  function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }
  function calcRange(kind, fromEl, toEl){
    const now=new Date();
    if(kind==="today") return [toYMD(now), toYMD(now)];
    if(kind==="week") return [toYMD(startOfWeek(now)), toYMD(endOfWeek(now))];
    if(kind==="month") return [toYMD(startOfMonth(now)), toYMD(endOfMonth(now))];
    if(kind==="custom"){ let f=fromEl.value||toYMD(startOfWeek(now)); let t=toEl.value||toYMD(endOfWeek(now)); if(f>t){const tmp=f;f=t;t=tmp;} return [f,t]; }
    return ["0001-01-01","9999-12-31"];
  }
  function show(tab){ $$(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab)); $$(".screen").forEach(s=>s.classList.remove("shown")); $("#screen-"+tab).classList.add("shown"); }
  $$("#tabs .tab").forEach(btn=>btn.addEventListener("click",()=>show(btn.dataset.tab)));
  async function api(path, opts={}){ const res=await fetch(path,Object.assign({headers:{"Content-Type":"application/json"}},opts)); if(!res.ok){throw new Error(await res.text());} const ct=res.headers.get("content-type")||""; return ct.includes("application/json")?res.json():res.text(); }
  async function loadManagers(){
    const rows=await api("/api/managers");
    const sel=$("#add-manager"); sel.innerHTML="";
    const filterSel=$("#filter-manager"); filterSel.innerHTML='<option value="">Все менеджеры</option>';
    rows.forEach(m=>{ const o=document.createElement("option"); o.value=m.id;o.textContent=m.name; sel.appendChild(o); const o2=document.createElement("option"); o2.value=m.id;o2.textContent=m.name; filterSel.appendChild(o2); });
    renderManagersTable(rows);
  }
  function renderManagersTable(rows){
    const tb=$("#mgr-table tbody"); tb.innerHTML="";
    rows.forEach(m=>{ const tr=document.createElement("tr"); tr.innerHTML=`<td>${escapeHtml(m.name)}</td><td>${m.target||0}</td><td><div class="row-actions"><button class="btn" data-action="edit" data-id="${m.id}">Изм.</button><button class="btn danger" data-action="del" data-id="${m.id}">Удалить</button></div></td>`; tb.appendChild(tr); });
  }
  $("#mgr-add").addEventListener("click", async ()=>{
    const name=$("#mgr-name").value.trim(); const target=Number($("#mgr-target").value||0);
    if(!name){ toast("Введите имя менеджера"); return; }
    await api("/api/managers",{method:"POST",body:JSON.stringify({name,target})});
    $("#mgr-name").value=""; $("#mgr-target").value=50; await loadManagers();
  });
  $("#mgr-table").addEventListener("click", async (e)=>{
    const btn=e.target.closest("button"); if(!btn) return;
    const id=btn.dataset.id; const action=btn.dataset.action;
    if(action==="del"){ if(!confirm("Удалить менеджера?")) return; await api(`/api/managers/${id}`,{method:"DELETE"}); await loadManagers(); await refreshAll(); }
    else if(action==="edit"){ const name=prompt("Имя менеджера:"); if(name===null) return; const tgt=prompt("Цель/неделя (людей):",50); if(tgt===null) return; await api(`/api/managers/${id}`,{method:"PUT",body:JSON.stringify({name,target:Number(tgt)||0})}); await loadManagers(); await refreshAll(); }
  });
  $("#add-date").value=todayStr();
  $("#add-form").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const payload={ date:$("#add-date").value, managerId:$("#add-manager").value, salesCount:Math.max(1,Number($("#add-sales").value||1)), people:Math.max(1,Number($("#add-people").value||1)), tour:$("#add-tour").value.trim(), amount:Number($("#add-amount").value||0), comment:$("#add-comment").value.trim() };
    await api("/api/events",{method:"POST",body:JSON.stringify(payload)});
    $("#add-form").reset(); $("#add-date").value=todayStr(); $("#add-sales").value=1; $("#add-people").value=1; toast("Сделка добавлена"); await refreshAll();
  });
  $("#add-reset").addEventListener("click",()=>{ $("#add-form").reset(); $("#add-date").value=todayStr(); $("#add-sales").value=1; $("#add-people").value=1; });
  $("#fab-add").addEventListener("click",()=>{ show("add"); $("#add-people").focus(); });
  const periodSel=$("#period"); const fromInput=$("#from-date"); const toInput=$("#to-date");
  periodSel.addEventListener("change",()=>{ const custom=periodSel.value==="custom"; fromInput.classList.toggle("hidden",!custom); toInput.classList.toggle("hidden",!custom); refreshEvents(); });
  $("#filter-manager").addEventListener("change",refreshEvents);
  fromInput.addEventListener("change",refreshEvents);
  toInput.addEventListener("change",refreshEvents);
  async function refreshEvents(){
    const [from,to]=calcRange(periodSel.value,fromInput,toInput);
    const params=new URLSearchParams({from,to,managerId:$("#filter-manager").value}).toString();
    const rows=await api(`/api/events?${params}`);
    const tb=$("#events-table tbody"); tb.innerHTML="";
    let sales=0, people=0;
    rows.forEach(ev=>{ sales+=ev.salesCount||1; people+=ev.people||0;
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${ev.date}</td><td>${escapeHtml(ev.managerName||"—")}</td><td>${ev.salesCount||1}</td><td>${ev.people||0}</td><td>${escapeHtml(ev.tour||"")}</td><td>${(ev.amount||0).toLocaleString()}</td><td class="mini">${escapeHtml(ev.comment||"")}</td><td><div class="row-actions"><button class="btn" data-action="edit" data-id="${ev.id}">Изм.</button><button class="btn danger" data-action="del" data-id="${ev.id}">Удалить</button></div></td>`;
      tb.appendChild(tr);
    });
    $("#events-totals").textContent=`Итого: ${sales} продаж, ${people} людей`;
    tb.onclick=async (e)=>{ const btn=e.target.closest("button"); if(!btn) return; const id=btn.dataset.id; const action=btn.dataset.action;
      if(action==="del"){ if(confirm("Удалить запись?")){ await api(`/api/events/${id}`,{method:"DELETE"}); await refreshAll(); } }
      else if(action==="edit"){ const row=rows.find(x=>x.id===id); if(!row) return;
        const nd=prompt("Дата (YYYY-MM-DD):",row.date); if(nd===null) return;
        const np=prompt("Людей:",row.people||1); if(np===null) return;
        const ns=prompt("Продаж:",row.salesCount||1); if(ns===null) return;
        await api(`/api/events/${id}`,{method:"PUT",body:JSON.stringify({ date:/^\d{4}-\d{2}-\d{2}$/.test(nd)?nd:row.date, people:Math.max(1,Number(np)||row.people), salesCount:Math.max(1,Number(ns)||row.salesCount) })});
        await refreshAll();
      }
    };
  }
  const lbSel=$("#lb-period"); const lbFrom=$("#lb-from"); const lbTo=$("#lb-to");
  lbSel.addEventListener("change",()=>{ const custom=lbSel.value==="custom"; lbFrom.classList.toggle("hidden",!custom); lbTo.classList.toggle("hidden",!custom); renderLeaderboard(); });
  lbFrom.addEventListener("change",renderLeaderboard);
  lbTo.addEventListener("change",renderLeaderboard);
  async function aggregates(from,to){ const params=new URLSearchParams({from,to}).toString(); return api(`/api/aggregates?${params}`); }
  function medal(i){ return i===0?"🥇":(i===1?"🥈":(i===2?"🥉":"")); }
  async function renderLeaderboard(){
    const [from,to]=calcRange(lbSel.value,lbFrom,lbTo);
    const rows=await aggregates(from,to);
    const box=$("#leaderboard-list"); box.innerHTML="";
    rows.forEach((r,idx)=>{ const avg=r.sales?(r.people/r.sales):0; const xp=r.people+2*r.sales; const level=Math.floor(xp/50)+1; const rem=xp-(Math.floor(xp/50)*50); const pct=Math.min(100,Math.floor(rem/50*100)); const badge=(r.people>=200)?"🏆":(r.people>=100?"🥈":(r.people>=50?"🥉":""));
      const card=document.createElement("div"); card.className="lb-card"; card.innerHTML=`<div><div class="lb-title">${idx+1}. ${escapeHtml(r.managerName)} ${badge}</div><div class="badges"><span class="badge">Люди: <b>${r.people}</b></span><span class="badge">Продаж: <b>${r.sales}</b></span><span class="badge">Средняя группа: <b>${avg.toFixed(1)}</b></span><span class="badge">Цель/нед: <b>${r.target||0}</b></span><span class="badge">XP: <b>${xp}</b> | LVL ${level}</span></div><div class="progress"><div style="width:${pct}%"></div></div></div><div style="font-weight:800;font-size:20px;">${medal(idx)}</div>`; box.appendChild(card);
    });
  }
  async function refreshDashboard(){
    const now=new Date(); const [tdFrom,tdTo]=[toYMD(now),toYMD(now)]; const [wkFrom,wkTo]=[toYMD(startOfWeek(now)),toYMD(endOfWeek(now))]; const [moFrom,moTo]=[toYMD(startOfMonth(now)),toYMD(endOfMonth(now))];
    const todayRows=await api(`/api/events?from=${tdFrom}&to=${tdTo}`);
    const weekRows=await api(`/api/events?from=${wkFrom}&to=${wkTo}`);
    const monthRows=await api(`/api/events?from=${moFrom}&to=${moTo}`);
    const sum=(arr,fn)=>arr.reduce((a,c)=>a+fn(c),0);
    $("#kpi-today-sales").textContent=sum(todayRows,x=>x.salesCount||1);
    $("#kpi-today-people").textContent=sum(todayRows,x=>x.people||0);
    $("#kpi-week-people").textContent=sum(weekRows,x=>x.people||0);
    $("#kpi-month-people").textContent=sum(monthRows,x=>x.people||0);
    const todayAgg=await aggregates(tdFrom,tdTo);
    const tb=$("#today-managers-table tbody"); tb.innerHTML="";
    todayAgg.forEach(r=>{ const tr=document.createElement("tr"); tr.innerHTML=`<td>${escapeHtml(r.managerName)}</td><td>${r.sales}</td><td>${r.people}</td>`; tb.appendChild(tr); });
    const leaderTxt=(rows)=>rows.length?`${rows[0].managerName}: люди ${rows[0].people}, продаж ${rows[0].sales}`:"—";
    $("#leader-today").textContent=leaderTxt(todayAgg);
    const weekAgg=await aggregates(wkFrom,wkTo); $("#leader-week").textContent=leaderTxt(weekAgg);
    const monthAgg=await aggregates(moFrom,moTo); $("#leader-month").textContent=leaderTxt(monthAgg);
  }
  $("#btn-backup").addEventListener("click", async ()=>{ const pack=await api("/api/backup"); const blob=new Blob([JSON.stringify(pack,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="sales-backup.json"; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(url); a.remove();},0); });
  $("#file-restore").addEventListener("change", async (e)=>{ const f=e.target.files?.[0]; if(!f) return; const text=await f.text(); await api("/api/restore",{method:"POST",body:text}); toast("База восстановлена"); await loadManagers(); await refreshAll(); e.target.value=""; });
  $("#btn-reset").addEventListener("click", async ()=>{ if(confirm("Удалить все события?")){ await api("/api/reset",{method:"POST"}); await refreshAll(); }});
  function escapeHtml(str){ return String(str||"").replace(/[&<>"']/g, s=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[s])); }
  function toast(msg){ const d=document.createElement("div"); d.textContent=msg; d.style.position="fixed"; d.style.bottom="90px"; d.style.right="18px"; d.style.background="#0b132b"; d.style.color="#fff"; d.style.padding="10px 14px"; d.style.borderRadius="12px"; d.style.boxShadow="0 8px 24px rgba(2,8,23,.06)"; document.body.appendChild(d); setTimeout(()=>d.remove(),1800); }
  async function refreshAll(){ await refreshDashboard(); await refreshEvents(); await renderLeaderboard(); }
  (async function init(){ try{ await loadManagers(); periodSel.value="today"; const now=new Date(); $("#from-date").value=toYMD(startOfWeek(now)); $("#to-date").value=toYMD(endOfWeek(now)); $("#lb-period").value="week"; $("#lb-from").value=toYMD(startOfWeek(now)); $("#lb-to").value=toYMD(endOfWeek(now)); await refreshAll(); show("dashboard"); if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{});} }catch(err){ console.error(err); alert("Ошибка инициализации: "+err.message); } })();
})();