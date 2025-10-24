// backend controller
const db = require("../config/db");
const axios = require("axios");
const nodemailer = require("nodemailer");

// Configure email transporter (use environment variables)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "your-email@gmail.com",
    pass: process.env.SMTP_PASS || "your-app-password",
  },
});

// Function to generate Application ID
function generateApplicationId(stateCode, districtCode, count) {
  const year = new Date().getFullYear();
  const paddedNo = String(count).padStart(4, "0");
  return `${year}${stateCode}${districtCode}${paddedNo}`;
}

exports.createRCApplication = async (req, res) => {
  try {
    const {
      country,
      state,
      district,
      taluka_tehsil,
      village,
      card_type,
      members,
      fps_id,
      email, // ✅ Now receiving email from frontend
    } = req.body;

    console.log("📧 Received email:", email); // Debug log

    // 1️⃣ Validate members
    if (!Array.isArray(members) || members.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one family member is required." });
    }

    const missingAadhar = members.some(
      (m) => !m.aadhar_no || m.aadhar_no.trim() === ""
    );
    if (missingAadhar) {
      return res
        .status(400)
        .json({ message: "Each member must have an Aadhaar number." });
    }

    // 2️⃣ Check duplicate Aadhaar within form
    const aadhaarNumbers = members.map((m) => m.aadhar_no);
    const uniqueAadhar = new Set(aadhaarNumbers);
    if (uniqueAadhar.size !== aadhaarNumbers.length) {
      return res.status(400).json({
        message: "Duplicate Aadhaar numbers found within members list.",
      });
    }

    // 3️⃣ Check Aadhaar already in DB
    for (const aadhar of aadhaarNumbers) {
      const [rows] = await db.query(
        `SELECT application_id FROM rc_applications WHERE JSON_SEARCH(members, 'one', ?, NULL, '$') IS NOT NULL`,
        [aadhar]
      );
      if (rows.length > 0) {
        return res.status(400).json({
          message: `Aadhaar number ${aadhar} already exists (Application ID: ${rows[0].application_id}).`,
        });
      }
    }

    // 4️⃣ Get codes for ID
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

    // 5️⃣ Generate Application ID
    const [rowsCount] = await db.query(
      "SELECT COUNT(*) AS count FROM rc_applications"
    );
    const count = rowsCount[0].count + 1;
    const applicationId = generateApplicationId(stateCode, districtCode, count);

    // 6️⃣ Get coordinates
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
      console.error("❌ Geocoding Error:", geoErr.message);
    }

    // 7️⃣ Insert into DB
    const totalMembers = members.length;
    await db.query(
      `INSERT INTO rc_applications
      (application_id, country, state, district, taluka_tehsil, village, card_type,
       fps_id, total_members, members, latitude, longitude)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        applicationId,
        country,
        state,
        district,
        taluka_tehsil,
        village,
        card_type,
        fps_id,
        totalMembers,
        JSON.stringify(members),
        latitude,
        longitude,
      ]
    );

    // --- Send Email Notification ---
    if (email && isValidEmail(email)) {
      try {
        const mailOptions = {
          from: `"Ration Card Department" <${
            process.env.SMTP_USER || "noreply@rationcard.com"
          }>`,
          to: email,
          subject: "✅ Ration Card Application Submitted Successfully!",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 28px;">🎉 Application Submitted!</h1>
                <p style="margin: 10px 0 0 0; font-size: 16px;">Ration Card Application Received</p>
              </div>
              
              <div style="padding: 30px; background: #f8f9fa;">
                <h3 style="color: #2c3e50; margin-top: 0;">Dear Applicant,</h3>
                <p style="color: #555; line-height: 1.6;">
                  We have successfully received your ration card application. Here are your application details:
                </p>
                
                <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #27ae60;">
                  <h4 style="color: #2c3e50; margin-top: 0;">Application Summary</h4>
                  <p><strong>Application ID:</strong> <span style="color: #e74c3c; font-weight: bold;">${applicationId}</span></p>
                  <p><strong>Status:</strong> <span style="color: #f39c12;">Under Review</span></p>
                  <p><strong>Total Family Members:</strong> ${totalMembers}</p>
                  <p><strong>Card Type:</strong> ${card_type}</p>
                  <p><strong>Location:</strong> ${village}, ${taluka_tehsil}, ${district}, ${state}</p>
                </div>
                
                <div style="background: #e3f2fd; border-radius: 8px; padding: 15px; margin: 20px 0;">
                  <h4 style="color: #1976d2; margin-top: 0;">📋 Next Steps</h4>
                  <ul style="color: #555;">
                    <li>Your application is under verification</li>
                    <li>You will receive status updates via email and SMS</li>
                    <li>Keep your application ID handy for future reference</li>
                    <li>Expected processing time: 15-30 days</li>
                  </ul>
                </div>
                
                <p style="color: #777; font-size: 14px; text-align: center;">
                  Thank you for choosing our services. For any queries, please contact your local ration card office.
                </p>
              </div>
              
              <div style="background: #2c3e50; color: white; padding: 20px; text-align: center; font-size: 12px;">
                <p style="margin: 0;">&copy; 2024 Ration Card Department. All rights reserved.</p>
                <p style="margin: 5px 0 0 0;">This is an automated email, please do not reply.</p>
              </div>
            </div>
          `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("✅ Email sent successfully to:", email);
        console.log("📧 Message ID:", info.messageId);
      } catch (err) {
        console.error("❌ Error sending email:", err.message);
        // Don't fail the request if email fails
        console.log("⚠️ Application saved but email failed to send");
      }
    } else {
      console.log("ℹ️ No valid email provided for notification");
    }

    res.status(201).json({
      message: "RC Application submitted successfully.",
      application_id: applicationId,
      email_sent: !!email,
    });
  } catch (error) {
    console.error("❌ Error submitting application:", error);
    res.status(500).json({
      message: "Error submitting application",
      error: error.message,
    });
  }
};

// Helper function to validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Get all RC Applications
exports.getAllRCApplications = async (req, res) => {
  try {
    const [applications] = await db.query(
      `SELECT 
         application_id, country, state, district, taluka_tehsil, village,
         card_type, fps_id, total_members, members, latitude, longitude, created_at
       FROM rc_applications
       ORDER BY created_at DESC`
    );

    res.status(200).json({
      success: true,
      message: "RC Applications fetched successfully.",
      data: applications,
    });
  } catch (error) {
    console.error("❌ Error fetching applications:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching applications",
      error: error.message,
    });
  }
};
