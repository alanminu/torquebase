// routes/students.js — Team member management
const router = require('express').Router();
const { col, oid, reject } = require('../db');
const R = require('../public/rules'); // user-defined validation functions

const pick = (b) => ({
  name: String(b.name || '').trim(),
  regNo: String(b.regNo || '').trim().toUpperCase(),
  role: b.role,
  subTeam: b.subTeam,
  email: String(b.email || '').trim(),
  skills: Array.isArray(b.skills) ? b.skills : [],
});

// READ — find() with optional filter
// $regex search on name + filter by subTeam
router.get('/', async (req, res) => {
  const filter = {};
  if (req.query.subTeam) filter.subTeam = req.query.subTeam;
  if (req.query.q) filter.name = { $regex: req.query.q, $options: 'i' };
  const students = await col('students').find(filter).sort({ name: 1 }).toArray();
  res.json(students);
});

// distinct() — list of sub-teams for the filter dropdown
router.get('/subteams', async (req, res) => {
  res.json(await col('students').distinct('subTeam'));
});

// CREATE — insertOne()   (regNo is protected by a unique index)
router.post('/', async (req, res) => {
  if (reject(res, R.validateStudent(req.body))) return; // server-side re-check
  const doc = { ...pick(req.body), joinedAt: new Date() };
  const r = await col('students').insertOne(doc);
  res.status(201).json({ _id: r.insertedId, ...doc });
});

// UPDATE — updateOne() with $set
router.put('/:id', async (req, res) => {
  if (reject(res, R.validateStudent(req.body))) return;
  const { skills, ...fields } = pick(req.body); // skills are edited via $addToSet/$pull below
  const r = await col('students').updateOne({ _id: oid(req.params.id) }, { $set: fields });
  res.json({ matched: r.matchedCount, modified: r.modifiedCount });
});

// ARRAY UPDATE — $addToSet adds a skill only if it isn't already there
router.post('/:id/skills', async (req, res) => {
  const student = await col('students').findOne({ _id: oid(req.params.id) });
  if (!student) return res.status(404).json({ error: 'Member not found' });
  if (reject(res, { skill: R.checkSkill(req.body.skill, student.skills) })) return;
  const r = await col('students').updateOne(
    { _id: student._id },
    { $addToSet: { skills: String(req.body.skill).trim() } }
  );
  res.json({ modified: r.modifiedCount });
});

// ARRAY UPDATE — $pull removes a skill from the array
router.delete('/:id/skills/:skill', async (req, res) => {
  const r = await col('students').updateOne(
    { _id: oid(req.params.id) },
    { $pull: { skills: req.params.skill } }
  );
  res.json({ modified: r.modifiedCount });
});

// DELETE — deleteOne(); also un-assign any assets referencing this student
router.delete('/:id', async (req, res) => {
  const id = oid(req.params.id);
  await col('assets').updateMany({ assignedTo: id }, { $set: { assignedTo: null } });
  const r = await col('students').deleteOne({ _id: id });
  res.json({ deleted: r.deletedCount });
});

module.exports = router;
