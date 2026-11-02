// routes/inventory.js — Spare parts & consumables, stock in / issue
const router = require('express').Router();
const { col, oid, reject } = require('../db');
const R = require('../public/rules');

// EMBEDDED DOCUMENT — supplier details live inside the inventory item
const pick = (b) => ({
  item: String(b.item || '').trim(),
  category: b.category,
  qty: Number(b.qty) || 0,
  minStock: Number(b.minStock) || 0,
  unitCost: Number(b.unitCost) || 0,
  supplier: {
    name: b.supplier?.name || '',
    contact: b.supplier?.contact || '',
    leadTimeDays: Number(b.supplier?.leadTimeDays) || 0,
  },
});

// READ — aggregation adds computed fields: "low" flag and stock value (qty * unitCost)
router.get('/', async (req, res) => {
  const rows = await col('inventory').aggregate([
    { $sort: { item: 1 } },
    { $addFields: { low: { $lt: ['$qty', '$minStock'] }, value: { $multiply: ['$qty', '$unitCost'] } } },
  ]).toArray();
  res.json(rows);
});

// Low-stock items
// $expr lets us compare two fields of the same document (qty < minStock)
router.get('/low-stock', async (req, res) => {
  const rows = await col('inventory')
    .find({ $expr: { $lt: ['$qty', '$minStock'] } })
    .project({ item: 1, qty: 1, minStock: 1, 'supplier.name': 1, 'supplier.leadTimeDays': 1 })
    .sort({ qty: 1 })
    .toArray();
  res.json(rows);
});

// CREATE
router.post('/', async (req, res) => {
  if (reject(res, R.validateInventory(req.body))) return; // server-side re-check
  const doc = pick(req.body);
  const r = await col('inventory').insertOne(doc);
  res.status(201).json({ _id: r.insertedId, ...doc });
});

// UPDATE
router.put('/:id', async (req, res) => {
  if (reject(res, R.validateInventory(req.body))) return;
  const r = await col('inventory').updateOne({ _id: oid(req.params.id) }, { $set: pick(req.body) });
  res.json({ modified: r.modifiedCount });
});

// Update one field inside the embedded supplier using dot notation
router.patch('/:id/supplier', async (req, res) => {
  if (reject(res, { contact: R.checkContact(req.body.contact), leadTimeDays: R.checkWhole(req.body.leadTimeDays, 'Lead time', 0, 90) })) return;
  const set = {};
  for (const k of ['name', 'contact', 'leadTimeDays']) {
    if (k in req.body) set[`supplier.${k}`] = k === 'leadTimeDays' ? Number(req.body[k]) : req.body[k];
  }
  const r = await col('inventory').updateOne({ _id: oid(req.params.id) }, { $set: set });
  res.json({ modified: r.modifiedCount });
});

// Stock IN — $inc adds to qty atomically
router.patch('/:id/stock-in', async (req, res) => {
  if (reject(res, { qty: R.checkWhole(req.body.qty, 'Quantity', 1, 100000, true) })) return;
  const n = Number(req.body.qty);
  const r = await col('inventory').updateOne({ _id: oid(req.params.id) }, { $inc: { qty: n } });
  res.json({ modified: r.modifiedCount });
});

// ISSUE — $inc with a negative value; filter qty >= n prevents negative stock
router.patch('/:id/issue', async (req, res) => {
  const item = await col('inventory').findOne({ _id: oid(req.params.id) });
  if (!item) return res.status(404).json({ error: 'Item not found' });
  if (reject(res, { qty: R.checkIssueQty(req.body.qty, item.qty) })) return; // stock check
  const n = Number(req.body.qty);
  const r = await col('inventory').updateOne(
    { _id: oid(req.params.id), qty: { $gte: n } },
    { $inc: { qty: -n } }
  );
  if (!r.matchedCount) return res.status(400).json({ error: 'Not enough stock' });
  res.json({ modified: r.modifiedCount });
});

// DELETE
router.delete('/:id', async (req, res) => {
  const r = await col('inventory').deleteOne({ _id: oid(req.params.id) });
  res.json({ deleted: r.deletedCount });
});

module.exports = router;
