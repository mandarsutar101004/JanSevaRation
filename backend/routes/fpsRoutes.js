const express = require("express");
const router = express.Router();
const { getNearbyFPS } = require("../controllers/getNearbyFPS");

// ✅ Route to get nearby FPS shops based on user's coordinates
router.post("/get-nearby-fps", getNearbyFPS);

module.exports = router;
