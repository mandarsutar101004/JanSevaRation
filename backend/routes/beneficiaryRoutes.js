const express = require("express");
const router = express.Router();
const { createBeneficiary, getAllBeneficiaries } = require("../controllers/beneficiaryController");

// ✅ POST: Create new beneficiary
router.post("/create", createBeneficiary);

router.get("/all", getAllBeneficiaries);

module.exports = router;
