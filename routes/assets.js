// routes/assets.js — Asset tracking + assignment to vehicle & student
const router = require('express').Router();
const { col, oid, reject } = require('../db');
const R = require('../public/rules');

// REFERENCES — vehicleId and assignedTo store ObjectIds of other documents
const pick = (b) => ({
  name: String(b.name || '').trim(),
  category: b.category,     // Brakes / Battery / Motor / Sensor / Suspension / Tool ...
  description: b.description || '',
  condition: b.condition,   // New / Good / Worn / Damaged
  status: b.status,         // Available / In Use / Under Maintenance / Retired
  cost: Number(b.cost) || 0,
  vehicleId: oid(b.vehicleId),
  assignedTo: oid(b.assignedTo),
});

// List assets
//  - filter by category + status  -> served by compound index {category, status} 
//  - q  -> $text full-text search on name + description, ranked by textScore
//  - $lookup vehicle and student names 
//  - countDocuments() for the total shown in the UI 
router.get('/', async (req, res) => {
  const match = {};
  if (req.query.category) match.category = req.query.category;
  if (req.query.status) match.status = req.query.status;
  if (req.query.q) match.$text = { $search: req.query.q };

  const pipeline = [
    { $match: match },
    req.query.q
      ? { $sort: { score: { $meta: 'textScore' }, name: 1 } }
      : { $sort: { category: 1, name: 1 } },
    { $lookup: { from: 'vehicles', localField: 'vehicleId', foreignField: '_id', as: 'vehicle' } },
    { $lookup: { from: 'students', localField: 'assignedTo', foreignField: '_id', as: 'student' } },
    { $project: {
        name: 1, category: 1, description: 1, condition: 1, status: 1, cost: 1, vehicleId: 1, assignedTo: 1,
        vehicleName: { $first: '$vehicle.name' },
        studentName: { $first: '$student.name' },
    } },
  ];

  const [items, total] = await Promise.all([
    col('assets').aggregate(pipeline).toArray(),
    col('assets').countDocuments(match),
  ]);
  res.json({ total, items });
});

// distinct() — categories for dropdown
router.get('/categories', async (req, res) => {
  res.json(await col('assets').distinct('category'));
});

// CREATE
router.post('/', async (req, res) => {
  if (reject(res, R.validateAsset(req.body))) return; // server-side re-check
  const doc = { ...pick(req.body), createdAt: new Date() };
  const r = await col('assets').insertOne(doc);
  res.status(201).json({ _id: r.insertedId, ...doc });
});

// UPDATE (full edit)
router.put('/:id', async (req, res) => {
  if (reject(res, R.validateAsset(req.body))) return;
  const r = await col('assets').updateOne({ _id: oid(req.params.id) }, { $set: pick(req.body) });
  res.json({ modified: r.modifiedCount });
});

// Quick assign: change vehicle / student / condition only — $set on selected fields
router.patch('/:id/assign', async (req, res) => {
  const current = await col('assets').findOne({ _id: oid(req.params.id) });
  if (!current) return res.status(404).json({ error: 'Asset not found' });
  if (reject(res, R.checkAssetRule({ ...current, ...req.body }))) return; // damaged/retired rule
  const set = {};
  if ('vehicleId' in req.body) set.vehicleId = oid(req.body.vehicleId);
  if ('assignedTo' in req.body) set.assignedTo = oid(req.body.assignedTo);
  if (req.body.condition) set.condition = req.body.condition;
  if (req.body.status) set.status = req.body.status;
  const r = await col('assets').updateOne({ _id: oid(req.params.id) }, { $set: set });
  res.json({ modified: r.modifiedCount });
});

// DELETE — also removes its maintenance history (deleteMany)
router.delete('/:id', async (req, res) => {
  const id = oid(req.params.id);
  await col('maintenance').deleteMany({ assetId: id });
  const r = await col('assets').deleteOne({ _id: id });
  res.json({ deleted: r.deletedCount });
});

module.exports = router;
