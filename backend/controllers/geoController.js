const axios = require("axios");
require("dotenv").config();

const getCoordinates = async (req, res) => {
  try {
    const { country, state, district, taluka_tehsil } = req.body;

    if (!country || !state || !district || !taluka_tehsil) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Combine full address for better accuracy
    const location = `${taluka_tehsil}, ${district}, ${state}, ${country}`;

    // Call the geocoding API
    const apiKey = process.env.GEOCODING_API_KEY;
    console.log("API Key Loaded:", process.env.GEOCODING_API_KEY);
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
      location
    )}&key=${apiKey}`;

    const response = await axios.get(url);

    // If location found
    if (response.data.results.length > 0) {
      const { lat, lng } = response.data.results[0].geometry;
      return res.status(200).json({
        location,
        latitude: lat,
        longitude: lng,
      });
    } else {
      return res.status(404).json({ message: "Location not found." });
    }
  } catch (error) {
    console.error("Geocoding Error:", error.message);
    return res.status(500).json({ message: "Error fetching coordinates." });
  }
};

module.exports = { getCoordinates };
