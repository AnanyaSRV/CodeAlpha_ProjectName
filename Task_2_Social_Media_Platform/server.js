
const express = require("express");
const session = require("express-session");
const path = require("path");

const db = require("./database/database");

const authRoutes = require("./routes/auth");
const postsRoutes = require("./routes/posts");
const usersRoutes = require("./routes/users");
const socialRoutes = require("./routes/social");

const app = express();
const PORT = process.env.PORT || 3000;


// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Session configuration
app.use(
    session({
        name: "folio.sid",
        secret:
            process.env.SESSION_SECRET ||
            "folio-development-secret-change-before-deployment",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24 * 7
        }
    })
);


// Serve frontend files.
app.use(express.static(path.join(__dirname, "public")));


// API routes
app.use("/api/auth", authRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/social", socialRoutes);


// API health check
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Folio API is running!",
        database: db.open ? "connected" : "disconnected",
        timestamp: new Date().toISOString()
    });
});


// Homepage
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});


// Handle unknown API routes
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });
});


// Global error handler
app.use((err, req, res, next) => {
    console.error("Server error:", err);

    res.status(500).json({
        success: false,
        message: "An internal server error occurred."
    });
});


// Start server
app.listen(PORT, () => {
    console.log("------------------------------------");
    console.log("       FOLIO SOCIAL PLATFORM");
    console.log("------------------------------------");
    console.log(`Server running at: http://localhost:${PORT}`);
    console.log(`API health: http://localhost:${PORT}/api/health`);
    console.log(`Authentication: http://localhost:${PORT}/api/auth`);
    console.log(`Posts API: http://localhost:${PORT}/api/posts`);
    console.log(`Users API: http://localhost:${PORT}/api/users`);
    console.log(`Social API: http://localhost:${PORT}/api/social`);
    console.log("------------------------------------");
});
