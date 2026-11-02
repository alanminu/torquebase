# TorqueBase

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-driver-47A248?logo=mongodb&logoColor=white)

**Garage, asset and inventory management for student racing teams.**

A Formula Student team owns lakhs of rupees' worth of motors, battery packs, chassis and tools, spread across several cars and dozens of members. TorqueBase keeps track of all of it in one place: who has which part, which car it's fitted to, when it was last serviced, what that cost, and which spares are running low.

Built with **Node.js + Express**, **MongoDB** (official driver, no ORM) and a plain **HTML/CSS/JavaScript** front end with no framework.

<!-- Add a screenshot here: save it as docs/screenshot.png and uncomment the line below -->
<!-- ![TorqueBase dashboard](docs/screenshot.png) -->

---

## Features

**Team & vehicles**
- Team members with roles, sub-teams and skills, plus search and sub-team filter
- Vehicle profiles with full specs (motor, battery, weight, chassis, top speed)
- Vehicle detail page: every fitted part, who holds it, service history, total asset value and service cost

**Assets**
- Track every part and tool: category, cost, condition and status
- Assign assets to a vehicle and a team member
- Full-text search across names and descriptions
- Rules that prevent mistakes: a damaged part can't be marked "In Use", and a retired part can't be assigned

**Maintenance**
- Log a service job with the issue, the fix, labour cost, who did it and the parts used
- Total cost is worked out automatically (labour + parts)
- Logging a job marks the asset "Under Maintenance"; completing it sets it back to "Available"
- Parts used are deducted from inventory automatically, after checking there's enough stock
- Jobs open for more than 7 days are flagged as overdue

**Inventory**
- Stock in and issue, with a check that you can't issue more than you have
- Low-stock alerts showing the supplier to reorder from
- Supplier details (contact, lead time) for every item

**Dashboard**
- Totals, overdue jobs, asset value and maintenance spend
- Asset value by category, spend per vehicle, most-used spare parts and the latest open jobs

**Data safety**
- Every form is validated twice, in the browser and again on the server, using the same rules file
- Deleting a member or vehicle un-assigns their assets instead of leaving broken links
- Deletes always ask for confirmation and say what else will be affected

## Quick start

You need **Node.js 18 or newer** ([nodejs.org](https://nodejs.org)).

```bash
git clone https://github.com/alanminu/torquebase.git
cd torquebase
npm install
npm start
```

Open **http://localhost:3000**.

With no database configured, TorqueBase starts its own **temporary in-memory MongoDB** and fills it with sample data, so you can try everything straight away. The first start downloads a MongoDB server for your computer (about 100 MB, needs internet), so give it a minute or two. After that it's cached.

> The in-memory database is wiped every time you stop the app. To keep your data, connect to MongoDB Atlas (below).

## Using MongoDB Atlas (to keep your data)

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Under **Database Access**, add a user with a password.
3. Under **Network Access**, add your IP address.
4. Click **Connect → Drivers** and copy the connection string.
5. In the project folder:
   ```bash
   cp .env.example .env          # Windows: copy .env.example .env
   ```
   Open `.env` and paste your connection string into `MONGODB_URI`, replacing `<user>` and `<password>`.
6. Load the sample data, then start the app:
   ```bash
   npm run seed
   npm start
   ```

`npm run seed` wipes the database and reloads the sample data, so you can use it any time to reset.

> `.env` holds your password. It's listed in `.gitignore`, so it won't be uploaded to GitHub. Never remove that line.

## Configuration

Settings go in `.env` (copy it from `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `MONGODB_URI` | none | Atlas connection string. If missing, the in-memory database is used |
| `DB_NAME` | `torquebase` | Database name |
| `PORT` | `3000` | Port the app runs on |

## Project structure

```
torquebase/
├── server.js            Express app and error handler
├── db.js                MongoDB connection, indexes, in-memory fallback
├── seed.js              Sample data: 15 members, 3 cars, 35 assets, 15 inventory items, 13 jobs
├── routes/
│   ├── students.js      Team members: CRUD, search, skills
│   ├── vehicles.js      Vehicles and the vehicle detail view
│   ├── assets.js        Assets, assignment, full-text search
│   ├── maintenance.js   Service jobs, automatic status and stock updates
│   ├── inventory.js     Stock in/issue, low stock, suppliers
│   └── dashboard.js     Dashboard statistics
├── public/
│   ├── index.html       Page shell
│   ├── app.js           Front end (single-page app, no framework)
│   ├── rules.js         Validation and business rules, shared by browser and server
│   └── style.css
├── docs/MONGODB.md      How the app uses MongoDB, with every query
└── queries.mongosh.js   The main queries, runnable in mongosh
```

## How it uses MongoDB

TorqueBase uses five collections and a wide range of MongoDB features: embedded documents, references with `$lookup`, aggregation pipelines (`$group`, `$unwind`, `$match`, `$sort`, `$project`), `$expr`, atomic `$inc` updates, unique and compound indexes, and full-text search.

[`docs/MONGODB.md`](docs/MONGODB.md) explains each one: where it appears in the app, the query behind it, and why the data is modelled that way.

## Troubleshooting

| Problem | Fix |
|---|---|
| `DB connection failed: bad auth` | Wrong username or password in `.env` |
| Timeout or `querySrv` error | Your IP isn't allowed in Atlas **Network Access**, or your Wi-Fi blocks port 27017. Try a mobile hotspot |
| First start is slow or fails to download | The in-memory mode downloads MongoDB on first run. Check your internet connection, or use Atlas instead |
| `Port 3000 is already in use` | Set a different `PORT` in `.env`, e.g. `PORT=3001` |
