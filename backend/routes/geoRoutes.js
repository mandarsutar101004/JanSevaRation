const express = require("express");
const router = express.Router();
const { getCoordinates } = require("../controllers/geoController");

router.post("/get-coordinates", getCoordinates);

module.exports = router;
