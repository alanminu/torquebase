// server.js — Express app entry point
const express = require('express');
const path = require('path');
const { connect } = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/students', require('./routes/students'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Central error handler (Express 5 forwards async errors here automatically)
app.use((err, req, res, next) => {
  console.error(err.message);
  if (err.code === 11000) return res.status(409).json({ error: 'Duplicate value: ' + JSON.stringify(err.keyValue) });
  res.status(err.status || 500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
connect()
  .then(() => app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`)))
  .catch((e) => { console.error('DB connection failed:', e.message); process.exit(1); });
