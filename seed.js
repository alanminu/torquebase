// seed.js — wipes and fills the database with realistic sample data
// Run:  npm run seed
require('dotenv').config();
const { MongoClient } = require('mongodb');
const { createIndexes } = require('./db');
const R = require('./public/rules');

const daysAgo = (n) => new Date(Date.now() - n * 86400000);

async function seedData(db) {

  for (const c of ['students', 'vehicles', 'assets', 'maintenance', 'inventory']) {
    await db.collection(c).drop().catch(() => {}); // ignore "ns not found"
  }
  await createIndexes(db);

  /* ---------- students ---------- */
  const students = [
    ['Aarav Mehta', '23BME0142', 'Captain', 'Management', ['Leadership', 'Vehicle Dynamics']],
    ['Diya Nair', '23BEE0311', 'Vice Captain', 'Electronics', ['BMS', 'Altium', 'Embedded C']],
    ['Rohan Kulkarni', '23BME0275', 'Sub-team Lead', 'Chassis', ['SolidWorks', 'ANSYS', 'Welding']],
    ['Sneha Iyer', '24BME0133', 'Sub-team Lead', 'Suspension', ['Kinematics', 'Adams Car']],
    ['Kabir Singh', '23BEE0198', 'Sub-team Lead', 'Powertrain', ['Motor Control', 'MATLAB']],
    ['Ananya Rao', '24BME0402', 'Sub-team Lead', 'Aerodynamics', ['CFD', 'Star-CCM+']],
    ['Vikram Joshi', '24BCE0521', 'Member', 'Electronics', ['CAN Bus', 'Python']],
    ['Meera Pillai', '24BME0087', 'Member', 'Chassis', ['CATIA', 'Composites']],
    ['Arjun Reddy', '24BME0366', 'Member', 'Suspension', ['Machining', 'Lathe']],
    ['Ishaan Gupta', '25BEE0104', 'Member', 'Powertrain', ['Cooling Systems']],
    ['Tanvi Deshpande', '25BME0219', 'Member', 'Aerodynamics', ['Composites', 'Ansys Fluent']],
    ['Kunal Shah', '24BMG0033', 'Sub-team Lead', 'Business', ['Sponsorship', 'Cost Report']],
    ['Riya Menon', '25BCE0450', 'Member', 'Electronics', ['Data Logging', 'Telemetry']],
    ['Aditya Verma', '25BME0301', 'Member', 'Powertrain', ['Brake Systems']],
    ['Nisha Bhatt', '25BMG0077', 'Member', 'Business', ['Marketing', 'Design']],
  ].map(([name, regNo, role, subTeam, skills]) => ({
    name, regNo, role, subTeam, skills,
    email: name.split(' ')[0].toLowerCase() + '.' + regNo.toLowerCase() + '@example.com',
    joinedAt: daysAgo(Math.floor(Math.random() * 600)),
  }));
  const sIds = Object.values((await db.collection('students').insertMany(students)).insertedIds);
  const S = (name) => sIds[students.findIndex((s) => s.name === name)];

  /* ---------- vehicles (specs = embedded document) ---------- */
  const vehicles = [
    { name: 'TB-24 Volt', year: 2024, type: 'EV', status: 'Competition',
      specs: { motor: 'EMRAX 228 (PMSM, 80 kW peak)', battery: '6.8 kWh Li-ion, 504 V', weightKg: 238, chassis: 'Steel spaceframe (4130 chromoly)', topSpeedKmph: 118 } },
    { name: 'TB-25 Surge', year: 2025, type: 'EV', status: 'Testing',
      specs: { motor: 'Dual AMK hub motors (4 × 35 kW)', battery: '7.2 kWh Li-ion, 600 V', weightKg: 221, chassis: 'Hybrid CFRP monocoque + rear frame', topSpeedKmph: 125 } },
    { name: 'TB-22 Blaze', year: 2022, type: 'Combustion', status: 'Retired',
      specs: { motor: 'KTM 390 single-cylinder, 43 hp', battery: '12 V LiFePO4 auxiliary', weightKg: 256, chassis: 'Steel spaceframe (AISI 1018)', topSpeedKmph: 110 } },
  ];
  const vIds = Object.values((await db.collection('vehicles').insertMany(vehicles)).insertedIds);
  const [V24, V25, V22] = vIds;

  /* ---------- assets (references to vehicles + students) ---------- */
  const A = (name, category, cost, vehicleId, assignedTo, condition, status, description) =>
    ({ name, category, cost, vehicleId, assignedTo, condition, status, description, createdAt: daysAgo(Math.floor(Math.random() * 400)) });
  const assets = [
    A('EMRAX 228 Motor', 'Motor', 420000, V24, S('Kabir Singh'), 'Good', 'In Use', 'Axial flux motor, liquid cooled'),
    A('AMK Hub Motor Set (4)', 'Motor', 1250000, V25, S('Kabir Singh'), 'New', 'In Use', 'Four wheel hub motors with inverters'),
    A('Accumulator Pack 504V', 'Battery', 380000, V24, S('Diya Nair'), 'Good', 'In Use', 'Li-ion accumulator, 6 segments'),
    A('Accumulator Pack 600V', 'Battery', 460000, V25, S('Diya Nair'), 'New', 'Under Maintenance', 'Li-ion accumulator, 8 segments, cell balancing issue'),
    A('Orion BMS 2', 'Electronics', 65000, V25, S('Vikram Joshi'), 'Good', 'In Use', 'Battery management system'),
    A('Bamocar D3 Inverter', 'Electronics', 210000, V24, S('Kabir Singh'), 'Worn', 'In Use', 'Motor controller, 400 A peak'),
    A('Front Brake Calipers (pair)', 'Brakes', 48000, V24, S('Aditya Verma'), 'Worn', 'In Use', 'Wilwood 4-piston calipers'),
    A('Rear Brake Calipers (pair)', 'Brakes', 42000, V24, S('Aditya Verma'), 'Good', 'In Use', 'Wilwood 2-piston calipers'),
    A('Brake Disc Set TB-25', 'Brakes', 36000, V25, S('Aditya Verma'), 'New', 'Available', 'Floating steel discs, laser cut'),
    A('Master Cylinder (tandem)', 'Brakes', 18000, V25, null, 'New', 'Available', 'Tilton 78 series with balance bar'),
    A('Front Dampers Ohlins TTX25', 'Suspension', 185000, V24, S('Sneha Iyer'), 'Good', 'In Use', 'Adjustable rebound and compression'),
    A('Rear Dampers Ohlins TTX25', 'Suspension', 185000, V25, S('Sneha Iyer'), 'Good', 'In Use', 'Adjustable rebound and compression'),
    A('Front Wishbone Set', 'Suspension', 22000, V24, S('Arjun Reddy'), 'Damaged', 'Under Maintenance', 'Chromoly A-arms, bent lower arm after skidpad'),
    A('Anti-roll Bar Kit', 'Suspension', 15000, V25, S('Arjun Reddy'), 'Good', 'In Use', 'Blade-type adjustable ARB'),
    A('Spaceframe Chassis TB-24', 'Chassis', 160000, V24, S('Rohan Kulkarni'), 'Good', 'In Use', 'TIG welded 4130 tube frame'),
    A('CFRP Monocoque TB-25', 'Chassis', 540000, V25, S('Meera Pillai'), 'New', 'In Use', 'Carbon fibre sandwich monocoque'),
    A('Front Wing Assembly', 'Chassis', 75000, V25, S('Ananya Rao'), 'Good', 'In Use', 'Three element carbon front wing'),
    A('Rear Wing Assembly', 'Chassis', 82000, V25, S('Tanvi Deshpande'), 'Worn', 'In Use', 'DRS capable rear wing, endplate crack'),
    A('Wheel Speed Sensors (4)', 'Sensor', 24000, V25, S('Riya Menon'), 'Good', 'In Use', 'Hall effect sensors'),
    A('Linear Potentiometers (4)', 'Sensor', 32000, V24, S('Riya Menon'), 'Good', 'In Use', 'Damper travel sensors'),
    A('IMU VectorNav VN-100', 'Sensor', 58000, V25, S('Vikram Joshi'), 'New', 'In Use', 'Inertial measurement unit for telemetry'),
    A('Brake Pressure Sensors (2)', 'Sensor', 14000, V24, S('Aditya Verma'), 'Good', 'In Use', 'Hydraulic pressure transducers'),
    A('Data Logger AiM EVO5', 'Electronics', 95000, V24, S('Riya Menon'), 'Good', 'In Use', 'Telemetry data acquisition'),
    A('Hoosier R25B Tyre Set', 'Tyres', 88000, V24, null, 'Worn', 'In Use', '13 inch slick tyres'),
    A('Hoosier LC0 Tyre Set', 'Tyres', 92000, V25, null, 'New', 'Available', '13 inch slick tyres, fresh set'),
    A('Wet Tyre Set', 'Tyres', 70000, null, null, 'Good', 'Available', 'Rain tyres shared between cars'),
    A('KTM 390 Engine', 'Motor', 150000, V22, null, 'Worn', 'Retired', 'Single cylinder engine from 2022 car'),
    A('Radiator + Fan Assembly', 'Motor', 26000, V24, S('Ishaan Gupta'), 'Good', 'In Use', 'Motor and inverter cooling loop'),
    A('TIG Welding Machine', 'Tool', 120000, null, S('Rohan Kulkarni'), 'Good', 'Available', 'Garage welding station'),
    A('Torque Wrench Set', 'Tool', 18000, null, null, 'Good', 'Available', '5–200 Nm calibrated set'),
    A('Corner Weight Scales', 'Tool', 95000, null, S('Sneha Iyer'), 'Good', 'Available', 'Four pad wireless scales'),
    A('Insulation Tester (Megger)', 'Tool', 42000, null, S('Diya Nair'), 'Good', 'Available', 'HV insulation resistance tester'),
    A('Battery Charger 600V', 'Electronics', 135000, V25, S('Diya Nair'), 'Good', 'Available', 'Elcon HV charger'),
    A('3D Printer Prusa MK4', 'Tool', 85000, null, S('Meera Pillai'), 'Good', 'In Use', 'For brackets and prototypes'),
    A('Laptop Rig (telemetry)', 'Electronics', 110000, null, S('Riya Menon'), 'Good', 'In Use', 'Pit laptop for live telemetry'),
  ];
  const aIds = Object.values((await db.collection('assets').insertMany(assets)).insertedIds);
  const AS = (name) => aIds[assets.findIndex((a) => a.name === name)];

  /* ---------- inventory (supplier = embedded document) ---------- */
  const I = (item, category, qty, minStock, unitCost, sName, contact, lead) =>
    ({ item, category, qty, minStock, unitCost, supplier: { name: sName, contact, leadTimeDays: lead } });
  const inventory = [
    I('Brake Pads (set)', 'Brakes', 3, 6, 3200, 'Wilwood India', 'wilwood@example.com', 14),
    I('Brake Fluid DOT 5.1 (500 ml)', 'Fluids', 8, 4, 650, 'Motul Distributors', '+91 90000 00001', 3),
    I('M8 Grade 12.9 Bolts', 'Fasteners', 140, 100, 25, 'Unbrako Chennai', '+91 90000 00002', 5),
    I('M6 Nyloc Nuts', 'Fasteners', 60, 150, 6, 'Unbrako Chennai', '+91 90000 00002', 5),
    I('Rod End Bearings', 'Bearings', 5, 8, 1450, 'FK Bearings', 'fkbearings@example.com', 21),
    I('Spherical Bearings', 'Bearings', 12, 6, 980, 'FK Bearings', 'fkbearings@example.com', 21),
    I('Coolant (5 L)', 'Fluids', 4, 2, 1200, 'Motul Distributors', '+91 90000 00001', 3),
    I('HV Orange Cable (per m)', 'Electrical', 18, 25, 420, 'Lapp India', 'lapp@example.com', 10),
    I('Li-ion Cells 21700', 'Electrical', 36, 24, 780, 'Molicel Asia', 'molicel@example.com', 30),
    I('CAN Connectors (Deutsch DTM)', 'Electrical', 22, 20, 350, 'TE Connectivity', 'te@example.com', 7),
    I('Zip Ties (pack of 100)', 'Consumables', 9, 5, 180, 'Local Hardware', '+91 90000 00003', 1),
    I('Carbon Fibre Prepreg (m²)', 'Consumables', 2, 5, 5400, 'Composites Tomorrow', 'composites@example.com', 18),
    I('Epoxy Adhesive (Araldite)', 'Consumables', 6, 4, 450, 'Local Hardware', '+91 90000 00003', 1),
    I('Wheel Bearings', 'Bearings', 10, 8, 1100, 'SKF India', 'skf@example.com', 7),
    I('Fuses 30A', 'Electrical', 40, 20, 45, 'Littelfuse', 'littelfuse@example.com', 5),
  ];
  const iIds = Object.values((await db.collection('inventory').insertMany(inventory)).insertedIds);
  const P = (item, qty) => {
    const k = inventory.findIndex((i) => i.item === item);
    return { itemId: iIds[k], item, qty, unitCost: inventory[k].unitCost };
  };

  /* ---------- maintenance (refs + partsUsed array) ---------- */
  const M = (asset, issue, action, cost, d, by, status, parts = []) => {
    const c = R.calcJobCost({ cost, partsUsed: parts }); // labour + parts
    return { assetId: AS(asset), issue, action, cost, partsCost: c.parts, totalCost: c.total, date: daysAgo(d), doneBy: S(by), status, partsUsed: parts,
       ...(status === 'Completed' ? { completedAt: daysAgo(d - 1) } : {}) };
  };
  const maintenance = [
    M('Front Brake Calipers (pair)', 'Spongy brake pedal', 'Bled system, replaced pads', 1500, 60, 'Aditya Verma', 'Completed', [P('Brake Pads (set)', 1), P('Brake Fluid DOT 5.1 (500 ml)', 2)]),
    M('Rear Brake Calipers (pair)', 'Pad wear beyond limit', 'Replaced pads', 800, 45, 'Aditya Verma', 'Completed', [P('Brake Pads (set)', 1)]),
    M('Front Brake Calipers (pair)', 'Caliper seal leak', 'Rebuilt caliper seals, bled lines', 2500, 12, 'Aditya Verma', 'Completed', [P('Brake Fluid DOT 5.1 (500 ml)', 1), P('Brake Pads (set)', 1)]),
    M('Front Wishbone Set', 'Lower arm bent after skidpad', 'Awaiting re-weld of lower A-arm', 3000, 11, 'Arjun Reddy', 'Open', [P('Rod End Bearings', 2), P('M8 Grade 12.9 Bolts', 8)]),
    M('Accumulator Pack 600V', 'Cell imbalance in segment 3', 'Replacing weak cells, re-balancing', 6000, 2, 'Diya Nair', 'Open', [P('Li-ion Cells 21700', 6), P('HV Orange Cable (per m)', 3)]),
    M('Bamocar D3 Inverter', 'Overheating under load', 'Flushed coolant loop, cleaned radiator', 1200, 30, 'Ishaan Gupta', 'Completed', [P('Coolant (5 L)', 1)]),
    M('Rear Wing Assembly', 'Endplate crack', 'Patched with prepreg layup', 2200, 20, 'Tanvi Deshpande', 'Completed', [P('Carbon Fibre Prepreg (m²)', 1), P('Epoxy Adhesive (Araldite)', 1)]),
    M('Front Dampers Ohlins TTX25', 'Damper oil seal service', 'Serviced & re-valved', 9500, 90, 'Sneha Iyer', 'Completed'),
    M('Data Logger AiM EVO5', 'Intermittent CAN dropouts', 'Replaced connectors, re-terminated bus', 400, 25, 'Riya Menon', 'Completed', [P('CAN Connectors (Deutsch DTM)', 4), P('Zip Ties (pack of 100)', 1)]),
    M('Spaceframe Chassis TB-24', 'Hairline crack at rear node', 'TIG re-welded & gusseted', 3500, 75, 'Rohan Kulkarni', 'Completed', [P('M8 Grade 12.9 Bolts', 12)]),
    M('Anti-roll Bar Kit', 'Loose drop links', 'Replaced rod ends, torqued to spec', 600, 15, 'Arjun Reddy', 'Completed', [P('Rod End Bearings', 2), P('M6 Nyloc Nuts', 10)]),
    M('Orion BMS 2', 'Firmware update + harness check', 'Updated firmware, replaced fuses', 0, 8, 'Vikram Joshi', 'Completed', [P('Fuses 30A', 4)]),
    M('Hoosier R25B Tyre Set', 'Wheel bearing noise', 'Replaced front wheel bearings', 700, 35, 'Aditya Verma', 'Completed', [P('Wheel Bearings', 2)]),
  ];
  await db.collection('maintenance').insertMany(maintenance);

  console.log(`Seeded: ${students.length} students, ${vehicles.length} vehicles, ${assets.length} assets, ${inventory.length} inventory items, ${maintenance.length} maintenance records`);
}

async function main() {
  const { connect, close } = require('./db');
  const db = await connect();
  const studentCount = await db.collection('students').countDocuments();
  if (studentCount === 0) {
    await seedData(db);
  }
  await close();
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { seedData };
