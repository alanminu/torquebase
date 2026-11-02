// routes/vehicles.js — Vehicle registration + vehicle detail view
const router = require('express').Router();
const { col, oid, reject } = require('../db');
const R = require('../public/rules');

// EMBEDDED DOCUMENT — specs are stored inside the vehicle document
const pick = (b) => ({
  name: b.name,
  year: Number(b.year),
  type: b.type,            // EV / Combustion
  status: b.status,        // Design / Manufacturing / Testing / Competition / Retired
  specs: {
    motor: b.specs?.motor || '',
    battery: b.specs?.battery || '',
    weightKg: Number(b.specs?.weightKg) || 0,
    chassis: b.specs?.chassis || '',
    topSpeedKmph: Number(b.specs?.topSpeedKmph) || 0,
  },
});

// READ
router.get('/', async (req, res) => {
  res.json(await col('vehicles').find().sort({ year: -1 }).toArray());
});

// Vehicle detail — $lookup joins referenced assets, their maintenance and students
router.get('/:id', async (req, res) => {
  const [vehicle] = await col('vehicles').aggregate([
    { $match: { _id: oid(req.params.id) } },
    { $lookup: { from: 'assets', localField: '_id', foreignField: 'vehicleId', as: 'assets' } },
    { $lookup: { from: 'maintenance', localField: 'assets._id', foreignField: 'assetId', as: 'history' } },
    { $lookup: { from: 'students', localField: 'assets.assignedTo', foreignField: '_id', as: 'people' } },
    { $project: {
        name: 1, year: 1, type: 1, status: 1, specs: 1,
        assets: { _id: 1, name: 1, category: 1, condition: 1, status: 1, cost: 1, assignedTo: 1 },
        history: { assetId: 1, issue: 1, action: 1, cost: 1, partsCost: 1, totalCost: 1, date: 1, status: 1 },
        people: { _id: 1, name: 1 },
        assetValue: { $sum: '$assets.cost' },
        serviceCost: { $sum: '$history.totalCost' },
    } },
  ]).toArray();
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(vehicle);
});

// CREATE
router.post('/', async (req, res) => {
  if (reject(res, R.validateVehicle(req.body))) return; // server-side re-check
  const doc = pick(req.body);
  const r = await col('vehicles').insertOne(doc);
  res.status(201).json({ _id: r.insertedId, ...doc });
});

// UPDATE — whole embedded specs object replaced with $set
router.put('/:id', async (req, res) => {
  if (reject(res, R.validateVehicle(req.body))) return;
  const r = await col('vehicles').updateOne({ _id: oid(req.params.id) }, { $set: pick(req.body) });
  res.json({ modified: r.modifiedCount });
});

// DELETE — detach assets that referenced this vehicle
router.delete('/:id', async (req, res) => {
  const id = oid(req.params.id);
  await col('assets').updateMany({ vehicleId: id }, { $set: { vehicleId: null } });
  const r = await col('vehicles').deleteOne({ _id: id });
  res.json({ deleted: r.deletedCount });
});

module.exports = router;
