// queries.mongosh.js — the main MongoDB queries used by TorqueBase, runnable in mongosh
// Usage:  mongosh "<your Atlas connection string>/torquebase"   then paste sections one by one
// (or run all:  mongosh "<uri>/torquebase" queries.mongosh.js)
// Run `npm run seed` first so the collections have data.

db = db.getSiblingDB("torquebase");

// ---------- CRUD ----------
db.students.insertOne({ name: "Demo Student", regNo: "99DEM0001", role: "Member", subTeam: "Chassis", skills: [] });
printjson(db.students.find({ subTeam: "Chassis" }, { name: 1, regNo: 1, _id: 0 }).sort({ name: 1 }).toArray());
db.students.updateOne({ regNo: "99DEM0001" }, { $set: { role: "Sub-team Lead" } });

// ---------- arrays ----------
db.students.updateOne({ regNo: "99DEM0001" }, { $addToSet: { skills: "CAD" } });
db.students.updateOne({ regNo: "99DEM0001" }, { $addToSet: { skills: "CAD" } });   // no duplicate added
db.students.updateOne({ regNo: "99DEM0001" }, { $pull: { skills: "CAD" } });
db.students.deleteOne({ regNo: "99DEM0001" });

// ---------- embedded documents ----------
printjson(db.vehicles.find({}, { name: 1, specs: 1, _id: 0 }).toArray());
printjson(db.vehicles.find({ "specs.weightKg": { $lt: 230 } }, { name: 1, "specs.weightKg": 1 }).toArray()); // query inside embedded doc
db.inventory.updateOne({ item: "Zip Ties (pack of 100)" }, { $set: { "supplier.leadTimeDays": 2 } });

// ---------- references + $lookup (vehicle detail) ----------
const v = db.vehicles.findOne({ name: "TB-25 Surge" });
printjson(db.vehicles.aggregate([
  { $match: { _id: v._id } },
  { $lookup: { from: "assets", localField: "_id", foreignField: "vehicleId", as: "assets" } },
  { $lookup: { from: "maintenance", localField: "assets._id", foreignField: "assetId", as: "history" } },
  { $project: { name: 1, assetCount: { $size: "$assets" }, assetValue: { $sum: "$assets.cost" }, serviceCost: { $sum: "$history.cost" } } },
]).toArray());

// ---------- $group ----------
printjson(db.assets.aggregate([
  { $match: { status: { $ne: "Retired" } } },
  { $group: { _id: null, totalAssetValue: { $sum: "$cost" }, count: { $sum: 1 } } },
]).toArray());

printjson(db.assets.aggregate([
  { $group: { _id: "$category", count: { $sum: 1 }, value: { $sum: "$cost" } } },
  { $sort: { value: -1 } },
]).toArray());

// Maintenance spend per vehicle (lookup + unwind + group)
printjson(db.maintenance.aggregate([
  { $lookup: { from: "assets", localField: "assetId", foreignField: "_id", as: "asset" } },
  { $unwind: "$asset" },
  { $group: { _id: "$asset.vehicleId", spend: { $sum: "$cost" }, jobs: { $sum: 1 } } },
  { $lookup: { from: "vehicles", localField: "_id", foreignField: "_id", as: "v" } },
  { $project: { _id: 0, vehicle: { $first: "$v.name" }, spend: 1, jobs: 1 } },
  { $sort: { spend: -1 } },
]).toArray());

// ---------- $match -> $sort -> $limit -> $project ----------
printjson(db.maintenance.aggregate([
  { $match: { status: "Open" } },
  { $sort: { date: -1 } },
  { $limit: 5 },
  { $project: { _id: 0, issue: 1, date: 1, cost: 1 } },
]).toArray());

// ---------- $expr (low stock) ----------
printjson(db.inventory.find({ $expr: { $lt: ["$qty", "$minStock"] } }, { _id: 0, item: 1, qty: 1, minStock: 1 }).toArray());

// ---------- $inc ----------
db.inventory.updateOne({ item: "Zip Ties (pack of 100)" }, { $inc: { qty: 5 } });                       // stock in
db.inventory.updateOne({ item: "Zip Ties (pack of 100)", qty: { $gte: 2 } }, { $inc: { qty: -2 } });     // issue (guarded)

// ---------- indexes ----------
printjson(db.students.getIndexes());
printjson(db.assets.getIndexes());
// proof the compound index is used -> look for "IXSCAN" in the winning plan
printjson(db.assets.find({ category: "Brakes", status: "In Use" }).explain("executionStats").queryPlanner.winningPlan);
// unique index violation (expected error E11000)
try { db.students.insertOne({ name: "Dup", regNo: "23BME0142" }); } catch (e) { print("Expected error:", e.message); }

// ---------- $regex, countDocuments, distinct ----------
printjson(db.students.find({ name: { $regex: "ar", $options: "i" } }, { name: 1, _id: 0 }).toArray());
print("Brakes assets:", db.assets.countDocuments({ category: "Brakes" }));
printjson(db.students.distinct("subTeam"));

// ---------- $unwind (most used spare parts) ----------
printjson(db.maintenance.aggregate([
  { $unwind: "$partsUsed" },
  { $group: { _id: "$partsUsed.item", qtyUsed: { $sum: "$partsUsed.qty" }, jobs: { $sum: 1 } } },
  { $sort: { qtyUsed: -1 } },
  { $limit: 5 },
]).toArray());

// ---------- text search ----------
printjson(db.assets.find(
  { $text: { $search: "carbon wing" } },
  { name: 1, score: { $meta: "textScore" }, _id: 0 }
).sort({ score: { $meta: "textScore" } }).toArray());
