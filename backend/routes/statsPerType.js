// routes/statsPerType.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db"); // MySQL connection pool

router.get("/", async (req, res) => {
  try {
    // Fetch all ration card types
    const [types] = await pool.query(
      "SELECT card_type_name FROM ration_card_types"
    );

    const stats = [];

    for (const type of types) {
      const cardType = type.card_type_name;

      // Total Ration Cards and Beneficiaries
      const [total] = await pool.query(
        "SELECT COUNT(*) AS ration_cards, IFNULL(SUM(total_members),0) AS beneficiaries FROM beneficiaries WHERE card_type = ?",
        [cardType]
      );

      // Aadhaar-seeded Ration Cards and Beneficiaries (status = Active)
      const [aadhaar] = await pool.query(
        "SELECT COUNT(*) AS aadhaar_rc, IFNULL(SUM(total_members),0) AS aadhaar_beneficiaries FROM beneficiaries WHERE card_type = ? AND status = 'Active'",
        [cardType]
      );

      stats.push({
        ration_card_type: cardType,
        ration_cards: total[0].ration_cards,
        beneficiaries: total[0].beneficiaries,
        aadhaar_rc: aadhaar[0].aadhaar_rc,
        aadhaar_beneficiaries: aadhaar[0].aadhaar_beneficiaries,
      });
    }

    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
