const express = require('express');
const { addPlan,getAllPlan } = require('../controler/plans'); // Ensure the path and export are correct

const router = express.Router();

router.post('/add', addPlan);
router.post('/get', getAllPlan);


module.exports = router;
