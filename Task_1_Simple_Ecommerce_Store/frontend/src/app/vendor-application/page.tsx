
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

type VendorApplication = {
  id: string;
  storeName: string;
  description: string | null;
  applicationStatus: ApplicationStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

type ApplicationResponse = {
  application: VendorApplication | null;
};

export default function VendorApplicationPage() {
  const router = useRouter();

  const [token, setToken] = useState("");
  const [application, setApplication] =
    useState<VendorApplication | null>(null);
  const [storeName, setStoreName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadApplication = useCallback(async (accessToken: string) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/vendors/my-application`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          cache: "no-store",
        },
      );

      const result = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("markethub-access-token");
        localStorage.removeItem("markethub-user");
        router.replace("/account?next=%2Fvendor-application");
        return;
      }

      if (response.status === 403) {
        const userText = localStorage.getItem("markethub-user");
        const user = userText ? JSON.parse(userText) : null;

        if (user?.role === "VENDOR") {
          router.replace("/vendor");
          return;
        }

        if (user?.role === "ADMIN") {
          router.replace("/admin");
          return;
        }

        throw new Error("Your account cannot submit a vendor application.");
      }

      if (!response.ok) {
        throw new Error(
          typeof result.message === "string"
            ? result.message
            : "Unable to load your application.",
        );
      }

      const data = result as ApplicationResponse;
      setApplication(data.application);

      if (data.application) {
        setStoreName(data.application.storeName);
        setDescription(data.application.description || "");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your application.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const accessToken = localStorage.getItem("markethub-access-token");
    const storedUser = localStorage.getItem("markethub-user");

    if (!accessToken || !storedUser) {
      router.replace("/account?next=%2Fvendor-application");
      return;
    }

    try {
      const user = JSON.parse(storedUser);

      if (user.role === "VENDOR") {
        router.replace("/vendor");
        return;
      }

      if (user.role === "ADMIN") {
        router.replace("/admin");
        return;
      }

      if (user.role !== "CUSTOMER") {
        setError("Your account cannot submit a vendor application.");
        setLoading(false);
        return;
      }

      setToken(accessToken);
      void loadApplication(accessToken);
    } catch {
      localStorage.removeItem("markethub-access-token");
      localStorage.removeItem("markethub-user");
      router.replace("/account");
    }
  }, [loadApplication, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      router.replace("/account?next=%2Fvendor-application");
      return;
    }

    if (storeName.trim().length < 2) {
      setError("Store name must contain at least 2 characters.");
      return;
    }

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API_URL}/vendors/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeName: storeName.trim(),
          description: description.trim(),
        }),
      });

      const result = await response.json();

      if (response.status === 401) {
        localStorage.removeItem("markethub-access-token");
        localStorage.removeItem("markethub-user");
        router.replace("/account?next=%2Fvendor-application");
        return;
      }

      if (!response.ok) {
        throw new Error(
          typeof result.message === "string"
            ? result.message
            : "Unable to submit your application.",
        );
      }

      setApplication(result.application);
      setNotice(result.message || "Your application was submitted.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit your application.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("markethub-access-token");
    localStorage.removeItem("markethub-user");
    router.replace("/account");
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <p style={styles.muted}>Loading your vendor application...</p>
      </main>
    );
  }

  const isPending = application?.applicationStatus === "PENDING";
  const isApproved = application?.applicationStatus === "APPROVED";
  const isRejected = application?.applicationStatus === "REJECTED";

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <Link href="/" style={styles.brand}>
          market<span style={{ fontWeight: 400 }}>hub</span>
        </Link>
        <Link href="/" style={styles.backLink}>
          ← Back to marketplace
        </Link>
      </header>

      <section style={styles.content}>
        <span style={styles.eyebrow}>SELL ON MARKETHUB</span>
        <h1 style={styles.heading}>
          Bring your store to <span style={styles.accent}>MarketHub.</span>
        </h1>
        <p style={styles.intro}>
          Introduce your store to shoppers looking for independent brands,
          thoughtful products, and new discoveries.
        </p>

        {error && (
          <div role="alert" style={styles.error}>
            {error}
          </div>
        )}

        {notice && (
          <div role="status" style={styles.success}>
            {notice}
          </div>
        )}

        {isPending && (
          <div style={styles.statusCard}>
            <StatusBadge status="PENDING" />
            <h2>Application under review</h2>
            <p>
              Your application for <strong>{application.storeName}</strong> has
              been submitted. Our admin team will review your store details.
            </p>
            <p style={styles.muted}>
              Submitted:{" "}
              {new Date(application.createdAt).toLocaleString()}
            </p>
            <button
              type="button"
              onClick={() => void loadApplication(token)}
              style={styles.secondaryButton}
            >
              Refresh application status
            </button>
          </div>
        )}

        {isApproved && (
          <div style={styles.statusCard}>
            <StatusBadge status="APPROVED" />
            <h2>Your store has been approved!</h2>
            <p>
              Congratulations! <strong>{application.storeName}</strong> is
              approved to sell on MarketHub.
            </p>
            <p style={styles.muted}>
              Log out and sign in again to refresh your account permissions
              and access your vendor dashboard.
            </p>
            <button
              type="button"
              onClick={handleLogout}
              style={styles.primaryButton}
            >
              Log out and sign in again
            </button>
          </div>
        )}

        {(!application || isRejected) && (
          <form onSubmit={handleSubmit} style={styles.form}>
            {isRejected && (
              <div style={styles.rejectionCard}>
                <StatusBadge status="REJECTED" />
                <h2>Changes are needed</h2>
                <p>
                  Your previous application was not approved. Review the
                  feedback below and update your application before
                  resubmitting.
                </p>
                <strong>Admin feedback</strong>
                <p>
                  {application.rejectionReason ||
                    "No rejection reason was provided."}
                </p>
              </div>
            )}

            <h2 style={styles.formHeading}>
              {isRejected ? "Update your application" : "Tell us about your store"}
            </h2>

            <label style={styles.label}>
              Store name
              <input
                required
                minLength={2}
                maxLength={100}
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
                placeholder="e.g. The Everyday Studio"
                style={styles.input}
              />
            </label>

            <label style={styles.label}>
              Store description
              <textarea
                maxLength={1000}
                rows={5}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Tell us what you sell and what makes your store special..."
                style={styles.textarea}
              />
              <small style={styles.muted}>
                Maximum 1,000 characters.
              </small>
            </label>

            <button
              type="submit"
              disabled={submitting}
              style={styles.primaryButton}
            >
              {submitting
                ? "Submitting..."
                : isRejected
                  ? "Resubmit application"
                  : "Submit vendor application"}
            </button>

            <p style={styles.footnote}>
              Your application will be reviewed by a MarketHub administrator.
              Vendor access is granted only after approval.
            </p>
          </form>
        )}
      </section>

      <footer style={styles.footer}>
        MarketHub · Good finds start here.
      </footer>
    </main>
  );
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  const colors = {
    PENDING: { background: "#fef3c7", color: "#92400e" },
    APPROVED: { background: "#dcfce7", color: "#166534" },
    REJECTED: { background: "#fee2e2", color: "#991b1b" },
  };

  return (
    <span style={{ ...styles.badge, ...colors[status] }}>
      {status}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    color: "#0f172a",
    padding: "24px 5%",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    maxWidth: 1100,
    margin: "0 auto",
  },
  brand: {
    fontSize: 25,
    fontWeight: 700,
    color: "#0f172a",
    textDecoration: "none",
  },
  backLink: {
    color: "#475569",
    textDecoration: "none",
  },
  content: {
    maxWidth: 720,
    margin: "65px auto",
  },
  eyebrow: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 2,
  },
  heading: {
    fontSize: "clamp(34px, 6vw, 52px)",
    lineHeight: 1.12,
    margin: "14px 0",
  },
  accent: {
    color: "#b77946",
  },
  intro: {
    color: "#64748b",
    fontSize: 17,
    lineHeight: 1.7,
    marginBottom: 30,
  },
  form: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 28,
    display: "grid",
    gap: 20,
  },
  formHeading: {
    fontSize: 23,
    margin: 0,
  },
  label: {
    display: "grid",
    gap: 8,
    fontWeight: 600,
  },
  input: {
    width: "100%",
    padding: 13,
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    font: "inherit",
    background: "#fff",
    color: "#0f172a",
  },
  textarea: {
    width: "100%",
    padding: 13,
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    font: "inherit",
    resize: "vertical",
    background: "#fff",
    color: "#0f172a",
  },
  primaryButton: {
    padding: "14px 20px",
    border: "none",
    borderRadius: 10,
    background: "#172b3a",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "11px 16px",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    background: "#fff",
    cursor: "pointer",
  },
  footnote: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.6,
    margin: 0,
  },
  statusCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 28,
    display: "grid",
    gap: 14,
  },
  badge: {
    display: "inline-block",
    width: "fit-content",
    padding: "7px 12px",
    borderRadius: 30,
    fontSize: 12,
    fontWeight: 700,
  },
  rejectionCard: {
    background: "#fff7f7",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: 18,
    display: "grid",
    gap: 10,
  },
  error: {
    padding: 14,
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 9,
    marginBottom: 18,
  },
  success: {
    padding: 14,
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: 9,
    marginBottom: 18,
  },
  muted: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.6,
  },
  footer: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
    padding: 24,
  },
};
