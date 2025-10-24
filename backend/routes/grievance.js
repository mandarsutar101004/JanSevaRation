// routes/grievance.js
const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const nodemailer = require("nodemailer");
require("dotenv").config();

// 📧 Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ✅ POST: Submit grievance
router.post("/", async (req, res) => {
  try {
    const {
      category,
      detail_description,
      contact_no,
      email,
      additional_info,
      supported_documents,
    } = req.body;

    console.log("📥 Received grievance submission:", {
      category,
      contact_no,
      email,
      documents_count: supported_documents ? supported_documents.length : 0,
    });

    if (!category || !detail_description || !contact_no || !email) {
      return res
        .status(400)
        .json({ message: "Please fill all required fields" });
    }

    // Process supported documents - store only metadata to avoid huge base64 in DB
    let fileData = "[]";
    if (supported_documents && supported_documents.length > 0) {
      const documentMetadata = supported_documents.map((doc) => ({
        name: doc.name,
        type: doc.type,
        size: doc.size,
        // Store only first 100 chars of base64 for reference, not the entire file
        data_preview: doc.data.substring(0, 100) + "...",
      }));
      fileData = JSON.stringify(documentMetadata);

      console.log(
        `📎 Processing ${supported_documents.length} documents:`,
        supported_documents.map((doc) => ({
          name: doc.name,
          type: doc.type,
          size: doc.size,
        }))
      );
    }

    const query = `
      INSERT INTO grievances 
      (category, detail_description, contact_no, email, additional_info, supported_documents)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.query(query, [
      category,
      detail_description,
      contact_no,
      email,
      additional_info || null,
      fileData,
    ]);

    console.log("✅ Grievance saved to database with ID:", result.insertId);

    // Send acknowledgment email
    try {
      await transporter.sendMail({
        from: `"JanSEVA Ration Support" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "📩 Grievance Acknowledgment - JanSEVA Ration Portal",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4361ee;">🙏 Dear Citizen,</h2>
            <p>We have successfully received your grievance regarding <strong>${category}</strong>.</p>
            <p>🕐 Our support team will carefully review your concern and take appropriate action at the earliest.</p>

            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>📝 Details Submitted:</strong></p>
              <ul style="margin: 0;">
                <li><strong>Category:</strong> ${category}</li>
                <li><strong>Description:</strong> ${detail_description}</li>
                <li><strong>Contact No:</strong> ${contact_no}</li>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Documents Uploaded:</strong> ${
                  supported_documents ? supported_documents.length : 0
                } file(s)</li>
              </ul>
            </div>

            <p>💡 We appreciate your patience and cooperation while we resolve your issue.</p>
            <p>We aim to respond within 3-5 working days.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
              <p style="margin: 0;">Warm regards,</p>
              <p style="margin: 0; font-weight: bold;">🤝 JanSEVA Ration Support Team</p>
              <p style="margin: 0;">Government of Maharashtra 🏛️</p>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #666;">
                <em>This is an automated message. Please do not reply.</em>
              </p>
            </div>
          </div>
        `,
      });
      console.log("✅ Confirmation email sent to:", email);
    } catch (emailError) {
      console.error("❌ Failed to send email:", emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      message:
        "✅ Grievance submitted successfully. A confirmation email has been sent.",
      grievanceId: result.insertId,
    });
  } catch (err) {
    console.error("❌ Error while saving grievance:", err);
    res
      .status(500)
      .json({ message: "Server error while submitting grievance." });
  }
});

// ✅ GET: Fetch all grievances
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM grievances ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching grievances:", err);
    res.status(500).json({ message: "Error fetching grievances." });
  }
});

// ✅ GET: Fetch single grievance by ID
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM grievances WHERE id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Grievance not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error fetching grievance:", err);
    res.status(500).json({ message: "Error fetching grievance." });
  }
});

module.exports = router;
