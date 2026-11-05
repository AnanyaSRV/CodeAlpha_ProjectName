
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../database/database");

const router = express.Router();

// Register a new user.
router.post("/register", (req, res) => {
    try {
        const {
            username,
            email,
            password,
            fullName
        } = req.body;

        // Validate required fields.
        if (!username || !email || !password || !fullName) {
            return res.status(400).json({
                success: false,
                message: "Please fill in all required fields."
            });
        }

        const cleanUsername = username.trim().toLowerCase();
        const cleanEmail = email.trim().toLowerCase();
        const cleanFullName = fullName.trim();

        // Validate username.
        if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
            return res.status(400).json({
                success: false,
                message: "Username must be 3–20 characters and contain only letters, numbers, and underscores."
            });
        }

        // Validate email.
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        // Validate password.
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 8 characters."
            });
        }

        if (cleanFullName.length < 2 || cleanFullName.length > 60) {
            return res.status(400).json({
                success: false,
                message: "Full name must be between 2 and 60 characters."
            });
        }

        // Check whether username or email already exists.
        const existingUser = db.prepare(`
            SELECT id
            FROM users
            WHERE username = ? OR email = ?
        `).get(cleanUsername, cleanEmail);

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Username or email is already registered."
            });
        }

        // Hash the password.
        const hashedPassword = bcrypt.hashSync(password, 12);

        // Save the new user.
        const result = db.prepare(`
            INSERT INTO users (
                username,
                email,
                password,
                full_name
            )
            VALUES (?, ?, ?, ?)
        `).run(
            cleanUsername,
            cleanEmail,
            hashedPassword,
            cleanFullName
        );

        const user = {
            id: result.lastInsertRowid,
            username: cleanUsername,
            email: cleanEmail,
            fullName: cleanFullName
        };

        // Start a logged-in session.
        req.session.regenerate((error) => {
            if (error) {
                console.error("Session error:", error);

                return res.status(500).json({
                    success: false,
                    message: "Account created, but login could not be started."
                });
            }

            req.session.userId = user.id;

            req.session.save((saveError) => {
                if (saveError) {
                    console.error("Session save error:", saveError);

                    return res.status(500).json({
                        success: false,
                        message: "Account created, but login could not be started."
                    });
                }

                return res.status(201).json({
                    success: true,
                    message: "Welcome to Folio! Your account has been created.",
                    user
                });
            });
        });

    } catch (error) {
        console.error("Registration error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to create your account."
        });
    }
});


// Log in an existing user.
router.post("/login", (req, res) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: "Please enter your username/email and password."
            });
        }

        const cleanIdentifier = identifier.trim().toLowerCase();

        const user = db.prepare(`
            SELECT id, username, email, password, full_name
            FROM users
            WHERE username = ? OR email = ?
        `).get(cleanIdentifier, cleanIdentifier);

        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({
                success: false,
                message: "Incorrect username/email or password."
            });
        }

        req.session.regenerate((error) => {
            if (error) {
                console.error("Session error:", error);

                return res.status(500).json({
                    success: false,
                    message: "Unable to start your session."
                });
            }

            req.session.userId = user.id;

            req.session.save((saveError) => {
                if (saveError) {
                    console.error("Session save error:", saveError);

                    return res.status(500).json({
                        success: false,
                        message: "Unable to save your session."
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "Login successful. Welcome back!",
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        fullName: user.full_name
                    }
                });
            });
        });

    } catch (error) {
        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to log in."
        });
    }
});


// Get the currently logged-in user.
router.get("/me", (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({
                success: false,
                message: "You are not logged in."
            });
        }

        const user = db.prepare(`
            SELECT
                id,
                username,
                email,
                full_name,
                bio,
                profile_image,
                created_at
            FROM users
            WHERE id = ?
        `).get(req.session.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User account not found."
            });
        }

        res.status(200).json({
            success: true,
            user
        });

    } catch (error) {
        console.error("User retrieval error:", error);

        res.status(500).json({
            success: false,
            message: "Unable to retrieve user information."
        });
    }
});


// Log out the current user.
router.post("/logout", (req, res) => {
    if (!req.session) {
        return res.status(200).json({
            success: true,
            message: "You are already logged out."
        });
    }

    req.session.destroy((error) => {
        if (error) {
            console.error("Logout error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to log out."
            });
        }

        res.clearCookie("folio.sid");

        res.status(200).json({
            success: true,
            message: "You have been logged out successfully."
        });
    });
});

module.exports = router;
