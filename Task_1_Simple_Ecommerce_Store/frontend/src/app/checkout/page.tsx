
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useCart } from "../../context/CartContext";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

type CheckoutForm = {
  shippingName: string;
  shippingPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  contactEmail: string;
};

type OrderResponse = {
  id: string;
  total: number;
  status: string;
  paymentStatus: string;
};

type RazorpayOrderResponse = {
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
};

type PaymentConfig = {
  keyId: string;
  currency: string;
};

type VerifyResponse = {
  success: boolean;
  message: string;
  orderId: string;
  paymentStatus: string;
};

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  theme: {
    color: string;
  };
  handler: (response: RazorpaySuccessResponse) => Promise<void>;
  modal: {
    ondismiss: () => void;
  };
};

declare global {
  interface Window {
    Razorpay?: new (
      options: RazorpayOptions
    ) => {
      open: () => void;
      on: (
        event: string,
        callback: (response: {
          error?: {
            description?: string;
            reason?: string;
          };
        }) => void
      ) => void;
    };
  }
}

const initialForm: CheckoutForm = {
  shippingName: "",
  shippingPhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  contactEmail: "",
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  background: "#fff",
  color: "#111827",
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(price);
}

async function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return true;

  return new Promise((resolve) => {
    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(!!window.Razorpay));
      existingScript.addEventListener("error", () => resolve(false));

      if (window.Razorpay) resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;

    script.onload = () => resolve(!!window.Razorpay);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
}

async function readApiError(response: Response): Promise<string> {
  try {
    const result = await response.json();
    const message = result.message;

    if (Array.isArray(message)) return message.join(" ");
    if (typeof message === "string") return message;
  } catch {
    // Use the fallback message below.
  }

  return "Something went wrong. Please try again.";
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, ready, subtotal, clearCart } = useCart();

  const [form, setForm] = useState<CheckoutForm>(initialForm);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!ready) return;

    const token = localStorage.getItem("markethub-access-token");

    if (!token) {
      router.replace("/account?next=/checkout");
      return;
    }

    let cancelled = false;

    async function verifyCustomer() {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (!response.ok) {
          localStorage.removeItem("markethub-access-token");
          localStorage.removeItem("markethub-user");

          if (!cancelled) router.replace("/account?next=/checkout");
          return;
        }

        const user = await response.json();

        if (user.role !== "CUSTOMER") {
          if (!cancelled) {
            setError(
              "Checkout is available to customer accounts only. Log out and sign in with a CUSTOMER account."
            );
          }
          return;
        }

        if (!cancelled) {
          setForm((current) => ({
            ...current,
            contactEmail: user.email || "",
          }));
        }
      } catch {
        if (!cancelled) {
          setError(
            "Unable to verify your account. Check that the backend is running."
          );
        }
      } finally {
        if (!cancelled) setCheckingAuth(false);
      }
    }

    void verifyCustomer();

    return () => {
      cancelled = true;
    };
  }, [ready, router]);

  function updateField(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const token = localStorage.getItem("markethub-access-token");

    if (!token) {
      router.push("/account?next=/checkout");
      return;
    }

    if (items.length === 0) {
      setError("Your cart is empty. Add a product before checking out.");
      return;
    }

    setSubmitting(true);

    try {
      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error(
          "Unable to load Razorpay Checkout. Check your internet connection and try again."
        );
      }

      const orderResponse = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          items: items.map(({ product, quantity }) => ({
            productId: product.id,
            quantity,
          })),
        }),
      });

      if (!orderResponse.ok) {
        throw new Error(await readApiError(orderResponse));
      }

      const order = (await orderResponse.json()) as OrderResponse;

      if (!order.id) {
        throw new Error("The server did not return an order ID.");
      }

      const configResponse = await fetch(`${API_URL}/payments/config`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!configResponse.ok) {
        throw new Error(await readApiError(configResponse));
      }

      const config = (await configResponse.json()) as PaymentConfig;

      const paymentOrderResponse = await fetch(
        `${API_URL}/payments/create-order/${encodeURIComponent(order.id)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!paymentOrderResponse.ok) {
        throw new Error(await readApiError(paymentOrderResponse));
      }

      const paymentOrder =
        (await paymentOrderResponse.json()) as RazorpayOrderResponse;

      if (
        !paymentOrder.razorpayOrderId ||
        !paymentOrder.amount ||
        !paymentOrder.keyId
      ) {
        throw new Error("The server returned incomplete payment details.");
      }

      const razorpay = new window.Razorpay({
        key: paymentOrder.keyId || config.keyId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency || config.currency || "INR",
        name: "MarketHub",
        description: `Payment for order ${order.id}`,
        order_id: paymentOrder.razorpayOrderId,
        prefill: {
          name: form.shippingName,
          email: form.contactEmail,
          contact: form.shippingPhone,
        },
        theme: {
          color: "#111827",
        },
        handler: async (paymentResponse) => {
          try {
            const verifyResponse = await fetch(`${API_URL}/payments/verify`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(paymentResponse),
            });

            if (!verifyResponse.ok) {
              throw new Error(await readApiError(verifyResponse));
            }

            const verification =
              (await verifyResponse.json()) as VerifyResponse;

            if (
              !verification.success ||
              verification.paymentStatus !== "PAID"
            ) {
              throw new Error("Payment could not be verified.");
            }

            clearCart();

            router.replace(
              `/orders/${encodeURIComponent(order.id)}?payment=success`
            );
          } catch (verificationError) {
            const message =
              verificationError instanceof Error
                ? verificationError.message
                : "Payment verification failed.";

            router.replace(
              `/orders/${encodeURIComponent(order.id)}?payment=verification_pending`
            );

            console.error("MarketHub payment verification:", message);
          }
        },
        modal: {
          ondismiss: () => {
            router.replace(
              `/orders/${encodeURIComponent(order.id)}?payment=pending`
            );
          },
        },
      });

      razorpay.on("payment.failed", (response) => {
        const description =
          response.error?.description || "Payment was not completed.";

        setError(description);
      });

      razorpay.open();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while placing your order."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || checkingAuth) {
    return (
      <main className="cart-page">
        <p>Preparing checkout...</p>
      </main>
    );
  }

  return (
    <main className="cart-page">
      <header className="cart-page-header">
        <Link href="/" className="detail-brand">
          MarketHub
        </Link>
        <Link href="/cart" className="back-link">
          ← Back to cart
        </Link>
      </header>

      <section className="cart-main">
        <p className="detail-eyebrow">ALMOST YOURS</p>
        <h1>Checkout</h1>

        <p style={{ color: "#64748b", marginBottom: 24 }}>
          Enter your delivery details and complete your payment securely.
        </p>

        {error && (
          <div role="alert" className="state-panel error-panel">
            <p>{error}</p>

            {error.includes("CUSTOMER account") && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  localStorage.removeItem("markethub-access-token");
                  localStorage.removeItem("markethub-user");
                  router.push("/account?next=/checkout");
                }}
              >
                Switch account
              </button>
            )}
          </div>
        )}

        {items.length === 0 ? (
          <div className="cart-empty">
            <h2>Your cart is empty.</h2>
            <p>Add something from the marketplace to begin checkout.</p>
            <Link href="/" className="cart-primary-button">
              Explore products
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(260px, 0.8fr)",
              gap: 28,
              alignItems: "start",
            }}
          >
            <form
              onSubmit={handleSubmit}
              style={{
                display: "grid",
                gap: 18,
                padding: 24,
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                background: "#fff",
              }}
            >
              <h2>Delivery information</h2>

              <label style={{ display: "grid", gap: 6 }}>
                Full name
                <input
                  required
                  name="shippingName"
                  maxLength={100}
                  autoComplete="name"
                  value={form.shippingName}
                  onChange={updateField}
                  style={fieldStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                Phone number
                <input
                  required
                  name="shippingPhone"
                  type="tel"
                  maxLength={30}
                  autoComplete="tel"
                  value={form.shippingPhone}
                  onChange={updateField}
                  style={fieldStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                Address line 1
                <input
                  required
                  name="addressLine1"
                  maxLength={200}
                  autoComplete="address-line1"
                  value={form.addressLine1}
                  onChange={updateField}
                  style={fieldStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                Address line 2 (optional)
                <input
                  name="addressLine2"
                  maxLength={200}
                  autoComplete="address-line2"
                  value={form.addressLine2}
                  onChange={updateField}
                  style={fieldStyle}
                />
              </label>

              <div className="checkout-field-grid">
                <label style={{ display: "grid", gap: 6 }}>
                  City
                  <input
                    required
                    name="city"
                    maxLength={100}
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={updateField}
                    style={fieldStyle}
                  />
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  State
                  <input
                    required
                    name="state"
                    maxLength={100}
                    autoComplete="address-level1"
                    value={form.state}
                    onChange={updateField}
                    style={fieldStyle}
                  />
                </label>
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                PIN / postal code
                <input
                  required
                  name="postalCode"
                  maxLength={20}
                  autoComplete="postal-code"
                  value={form.postalCode}
                  onChange={updateField}
                  style={fieldStyle}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                Contact email (optional)
                <input
                  name="contactEmail"
                  type="email"
                  maxLength={254}
                  autoComplete="email"
                  value={form.contactEmail}
                  onChange={updateField}
                  style={fieldStyle}
                />
              </label>

              <button
                type="submit"
                className="cart-primary-button"
                disabled={submitting || checkingAuth}
              >
                {submitting ? "Preparing secure payment..." : "Pay securely"}
              </button>

              <p style={{ color: "#64748b", fontSize: 13 }}>
                Payments are processed securely through Razorpay. Your order
                will be confirmed after the server verifies your payment.
              </p>
            </form>

            <aside
              style={{
                padding: 24,
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                background: "#fff",
              }}
            >
              <h2>Order summary</h2>

              {items.map(({ product, quantity }) => (
                <div
                  key={product.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "14px 0",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <span>
                    {product.name} × {quantity}
                  </span>
                  <strong>
                    {formatPrice(Number(product.price) * quantity)}
                  </strong>
                </div>
              ))}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  paddingTop: 18,
                  fontSize: 18,
                }}
              >
                <strong>Subtotal</strong>
                <strong>{formatPrice(subtotal)}</strong>
              </div>

              <p style={{ color: "#64748b", fontSize: 13, marginTop: 12 }}>
                Shipping charges are not included in this MVP.
              </p>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
