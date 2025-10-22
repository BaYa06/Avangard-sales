/* Frontend for server (works with sql.js backend) */
(function(){
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const todayStr = () => new Date().toISOString().slice(0,10);
  const toYMD = (d) => d.toISOString().slice(0,10);
  let monthlySalesChart = null;
  function startOfWeek(d){ const day=d.getDay(); const diff=(day===0?-6:1)-day; const res=new Date(d); res.setDate(d.getDate()+diff); return res; }
  function endOfWeek(d){ const s=startOfWeek(d); const res=new Date(s); res.setDate(s.getDate()+6); return res; }
  function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
  function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }
  function dmyToYmd(s){
    const m = String(s||"").match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if(!m) return null;
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
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
    const editSel = $("#edit-manager");
    if (editSel) {
      editSel.innerHTML = "";
      rows.forEach(m => {
        const o = document.createElement("option");
        o.value = m.id; o.textContent = m.name;
        editSel.appendChild(o);
      });
    }
    rows.forEach(m=>{ const o=document.createElement("option"); o.value=m.id;o.textContent=m.name; sel.appendChild(o); const o2=document.createElement("option"); o2.value=m.id;o2.textContent=m.name; filterSel.appendChild(o2); });
    managersById = Object.fromEntries(rows.map(m => [String(m.id), m]));
    const loginSel = $("#login-manager");
    if (loginSel) {
      loginSel.innerHTML = "";
      rows.forEach(m => {
        const o = document.createElement("option"); o.value = m.id; o.textContent = m.name;
        loginSel.appendChild(o);
      });
    }

  if (rows.length && sel) sel.value = rows[0].id;
  renderManagersTable(rows);
    if(rows.length) sel.value = rows[0].id;
    renderManagersTable(rows);

    updateMeUI();
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
    const mgrVal = $("#add-manager").value; 
    if(!mgrVal){ toast("Выберите менеджера"); return; }

    const idStr = String(mgrVal).trim();   // ✅ оставляем UUID строкой
    const payload = {
      date: $("#add-date").value,
      managerId: idStr,
      manager_id: idStr,
      salesCount: Math.max(1, Number($("#add-sales").value||1)),
      people: Math.max(1, Number($("#add-people").value||1)),
      tour: $("#add-tour").value.trim(),
      amount: Number($("#add-amount").value||0),
      comment: $("#add-comment").value.trim(),
      currency: ($("#add-currency")?.value || "KGS")
    };
    await api("/api/events",{ method:"POST", body: JSON.stringify(payload) });


    $("#add-form").reset(); $("#add-date").value=todayStr(); $("#add-sales").value=1; $("#add-people").value=1; toast("Сделка добавлена"); await refreshAll();
  });
  $("#add-reset").addEventListener("click",()=>{ $("#add-form").reset(); $("#add-date").value=todayStr(); $("#add-sales").value=1; $("#add-people").value=1; });
  $("#fab-add").addEventListener("click",()=>{ show("add"); $("#add-people").focus(); });
  const periodSel=$("#period"); const fromInput=$("#from-date"); const toInput=$("#to-date");
  periodSel.addEventListener("change",()=>{ const custom=periodSel.value==="custom"; fromInput.classList.toggle("hidden",!custom); toInput.classList.toggle("hidden",!custom); refreshEvents(); });
  $("#filter-manager").addEventListener("change",refreshEvents);
  fromInput.addEventListener("change",refreshEvents);
  toInput.addEventListener("change",refreshEvents);

  // === Date formatting helpers & manager cache ===
  let managersById = {}; // наполняем в loadManagers()

  function isoToYmd(s){ return (typeof s === "string" && s.includes("T")) ? s.slice(0,10) : s; }
  function ymdToDmy(s){ if(!s) return ""; const [y,m,d] = s.split("-"); return `${d}.${m}.${y}`; }
  function fmtDate(x){
    if(!x) return "";
    const s = typeof x === "string" ? x : (x?.toISOString?.() ?? "");
    const ymd = isoToYmd(s);
    return ymd && ymd.includes("-") ? ymdToDmy(ymd) : s;
  }

  function accentColor(alpha = 1){
    const cssColor = getComputedStyle(document.documentElement).getPropertyValue("--accent")?.trim() || "#1c7ed6";
    if(!cssColor.startsWith("#")) return alpha === 1 ? cssColor : `rgba(28, 126, 214, ${alpha})`;
    let hex = cssColor.slice(1);
    if(hex.length === 3) hex = hex.split("").map(ch=>ch+ch).join("");
    const int = parseInt(hex, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function updateMonthlySalesChart(rows, from, to){
    const canvas = $("#monthly-sales-chart");
    if(!canvas || typeof Chart === "undefined") return;

    const totals = {};
    rows.forEach(ev => {
      const raw = ev?.date;
      let ymd = "";
      if(typeof raw === "string"){
        ymd = raw.slice(0,10);
      } else if(raw instanceof Date){
        ymd = toYMD(raw);
      } else if(raw){
        try { ymd = toYMD(new Date(raw)); }
        catch { ymd = ""; }
      }
      if(!ymd) return;
      const count = Number(ev?.people ?? 0) || 0;
      totals[ymd] = (totals[ymd] || 0) + Math.max(0, count);
    });

    const labels = [];
    const data = [];
    const parseYmd = (value) => {
      const parts = (value || "").split("-").map(Number);
      if(parts.length !== 3 || parts.some(n=>Number.isNaN(n))) return null;
      return new Date(Date.UTC(parts[0], parts[1]-1, parts[2]));
    };
    const start = parseYmd(from);
    const end = parseYmd(to);
    if(!start || !end) return;
    for(let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)){
      const dayKey = d.toISOString().slice(0,10);
      labels.push(new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }));
      data.push(totals[dayKey] || 0);
    }

    const border = accentColor(1);
    const background = accentColor(0.18);

    if(!monthlySalesChart){
      monthlySalesChart = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: "Люди",
            data,
            tension: 0.35,
            borderColor: border,
            backgroundColor: background,
            borderWidth: 3,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0
              }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(ctx){
                  return `Людей: ${ctx.parsed.y}`;
                }
              }
            }
          }
        }
      });
    } else {
      monthlySalesChart.data.labels = labels;
      monthlySalesChart.data.datasets[0].data = data;
      monthlySalesChart.data.datasets[0].borderColor = border;
      monthlySalesChart.data.datasets[0].backgroundColor = background;
      monthlySalesChart.update();
    }
  }

  async function refreshEvents(){
    const [from,to]=calcRange(periodSel.value,fromInput,toInput);
    const params=new URLSearchParams({from,to,managerId:$("#filter-manager").value}).toString();
    const rows=await api(`/api/events?${params}`);
    const tb=$("#events-table tbody"); tb.innerHTML="";
    let sales=0, people=0;
    rows.forEach(ev=>{ sales+=ev.salesCount||1; people+=ev.people||0;
      const tr=document.createElement("tr");
      const evMgrId = ev.managerId ?? ev.manager_id ?? ev.manager ?? ev.mgrId ?? ev.mgr_id;
      const mgrName = ev.managerName ?? managersById[String(evMgrId)]?.name ?? "—";
      tr.innerHTML = `<td>${fmtDate(ev.date)}</td>
        <td>${escapeHtml(mgrName)}</td>
        <td>${ev.salesCount||1}</td>
        <td>${ev.people||0}</td>
        <td>${escapeHtml(ev.tour||"")}</td>
        <td>${(ev.amount||0).toLocaleString()}</td>
        <td>${currencyLabel(ev.currency)}</td>
        <td class="mini">${escapeHtml(ev.comment||"")}</td>
        <td><div class="row-actions">
          <button class="btn" data-action="edit" data-id="${ev.id}">Изм.</button>
          <button class="btn danger" data-action="del" data-id="${ev.id}">Удалить</button>
        </div></td>`;

      tb.appendChild(tr);
    });
    $("#events-totals").textContent=`Итого: ${sales} продаж, ${people} людей`;
    tb.onclick=async (e)=>{ const btn=e.target.closest("button"); if(!btn) return; const id=btn.dataset.id; const action=btn.dataset.action;
      if(action==="del"){ if(confirm("Удалить запись?")){ await api(`/api/events/${id}`,{method:"DELETE"}); await refreshAll(); } }
      else if(action==="edit"){
        const row = rows.find(x=>x.id===id); if(!row) return;
        openEditModal(row);
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
    rows.forEach((r,idx)=>{ const avg=r.sales?(r.people/r.sales):0; const xp=r.people+2*r.sales; const level=Math.floor(xp/10)+1; const rem=xp-(Math.floor(xp/50)*50); const pct=Math.min(100,Math.floor(rem/50*100)); const badge=(r.people>=200)?"🏆":(r.people>=100?"🥈":(r.people>=50?"🥉":""));
      const card=document.createElement("div"); card.className="lb-card"; card.innerHTML=`<div><div class="lb-title">${idx+1}. ${escapeHtml(r.managerName)} ${badge}</div><div class="badges"><span class="badge">Люди: <b>${r.people}</b></span><span class="badge">Продаж: <b>${r.sales}</b></span><span class="badge">Средняя группа: <b>${avg.toFixed(1)}</b></span><span class="badge">Цель/нед: <b>${r.target||0}</b></span><span class="badge">XP: <b>${xp}</b> | LVL ${level}</span></div><div class="progress"><div style="width:${pct}%"></div></div></div><div style="font-weight:800;font-size:20px;">${medal(idx)}</div>`; box.appendChild(card);
    });
  }
  function updateMeUI(){
    const a = getAuth();
    const una = $("#me-unauth"), au = $("#me-auth");
    if (!una || !au) return; // если секции нет — выходим

    if (a) {
      // Показ "вошёл"
      una.classList.add("hidden");
      au.classList.remove("hidden");
      const name = managersById?.[String(a.managerId)]?.name || a.name || "—";
      $("#me-name").textContent = `Вы вошли как: ${name}`;
      // (опционально) фиксируем менеджера при добавлении
      if ($("#add-manager")) {
        $("#add-manager").value = a.managerId;
        $("#add-manager").disabled = true; // можно убрать, если хочется менять вручную
      }
    } else {
      // Показ "не вошёл"
      au.classList.add("hidden");
      una.classList.remove("hidden");
      $("#me-name").textContent = "";
      if ($("#add-manager")) {
        $("#add-manager").disabled = false;
      }
    }
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
    updateMonthlySalesChart(monthRows, moFrom, moTo);
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
  function currencyLabel(code){
    const c=(code||'KGS').toUpperCase();
    if(c==='USD') return '$';
    if(c==='KZT') return '₸';
    return 'сом'; // KGS
  }
  function getAuth(){
    try { return JSON.parse(localStorage.getItem("auth") || "null"); }
    catch { return null; }
  }
  function setAuth(obj){
    if (obj) localStorage.setItem("auth", JSON.stringify(obj));
    else localStorage.removeItem("auth");
  }
  function toast(msg){ const d=document.createElement("div"); d.textContent=msg; d.style.position="fixed"; d.style.bottom="90px"; d.style.right="18px"; d.style.background="#0b132b"; d.style.color="#fff"; d.style.padding="10px 14px"; d.style.borderRadius="12px"; d.style.boxShadow="0 8px 24px rgba(2,8,23,.06)"; document.body.appendChild(d); setTimeout(()=>d.remove(),1800); }
  async function refreshAll(){ await refreshDashboard(); await refreshEvents(); await renderLeaderboard(); }
  function openEditModal(row){
    // Преобразуем дату к dd.mm.yyyy
    const ymd = typeof row.date === "string" ? row.date.slice(0,10) : "";
    const ddmmyyyy = (function(){
      if(!ymd) return "";
      const [y,m,d] = ymd.split("-");
      return `${d}.${m}.${y}`;
    })();

    $("#edit-id").value = row.id;
    $("#edit-date").value = ddmmyyyy;

    const evMgrId = row.managerId ?? row.manager_id ?? row.manager ?? row.mgrId ?? row.mgr_id;
    $("#edit-manager").value = String(evMgrId || "");

    $("#edit-sales").value = Number(row.salesCount || 1);
    $("#edit-people").value = Number(row.people || 1);
    $("#edit-tour").value = row.tour || "";
    $("#edit-amount").value = Number(row.amount || 0);
    $("#edit-currency").value = (row.currency || "KGS").toUpperCase();
    $("#edit-comment").value = row.comment || "";

    $("#edit-modal").classList.remove("hidden");
  }

  function closeEditModal(){
    $("#edit-modal").classList.add("hidden");
  }

  (async function init(){ try{ await loadManagers(); 

    // Сохранить изменения
    const editForm = $("#edit-form");
    if (editForm) {
      editForm.addEventListener("submit", async (e)=>{
        e.preventDefault();

        const id = $("#edit-id").value;
        const dmy = $("#edit-date").value.trim();
        const ymd = dmyToYmd(dmy) || null; // валидируем формат дд.мм.гггг

        if(!ymd){ alert("Неверный формат даты. Используйте дд.мм.гггг"); return; }

        const payload = {
          date: ymd,
          managerId: $("#edit-manager").value,
          manager_id: $("#edit-manager").value, // на всякий случай для бэка
          salesCount: Math.max(1, Number($("#edit-sales").value||1)),
          people: Math.max(1, Number($("#edit-people").value||1)),
          tour: $("#edit-tour").value.trim() || null,
          amount: Number($("#edit-amount").value||0),
          comment: $("#edit-comment").value.trim() || null,
          currency: ($("#edit-currency").value || "KGS")
        };

        try {
          await api(`/api/events?id=${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(payload) });
          closeEditModal();
          toast("Сделка обновлена");
          await refreshAll();
        } catch (err) {
          console.error(err);
          alert("Не удалось сохранить изменения");
        }
      });
    }

    // Отмена
    const editCancel = $("#edit-cancel");
    if (editCancel) editCancel.addEventListener("click", closeEditModal);


    const loginForm = $("#login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const managerId = $("#login-manager").value;
        const password  = $("#login-pass").value;
        try {
          const resp = await api("/api/auth", {
            method: "POST",
            body: JSON.stringify({ managerId, password })
          });
          if (resp?.ok) {
            setAuth({ managerId, name: resp.name });
            $("#login-pass").value = "";
            toast("Вход выполнен");
            updateMeUI();
          } else {
            alert(resp?.error || "Неверные данные");
          }
        } catch (err) {
          console.error(err);
          alert("Ошибка входа");
        }
      });
    }

    const btnChangePass = $("#btn-change-pass");
    if (btnChangePass) {
      btnChangePass.addEventListener("click", async () => {
        const a = getAuth();
        if (!a) { toast("Сначала войдите"); return; }
        const np = prompt("Новый пароль:");
        if (!np) return;
        try {
          const r = await api("/api/set-password", {
            method: "POST",
            body: JSON.stringify({ managerId: a.managerId, newPassword: np })
          });
          if (r?.ok) toast("Пароль обновлён");
          else alert(r?.error || "Не удалось сменить пароль");
        } catch (e) {
          console.error(e);
          alert("Ошибка смены пароля");
        }
      });
    }

    const btnLogout = $("#btn-logout");
    if (btnLogout) {
      btnLogout.addEventListener("click", () => {
        setAuth(null);
        toast("Вы вышли");
        updateMeUI();
      });
    }
    periodSel.value="today"; const now=new Date(); $("#from-date").value=toYMD(startOfWeek(now)); $("#to-date").value=toYMD(endOfWeek(now)); $("#lb-period").value="week"; $("#lb-from").value=toYMD(startOfWeek(now)); $("#lb-to").value=toYMD(endOfWeek(now)); updateMeUI(); await refreshAll(); show("dashboard"); if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{});} }catch(err){ console.error(err); alert("Ошибка инициализации: "+err.message); } })();
})();