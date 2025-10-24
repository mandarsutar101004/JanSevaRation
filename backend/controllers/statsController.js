// backend/controllers/statsController.js
const db = require("../config/db");

exports.getStats = async (req, res) => {
  try {
    // Total members in beneficiaries
    const [membersCountRow] = await db.query(
      `SELECT SUM(total_members) AS total_members FROM beneficiaries`
    );
    const totalMembers = membersCountRow[0].total_members || 0;

    // Total ration cards
    const [rationCardsRow] = await db.query(
      `SELECT COUNT(*) AS total_cards FROM beneficiaries`
    );
    const totalRationCards = rationCardsRow[0].total_cards || 0;

    // Total FPS shops
    const [fpsRow] = await db.query(
      `SELECT COUNT(*) AS total_fps FROM fps_shops`
    );
    const totalFPS = fpsRow[0].total_fps || 0;

    res.json({
      beneficiaries: totalMembers,
      ration_cards: totalRationCards,
      fps: totalFPS,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching stats", error });
  }
};
