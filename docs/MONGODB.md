# How TorqueBase uses MongoDB

TorqueBase stores everything in five MongoDB collections and uses the official Node.js driver (no Mongoose). This page shows each MongoDB feature the app relies on, where you can see it in the app, and the query behind it.

Every query here can also be run by hand in `mongosh`. See [`queries.mongosh.js`](../queries.mongosh.js).

## Data model

| Collection | What it holds | Relationships |
|---|---|---|
| `students` | Team members: name, reg. no., role, sub-team, skills | Referenced by assets and maintenance |
| `vehicles` | Cars, with their specs embedded | Referenced by assets |
| `assets` | Parts and tools: category, cost, condition, status | References a vehicle and a student; referenced by maintenance |
| `maintenance` | Service jobs: issue, action, labour, parts used | References an asset and a student |
| `inventory` | Consumable stock, with supplier details embedded | Parts used in jobs are deducted from here |

Validation rules live in [`public/rules.js`](../public/rules.js). The same file runs in the browser (checks a form before it's sent) and on the server (checks again before writing to MongoDB).

## CRUD operations
**Where:** every route file. It's the Add / Edit / Delete buttons on every page.
```js
db.students.insertOne({ name, regNo, role, subTeam, skills: [] })      // Create
db.students.find({ subTeam: "Chassis" }).sort({ name: 1 })             // Read
db.students.updateOne({ _id }, { $set: { role: "Captain" } })          // Update
db.students.deleteOne({ _id })                                          // Delete
```
Deleting a vehicle or student also runs `updateMany` to clear references to it. Deleting an asset runs `deleteMany` on its maintenance records.

## Embedded documents
**Where:** `vehicles.specs` and `inventory.supplier`. UI: the *Specs* card on Vehicles, and the *Supplier* column and *Supplier* button on Inventory (edits only the embedded supplier with dot notation).
```js
{ name: "TB-25 Surge", specs: { motor: "...", battery: "...", weightKg: 221, chassis: "...", topSpeedKmph: 125 } }
{ item: "Brake Pads (set)", supplier: { name: "Wilwood India", contact: "...", leadTimeDays: 14 } }
// update one nested field with dot notation — Inventory → Supplier button → routes/inventory.js  PATCH /:id/supplier
db.inventory.updateOne({ _id }, { $set: { "supplier.leadTimeDays": 10 } })
```
**Why embed:** specs and supplier details are always read together with their parent and are never shared, so no join is needed.

## Arrays with `$addToSet` / `$pull` / `$push`
**Where:** the Skills column on Students (`+` and `×`), and *+ Part* on Maintenance.
```js
db.students.updateOne({ _id }, { $addToSet: { skills: "CAD" } })   // adds only if not already present
db.students.updateOne({ _id }, { $pull: { skills: "CAD" } })       // removes it
db.maintenance.updateOne({ _id }, { $push: { partsUsed: { itemId, item, qty, unitCost } } })
```

## Document references + `$lookup`
**Where:**
- `assets.vehicleId` references `vehicles._id`
- `assets.assignedTo` references `students._id`
- `maintenance.assetId` references `assets._id`
- `maintenance.doneBy` references `students._id`

These are joined with `$lookup` in the Assets list, the Maintenance list, Vehicle detail (3 lookups) and the Dashboard.
```js
// routes/vehicles.js — vehicle detail
db.vehicles.aggregate([
  { $match: { _id } },
  { $lookup: { from: "assets",      localField: "_id",               foreignField: "vehicleId", as: "assets"  } },
  { $lookup: { from: "maintenance", localField: "assets._id",        foreignField: "assetId",   as: "history" } },
  { $lookup: { from: "students",    localField: "assets.assignedTo", foreignField: "_id",       as: "people"  } },
  { $project: { name: 1, specs: 1, assets: 1, history: 1, assetValue: { $sum: "$assets.cost" }, serviceCost: { $sum: "$history.totalCost" } } }
])
```
**Why reference:** one student holds many assets, and an asset collects many maintenance records over time. Embedding these would duplicate data and grow documents without limit.

## Aggregation `$group` / `$sum`
**Where:** Dashboard: *Asset value*, *Assets by category*, *Maintenance spend per vehicle*.
```js
db.assets.aggregate([{ $match: { status: { $ne: "Retired" } } }, { $group: { _id: null, total: { $sum: "$cost" } } }])
db.assets.aggregate([{ $group: { _id: "$category", count: { $sum: 1 }, value: { $sum: "$cost" } } }])
```

## Multi-stage pipeline (`$match` → `$sort` → `$limit` → `$project`)
**Where:** Dashboard → *Latest open jobs*, *Assets by category*; the Maintenance list.
```js
db.maintenance.aggregate([
  { $match: { status: "Open" } },
  { $sort: { date: -1 } },
  { $limit: 5 },
  { $lookup: { from: "assets", localField: "assetId", foreignField: "_id", as: "a" } },
  { $project: { issue: 1, date: 1, cost: 1, asset: { $first: "$a.name" } } }
])
```

## `$expr` (comparing two fields of the same document)
**Where:** Dashboard → *Low stock*, and the red rows on Inventory.
```js
db.inventory.find({ $expr: { $lt: ["$qty", "$minStock"] } })
```
A normal query can only compare a field against a constant. `$expr` compares `qty` against that item's own `minStock`.

## `$inc` (atomic counter update)
**Where:** Inventory *+ In* / *− Issue*, and automatically when maintenance uses parts.
```js
db.inventory.updateOne({ _id }, { $inc: { qty: 10 } })                           // stock in
db.inventory.updateOne({ _id, qty: { $gte: 3 } }, { $inc: { qty: -3 } })          // issue; won't go below 0
```
The check and the change happen in one atomic operation, so two people issuing parts at the same time can't push the stock negative.

## Indexes (unique, single-field, compound)
**Where:** created in `db.js → createIndexes()` on startup.
```js
db.students.createIndex({ regNo: 1 }, { unique: true })      // duplicate Reg. No. -> error 11000 -> "Duplicate value" toast
db.inventory.createIndex({ item: 1 }, { unique: true })
db.students.createIndex({ subTeam: 1 })
db.assets.createIndex({ vehicleId: 1 })
db.assets.createIndex({ category: 1, status: 1 })            // compound: used by the Assets category+status filter
db.maintenance.createIndex({ assetId: 1, date: -1 })         // compound: history per asset, newest first
```
**Try it:** add a student with an existing Reg. No. and you'll see a "Duplicate value" error.
**Proof in mongosh:** `db.assets.find({category:"Brakes",status:"In Use"}).explain("executionStats")` shows `IXSCAN`.

## `$regex`, `countDocuments()`, `distinct()`
**Where:** Students search box (`$regex`), sub-team and category dropdowns (`distinct`), the Assets total and Dashboard counts (`countDocuments`).
```js
db.students.find({ name: { $regex: "ar", $options: "i" } })
db.students.distinct("subTeam")
db.assets.countDocuments({ category: "Brakes" })
```

## `$unwind`
**Where:** Dashboard → *Most used spare parts*. It's also used when flattening joined arrays in the Maintenance list and in spend per vehicle.
```js
db.maintenance.aggregate([
  { $unwind: "$partsUsed" },                       // 1 document per part used
  { $group: { _id: "$partsUsed.item", qtyUsed: { $sum: "$partsUsed.qty" }, jobs: { $sum: 1 } } },
  { $sort: { qtyUsed: -1 } },
  { $limit: 5 }
])
```
`partsUsed` is an array. `$unwind` splits a job that used 3 parts into 3 documents so each part can be grouped and totalled.

## Text index + `$text` search
**Where:** Assets → *Full-text search* box.
```js
db.assets.createIndex({ name: "text", description: "text" })
db.assets.find({ $text: { $search: "carbon" } }).sort({ score: { $meta: "textScore" } })
```
The search looks at both name and description, matches whole words (with stemming, so "welded" matches "weld") and ranks results by relevance. This is different from `$regex`, which only does pattern matching.
