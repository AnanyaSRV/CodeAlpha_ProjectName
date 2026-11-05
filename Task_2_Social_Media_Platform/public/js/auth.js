
document.addEventListener("DOMContentLoaded", () => {
    const registerForm = document.getElementById("registerForm");
    const loginForm = document.getElementById("loginForm");

    const message = document.getElementById("formMessage");

    // Show or hide passwords.
    document.querySelectorAll(".password-toggle").forEach(button => {
        button.addEventListener("click", () => {
            const input = document.getElementById(button.dataset.target);

            if (!input) return;

            const isPassword = input.type === "password";

            input.type = isPassword ? "text" : "password";
            button.textContent = isPassword ? "Hide" : "Show";
        });
    });

    function showMessage(text, type) {
        if (!message) return;

        message.textContent = text;
        message.className = `form-message show ${type}`;
    }

    function setLoading(button, loading, originalText) {
        button.disabled = loading;
        button.textContent = loading ? "Please wait..." : originalText;
    }

    // Registration.
    if (registerForm) {
        registerForm.addEventListener("submit", async event => {
            event.preventDefault();

            const button = document.getElementById("registerButton");
            const originalText = "Create my account ↗";

            const fullName = document.getElementById("fullName").value.trim();
            const username = document.getElementById("username").value.trim();
            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value;

            if (password.length < 8) {
                showMessage("Password must contain at least 8 characters.", "error");
                return;
            }

            setLoading(button, true, originalText);

            try {
                const response = await fetch("/api/auth/register", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "same-origin",
                    body: JSON.stringify({
                        fullName,
                        username,
                        email,
                        password
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || "Registration failed.");
                }

                showMessage("Account created! Welcome to Folio.", "success");

                registerForm.reset();

                setTimeout(() => {
                    window.location.href = "/";
                }, 1000);

            } catch (error) {
                showMessage(error.message, "error");
            } finally {
                setLoading(button, false, originalText);
            }
        });
    }

    // Login.
    if (loginForm) {
        loginForm.addEventListener("submit", async event => {
            event.preventDefault();

            const button = document.getElementById("loginButton");
            const originalText = "Log in to Folio ↗";

            const identifier = document.getElementById("identifier").value.trim();
            const password = document.getElementById("password").value;

            setLoading(button, true, originalText);

            try {
                const response = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "same-origin",
                    body: JSON.stringify({
                        identifier,
                        password
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || "Login failed.");
                }

                showMessage("Login successful! Welcome back.", "success");

                setTimeout(() => {
                    window.location.href = "/";
                }, 800);

            } catch (error) {
                showMessage(error.message, "error");
            } finally {
                setLoading(button, false, originalText);
            }
        });
    }
});
