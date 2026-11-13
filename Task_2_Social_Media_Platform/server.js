
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const path = require("path");

const db = require("./database/database");

const authRoutes = require("./routes/auth");
const postsRoutes = require("./routes/posts");
const usersRoutes = require("./routes/users");
const socialRoutes = require("./routes/social");

const app = express();

const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be configured in production.");
}

app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        store: new pgSession({
            pool: db.pool,
            tableName: "session",
            createTableIfMissing: true
        }),

        name: "folio.sid",

        secret:
            process.env.SESSION_SECRET ||
            "folio-local-development-secret",

        resave: false,
        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24 * 7
        }
    })
);

app.use(express.static(path.join(__dirname, "public")));

app.use("/api/auth", authRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/social", socialRoutes);


// Database health check.
app.get("/api/health", async (req, res) => {
    try {
        await db.pool.query("SELECT 1");

        res.status(200).json({
            success: true,
            message: "Folio API is running!",
            database: "connected",
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("Health check database error:", error);

        res.status(503).json({
            success: false,
            message: "Database connection unavailable."
        });
    }
});


// Homepage.
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});


// API 404 handler.
app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });
});


// Global error handler.
app.use((err, req, res, next) => {
    console.error("Server error:", err);

    res.status(500).json({
        success: false,
        message: "An internal server error occurred."
    });
});


// Start the application.
async function startServer() {
    try {
        await db.initializeDatabase();

        app.listen(PORT, "0.0.0.0", () => {
            console.log("------------------------------------");
            console.log("       FOLIO SOCIAL PLATFORM");
            console.log("------------------------------------");
            console.log(`Server running on port: ${PORT}`);
            console.log("Database: PostgreSQL");
            console.log("Image storage: Cloudinary");
            console.log("API health: /api/health");
            console.log("------------------------------------");
        });

    } catch (error) {
        console.error("Folio startup failed:", error);
        process.exit(1);
    }
}

startServer();
