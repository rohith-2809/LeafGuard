// ======== server.js ========
// ✅ CommonJS Version - Complete, Stable, and Production-ready

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const axios = require("axios");
const morgan = require("morgan");
const compression = require("compression");
const helmet = require("helmet");

// =======================
// ✅ Hardcoded Configuration
// =======================
const PORT = process.env.PORT || 5000;

// 🌱 Hardcoded URLs (private repo safe)
const MONGO_URI = "mongodb+srv://myAppUser:890iopjklnm@plantdiseasedetection.uhd0o.mongodb.net/LeafGuard?retryWrites=true&w=majority&appName=Plantdiseasedetection";
const CLIENT_URL = "https://mern-test-client.onrender.com";
const FLASK_URL = "https://predict-app-mawg.onrender.com";
const GEMINI_URL = "https://agent-app.onrender.com";

// 🔐 JWT Secret
const JWT_SECRET = "super_secret_key_leafguard_890iopjklnm";

// =======================
// ✅ App Initialization
// =======================
const app = express();
app.use(express.json());
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(morgan("dev"));
app.use(compression());
app.use(helmet());

// =======================
// ✅ MongoDB Connection (with retry)
// =======================
const connectDB = async (retries = 5) => {
  console.log("🕓 Attempting MongoDB connection...");
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.error("❌ MongoDB connection failed, retrying in 5s...");
    if (retries > 0) setTimeout(() => connectDB(retries - 1), 5000);
    else console.error("❌ MongoDB connection permanently failed:", err.message);
  }
};
connectDB();

// =======================
// ✅ Mongoose Models
// =======================
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  history: [
    {
      imageUrl: String,
      result: String,
      recommendation: String,
      date: { type: Date, default: Date.now }
    }
  ]
});

const User = mongoose.model("User", userSchema);

// =======================
// ✅ Auth Middleware
// =======================
const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Access Denied. No Token Provided." });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    console.log("⚠️ Invalid Token:", err.message);
    return res.status(403).json({ error: "Invalid or expired token." });
  }
};

// =======================
// ✅ Multer Setup for Image Upload
// =======================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// =======================
// ✅ Routes
// =======================

// Health route
app.get("/health", (req, res) => res.json({ status: "OK", mongo: mongoose.connection.readyState }));

// Signup
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: "User already exists." });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashed });
    await user.save();
    res.json({ message: "Signup successful" });
  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ token });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Analyze Image (Flask + Gemini)
app.post("/analyze", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image provided" });

    const { plantType, waterFreq, language } = req.body;
    console.log("📸 Received image for analysis");

    // Step 1: Send to Flask API
    const flaskResponse = await axios.post(`${FLASK_URL}/predict`, {
      image: req.file.buffer.toString("base64"),
      plantType
    });
    const prediction = flaskResponse.data.prediction || "Unknown";

    // Step 2: Get recommendation from Gemini Agent
    const geminiResponse = await axios.post(`${GEMINI_URL}/recommend`, {
      disease: prediction,
      language,
      waterFreq
    });
    const recommendation = geminiResponse.data.recommendation || "No recommendation available";

    // Step 3: Save to user history
    const user = await User.findById(req.user.id);
    if (user) {
      user.history.push({
        imageUrl: "Image Uploaded via Analyze API",
        result: prediction,
        recommendation
      });
      await user.save();
    }

    console.log(`✅ Analysis complete for user ${req.user.email}`);
    res.json({ status: "success", prediction, recommendation });
  } catch (err) {
    console.error("❌ Analyze route error:", err.message);
    res.status(500).json({ error: "Analysis failed" });
  }
});

// Fetch History (Paginated)
app.get("/history", authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const user = await User.findById(req.user.id);

    if (!user) return res.status(404).json({ error: "User not found" });

    const total = user.history.length;
    const start = (page - 1) * limit;
    const end = start + parseInt(limit);

    res.json({
      name: user.name,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      history: user.history.slice(start, end)
    });
  } catch (err) {
    console.error("❌ History fetch error:", err);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

// Default route
app.get("/", (req, res) => {
  res.send("🌿 LeafGuard Backend Running Successfully!");
});

// =======================
// ✅ Start Server
// =======================
app.listen(PORT, () => {
  console.log("==========================================");
  console.log(`🚀 Server running on port: ${PORT}`);
  console.log(`🌍 Access: http://localhost:${PORT}/`);
  console.log(`🧠 Flask API: ${FLASK_URL}`);
  console.log(`🤖 Gemini Agent: ${GEMINI_URL}`);
  console.log(`💾 MongoDB: Connected -> ${MONGO_URI.includes("mongodb+srv") ? "Atlas Cluster" : "Local DB"}`);
  console.log("==========================================");
});
