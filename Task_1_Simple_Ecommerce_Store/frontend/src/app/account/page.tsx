"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

type UserRole = "CUSTOMER" | "VENDOR" | "DELIVERY" | "ADMIN";

type AccountUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

type AuthResponse = {
  message?: string | string[];
  accessToken?: string;
  user?: AccountUser;
};

function AccountContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");

  const destination =
    nextPath?.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/account";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [currentUser, setCurrentUser] = useState<AccountUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("markethub-access-token");
    const savedUser = localStorage.getItem("markethub-user");

    if (token && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as AccountUser;

        if (
          parsedUser &&
          parsedUser.id &&
          parsedUser.name &&
          parsedUser.email &&
          parsedUser.role
        ) {
          if (parsedUser.role !== "CUSTOMER") {
            const roleDestination =
              parsedUser.role === "ADMIN"
                ? "/admin"
                : parsedUser.role === "VENDOR"
                  ? "/vendor"
                  : "/delivery";

            router.replace(roleDestination);
          } else {
            setCurrentUser(parsedUser);
          }
        }
      } catch {
        localStorage.removeItem("markethub-user");
      }
    }

    setCheckingSession(false);
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const endpoint = mode === "login" ? "login" : "register";

      const payload =
        mode === "login"
          ? { email, password }
          : { name, email, password };

      const response = await fetch(`${API_URL}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result: AuthResponse = await response.json();

      if (!response.ok) {
        const message = result.message;

        throw new Error(
          Array.isArray(message)
            ? message.join(" ")
            : message || "Unable to process your account request."
        );
      }

      if (mode === "register") {
        setMode("login");
        setPassword("");
        setNotice("Account created! Log in with your new customer account.");
        return;
      }

      if (!result.accessToken || !result.user) {
        throw new Error("The server returned an incomplete login response.");
      }

      if (
        result.user.role !== "CUSTOMER" &&
        result.user.role !== "VENDOR" &&
        result.user.role !== "DELIVERY" &&
        result.user.role !== "ADMIN"
      ) {
        throw new Error(
          "This account does not have an available MarketHub portal."
        );
      }

      localStorage.setItem("markethub-access-token", result.accessToken);
      localStorage.setItem("markethub-user", JSON.stringify(result.user));

      let roleDestination: string;

      switch (result.user.role) {
        case "ADMIN":
          roleDestination = "/admin";
          break;

        case "VENDOR":
          roleDestination = "/vendor";
          break;

        case "DELIVERY":
          roleDestination = "/delivery";
          break;

        case "CUSTOMER":
        default:
          roleDestination = destination;
          break;
      }

      if (result.user.role === "CUSTOMER" && roleDestination === "/account") {
        setCurrentUser(result.user);
      } else {
        router.replace(roleDestination);
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("markethub-access-token");
    localStorage.removeItem("markethub-user");

    setCurrentUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setMode("login");
    setError("");
    setNotice("You have successfully logged out.");

    router.replace("/account");
    router.refresh();
  }

  if (checkingSession) {
    return (
      <main className="detail-page">
        <p className="detail-status">Loading your account...</p>
      </main>
    );
  }

  if (currentUser) {
    return (
      <main className="detail-page">
        <header className="detail-header">
          <Link href="/" className="detail-brand">
            MarketHub
          </Link>

          <button
            type="button"
            className="secondary-button"
            onClick={handleLogout}
          >
            Log out
          </button>
        </header>

        <section
          style={{
            maxWidth: 850,
            margin: "48px auto",
            padding: 28,
          }}
        >
          <p className="detail-eyebrow">YOUR MARKETHUB ACCOUNT</p>

          <h1 style={{ fontSize: 34, margin: "10px 0" }}>
            Welcome back, {currentUser.name}!
          </h1>

          <p style={{ color: "#64748b", marginBottom: 28 }}>
            Manage your purchases, track deliveries, and continue shopping.
          </p>

          <div
            style={{
              padding: 22,
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              background: "#fff",
              marginBottom: 24,
            }}
          >
            <h2 style={{ fontSize: 19, marginBottom: 16 }}>
              Account information
            </h2>

            <p style={{ marginBottom: 10 }}>
              <strong>Name:</strong> {currentUser.name}
            </p>

            <p style={{ marginBottom: 10, overflowWrap: "anywhere" }}>
              <strong>Email:</strong> {currentUser.email}
            </p>

            <p>
              <strong>Account type:</strong> Customer
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
            }}
          >
            <Link
              href="/my-orders"
              style={{
                display: "block",
                padding: 24,
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                background: "#fff",
                color: "#111827",
                textDecoration: "none",
              }}
            >
              <div style={{ fontSize: 30, marginBottom: 12 }}>📦</div>

              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                My Orders
              </h2>

              <p style={{ fontSize: 14, color: "#64748b" }}>
                View previous purchases, check payment status, and track
                deliveries.
              </p>

              <p
                style={{
                  color: "#166534",
                  fontWeight: 700,
                  marginTop: 16,
                  fontSize: 14,
                }}
              >
                View order history →
              </p>
            </Link>

            <Link
              href="/"
              style={{
                display: "block",
                padding: 24,
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                background: "#fff",
                color: "#111827",
                textDecoration: "none",
              }}
            >
              <div style={{ fontSize: 30, marginBottom: 12 }}>🛍️</div>

              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                Continue Shopping
              </h2>

              <p style={{ fontSize: 14, color: "#64748b" }}>
                Explore products and discover independent stores on
                MarketHub.
              </p>

              <p
                style={{
                  color: "#166534",
                  fontWeight: 700,
                  marginTop: 16,
                  fontSize: 14,
                }}
              >
                Explore marketplace →
              </p>
            </Link>

            <Link
              href="/cart"
              style={{
                display: "block",
                padding: 24,
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                background: "#fff",
                color: "#111827",
                textDecoration: "none",
              }}
            >
              <div style={{ fontSize: 30, marginBottom: 12 }}>🛒</div>

              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
                Shopping Cart
              </h2>

              <p style={{ fontSize: 14, color: "#64748b" }}>
                Review the products in your cart and proceed to checkout.
              </p>

              <p
                style={{
                  color: "#166534",
                  fontWeight: 700,
                  marginTop: 16,
                  fontSize: 14,
                }}
              >
                Open cart →
              </p>
            </Link>
          </div>

          <div style={{ marginTop: 28, textAlign: "center" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={handleLogout}
            >
              Log out of MarketHub
            </button>
          </div>
        </section>

        <footer className="detail-footer">
          <span>MarketHub</span>
          <span>Good finds start here.</span>
        </footer>
      </main>
    );
  }

  return (
    <main className="detail-page">
      <header className="detail-header">
        <Link href="/" className="detail-brand">
          MarketHub
        </Link>

        <Link href="/" className="back-link">
          ← Continue shopping
        </Link>
      </header>

      <section
        style={{
          maxWidth: 480,
          margin: "48px auto",
          padding: 28,
          border: "1px solid #e5e7eb",
          borderRadius: 20,
          background: "#fff",
        }}
      >
        <p className="detail-eyebrow">WELCOME TO MARKETHUB</p>

        <h1 style={{ fontSize: 32, margin: "10px 0" }}>
          {mode === "login" ? "Welcome back." : "Create your account."}
        </h1>

        <p style={{ color: "#64748b", marginBottom: 24 }}>
          {mode === "login"
            ? "Sign in to continue shopping or manage your MarketHub account."
            : "Create a customer account to shop from independent stores."}
        </p>

        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setMode("login");
              setError("");
              setNotice("");
            }}
            disabled={loading}
          >
            Log in
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setMode("register");
              setError("");
              setNotice("");
            }}
            disabled={loading}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          {mode === "register" && (
            <label style={{ display: "grid", gap: 6 }}>
              Full name

              <input
                required
                minLength={2}
                maxLength={80}
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                style={fieldStyle}
              />
            </label>
          )}

          <label style={{ display: "grid", gap: 6 }}>
            Email address

            <input
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              style={fieldStyle}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            Password

            <input
              required
              type="password"
              minLength={8}
              maxLength={72}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              style={fieldStyle}
            />

            {mode === "register" && (
              <small style={{ color: "#64748b" }}>
                Use at least 8 characters.
              </small>
            )}
          </label>

          {error && (
            <p role="alert" style={{ color: "#b91c1c" }}>
              {error}
            </p>
          )}

          {notice && (
            <p role="status" style={{ color: "#166534" }}>
              {notice}
            </p>
          )}

          <button
            type="submit"
            className="cart-primary-button"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Log in"
                : "Create customer account"}
          </button>
        </form>

        {mode === "login" && (
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 20 }}>
            Customer, vendor, delivery partner and administrator accounts
            are directed to their respective MarketHub portals after login.
            Vendor and delivery partner access is assigned by MarketHub,
            not through customer registration.
          </p>
        )}
      </section>

      <footer className="detail-footer">
        <span>MarketHub</span>
        <span>Good finds start here.</span>
      </footer>
    </main>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  background: "#fff",
  color: "#111827",
};

export default function AccountPage() {
  return (
    <Suspense
      fallback={<main className="detail-page">Loading account...</main>}
    >
      <AccountContent />
    </Suspense>
  );
}