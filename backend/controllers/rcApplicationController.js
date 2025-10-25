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

// ✅ Function to generate Application ID
function generateApplicationId(stateCode, districtCode, count) {
  const year = new Date().getFullYear();
  const paddedNo = String(count).padStart(4, "0");
  return `${year}${stateCode}${districtCode}${paddedNo}`;
}

// Helper function to validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Function to get Head of Family from members
function getHeadOfFamily(members) {
  if (!Array.isArray(members)) return null;

  // Parse members if it's a string
  let membersArray;
  try {
    membersArray = typeof members === "string" ? JSON.parse(members) : members;
  } catch (error) {
    console.error("Error parsing members:", error);
    return null;
  }

  // Try to find Self relation first, then use first member
  const hof =
    membersArray.find((member) => member.relation === "Self") ||
    membersArray[0];
  return hof || null;
}

// Function to send status update email
async function sendStatusUpdateEmail(
  application,
  status,
  beneficiaryData = null
) {
  try {
    // Get HOF details from members
    const hof = getHeadOfFamily(application.members);

    if (!hof || !hof.email || !isValidEmail(hof.email)) {
      console.log("ℹ️ No valid HOF email found for status notification");
      return false;
    }

    let subject, html;

    if (status === "approved") {
      subject = "🎉 Your Ration Card Application Has Been Approved!";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">✅ Application Approved!</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Ration Card Successfully Issued</p>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa;">
            <h3 style="color: #2c3e50; margin-top: 0;">Dear ${
              hof.name || "Applicant"
            },</h3>
            <p style="color: #555; line-height: 1.6;">
              We are pleased to inform you that your ration card application has been <strong>approved</strong>. 
              Your ration card has been successfully generated and is now active.
            </p>
            
            <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #27ae60;">
              <h4 style="color: #2c3e50; margin-top: 0;">Application & Ration Card Details</h4>
              <p><strong>Application ID:</strong> <span style="color: #e74c3c; font-weight: bold;">${
                application.application_id
              }</span></p>
              <p><strong>Ration Card Number:</strong> <span style="color: #27ae60; font-weight: bold;">${
                beneficiaryData?.rc_no || "Generated"
              }</span></p>
              <p><strong>Status:</strong> <span style="color: #27ae60; font-weight: bold;">Approved ✅</span></p>
              <p><strong>Total Family Members:</strong> ${
                application.total_members
              }</p>
              <p><strong>Card Type:</strong> ${application.card_type}</p>
              <p><strong>Location:</strong> ${application.village}, ${
        application.taluka_tehsil
      }, ${application.district}</p>
            </div>
            
            <div style="background: #d4edda; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <h4 style="color: #155724; margin-top: 0;">📋 Next Steps & Important Information</h4>
              <ul style="color: #155724;">
                <li>Your ration card is now active and ready for use</li>
                <li>Visit your nearest Fair Price Shop (FPS) to start availing benefits</li>
                <li>Keep your Ration Card Number safe for future reference</li>
                <li>Carry valid ID proof when visiting FPS</li>
                <li>Benefits will be available from the next distribution cycle</li>
              </ul>
            </div>
            
            <div style="background: #e3f2fd; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <h4 style="color: #1976d2; margin-top: 0;">ℹ️ Contact Information</h4>
              <p style="color: #555; margin: 5px 0;">
                <strong>Ration Card Office:</strong> ${
                  application.district
                } District Office<br>
                <strong>Helpline:</strong> 1800-XXX-XXXX<br>
                <strong>Email:</strong> support@rationcard.gov.in
              </p>
            </div>
            
            <p style="color: #777; font-size: 14px; text-align: center;">
              Thank you for your patience during the verification process. We are committed to serving you better.
            </p>
          </div>
          
          <div style="background: #2c3e50; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">&copy; 2024 Ration Card Department. All rights reserved.</p>
            <p style="margin: 5px 0 0 0;">This is an automated email, please do not reply.</p>
          </div>
        </div>
      `;
    } else {
      subject = "❌ Update on Your Ration Card Application";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); padding: 30px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px;">❌ Application Status Update</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Important Notification Regarding Your Application</p>
          </div>
          
          <div style="padding: 30px; background: #f8f9fa;">
            <h3 style="color: #2c3e50; margin-top: 0;">Dear ${
              hof.name || "Applicant"
            },</h3>
            <p style="color: #555; line-height: 1.6;">
              After careful review and verification, we regret to inform you that your ration card application 
              <strong>could not be approved</strong> at this time.
            </p>
            
            <div style="background: white; border-radius: 10px; padding: 20px; margin: 20px 0; border-left: 4px solid #e74c3c;">
              <h4 style="color: #2c3e50; margin-top: 0;">Application Details</h4>
              <p><strong>Application ID:</strong> <span style="color: #e74c3c; font-weight: bold;">${
                application.application_id
              }</span></p>
              <p><strong>Status:</strong> <span style="color: #e74c3c; font-weight: bold;">Rejected ❌</span></p>
              <p><strong>Total Family Members:</strong> ${
                application.total_members
              }</p>
              <p><strong>Card Type Applied:</strong> ${
                application.card_type
              }</p>
              <p><strong>Location:</strong> ${application.village}, ${
        application.taluka_tehsil
      }, ${application.district}</p>
            </div>
            
            <div style="background: #f8d7da; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <h4 style="color: #721c24; margin-top: 0;">📋 Possible Reasons for Rejection</h4>
              <ul style="color: #721c24;">
                <li>Incomplete or inaccurate information provided</li>
                <li>Document verification issues</li>
                <li>Eligibility criteria not met</li>
                <li>Duplicate application detected</li>
                <li>Income criteria mismatch</li>
              </ul>
            </div>
            
            <div style="background: #e3f2fd; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <h4 style="color: #1976d2; margin-top: 0;">🔄 Next Steps & Re-application</h4>
              <ul style="color: #555;">
                <li>You may visit the nearest ration card office for detailed feedback</li>
                <li>Address any discrepancies in your documents</li>
                <li>Re-apply after 30 days with corrected information</li>
                <li>Ensure all documents are valid and clearly visible</li>
                <li>Verify income details and family member information</li>
              </ul>
            </div>
            
            <div style="background: #fff3cd; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <h4 style="color: #856404; margin-top: 0;">ℹ️ Contact for Clarification</h4>
              <p style="color: #856404; margin: 5px 0;">
                <strong>Ration Card Office:</strong> ${
                  application.district
                } District Office<br>
                <strong>Helpline:</strong> 1800-XXX-XXXX<br>
                <strong>Email:</strong> grievances@rationcard.gov.in<br>
                <strong>Office Hours:</strong> 10:00 AM - 5:00 PM (Mon-Fri)
              </p>
            </div>
            
            <p style="color: #777; font-size: 14px; text-align: center;">
              We appreciate your interest in our services and encourage you to re-apply after addressing the concerns.
            </p>
          </div>
          
          <div style="background: #2c3e50; color: white; padding: 20px; text-align: center; font-size: 12px;">
            <p style="margin: 0;">&copy; 2024 Ration Card Department. All rights reserved.</p>
            <p style="margin: 5px 0 0 0;">This is an automated email, please do not reply.</p>
          </div>
        </div>
      `;
    }

    const mailOptions = {
      from: `"Ration Card Department" <${
        process.env.SMTP_USER || "noreply@rationcard.com"
      }>`,
      to: hof.email,
      subject: subject,
      html: html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Status update email sent successfully to: ${hof.email}`);
    console.log("📧 Message ID:", info.messageId);
    return true;
  } catch (error) {
    console.error("❌ Error sending status update email:", error.message);
    return false;
  }
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
      email,
    } = req.body;

    console.log("📧 Received email:", email);

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

// Get all RC Applications
exports.getAllRCApplications = async (req, res) => {
  try {
    const [applications] = await db.query(
      `SELECT 
         application_id, country, state, district, taluka_tehsil, village,
         card_type, fps_id, total_members, members,status, latitude, longitude, created_at
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

// ✅ Update RC Application Status
exports.updateRCApplicationStatus = async (req, res) => {
  const { id } = req.params;
  const { status, issued_by } = req.body;

  if (!status || !["approved", "rejected"].includes(status.toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: "Invalid status. Must be 'approved' or 'rejected'.",
    });
  }

  try {
    // 1️⃣ Check if record exists
    const [existing] = await db.query(
      "SELECT * FROM rc_applications WHERE application_id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Application not found.",
      });
    }

    const application = existing[0];

    // 2️⃣ Update status
    await db.query(
      "UPDATE rc_applications SET status = ? WHERE application_id = ?",
      [status.toLowerCase(), id]
    );

    let beneficiaryResult = null;

    // 3️⃣ If approved, create a new Beneficiary
    if (status.toLowerCase() === "approved") {
      let membersData;
      try {
        if (typeof application.members === "string") {
          membersData = JSON.parse(application.members);
        } else {
          membersData = application.members;
        }
      } catch (parseError) {
        console.error("❌ Error parsing members data:", parseError);
        return res.status(500).json({
          success: false,
          message: "Invalid members data format",
        });
      }

      const beneficiaryData = {
        country: application.country,
        state: application.state,
        district: application.district,
        taluka_tehsil: application.taluka_tehsil,
        village: application.village,
        card_type: application.card_type,
        members: membersData,
        issued_by: issued_by || "Admin",
      };

      try {
        beneficiaryResult = await createBeneficiaryBackend(beneficiaryData);
      } catch (beneficiaryError) {
        console.error("❌ Error creating beneficiary:", beneficiaryError);
        return res.status(500).json({
          success: false,
          message:
            "Application approved but failed to create beneficiary: " +
            beneficiaryError.message,
        });
      }
    }

    // 4️⃣ Send status update email
    try {
      await sendStatusUpdateEmail(
        application,
        status.toLowerCase(),
        beneficiaryResult
      );
    } catch (emailError) {
      console.error("❌ Error sending status email:", emailError.message);
      // Don't fail the request if email fails
    }

    // 5️⃣ Return response
    if (status.toLowerCase() === "approved") {
      return res.json({
        success: true,
        message: `Application ${id} approved and beneficiary created successfully.`,
        beneficiary: beneficiaryResult,
        email_sent: true,
      });
    } else {
      return res.json({
        success: true,
        message: `Application ${id} status updated to '${status}'.`,
        email_sent: true,
      });
    }
  } catch (error) {
    console.error("❌ Error updating application status:", error);
    res.status(500).json({
      success: false,
      message: "Error updating application status.",
      error: error.message,
    });
  }
};

// Helper to call createBeneficiary without HTTP request
async function createBeneficiaryBackend(data) {
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
    } = data;

    if (!Array.isArray(members) || members.length === 0) {
      throw new Error("At least one member is required");
    }

    // Fetch state and district codes
    const [stateRow] = await db.query(
      "SELECT state_code FROM states WHERE state_name = ?",
      [state]
    );
    const [districtRow] = await db.query(
      "SELECT district_code FROM districts WHERE district_name = ?",
      [district]
    );

    if (!stateRow.length || !districtRow.length) {
      throw new Error("Invalid state or district");
    }

    const stateCode = stateRow[0].state_code;
    const districtCode = districtRow[0].district_code;

    // Generate RC Number
    const [rows] = await db.query(
      "SELECT COUNT(*) AS count FROM beneficiaries"
    );
    const count = rows[0].count + 1;
    const rcNo = generateRCNo(stateCode, districtCode, count);

    // Check Aadhaar uniqueness
    for (let m of members) {
      const [existing] = await db.query(
        "SELECT rc_no FROM beneficiaries WHERE JSON_CONTAINS(members, ?) LIMIT 1",
        [JSON.stringify({ aadhar_no: m.aadhar_no })]
      );
      if (existing.length) {
        throw new Error(
          `Aadhaar ${m.aadhar_no} is already attached to RC No ${existing[0].rc_no}`
        );
      }
    }

    // Get latitude and longitude
    let latitude = null;
    let longitude = null;

    try {
      const geoResponse = await axios.post(
        "http://localhost:5000/api/get-coordinates",
        { country, state, district, taluka_tehsil }
      );
      latitude = geoResponse.data.latitude;
      longitude = geoResponse.data.longitude;
    } catch (geoErr) {
      console.error("❌ Geocoding API Error:", geoErr.message);
    }

    // Assign member IDs
    const membersWithId = members.map((m, index) => ({
      member_id: generateMemberId(rcNo, index),
      ...m,
    }));

    const totalMembers = membersWithId.length;

    // Insert into beneficiaries
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

    return {
      rc_no: rcNo,
      members: membersWithId,
      coordinates: { latitude, longitude },
    };
  } catch (error) {
    console.error("❌ Error creating beneficiary:", error.message);
    throw error;
  }
}
