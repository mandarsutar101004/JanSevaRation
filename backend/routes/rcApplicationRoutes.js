const express = require('express');
const router = express.Router();
const { createRCApplication, getAllRCApplications } = require('../controllers/rcApplicationController');

router.post('/create', createRCApplication);

// Get all RC Applications
router.get("/all", getAllRCApplications);

module.exports = router;
