const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const rcApplicationRoutes = require('./routes/rcApplicationRoutes');
const beneficiaryRoutes = require("./routes/beneficiaryRoutes");
const grievanceRoutes = require("./routes/grievance");
const geoRoutes = require("./routes/geoRoutes");
const fpsRoutes = require("./routes/fpsRoutes");
const authRoutes = require("./routes/authRoutes");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Test route
app.get("/", (req, res) => {
  res.send("Ration System Backend Running...");
});

app.use('/api/rc-applications', rcApplicationRoutes);

app.use("/api/beneficiaries", beneficiaryRoutes);

app.use("/api/stats", require("./routes/stats"));

app.use("/api/stats-per-type", require("./routes/statsPerType"));

app.use("/api/ration-card-types", require("./routes/rationCardTypes"));

app.use("/api/grievances", grievanceRoutes);

app.use("/api", geoRoutes);

app.use("/api", fpsRoutes);

app.use("/api/auth", authRoutes);





const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
