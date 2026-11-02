// app.js — minimal single-page frontend (no frameworks)
// Feature tags like or in comments match FEATURES.md.

/* ---------- constants ---------- */
const SUBTEAMS = ['Powertrain', 'Chassis', 'Suspension', 'Electronics', 'Aerodynamics', 'Business', 'Management'];
const ROLES = ['Captain', 'Vice Captain', 'Sub-team Lead', 'Member'];
const CATEGORIES = ['Brakes', 'Battery', 'Motor', 'Sensor', 'Suspension', 'Chassis', 'Electronics', 'Tyres', 'Tool'];
const CONDITIONS = ['New', 'Good', 'Worn', 'Damaged'];
const ASSET_STATUS = ['Available', 'In Use', 'Under Maintenance', 'Retired'];
const VEHICLE_STATUS = ['Design', 'Manufacturing', 'Testing', 'Competition', 'Retired'];
const INV_CATEGORIES = ['Fasteners', 'Fluids', 'Electrical', 'Brakes', 'Consumables', 'Tyres', 'Bearings'];

/* ---------- helpers ---------- */
const $ = (s) => document.querySelector(s);
const view = $('#view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const opts = (list, sel, blank) =>
  (blank !== undefined ? `<option value="">${blank}</option>` : '') +
  list.map((o) => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return `<option value="${esc(v)}" ${String(v) === String(sel ?? '') ? 'selected' : ''}>${esc(l)}</option>`;
  }).join('');

async function api(method, url, body) {
  const res = await fetch('/api' + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || res.statusText), { fields: data.fields });
  return data;
}

function toast(msg, err) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (err ? ' err' : '');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.add('hidden'), 2600);
}

// run an action, show result, re-render
async function act(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); render(); }
  catch (e) { toast(e.message, true); }
}

/* ---------- generic modal form ---------- */
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), o)[last] = v; };

// Show validation errors under each field (red border + message). Returns true if there were errors.
function showErrors(errors) {
  document.querySelectorAll('#modalFields .ferr').forEach((e) => e.remove());
  document.querySelectorAll('#modalFields .err').forEach((e) => e.classList.remove('err'));
  let first = null;
  for (const [name, msg] of Object.entries(errors || {})) {
    if (!msg) continue;
    const input = document.querySelector(`#modalFields [name="${name}"]`);
    if (!input) { toast(msg, true); continue; }
    input.classList.add('err');
    input.insertAdjacentHTML('afterend', `<div class="ferr">${esc(msg)}</div>`);
    first = first || input;
  }
  if (first) first.focus();
  return Object.values(errors || {}).some(Boolean);
}

// validate(formData) -> { field: 'message' }   runs BEFORE the request is sent (user-defined validation)
function openForm(title, fields, initial, onSubmit, validate) {
  $('#modalTitle').textContent = title;
  $('#modalFields').innerHTML = fields.map((f) => {
    if (f.section) return `<div class="section">${esc(f.section)}</div>`;
    let v = getPath(initial || {}, f.name);
    if (f.type === 'date') v = isoDate(v);
    let input;
    if (f.type === 'select') input = `<select name="${f.name}">${opts(f.options, v, f.blank)}</select>`;
    else if (f.type === 'textarea') input = `<textarea name="${f.name}" rows="2">${esc(v)}</textarea>`;
    else input = `<input name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${f.type === 'number' ? 'step="any"' : ''}>`;
    return `<label class="${f.full ? 'full' : ''}">${esc(f.label)}${input}</label>`;
  }).join('');
  $('#modal').classList.remove('hidden');
  $('#modalForm').onsubmit = async (e) => {
    e.preventDefault();
    const out = {};
    new FormData(e.target).forEach((v, k) => setPath(out, k, v));
    if (validate && showErrors(validate(out))) return;          // stop here: nothing reaches the database
    try { await onSubmit(out); closeForm(); render(); toast('Saved'); }
    catch (err) { if (!(err.fields && showErrors(err.fields))) toast(err.message, true); }
  };
  // clear a field's error as soon as the user edits it
  $('#modalFields').oninput = (e) => {
    e.target.classList.remove('err');
    if (e.target.nextElementSibling?.classList.contains('ferr')) e.target.nextElementSibling.remove();
  };
}
function closeForm() { $('#modal').classList.add('hidden'); }
$('#modalCancel').onclick = closeForm;

/* ---------- router ---------- */
const routes = {};
async function render() {
  const [, page = 'dashboard', id] = location.hash.split('/');
  document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#/${page}`));
  try { await (routes[page] || routes.dashboard)(id); }
  catch (e) { view.innerHTML = `<div class="card">Error: ${esc(e.message)}</div>`; }
}
window.addEventListener('hashchange', render);

/* ================= DASHBOARD ================= */
routes.dashboard = async () => {
  const d = await api('GET', '/dashboard');
  const maxCat = Math.max(1, ...d.byCategory.map((c) => c.value));
  view.innerHTML = `
    <div class="between"><h2>Dashboard</h2></div>
    <div class="grid g4">
      ${[['Team members', d.counts.students], ['Vehicles', d.counts.vehicles], ['Assets', d.counts.assets],
         ['Open jobs', d.counts.openJobs], ['Overdue jobs', d.overdueJobs], ['Asset value', inr(d.assetValue)], ['Maintenance spend', inr(d.totalSpend)]]
        .map(([l, n]) => `<div class="card stat"><div class="lbl">${l}</div><div class="num">${n}</div></div>`).join('')}
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card"><h3>Assets by category</h3>
        <table><tr><th>Category</th><th class="num">Count</th><th class="num">Value</th></tr>
        ${d.byCategory.map((c) => `<tr><td>${esc(c.category)}<div class="bar"><i style="width:${(c.value / maxCat) * 100}%"></i></div></td>
          <td class="num">${c.count}</td><td class="num">${inr(c.value)}</td></tr>`).join('')}</table></div>

      <div class="card"><h3>Low stock</h3>
        ${d.lowStock.length ? `<table><tr><th>Item</th><th class="num">Qty</th><th class="num">Min</th><th>Supplier</th></tr>
        ${d.lowStock.map((i) => `<tr class="low"><td>${esc(i.item)}</td><td class="num">${i.qty}</td><td class="num">${i.minStock}</td><td>${esc(i.supplier?.name)}</td></tr>`).join('')}</table>`
        : '<div class="empty">All items above minimum stock.</div>'}</div>

      <div class="card"><h3>Maintenance spend per vehicle</h3>
        <table><tr><th>Vehicle</th><th class="num">Jobs</th><th class="num">Spend</th></tr>
        ${d.spendPerVehicle.map((v) => `<tr><td>${esc(v.vehicle)}</td><td class="num">${v.jobs}</td><td class="num">${inr(v.spend)}</td></tr>`).join('')}</table></div>

      <div class="card"><h3>Most used spare parts</h3>
        ${d.topParts.length ? `<table><tr><th>Part</th><th class="num">Qty used</th><th class="num">Jobs</th></tr>
        ${d.topParts.map((p) => `<tr><td>${esc(p.item)}</td><td class="num">${p.qtyUsed}</td><td class="num">${p.jobs}</td></tr>`).join('')}</table>`
        : '<div class="empty">No parts used yet.</div>'}</div>

      <div class="card"><h3>Latest open jobs</h3>
        ${d.openJobs.length ? `<table><tr><th>Date</th><th>Asset</th><th>Issue</th></tr>
        ${d.openJobs.map((j) => `<tr class="${Rules.isOverdue(j) ? 'overdue' : ''}"><td>${fmtDate(j.date)}</td><td>${esc(j.asset)}</td><td>${esc(j.issue)} ${overduePill(j)}</td></tr>`).join('')}</table>`
        : '<div class="empty">No open jobs.</div>'}</div>
    </div>`;
};

/* ================= STUDENTS ================= */
let stuFilter = { q: '', subTeam: '' };
const studentFields = [
  { name: 'name', label: 'Name', required: true },
  { name: 'regNo', label: 'Reg. No.', required: true },
  { name: 'role', label: 'Role', type: 'select', options: ROLES },
  { name: 'subTeam', label: 'Sub-team', type: 'select', options: SUBTEAMS },
  { name: 'email', label: 'Email', type: 'email', full: true },
];

routes.students = async () => {
  const qs = new URLSearchParams(stuFilter).toString();
  const [list, teams] = await Promise.all([api('GET', '/students?' + qs), api('GET', '/students/subteams')]);
  window._students = Object.fromEntries(list.map((s) => [s._id, s]));
  view.innerHTML = `
    <div class="between"><h2>Team members <span class="sub">(${list.length})</span></h2>
      <div class="row">
        <input id="sq" placeholder="Search name…" value="${esc(stuFilter.q)}">
        <select id="st">${opts(teams, stuFilter.subTeam, 'All sub-teams')}</select>
        <button onclick="addStudent()">+ Add member</button>
      </div></div>
    <div class="card table-wrap"><table>
      <tr><th>Name</th><th>Reg. No.</th><th>Role</th><th>Sub-team</th><th>Skills</th><th></th></tr>
      ${list.map((s) => `<tr>
        <td>${esc(s.name)}<div class="sub">${esc(s.email)}</div></td><td>${esc(s.regNo)}</td><td>${esc(s.role)}</td><td>${esc(s.subTeam)}</td>
        <td>${(s.skills || []).map((k, i) => `<span class="pill">${esc(k)}<x onclick="removeSkill('${s._id}',${i})">×</x></span>`).join('')}
            <button class="ghost sm" onclick="addSkill('${s._id}')">+</button></td>
        <td class="num"><button class="ghost sm" onclick="editStudent('${s._id}')">Edit</button>
            <button class="ghost sm danger" onclick="delStudent('${s._id}')">Delete</button></td></tr>`).join('')}
    </table>${list.length ? '' : '<div class="empty">No members found.</div>'}</div>`;
  $('#sq').onchange = (e) => { stuFilter.q = e.target.value; render(); };
  $('#st').onchange = (e) => { stuFilter.subTeam = e.target.value; render(); };
};
window.addStudent = () => openForm('Add member', studentFields, {}, (b) => api('POST', '/students', b), Rules.validateStudent);
window.editStudent = (id) => openForm('Edit member', studentFields, _students[id], (b) => api('PUT', '/students/' + id, b), Rules.validateStudent);
// confirmation before delete
window.delStudent = (id) => confirm(`Delete member "${_students[id].name}"? Their assets will be un-assigned.`) && act(() => api('DELETE', '/students/' + id), 'Deleted');
// duplicate skill check before sending
window.addSkill = (id) => openForm('Add skill: ' + _students[id].name, [{ name: 'skill', label: 'Skill (e.g. CAD, MATLAB, Welding)', full: true }], {},
  (b) => api('POST', `/students/${id}/skills`, { skill: b.skill.trim() }),
  (b) => ({ skill: Rules.checkSkill(b.skill, _students[id].skills) }));
window.removeSkill = (id, i) => act(() => api('DELETE', `/students/${id}/skills/${encodeURIComponent(_students[id].skills[i])}`));

/* ================= VEHICLES ================= */
const vehicleFields = [
  { name: 'name', label: 'Name', required: true },
  { name: 'year', label: 'Year', type: 'number', required: true },
  { name: 'type', label: 'Type', type: 'select', options: ['EV', 'Combustion'] },
  { name: 'status', label: 'Status', type: 'select', options: VEHICLE_STATUS },
  { section: 'Specs (embedded document)' },
  { name: 'specs.motor', label: 'Motor / Engine' },
  { name: 'specs.battery', label: 'Battery' },
  { name: 'specs.weightKg', label: 'Weight (kg)', type: 'number' },
  { name: 'specs.topSpeedKmph', label: 'Top speed (km/h)', type: 'number' },
  { name: 'specs.chassis', label: 'Chassis', full: true },
];

routes.vehicles = async (id) => {
  if (id) return vehicleDetail(id);
  const list = await api('GET', '/vehicles');
  window._vehicles = Object.fromEntries(list.map((v) => [v._id, v]));
  view.innerHTML = `
    <div class="between"><h2>Vehicles</h2><button onclick="addVehicle()">+ Add vehicle</button></div>
    <div class="grid g2">
      ${list.map((v) => `<div class="card">
        <div class="between" style="margin-bottom:10px"><div><a class="link" href="#/vehicles/${v._id}"><b>${esc(v.name)}</b></a>
          <span class="sub"> · ${v.year} · ${esc(v.type)}</span></div><span class="pill">${esc(v.status)}</span></div>
        <h3>Specs</h3>
        <div class="specs">
          <div><span>Motor</span>${esc(v.specs?.motor)}</div><div><span>Battery</span>${esc(v.specs?.battery)}</div>
          <div><span>Weight</span>${v.specs?.weightKg} kg</div><div><span>Top speed</span>${v.specs?.topSpeedKmph} km/h</div>
          <div><span>Chassis</span>${esc(v.specs?.chassis)}</div></div>
        <div class="row end" style="margin-top:12px">
          <a href="#/vehicles/${v._id}"><button class="ghost sm">Details</button></a>
          <button class="ghost sm" onclick="editVehicle('${v._id}')">Edit</button>
          <button class="ghost sm danger" onclick="delVehicle('${v._id}')">Delete</button></div>
      </div>`).join('')}
    </div>${list.length ? '' : '<div class="empty">No vehicles yet.</div>'}`;
};

async function vehicleDetail(id) {
  const v = await api('GET', '/vehicles/' + id);
  const who = Object.fromEntries(v.people.map((p) => [p._id, p.name]));
  const assetName = Object.fromEntries(v.assets.map((a) => [a._id, a.name]));
  view.innerHTML = `
    <div class="between"><div><a class="link sub" href="#/vehicles">← Vehicles</a><h2>${esc(v.name)} <span class="sub">${v.year} · ${esc(v.type)} · ${esc(v.status)}</span></h2></div></div>
    <div class="grid g4">
      <div class="card stat"><div class="lbl">Assets</div><div class="num">${v.assets.length}</div></div>
      <div class="card stat"><div class="lbl">Asset value</div><div class="num">${inr(v.assetValue)}</div></div>
      <div class="card stat"><div class="lbl">Service jobs</div><div class="num">${v.history.length}</div></div>
      <div class="card stat"><div class="lbl">Service cost</div><div class="num">${inr(v.serviceCost)}</div></div>
    </div>
    <div class="card" style="margin-top:14px"><h3>Specs</h3><div class="specs">
      ${[['Motor', v.specs?.motor], ['Battery', v.specs?.battery], ['Weight', v.specs?.weightKg + ' kg'], ['Top speed', v.specs?.topSpeedKmph + ' km/h'], ['Chassis', v.specs?.chassis]]
        .map(([k, val]) => `<div><span>${k}</span>${esc(val)}</div>`).join('')}</div></div>
    <div class="card table-wrap" style="margin-top:14px"><h3>Assets on this vehicle</h3>
      <table><tr><th>Asset</th><th>Category</th><th>Assigned to</th><th>Condition</th><th>Status</th><th class="num">Cost</th></tr>
      ${v.assets.map((a) => `<tr><td>${esc(a.name)}</td><td>${esc(a.category)}</td><td>${esc(who[a.assignedTo] || '—')}</td>
        <td>${esc(a.condition)}</td><td>${statusPill(a.status)}</td><td class="num">${inr(a.cost)}</td></tr>`).join('')}</table></div>
    <div class="card table-wrap" style="margin-top:14px"><h3>Service history</h3>
      ${v.history.length ? `<table><tr><th>Date</th><th>Asset</th><th>Issue</th><th>Action</th><th>Status</th><th class="num">Cost</th></tr>
      ${v.history.sort((a, b) => new Date(b.date) - new Date(a.date)).map((h) => `<tr><td>${fmtDate(h.date)}</td><td>${esc(assetName[h.assetId])}</td>
        <td>${esc(h.issue)}</td><td>${esc(h.action)}</td><td>${statusPill(h.status)}</td><td class="num">${inr(Rules.calcJobCost(h).total)}</td></tr>`).join('')}</table>`
      : '<div class="empty">No service history.</div>'}</div>`;
}
window.addVehicle = () => openForm('Add vehicle', vehicleFields, { year: new Date().getFullYear() }, (b) => api('POST', '/vehicles', b), Rules.validateVehicle);
window.editVehicle = (id) => openForm('Edit vehicle', vehicleFields, _vehicles[id], (b) => api('PUT', '/vehicles/' + id, b), Rules.validateVehicle);
window.delVehicle = (id) => confirm(`Delete vehicle "${_vehicles[id].name}"? Its assets will be un-assigned.`) && act(() => api('DELETE', '/vehicles/' + id), 'Deleted');

// overdue badge for open jobs older than 7 days
function overduePill(j) {
  return Rules.isOverdue(j) ? `<span class="pill alert">Overdue · ${Rules.daysOpen(j)} days</span>` : '';
}

function statusPill(s) {
  const cls = s === 'Under Maintenance' || s === 'Open' || s === 'Damaged' ? 'alert' : s === 'Available' || s === 'Completed' ? 'ok' : '';
  return `<span class="pill ${cls}">${esc(s)}</span>`;
}

/* ================= ASSETS ================= */
let assetFilter = { q: '', category: '', status: '' };
async function lookups() {
  const [vs, ss] = await Promise.all([api('GET', '/vehicles'), api('GET', '/students')]);
  return {
    vOpts: vs.map((v) => ({ value: v._id, label: v.name })),
    sOpts: ss.map((s) => ({ value: s._id, label: `${s.name} (${s.subTeam})` })),
  };
}

routes.assets = async () => {
  const qs = new URLSearchParams(assetFilter).toString();
  const [{ total, items }, cats] = await Promise.all([api('GET', '/assets?' + qs), api('GET', '/assets/categories')]);
  window._assets = Object.fromEntries(items.map((a) => [a._id, a]));
  view.innerHTML = `
    <div class="between"><h2>Assets <span class="sub">(${total})</span></h2>
      <div class="row">
        <input id="aq" placeholder="Full-text search…" value="${esc(assetFilter.q)}">
        <select id="ac">${opts(cats, assetFilter.category, 'All categories')}</select>
        <select id="as">${opts(ASSET_STATUS, assetFilter.status, 'All statuses')}</select>
        <button onclick="addAsset()">+ Add asset</button>
      </div></div>
    <div class="card table-wrap"><table>
      <tr><th>Asset</th><th>Category</th><th>Vehicle</th><th>Assigned to</th><th>Condition</th><th>Status</th><th class="num">Cost</th><th></th></tr>
      ${items.map((a) => `<tr>
        <td>${esc(a.name)}<div class="sub">${esc(a.description)}</div></td><td>${esc(a.category)}</td>
        <td>${esc(a.vehicleName || '—')}</td><td>${esc(a.studentName || '—')}</td><td>${esc(a.condition)}</td>
        <td>${statusPill(a.status)}</td><td class="num">${inr(a.cost)}</td>
        <td class="num" style="white-space:nowrap"><button class="ghost sm" onclick="assignAsset('${a._id}')">Assign</button>
          <button class="ghost sm" onclick="editAsset('${a._id}')">Edit</button>
          <button class="ghost sm danger" onclick="delAsset('${a._id}')">Delete</button></td></tr>`).join('')}
    </table>${items.length ? '' : '<div class="empty">No assets match.</div>'}</div>`;
  $('#aq').onchange = (e) => { assetFilter.q = e.target.value; render(); };
  $('#ac').onchange = (e) => { assetFilter.category = e.target.value; render(); };
  $('#as').onchange = (e) => { assetFilter.status = e.target.value; render(); };
};

async function assetFields() {
  const { vOpts, sOpts } = await lookups();
  return [
    { name: 'name', label: 'Name', required: true, full: true },
    { name: 'category', label: 'Category', type: 'select', options: CATEGORIES },
    { name: 'cost', label: 'Purchase cost (₹)', type: 'number' },
    { name: 'condition', label: 'Condition', type: 'select', options: CONDITIONS },
    { name: 'status', label: 'Status', type: 'select', options: ASSET_STATUS },
    { name: 'vehicleId', label: 'Vehicle', type: 'select', options: vOpts, blank: '— none —' },
    { name: 'assignedTo', label: 'Assigned to', type: 'select', options: sOpts, blank: '— none —' },
    { name: 'description', label: 'Description', type: 'textarea', full: true },
  ];
}
window.addAsset = async () => openForm('Add asset', await assetFields(), { condition: 'New', status: 'Available' }, (b) => api('POST', '/assets', b), Rules.validateAsset);
window.editAsset = async (id) => openForm('Edit asset', await assetFields(), _assets[id], (b) => api('PUT', '/assets/' + id, b), Rules.validateAsset);
window.assignAsset = async (id) => {
  const { vOpts, sOpts } = await lookups();
  openForm('Assign: ' + _assets[id].name, [
    { name: 'vehicleId', label: 'Vehicle', type: 'select', options: vOpts, blank: '— none —' },
    { name: 'assignedTo', label: 'Assigned to', type: 'select', options: sOpts, blank: '— none —' },
    { name: 'condition', label: 'Condition', type: 'select', options: CONDITIONS },
    { name: 'status', label: 'Status', type: 'select', options: ASSET_STATUS },
  ], _assets[id], (b) => api('PATCH', `/assets/${id}/assign`, b), Rules.checkAssetRule);
};
window.delAsset = (id) => confirm(`Delete "${_assets[id].name}" and its maintenance history?`) && act(() => api('DELETE', '/assets/' + id), 'Deleted');

/* ================= MAINTENANCE ================= */
let mFilter = { status: '' };
routes.maintenance = async () => {
  const rows = await api('GET', '/maintenance?' + new URLSearchParams(mFilter));
  view.innerHTML = `
    <div class="between"><h2>Maintenance</h2>
      <div class="row"><select id="ms">${opts(['Open', 'Completed'], mFilter.status, 'All')}</select>
        <button onclick="logJob()">+ Log maintenance</button></div></div>
    <div class="card table-wrap"><table>
      <tr><th>Date</th><th>Asset</th><th>Issue / Action</th><th>Done by</th><th>Parts used</th><th class="num">Total cost</th><th>Status</th><th></th></tr>
      ${rows.map((m) => { const c = Rules.calcJobCost(m); return `<tr class="${Rules.isOverdue(m) ? 'overdue' : ''}">
        <td style="white-space:nowrap">${fmtDate(m.date)}</td><td>${esc(m.assetName || '(deleted)')}<div class="sub">${esc(m.category)}</div></td>
        <td>${esc(m.issue)}<div class="sub">${esc(m.action)}</div></td><td>${esc(m.doneByName || '—')}</td>
        <td>${(m.partsUsed || []).map((p) => `<span class="pill">${esc(p.item)} × ${p.qty}</span>`).join('') || '<span class="sub">—</span>'}</td>
        <td class="num">${inr(c.total)}<div class="sub" style="white-space:nowrap">labour ${inr(c.labour)}<br>+ parts ${inr(c.parts)}</div></td>
        <td>${statusPill(m.status)} ${overduePill(m)}</td>
        <td class="num" style="white-space:nowrap">
          ${m.status === 'Open' ? `<button class="ghost sm" onclick="addPart('${m._id}')">+ Part</button>
          <button class="ghost sm" onclick="completeJob('${m._id}')">Complete</button>` : ''}
          <button class="ghost sm danger" onclick="delJob('${m._id}')">Delete</button></td></tr>`; }).join('')}
    </table>${rows.length ? '' : '<div class="empty">No records.</div>'}</div>`;
  $('#ms').onchange = (e) => { mFilter.status = e.target.value; render(); };
};

async function invOpts() {
  const inv = await api('GET', '/inventory');
  window._stock = Object.fromEntries(inv.map((i) => [i._id, i.qty])); // used by the stock check 
  return inv.map((i) => ({ value: i._id, label: `${i.item} (stock ${i.qty})` }));
}
window.logJob = async () => {
  const [{ items }, { sOpts }, iOpts] = await Promise.all([api('GET', '/assets'), lookups(), invOpts()]);
  const aOpts = items.map((a) => ({ value: a._id, label: `${a.name} — ${a.vehicleName || 'no vehicle'}` }));
  const partFields = [1, 2, 3].flatMap((n) => [
    { name: `p${n}.itemId`, label: `Part ${n}`, type: 'select', options: iOpts, blank: '— none —' },
    { name: `p${n}.qty`, label: 'Qty', type: 'number' },
  ]);
  openForm('Log maintenance', [
    { name: 'assetId', label: 'Asset', type: 'select', options: aOpts, full: true },
    { name: 'issue', label: 'Issue identified', required: true, full: true },
    { name: 'action', label: 'Action taken', type: 'textarea', full: true },
    { name: 'cost', label: 'Labour / service cost (₹)', type: 'number' },
    { name: 'date', label: 'Date', type: 'date' },
    { name: 'doneBy', label: 'Done by', type: 'select', options: sOpts, blank: '— select —', full: true },
    { section: 'Parts used (deducted from inventory with $inc)' },
    ...partFields,
  ], { date: new Date() }, (b) => {
    b.partsUsed = [b.p1, b.p2, b.p3].filter((p) => p && p.itemId && p.qty);
    delete b.p1; delete b.p2; delete b.p3;
    return api('POST', '/maintenance', b);
  }, (b) => Rules.validateMaintenance(b, _stock)); // checked before sending
};
window.addPart = async (id) => openForm('Add part to job', [
  { name: 'itemId', label: 'Part', type: 'select', options: await invOpts(), full: true },
  { name: 'qty', label: 'Qty', type: 'number', required: true },
], { qty: 1 }, (b) => api('POST', `/maintenance/${id}/parts`, b),
  (b) => ({ itemId: b.itemId ? null : 'Select a part', qty: Rules.checkIssueQty(b.qty, _stock[b.itemId] ?? Infinity) }));
window.completeJob = (id) => act(() => api('PATCH', `/maintenance/${id}/complete`, {}), 'Job completed — asset set to Available');
window.delJob = (id) => confirm('Delete this maintenance record?') && act(() => api('DELETE', '/maintenance/' + id), 'Deleted');

/* ================= INVENTORY ================= */
const invFields = [
  { name: 'item', label: 'Item', required: true, full: true },
  { name: 'category', label: 'Category', type: 'select', options: INV_CATEGORIES },
  { name: 'unitCost', label: 'Unit cost (₹)', type: 'number' },
  { name: 'qty', label: 'Quantity', type: 'number' },
  { name: 'minStock', label: 'Minimum stock', type: 'number' },
  { section: 'Supplier (embedded document)' },
  { name: 'supplier.name', label: 'Supplier name' },
  { name: 'supplier.contact', label: 'Contact' },
  { name: 'supplier.leadTimeDays', label: 'Lead time (days)', type: 'number' },
];
routes.inventory = async () => {
  const rows = await api('GET', '/inventory');
  window._inv = Object.fromEntries(rows.map((r) => [r._id, r]));
  const low = rows.filter((r) => r.low).length;
  view.innerHTML = `
    <div class="between"><h2>Inventory <span class="sub">(${rows.length} items${low ? ` · <span style="color:var(--alert)">${low} low</span>` : ''})</span></h2>
      <button onclick="addInv()">+ Add item</button></div>
    <div class="card table-wrap"><table>
      <tr><th>Item</th><th>Category</th><th class="num">Qty</th><th class="num">Min</th><th class="num">Unit cost</th><th class="num">Value</th><th>Supplier</th><th></th></tr>
      ${rows.map((r) => `<tr class="${r.low ? 'low' : ''}">
        <td>${esc(r.item)} ${r.low ? `<span class="pill alert">low</span>` : ''}</td><td>${esc(r.category)}</td>
        <td class="num">${r.qty}</td><td class="num">${r.minStock}</td><td class="num">${inr(r.unitCost)}</td><td class="num">${inr(r.value)}</td>
        <td>${esc(r.supplier?.name)}<div class="sub">${esc(r.supplier?.contact)}${r.supplier?.leadTimeDays ? ` · ${r.supplier.leadTimeDays}d lead` : ''}</div></td>
        <td class="num" style="white-space:nowrap">
          <button class="ghost sm" onclick="stock('${r._id}','stock-in')">+ In</button>
          <button class="ghost sm" onclick="stock('${r._id}','issue')">− Issue</button>
          <button class="ghost sm" onclick="editSupplier('${r._id}')">Supplier</button>
          <button class="ghost sm" onclick="editInv('${r._id}')">Edit</button>
          <button class="ghost sm danger" onclick="delInv('${r._id}')">Delete</button></td></tr>`).join('')}
    </table></div>
    <p class="sub" style="margin-top:10px">Rows in red are below their minimum stock level.</p>`;
};
window.addInv = () => openForm('Add item', invFields, {}, (b) => api('POST', '/inventory', b), Rules.validateInventory);
window.editInv = (id) => openForm('Edit item', invFields, _inv[id], (b) => api('PUT', '/inventory/' + id, b), Rules.validateInventory);
// Edit ONLY the embedded supplier — sent to PATCH /inventory/:id/supplier, which runs
//      updateOne({ _id }, { $set: { 'supplier.name': ..., 'supplier.contact': ..., 'supplier.leadTimeDays': ... } })
window.editSupplier = (id) => openForm('Edit supplier: ' + _inv[id].item,
  [
    { name: 'name', label: 'Supplier name', full: true },
    { name: 'contact', label: 'Contact (phone or email)' },
    { name: 'leadTimeDays', label: 'Lead time (days)', type: 'number' },
  ],
  _inv[id].supplier || {},
  (b) => api('PATCH', `/inventory/${id}/supplier`, { name: b.name, contact: b.contact, leadTimeDays: b.leadTimeDays }),
  (b) => ({ contact: Rules.checkContact(b.contact), leadTimeDays: Rules.checkWhole(b.leadTimeDays, 'Lead time', 0, 90) }));
window.delInv = (id) => confirm(`Delete "${_inv[id].item}" from inventory?`) && act(() => api('DELETE', '/inventory/' + id), 'Deleted');
// Stock in / issue — whole number > 0, issue cannot exceed stock (checked before sending)
window.stock = (id, kind) => {
  const it = _inv[id];
  openForm(`${kind === 'issue' ? 'Issue' : 'Stock in'}: ${it.item} (in stock: ${it.qty})`,
    [{ name: 'qty', label: 'Quantity', type: 'number', full: true }], { qty: 1 },
    (b) => api('PATCH', `/inventory/${id}/${kind}`, { qty: Number(b.qty) }),
    (b) => ({ qty: kind === 'issue' ? Rules.checkIssueQty(b.qty, it.qty) : Rules.checkWhole(b.qty, 'Quantity', 1, 100000, true) }));
};

render();
