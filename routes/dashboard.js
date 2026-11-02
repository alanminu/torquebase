// routes/dashboard.js — Dashboard stats + low-stock panel
const router = require('express').Router();
const { col } = require('../db');
const R = require('../public/rules');

router.get('/', async (req, res) => {
  const [
    counts,
    totalValue,
    byCategory,
    spendPerVehicle,
    topParts,
    lowStock,
    openJobs,
    allOpen,
  ] = await Promise.all([
    // countDocuments() on each collection
    Promise.all([
      col('students').countDocuments(),
      col('vehicles').countDocuments(),
      col('assets').countDocuments(),
      col('maintenance').countDocuments({ status: 'Open' }),
      col('inventory').countDocuments(),
    ]),

    // $group with _id: null -> one total for the whole collection
    col('assets').aggregate([
      { $match: { status: { $ne: 'Retired' } } },
      { $group: { _id: null, total: { $sum: '$cost' }, count: { $sum: 1 } } },
    ]).toArray(),

    // + asset count & value by category: $group -> $sort -> $project
    col('assets').aggregate([
      { $group: { _id: '$category', count: { $sum: 1 }, value: { $sum: '$cost' } } },
      { $sort: { value: -1 } },
      { $project: { _id: 0, category: '$_id', count: 1, value: 1 } },
    ]).toArray(),

    // + maintenance spend per vehicle:
    //   maintenance -> $lookup asset -> $unwind -> $group by vehicle -> $lookup vehicle name
    col('maintenance').aggregate([
      { $lookup: { from: 'assets', localField: 'assetId', foreignField: '_id', as: 'asset' } },
      { $unwind: '$asset' },
      { $group: { _id: '$asset.vehicleId', spend: { $sum: '$totalCost' }, jobs: { $sum: 1 } } },
      { $lookup: { from: 'vehicles', localField: '_id', foreignField: '_id', as: 'v' } },
      { $project: { _id: 0, vehicle: { $ifNull: [{ $first: '$v.name' }, 'Unassigned'] }, spend: 1, jobs: 1 } },
      { $sort: { spend: -1 } },
    ]).toArray(),

    // $unwind — break the partsUsed array into one doc per part, then total them
    col('maintenance').aggregate([
      { $unwind: '$partsUsed' },
      { $group: { _id: '$partsUsed.item', qtyUsed: { $sum: '$partsUsed.qty' }, jobs: { $sum: 1 } } },
      { $sort: { qtyUsed: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, item: '$_id', qtyUsed: 1, jobs: 1 } },
    ]).toArray(),

    // + $expr: qty < minStock
    col('inventory')
      .find({ $expr: { $lt: ['$qty', '$minStock'] } })
      .project({ item: 1, qty: 1, minStock: 1, 'supplier.name': 1 })
      .sort({ qty: 1 })
      .toArray(),

    // $match -> $sort -> $limit -> $project : latest open jobs
    col('maintenance').aggregate([
      { $match: { status: 'Open' } },
      { $sort: { date: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'assets', localField: 'assetId', foreignField: '_id', as: 'a' } },
      { $project: { issue: 1, date: 1, cost: 1, status: 1, asset: { $first: '$a.name' } } },
    ]).toArray(),

    col('maintenance').find({ status: 'Open' }).project({ date: 1, status: 1 }).toArray(),
  ]);

  res.json({
    counts: { students: counts[0], vehicles: counts[1], assets: counts[2], openJobs: counts[3], inventory: counts[4] },
    assetValue: totalValue[0]?.total || 0,
    byCategory,
    spendPerVehicle,
    totalSpend: spendPerVehicle.reduce((s, v) => s + v.spend, 0),
    topParts,
    lowStock,
    openJobs,
    overdueJobs: allOpen.filter((j) => R.isOverdue(j)).length,
  });
});

module.exports = router;
