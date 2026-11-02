// rules.js — USER-DEFINED FUNCTIONS (validation + business rules + calculations)
// The same file runs in two places:
//   1. In the browser  -> checks the form BEFORE anything is sent to the server/database
//   2. On the server   -> checks again before writing to MongoDB (in case the form is bypassed)
// Each check returns an error message (string) or null if the value is fine.

(function (root) {
  const R = {};

  const blank = (v) => v == null || String(v).trim() === '';
  const num = (v) => Number(String(v).trim());

  /* ============ NUMBER AND DATE VALIDATION ============ */

  // Money amount: must be a number, not negative, max 2 decimals (e.g. cost, unit cost)
  R.checkAmount = (v, label, required = false) => {
    if (blank(v)) return required ? `Please enter ${label.toLowerCase()}` : null;
    if (isNaN(num(v))) return `${label} must be a number`;
    if (num(v) < 0) return `${label} cannot be negative`;
    if (!/^\d+(\.\d{1,2})?$/.test(String(v).trim())) return `${label} can have at most 2 decimal places`;
    return null;
  };

  // Whole number inside a range (e.g. quantity, year, weight)
  R.checkWhole = (v, label, min = 0, max = Infinity, required = false) => {
    if (blank(v)) return required ? `Please enter ${label.toLowerCase()}` : null;
    if (isNaN(num(v))) return `${label} must be a number`;
    if (num(v) < 0) return `${label} cannot be negative`;
    if (!Number.isInteger(num(v))) return `${label} must be a whole number`;
    if (num(v) < min) return `${label} must be at least ${min}`;
    if (num(v) > max) return `${label} cannot be more than ${max}`;
    return null;
  };

  // Date cannot be in the future (maintenance date)
  R.checkPastDate = (v, label) => {
    if (blank(v)) return null;
    const d = new Date(v);
    if (isNaN(d)) return `Enter a valid ${label.toLowerCase()}`;
    const today = new Date(); today.setHours(23, 59, 59, 999);
    if (d > today) return `${label} cannot be in the future`;
    return null;
  };

  /* ============ REQUIRED FIELD AND FORMAT VALIDATION ============ */

  R.checkRequired = (v, label) => (blank(v) ? `Please enter ${label.toLowerCase()}` : null);

  // Name: letters, spaces and dots only, at least 2 characters
  R.checkName = (v) =>
    R.checkRequired(v, 'Name') ||
    (!/^[A-Za-z][A-Za-z .]+$/.test(String(v).trim()) ? 'Name can only contain letters and spaces' : null);

  // Registration number like 23BME0142 (2 digits + 3 letters + 4 digits)
  R.checkRegNo = (v) =>
    R.checkRequired(v, 'Reg. No.') ||
    (!/^\d{2}[A-Z]{3}\d{4}$/i.test(String(v).trim()) ? 'Invalid registration number (example: 23BME0142)' : null);

  // Email is optional, but if given it must look like a real address
  R.checkEmail = (v) =>
    blank(v) ? null :
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()) ? 'Enter a valid email address' : null;

  // Supplier contact is optional: a 10-digit phone number (+91 allowed) or an email
  R.checkContact = (v) => {
    if (blank(v)) return null;
    const s = String(v).trim();
    const phone = s.replace(/[\s-]/g, '');
    if (/^(\+91)?\d{10}$/.test(phone)) return null;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
    return 'Enter a valid 10-digit phone number or email';
  };

  /* ============ STOCK AVAILABILITY CHECK ============ */

  // Quantity to issue must be a whole number > 0 and not more than what is in stock
  R.checkIssueQty = (v, available) =>
    R.checkWhole(v, 'Quantity', 1, Infinity, true) ||
    (num(v) > available ? `Only ${available} in stock` : null);

  /* ============ DUPLICATE SKILL CHECK ============ */

  R.checkSkill = (skill, existing = []) => {
    if (blank(skill)) return 'Please enter a skill';
    const s = String(skill).trim();
    if (s.length > 30) return 'Skill can be at most 30 characters';
    if (existing.some((e) => e.toLowerCase() === s.toLowerCase())) return 'This member already has that skill';
    return null;
  };

  /* ============ ASSET CONDITION / STATUS RULE ============ */

  // A damaged asset cannot be "In Use", and a retired asset cannot be assigned to anyone
  R.checkAssetRule = (a) => {
    const errors = {};
    if (a.condition === 'Damaged' && a.status === 'In Use')
      errors.status = 'A damaged asset cannot be In Use. Send it for maintenance first';
    if (a.status === 'Retired' && !blank(a.assignedTo))
      errors.assignedTo = 'A retired asset cannot be assigned to a student';
    return errors;
  };

  /* ============ MAINTENANCE COST CALCULATION ============ */

  // total cost of a job = labour cost + sum of (part qty x unit cost)
  R.calcJobCost = (job) => {
    const labour = Number(job.cost) || 0;
    const parts = (job.partsUsed || []).reduce((sum, p) => sum + (Number(p.qty) || 0) * (Number(p.unitCost) || 0), 0);
    return { labour, parts, total: labour + parts };
  };

  /* ============ OVERDUE MAINTENANCE CHECK ============ */

  R.OVERDUE_DAYS = 7;
  R.daysOpen = (job, now = new Date()) => Math.floor((now - new Date(job.date)) / 86400000);
  R.isOverdue = (job, now = new Date()) => job.status === 'Open' && R.daysOpen(job, now) > R.OVERDUE_DAYS;

  /* ============ FORM VALIDATORS (combine the checks above) ============ */
  // Each returns an object { fieldName: 'error message' }. Empty object = valid.

  const collect = (pairs) => {
    const errors = {};
    for (const [field, msg] of pairs) if (msg && !errors[field]) errors[field] = msg;
    return errors;
  };

  R.validateStudent = (b) => collect([
    ['name', R.checkName(b.name)],
    ['regNo', R.checkRegNo(b.regNo)],
    ['email', R.checkEmail(b.email)],
  ]);

  R.validateVehicle = (b) => collect([
    ['name', R.checkRequired(b.name, 'Vehicle name')],
    ['year', R.checkWhole(b.year, 'Year', 2000, new Date().getFullYear() + 1, true)],
    ['specs.weightKg', R.checkWhole(b.specs?.weightKg, 'Weight', 100, 400)],
    ['specs.topSpeedKmph', R.checkWhole(b.specs?.topSpeedKmph, 'Top speed', 1, 200)],
  ]);

  R.validateAsset = (b) => ({
    ...collect([
      ['name', R.checkRequired(b.name, 'Asset name')],
      ['cost', R.checkAmount(b.cost, 'Cost')],
    ]),
    ...R.checkAssetRule(b),
  });

  R.validateInventory = (b) => collect([
    ['item', R.checkRequired(b.item, 'Item name')],
    ['unitCost', R.checkAmount(b.unitCost, 'Unit cost')],
    ['qty', R.checkWhole(b.qty, 'Quantity')],
    ['minStock', R.checkWhole(b.minStock, 'Minimum stock')],
    ['supplier.contact', R.checkContact(b.supplier?.contact)],
    ['supplier.leadTimeDays', R.checkWhole(b.supplier?.leadTimeDays, 'Lead time', 0, 90)],
  ]);

  // stock = { itemId: qtyAvailable } so parts can be checked against inventory
  R.validateMaintenance = (b, stock = {}) => {
    const pairs = [
      ['assetId', blank(b.assetId) ? 'Please select an asset' : null],
      ['issue', R.checkRequired(b.issue, 'Issue')],
      ['cost', R.checkAmount(b.cost, 'Cost')],
      ['date', R.checkPastDate(b.date, 'Date')],
      ['doneBy', blank(b.doneBy) ? 'Please select who did the work' : null],
    ];
    [1, 2, 3].forEach((n) => {
      const p = b['p' + n] || {};
      if (!blank(p.itemId) && blank(p.qty)) pairs.push([`p${n}.qty`, 'Enter a quantity for the selected part']);
      else if (blank(p.itemId) && !blank(p.qty)) pairs.push([`p${n}.itemId`, 'Select a part']);
      else if (!blank(p.itemId)) pairs.push([`p${n}.qty`, R.checkIssueQty(p.qty, stock[p.itemId] ?? Infinity)]);
    });
    return collect(pairs);
  };

  R.firstError = (errors) => Object.values(errors)[0] || null;

  if (typeof module !== 'undefined' && module.exports) module.exports = R; // Node (server)
  else root.Rules = R;                                                     // browser
})(this);
