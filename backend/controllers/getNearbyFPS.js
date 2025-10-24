const db = require("../config/db");

// Helper function to calculate distance (Haversine Formula)
function getDistanceFromLatLon(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d.toFixed(2); // Return distance in km (rounded to 2 decimals)
}

exports.getNearbyFPS = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ message: "Latitude and longitude are required." });
    }

    // Fetch all FPS shops with their coordinates
    const [fpsShops] = await db.query(`
      SELECT fps_id, fps_name, state, district, taluka_tehsil, village,
             latitude, longitude, address_line1
      FROM fps_shops
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    `);

    if (!fpsShops.length) {
      return res
        .status(404)
        .json({ message: "No FPS shops found in the database." });
    }

    // Calculate distance for each shop
    const fpsWithDistance = fpsShops.map((shop) => {
      const distance = getDistanceFromLatLon(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(shop.latitude),
        parseFloat(shop.longitude)
      );
      return { ...shop, distance: parseFloat(distance) };
    });

    // Sort by nearest distance
    fpsWithDistance.sort((a, b) => a.distance - b.distance);

    // Pick top 3 nearby shops
    const nearestFPS = fpsWithDistance.slice(0, 3);

    res.status(200).json({
      message: "Nearby FPS shops fetched successfully.",
      user_location: { latitude, longitude },
      nearby_fps: nearestFPS,
    });
  } catch (error) {
    console.error("❌ Error fetching nearby FPS shops:", error);
    res.status(500).json({
      message: "Error fetching nearby FPS shops.",
      error: error.message,
    });
  }
};
