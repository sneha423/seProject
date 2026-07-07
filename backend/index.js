const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const port = process.env.PORT || 5000;
const dataFilePath = path.join(__dirname, "data.json");

app.use(cors());
app.use(express.json());

let users = [];
let pools = [];
let feedbacks = [];
let sessions = {};

const defaultData = {
  users: [],
  pools: [],
  feedbacks: [],
};

const loadData = () => {
  try {
    if (fs.existsSync(dataFilePath)) {
      const raw = fs.readFileSync(dataFilePath, "utf8");
      const data = JSON.parse(raw || "{}");
      users = data.users || [];
      pools = data.pools || [];
      feedbacks = data.feedbacks || [];
      return;
    }
  } catch (error) {
    console.error("Failed to load backend data:", error);
  }

  users = defaultData.users;
  pools = defaultData.pools;
  feedbacks = defaultData.feedbacks;
  saveData();
};

const saveData = () => {
  try {
    fs.writeFileSync(
      dataFilePath,
      JSON.stringify({ users, pools, feedbacks }, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("Failed to save backend data:", error);
  }
};

const isPoolExpired = (pool) => {
  if (!pool.date || !pool.time) return false;
  const scheduledTime = new Date(`${pool.date}T${pool.time}`);
  if (Number.isNaN(scheduledTime.getTime())) return false;
  return Date.now() >= scheduledTime.getTime() + 2 * 60 * 1000;
};

const refreshPoolStatuses = () => {
  let changed = false;
  pools.forEach((pool) => {
    if (pool.status === "upcoming" && isPoolExpired(pool)) {
      pool.status = "completed";
      changed = true;
    }
  });
  if (changed) saveData();
};

loadData();

setInterval(refreshPoolStatuses, 60 * 1000);

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];
  const userId = sessions[token];
  if (!userId) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }

  req.user = user;
  next();
};

app.post("/api/auth/signup", (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    gender,
    community,
    preferences,
  } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (users.some((user) => user.email === normalizedEmail)) {
    return res.status(409).json({ message: "Email already exists" });
  }

  const newUser = {
    id: uuidv4(),
    name,
    email: normalizedEmail,
    password,
    phone: phone || "",
    gender: gender || "other",
    community: community || "",
    preferences: preferences || {
      womenOnly: false,
      communityOnly: false,
      verifiedOnly: true,
    },
    trustScore: 50,
  };

  users.push(newUser);
  saveData();

  const token = `dev-token-${uuidv4()}`;
  sessions[token] = newUser.id;

  const userResponse = {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    phone: newUser.phone,
    gender: newUser.gender,
    community: newUser.community,
    preferences: newUser.preferences,
    trustScore: newUser.trustScore,
  };

  res.json({ token, user: userResponse });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.trim().toLowerCase();

  const user = users.find((u) => u.email === normalizedEmail);
  if (!user || user.password !== password) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const token = `dev-token-${uuidv4()}`;
  sessions[token] = user.id;
  const userResponse = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    gender: user.gender,
    community: user.community,
    preferences: user.preferences,
    trustScore: user.trustScore,
  };
  res.json({ token, user: userResponse });
});

app.put("/api/auth/profile/:userId", authMiddleware, (req, res) => {
  const { userId } = req.params;
  const user = users.find((u) => u.id === userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const { name, phone, community, preferences } = req.body;
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (community) user.community = community;
  if (preferences) user.preferences = preferences;

  saveData();

  const userResponse = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    gender: user.gender,
    community: user.community,
    preferences: user.preferences,
    trustScore: user.trustScore,
  };

  res.json({ user: userResponse });
});

app.post("/api/pools", authMiddleware, (req, res) => {
  const creator = {
    _id: req.user.id,
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    community: req.user.community,
    trustScore: req.user.trustScore,
  };

  const requestedParticipants = Array.isArray(req.body.participants)
    ? req.body.participants.filter((participant) => participant._id !== creator._id)
    : [];

  const pool = {
    _id: uuidv4(),
    ...req.body,
    createdBy: req.body.createdBy || creator,
    participants: [creator, ...requestedParticipants],
    status: "upcoming",
  };
  pools.push(pool);
  saveData();
  res.json({ success: true, pool });
});

app.get("/api/pools", authMiddleware, (req, res) => {
  const status = req.query.status;
  const filtered = status ? pools.filter((p) => p.status === status) : pools;
  res.json({ pools: filtered });
});

app.get("/api/pools/my-pools", authMiddleware, (req, res) => {
  const myPools = pools.filter(
    (pool) =>
      pool.createdBy?._id === req.user.id ||
      pool.participants.some((participant) => participant._id === req.user.id)
  );
  res.json({ pools: myPools });
});

app.get("/api/pools/:poolId", authMiddleware, (req, res) => {
  const pool = pools.find((p) => p._id === req.params.poolId);
  if (!pool) {
    return res.status(404).json({ message: "Pool not found" });
  }
  res.json({ pool });
});

app.post("/api/pools/:poolId/join", authMiddleware, (req, res) => {
  const pool = pools.find((p) => p._id === req.params.poolId);
  if (!pool) {
    return res.status(404).json({ message: "Pool not found" });
  }

  const participant =
    req.body.participant ||
    ({
      _id: req.user.id,
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      community: req.user.community,
      trustScore: req.user.trustScore,
    });

  if (pool.participants.some((p) => p._id === participant._id)) {
    return res.status(400).json({ message: "User already joined this pool" });
  }

  pool.participants.push(participant);
  saveData();
  res.json({ success: true, pool });
});

app.post("/api/pools/:poolId/leave", authMiddleware, (req, res) => {
  const pool = pools.find((p) => p._id === req.params.poolId);
  if (!pool) {
    return res.status(404).json({ message: "Pool not found" });
  }

  const participantId = req.body.participantId || req.user.id;
  pool.participants = pool.participants.filter((p) => p._id !== participantId);
  saveData();
  res.json({ success: true, pool });
});

app.get("/api/pools/my-pools", authMiddleware, (req, res) => {
  const myPools = pools.filter(
    (pool) =>
      pool.createdBy?._id === req.user.id ||
      pool.participants.some((participant) => participant._id === req.user.id)
  );
  res.json({ pools: myPools });
});

app.patch("/api/pools/:poolId/status", authMiddleware, (req, res) => {
  const pool = pools.find((p) => p._id === req.params.poolId);
  if (!pool) {
    return res.status(404).json({ message: "Pool not found" });
  }
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ message: "Status is required" });
  }
  pool.status = status;
  saveData();
  res.json({ success: true, pool });
});

app.delete("/api/pools/:poolId", authMiddleware, (req, res) => {
  const poolIndex = pools.findIndex((p) => p._id === req.params.poolId);
  if (poolIndex === -1) {
    return res.status(404).json({ message: "Pool not found" });
  }
  pools.splice(poolIndex, 1);
  saveData();
  res.json({ success: true });
});

app.post("/api/feedback", authMiddleware, (req, res) => {
  const feedback = {
    id: uuidv4(),
    ...req.body,
  };
  feedbacks.push(feedback);
  saveData();
  res.json({ success: true, feedback });
});

app.get("/api/feedback/my-feedback", authMiddleware, (req, res) => {
  const myFeedback = feedbacks.filter(
    (f) => f.userId === req.user.id || f.fromUserId === req.user.id
  );
  res.json({ feedbacks: myFeedback });
});

app.get("/api/feedback/user/:userId", authMiddleware, (req, res) => {
  const userFeedback = feedbacks.filter((f) => f.userId === req.params.userId);
  res.json({ feedbacks: userFeedback });
});

app.get("/api/feedback/pool/:poolId", authMiddleware, (req, res) => {
  const poolFeedback = feedbacks.filter((f) => f.poolId === req.params.poolId);
  res.json({ feedbacks: poolFeedback });
});

app.listen(port, () => {
  console.log(`Backend server running on http://localhost:${port}`);
});

// If a frontend build exists, serve it (useful for local deployment)
const clientBuildPath = path.join(__dirname, "..", "build");
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
  console.log("Serving frontend from:", clientBuildPath);
} else {
  // Provide a helpful root response when no frontend is present
  app.get("/", (req, res) => {
    res.send("RideCircle API running. Use /api routes to interact with the backend.");
  });
}
