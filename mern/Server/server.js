// ==========================
// 🌿 Plant Disease Detection Backend (CJS)
// Author: Vittamraj Sai Rohith
// ==========================

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const path = require("path");

// Load env variables
dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// ==========================
// ⚙️ Config
// ==========================
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "mysecretkey";
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://myAppUser:890iopjklnm@plantdiseasedetection.uhd0o.mongodb.net/?retryWrites=true&w=majority&appName=Plantdiseasedetection";

// ==========================
// 🧠 MongoDB Connection
// ==========================
console.log("🕓 Attempting MongoDB connection...");
mongoose
  .connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Failed:", err.message);
  });

// ==========================
// 📦 Mongoose Models
// ==========================
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
});

const historySchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  imageName: String,
  prediction: String,
  date: { type: Date, default: Date.now },
});

// ✅ Use custom collection name “LeafGuard”
const User = mongoose.model("LeafGuard", userSchema, "LeafGuard");
const History = mongoose.model("History", historySchema);

// ==========================
// 🔐 JWT Auth Middleware
// ==========================
function verifyToken(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header) {
      console.warn("⚠️ No Authorization Header");
      return res.status(401).json({ message: "No token provided" });
    }

    const token = header.split(" ")[1];
    if (!token) {
      console.warn("⚠️ Bearer token missing");
      return res.status(401).json({ message: "Invalid token format" });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.warn("⚠️ Invalid Token:", err.message);
        return res.status(401).json({ message: "Invalid token" });
      }
      req.user = decoded;
      console.log(`🔓 Authenticated user: ${decoded.email}`);
      next();
    });
  } catch (error) {
    console.error("🔥 Token verification error:", error);
    res.status(500).json({ message: "Token verification failed" });
  }
}

// ==========================
// 📸 Multer (Image Upload)
// ==========================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ==========================
// 👤 Auth Routes
// ==========================
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashed });
    await newUser.save();

    console.log(`✅ New user registered: ${email}`);
    res.json({ success: true, message: "Signup successful" });
  } catch (error) {
    console.error("❌ Signup error:", error);
    res.status(500).json({ message: "Signup failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign(
      { id: user._id, email: user.email },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    console.log(`🔑 User logged in: ${email}`);
    res.json({ success: true, token });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

// ==========================
// 🧩 Analyze Route
// ==========================
app.post("/analyze", verifyToken, upload.single("image"), async (req, res) => {
  try {
    console.log("📩 /analyze request received");

    if (!req.file) {
      console.warn("⚠️ No file uploaded");
      return res.status(400).json({ message: "No image uploaded" });
    }

    console.log(`🖼️ Uploaded image: ${req.file.originalname}`);

    // Dummy prediction
    const prediction = "Neem Leaf - Possible Leaf Spot Disease";

    // Save to History
    const history = new History({
      userId: req.user.id,
      imageName: req.file.originalname,
      prediction,
    });
    await history.save();

    res.json({
      success: true,
      message: "✅ Image analyzed successfully",
      prediction,
      filename: req.file.originalname,
    });
  } catch (error) {
    console.error("❌ Analyze error:", error);
    res.status(500).json({ message: "Analysis failed" });
  }
});

// ==========================
// 📜 History Route
// ==========================
app.get("/history", verifyToken, async (req, res) => {
  try {
    console.log(`📜 Fetching history for user: ${req.user.email}`);
    const records = await History.find({ userId: req.user.id }).sort({ date: -1 });
    res.json({ success: true, history: records });
  } catch (error) {
    console.error("❌ History fetch error:", error);
    res.status(500).json({ message: "Failed to fetch history" });
  }
});

// ==========================
// 🧪 Test Routes
// ==========================
app.get("/test-db", async (req, res) => {
  const state = mongoose.connection.readyState;
  res.json({
    mongoStatus:
      state === 1 ? "✅ Connected to MongoDB" : "⚠️ Not Connected to MongoDB",
  });
});

app.get("/", (req, res) => {
  res.send("🌿 LeafGuard Backend is Running");
});

// ==========================
// 🚀 Start Server
// ==========================
app.listen(PORT, () => {
  console.log("==========================================");
  console.log(`🚀 Server running on port: ${PORT}`);
  console.log(`🌍 Access: http://localhost:${PORT}/`);
  console.log("==========================================");
});
