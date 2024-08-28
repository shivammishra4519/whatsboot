const express = require('express');
const { addPlan,getAllPlan,buyPlan,verifyPayment,deletePlan} = require('../controler/plans'); // Ensure the path and export are correct

const router = express.Router();

router.post('/add', addPlan);
router.post('/get', getAllPlan);
router.post('/buy', buyPlan);
router.post('/verify/payment', verifyPayment);
router.post('/delete', deletePlan);


module.exports = router;
