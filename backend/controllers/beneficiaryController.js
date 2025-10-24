const db = require("../config/db");
const axios = require("axios");

// ✅ Function to generate Beneficiary RC Number
function generateRCNo(stateCode, districtCode, count) {
  const year = new Date().getFullYear();
  const paddedNo = String(count).padStart(8, "0"); // 8-digit sequence
  return `${year}${stateCode}${districtCode}${paddedNo}`; // 16 digits
}

// ✅ Function to generate Member ID (18 digits: 16-digit RC No + 2-digit sequence)
function generateMemberId(rcNo, index) {
  const memberSeq = String(index + 1).padStart(2, "0"); // 01, 02, ...
  return rcNo + memberSeq; // 18 digits
}

// ✅ Controller to create new beneficiary
exports.createBeneficiary = async (req, res) => {
  try {
    const {
      country,
      state,
      district,
      taluka_tehsil,
      village,
      card_type,
      members,
      issued_by,
    } = req.body;

    if (!Array.isArray(members) || members.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one member is required" });
    }

    // 🔹 Fetch state and district codes
    const [stateRow] = await db.query(
      "SELECT state_code FROM states WHERE state_name = ?",
      [state]
    );
    const [districtRow] = await db.query(
      "SELECT district_code FROM districts WHERE district_name = ?",
      [district]
    );

    if (!stateRow.length || !districtRow.length) {
      return res.status(400).json({ message: "Invalid state or district" });
    }

    const stateCode = stateRow[0].state_code;
    const districtCode = districtRow[0].district_code;

    // 🔹 Generate RC Number
    const [rows] = await db.query(
      "SELECT COUNT(*) AS count FROM beneficiaries"
    );
    const count = rows[0].count + 1;
    const rcNo = generateRCNo(stateCode, districtCode, count);

    // 🔹 Check Aadhaar uniqueness for each member
    for (let m of members) {
      const [existing] = await db.query(
        "SELECT rc_no FROM beneficiaries WHERE JSON_CONTAINS(members, ?) LIMIT 1",
        [JSON.stringify({ aadhar_no: m.aadhar_no })]
      );
      if (existing.length) {
        return res.status(400).json({
          message: `Aadhaar ${m.aadhar_no} is already attached to RC No ${existing[0].rc_no}`,
        });
      }
    }

    // 🔹 Get latitude and longitude using backend API
    let latitude = null;
    let longitude = null;

    try {
      const geoResponse = await axios.post(
        "http://localhost:5000/api/get-coordinates",
        {
          country,
          state,
          district,
          taluka_tehsil,
        }
      );
      latitude = geoResponse.data.latitude;
      longitude = geoResponse.data.longitude;
    } catch (geoErr) {
      console.error("❌ Geocoding API Error:", geoErr.message);
    }

    // 🔹 Assign 18-digit member_id to each member
    const membersWithId = members.map((m, index) => ({
      member_id: generateMemberId(rcNo, index),
      ...m,
    }));

    const totalMembers = membersWithId.length;

    // 🔹 Insert Beneficiary
    const insertQuery = `
      INSERT INTO beneficiaries
      (rc_no, country, state, district, taluka_tehsil, village,
       card_type, total_members, members, status, issued_by, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?, ?)
    `;

    await db.query(insertQuery, [
      rcNo,
      country,
      state,
      district,
      taluka_tehsil,
      village || null,
      card_type,
      totalMembers,
      JSON.stringify(membersWithId),
      issued_by,
      latitude,
      longitude,
    ]);

    res.status(201).json({
      message: "Beneficiary created successfully",
      rc_no: rcNo,
      coordinates: { latitude, longitude },
      members: membersWithId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error creating beneficiary", error });
  }
};

// ✅ Controller: Get all beneficiaries
exports.getAllBeneficiaries = async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM beneficiaries");

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("❌ Error fetching beneficiaries:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching beneficiaries",
      error: error.message,
    });
  }
};
