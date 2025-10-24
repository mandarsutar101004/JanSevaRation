const express = require("express");
const router = express.Router();
const pool = require("../config/db"); // Your MySQL connection pool

// GET /api/ration-card-types
router.get("/", async (req, res) => {
  try {
    const [types] = await pool.query(`
      SELECT card_type_id, card_type_name, description, eligibility_income, created_at
      FROM ration_card_types
      ORDER BY card_type_name
    `);

    res.json(types);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
