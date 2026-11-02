// routes/maintenance.js — Maintenance logging (auto-updates asset status, deducts parts)
const router = require('express').Router();
const { col, oid, reject } = require('../db');
const R = require('../public/rules');

// Deduct parts from inventory automatically.
// $inc is atomic; the filter { qty: { $gte: n } } stops stock going negative.
async function issueParts(parts) {
  // check everything first so we don't deduct half the list and then fail
  for (const p of parts) {
    const item = await col('inventory').findOne({ _id: p.itemId });
    if (!item) throw Object.assign(new Error('Inventory item not found'), { status: 400 });
    const err = R.checkIssueQty(p.qty, item.qty); // stock availability
    if (err) throw Object.assign(new Error(`${item.item}: ${err}`), { status: 400 });
    p.item = item.item;
    p.unitCost = item.unitCost;
  }
  for (const p of parts) {
    await col('inventory').updateOne({ _id: p.itemId, qty: { $gte: p.qty } }, { $inc: { qty: -p.qty } });
  }
  return parts;
}

const cleanParts = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .filter((p) => p.itemId && Number(p.qty) > 0)
    .map((p) => ({ itemId: oid(p.itemId), qty: Number(p.qty) }));

// List maintenance records
// $lookup asset + student,  $unwind flattens the joined arrays
// $match -> $sort -> $project pipeline
router.get('/', async (req, res) => {
  const match = {};
  if (req.query.status) match.status = req.query.status;
  const rows = await col('maintenance').aggregate([
    { $match: match },
    { $sort: { date: -1 } },
    { $lookup: { from: 'assets', localField: 'assetId', foreignField: '_id', as: 'asset' } },
    { $unwind: { path: '$asset', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'students', localField: 'doneBy', foreignField: '_id', as: 'student' } },
    { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
    { $project: {
        issue: 1, action: 1, cost: 1, partsCost: 1, totalCost: 1, date: 1, status: 1, partsUsed: 1,
        assetId: 1, assetName: '$asset.name', category: '$asset.category',
        doneByName: '$student.name',
    } },
  ]).toArray();
  res.json(rows);
});

// CREATE + side effects:
//   1. insert record   2. asset.status -> "Under Maintenance"   3. deduct parts from inventory
router.post('/', async (req, res) => {
  const b = req.body;
  // server-side re-check (parts are passed as p1, p2, p3 to match the form)
  const asForm = { ...b };
  (b.partsUsed || []).forEach((p, i) => (asForm['p' + (i + 1)] = p));
  if (reject(res, R.validateMaintenance(asForm))) return;
  const assetId = oid(b.assetId);

  const parts = await issueParts(cleanParts(b.partsUsed));
  const cost = R.calcJobCost({ cost: b.cost, partsUsed: parts }); // labour + parts
  const doc = {
    assetId,
    issue: b.issue,
    action: b.action || '',
    cost: cost.labour,       // labour / service cost
    partsCost: cost.parts,   // qty x unit cost of every part
    totalCost: cost.total,   // labour + parts
    date: b.date ? new Date(b.date) : new Date(),
    doneBy: oid(b.doneBy),
    status: 'Open',
    partsUsed: parts, // array of embedded sub-documents
  };
  const r = await col('maintenance').insertOne(doc);
  await col('assets').updateOne({ _id: assetId }, { $set: { status: 'Under Maintenance' } });
  res.status(201).json({ _id: r.insertedId, ...doc });
});

// $push — add a part to an existing record (and $inc stock down)
router.post('/:id/parts', async (req, res) => {
  if (reject(res, { itemId: req.body.itemId ? null : 'Select a part', qty: R.checkWhole(req.body.qty, 'Quantity', 1, Infinity, true) })) return;
  const [part] = await issueParts(cleanParts([req.body]));
  const extra = R.calcJobCost({ partsUsed: [part] }).parts; // keep the total cost up to date
  const r = await col('maintenance').updateOne(
    { _id: oid(req.params.id) },
    { $push: { partsUsed: part }, $inc: { partsCost: extra, totalCost: extra } }
  );
  res.json({ modified: r.modifiedCount });
});

// Complete a job: record -> "Completed", asset -> "Available" + condition "Good"
router.patch('/:id/complete', async (req, res) => {
  const rec = await col('maintenance').findOne({ _id: oid(req.params.id) });
  if (!rec) return res.status(404).json({ error: 'Record not found' });
  await col('maintenance').updateOne(
    { _id: rec._id },
    { $set: { status: 'Completed', completedAt: new Date(), action: req.body.action || rec.action } }
  );
  await col('assets').updateOne({ _id: rec.assetId }, { $set: { status: 'Available', condition: 'Good' } });
  res.json({ ok: true });
});

// DELETE
router.delete('/:id', async (req, res) => {
  const r = await col('maintenance').deleteOne({ _id: oid(req.params.id) });
  res.json({ deleted: r.deletedCount });
});

module.exports = router;
