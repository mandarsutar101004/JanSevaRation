const express = require('express');
const router = express.Router();
const { createRCApplication, getAllRCApplications, updateRCApplicationStatus } = require('../controllers/rcApplicationController');

router.post('/create', createRCApplication);

// Get all RC Applications
router.get("/all", getAllRCApplications);

router.put("/:id/status", updateRCApplicationStatus);

module.exports = router;
