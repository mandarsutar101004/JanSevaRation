const db = require("../config/db");
const nodemailer = require("nodemailer");
require("dotenv").config();

// ✅ Configure mail transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// ✅ Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ✅ Safe JSON parser
function safeParseJSON(data) {
  try {
    if (typeof data === "string") return JSON.parse(data);
    if (Array.isArray(data)) return data;
    if (typeof data === "object" && data !== null) return [data];
    return [];
  } catch {
    return [];
  }
}

// ✅ Generate OTP Controller
exports.generateOTP = async (req, res) => {
  const { user_type, identifier } = req.body; // identifier: RC no / Aadhar / email / Application ID
  let email = null;

  try {
    switch (user_type) {
      // ==============================================================
      // ✅ BENEFICIARY LOGIN
      // ==============================================================
      case "beneficiary": {
        // ✅ Step 1 — If identifier is Aadhar number
        if (/^\d{12}$/.test(identifier)) {
          let existsInBeneficiary = false;

          // Check if Aadhar exists inside beneficiaries.members JSON
          const [beneficiaries] = await db.query(
            "SELECT members FROM beneficiaries"
          );

          for (const row of beneficiaries) {
            const members = safeParseJSON(row.members);
            const found = members.find((m) => m.aadhar_no === identifier);

            if (found) {
              existsInBeneficiary = true;
              break;
            }
          }

          if (!existsInBeneficiary) {
            return res
              .status(404)
              .json({ message: "Aadhar Card not linked with any RC" });
          }

          // ✅ Step 2 — Check Aadhar in aadhar_cards
          const [aadharData] = await db.query(
            "SELECT email FROM aadhar_cards WHERE aadhar_no = ?",
            [identifier]
          );

          if (!aadharData.length) {
            return res
              .status(404)
              .json({ message: "Aadhar not found in Aadhar Cards table." });
          }

          // ✅ Must exist in both
          email = aadharData[0].email;
        }

        // ✅ If identifier is RC number
        else {
          const [rcData] = await db.query(
            "SELECT members FROM beneficiaries WHERE rc_no = ?",
            [identifier]
          );

          if (rcData.length) {
            const members = safeParseJSON(rcData[0].members);
            const hof = members.find(
              (m) => m.relation === "Self" || m.relation === "Head"
            );
            email = hof?.email || null;
          }
        }
        break;
      }

      // ==============================================================
      // ✅ FPS LOGIN
      // ==============================================================
      case "fps": {
        const [fps] = await db.query(
          "SELECT email FROM fps_shops WHERE email = ?",
          [identifier]
        );
        email = fps[0]?.email || null;
        break;
      }

      // ==============================================================
      // ✅ AGENT LOGIN
      // ==============================================================
      case "agent": {
        const [agent] = await db.query(
          "SELECT email FROM delivery_agents WHERE email = ?",
          [identifier]
        );
        email = agent[0]?.email || null;
        break;
      }

      // ==============================================================
      // ✅ ADMIN LOGIN
      // ==============================================================
      case "admin": {
        const [admin] = await db.query(
          "SELECT email FROM admin WHERE email = ?",
          [identifier]
        );
        email = admin[0]?.email || null;
        break;
      }

      // ==============================================================
      // ✅ APPLICATION LOGIN
      // ==============================================================
      case "application": {
        const [app] = await db.query(
          "SELECT members FROM rc_applications WHERE application_id = ?",
          [identifier]
        );

        if (app.length) {
          const members = safeParseJSON(app[0].members);
          const hof = members.find(
            (m) => m.relation === "Self" || m.relation === "Head"
          );
          email = hof?.email || null;
        }
        break;
      }

      default:
        return res.status(400).json({ message: "Invalid user type" });
    }

    // ==============================================================
    // ✅ Send OTP
    // ==============================================================
    if (!email) {
      return res
        .status(404)
        .json({ message: "Email not found for this user." });
    }

    const otp = generateOTP();

    await db.query(
      "INSERT INTO otp_logins (user_type, identifier, otp) VALUES (?, ?, ?)",
      [user_type, identifier, otp]
    );

    await transporter.sendMail({
      from: `"Ration System" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your OTP for Login",
      html: `<h3>Dear User,</h3><p>Your OTP is <b>${otp}</b>. It is valid for 5 minutes.</p>`,
    });

    res.status(200).json({ message: "OTP sent successfully", email });
  } catch (err) {
    console.error("Error generating OTP:", err);
    res.status(500).json({
      message: "Error sending OTP",
      error: err.message || JSON.stringify(err),
    });
  }
};

// ✅ Verify OTP Controller
exports.verifyOTP = async (req, res) => {
  const { user_type, identifier, otp } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT * FROM otp_logins WHERE user_type=? AND identifier=? AND otp=? AND expires_at > NOW()",
      [user_type, identifier, otp]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Delete OTP after successful login
    await db.query(
      "DELETE FROM otp_logins WHERE user_type=? AND identifier=?",
      [user_type, identifier]
    );

    res.status(200).json({ message: "Login successful", user_type });
  } catch (err) {
    console.error("Error verifying OTP:", err);
    res.status(500).json({
      message: "Error verifying OTP",
      error: err.message || JSON.stringify(err),
    });
  }
};
