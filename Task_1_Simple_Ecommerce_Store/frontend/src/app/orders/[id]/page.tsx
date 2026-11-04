"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCart } from "../../../context/CartContext";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

type OrderData = {
  id: string;
  total: number;
  status: string;
  paymentStatus: string;
  paymentExpiresAt: string | null;
  createdAt: string;
  deliveryAssignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  deliveryPartner: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type PaymentConfig = {
  keyId: string;
  currency: string;
};

type RazorpayOrderResponse = {
  orderId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
};

type RazorpaySuccessResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type VerifyResponse = {
  success: boolean;
  message: string;
  orderId: string;
  paymentStatus: string;
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

async function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return true;

  return new Promise((resolve) => {
    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () =>
        resolve(!!window.Razorpay)
      );
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
    // Use the fallback below.
  }

  return "Something went wrong. Please try again.";
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(price);
}

function formatDate(value: string | null) {
  if (!value) return "Awaiting update";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Awaiting update";

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function TrackingStep({
  title,
  description,
  completed,
  timestamp,
  last,
}: {
  title: string;
  description: string;
  completed: boolean;
  timestamp: string | null;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        position: "relative",
        minHeight: last ? 58 : 90,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 24,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: completed ? "#16a34a" : "#e2e8f0",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            zIndex: 1,
          }}
        >
          {completed ? "✓" : ""}
        </div>

        {!last && (
          <div
            style={{
              width: 2,
              flex: 1,
              minHeight: 55,
              background: completed ? "#16a34a" : "#e2e8f0",
            }}
          />
        )}
      </div>

      <div style={{ paddingBottom: 20, textAlign: "left" }}>
        <p
          style={{
            fontWeight: 700,
            color: completed ? "#166534" : "#64748b",
            marginBottom: 4,
          }}
        >
          {title}
        </p>

        <p
          style={{
            fontSize: 13,
            color: "#64748b",
            marginBottom: 4,
          }}
        >
          {description}
        </p>

        <p style={{ fontSize: 12, color: "#94a3b8" }}>
          {completed ? formatDate(timestamp) : "Pending"}
        </p>
      </div>
    </div>
  );
}

function OrderConfirmationContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { clearCart } = useCart();

  const orderId = params.id;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadOrder = useCallback(async () => {
    const token = localStorage.getItem("markethub-access-token");

    if (!token) {
      router.replace("/account");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/orders/my`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const orders = (await response.json()) as OrderData[];

      const matchingOrder = orders.find(
        (item) => item.id === orderId
      );

      if (!matchingOrder) {
        throw new Error(
          "This order could not be found in your customer account."
        );
      }

      setOrder(matchingOrder);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your order."
      );
    } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  async function refreshOrder() {
    setRefreshing(true);
    await loadOrder();
    setRefreshing(false);
  }

  async function retryPayment() {
    const token = localStorage.getItem("markethub-access-token");

    if (!token || !order) {
      router.replace("/account");
      return;
    }

    setError("");
    setNotice("");
    setRetrying(true);

    try {
      if (
        !order.paymentExpiresAt ||
        new Date(order.paymentExpiresAt).getTime() <= Date.now()
      ) {
        throw new Error(
          "The payment window has expired. Please place a new order."
        );
      }

      const scriptLoaded = await loadRazorpayScript();

      if (!scriptLoaded || !window.Razorpay) {
        throw new Error(
          "Unable to load Razorpay Checkout. Check your internet connection."
        );
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

      const config =
        (await configResponse.json()) as PaymentConfig;

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

      if (!paymentOrder.razorpayOrderId || !paymentOrder.amount) {
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
          name: "",
          email: "",
          contact: "",
        },
        theme: {
          color: "#111827",
        },
        handler: async (paymentResponse) => {
          try {
            const verifyResponse = await fetch(
              `${API_URL}/payments/verify`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(paymentResponse),
              }
            );

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
            await loadOrder();

            setNotice("Your payment has been verified successfully.");
            setError("");
          } catch (err) {
            setError(
              err instanceof Error
                ? `${err.message} If money was deducted, contact support with your payment reference.`
                : "Payment verification failed. Contact support if money was deducted."
            );

            await loadOrder();
          } finally {
            setRetrying(false);
          }
        },
        modal: {
          ondismiss: () => {
            setNotice(
              "Payment was not completed. You can retry while the payment window is active."
            );
            setRetrying(false);
          },
        },
      });

      razorpay.on("payment.failed", (response) => {
        setError(
          response.error?.description || "Payment was not completed."
        );
        setRetrying(false);
      });

      razorpay.open();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to start payment. Please try again."
      );
      setRetrying(false);
    }
  }

  const isPaid = order?.paymentStatus === "PAID";
  const isCancelled = order?.status === "CANCELLED";

  const paymentExpired =
    !order?.paymentExpiresAt ||
    new Date(order.paymentExpiresAt).getTime() <= Date.now();

  const canRetry =
    !!order &&
    order.paymentStatus === "PENDING" &&
    !isCancelled &&
    !paymentExpired;

  const shippedStatuses = [
    "SHIPPED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ];

  const outForDeliveryStatuses = [
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ];

  const isShipped = !!order && shippedStatuses.includes(order.status);
  const isOutForDelivery =
    !!order && outForDeliveryStatuses.includes(order.status);
  const isDelivered = order?.status === "DELIVERED";

  return (
    <main className="detail-page">
      <header className="detail-header">
        <Link href="/" className="detail-brand">
          MarketHub
        </Link>

        <Link href="/" className="back-link">
          Continue shopping
        </Link>
      </header>

      <section
        style={{
          maxWidth: 680,
          margin: "60px auto",
          padding: 32,
          border: "1px solid #e5e7eb",
          borderRadius: 20,
          background: "#fff",
          textAlign: "center",
        }}
      >
        {loading ? (
          <p className="detail-status">Loading order confirmation...</p>
        ) : !order ? (
          <>
            <p className="detail-eyebrow">ORDER INFORMATION</p>

            <h1 style={{ fontSize: 28, margin: "12px 0" }}>
              Unable to load order
            </h1>

            <p style={{ color: "#b91c1c", marginBottom: 24 }}>
              {error}
            </p>

            <Link href="/my-orders" className="cart-primary-button">
              View my orders
            </Link>
          </>
        ) : (
          <>
            <div
              style={{ fontSize: 48, marginBottom: 12 }}
              aria-hidden="true"
            >
              {isPaid ? "✓" : isCancelled ? "!" : "⌛"}
            </div>

            <p className="detail-eyebrow">
              {isPaid
                ? "PAYMENT CONFIRMED"
                : isCancelled
                  ? "ORDER CANCELLED"
                  : "ORDER RECEIVED"}
            </p>

            <h1 style={{ fontSize: 32, margin: "12px 0" }}>
              {isPaid
                ? "Thank you for your order!"
                : isCancelled
                  ? "This order was cancelled"
                  : "Your order is awaiting payment"}
            </h1>

            <p style={{ color: "#64748b", marginBottom: 20 }}>
              {isPaid
                ? "Your payment was successfully verified. Your order has been received."
                : isCancelled
                  ? "This order is no longer available for payment. You can place a new order from the marketplace."
                  : paymentExpired
                    ? "The payment window has expired. Please place a new order."
                    : "Your order has been created, but payment has not yet been confirmed. Complete payment before the payment window expires."}
            </p>

            {/* Order information */}
            <div
              style={{
                padding: 20,
                marginBottom: 24,
                borderRadius: 12,
                background: "#f8fafc",
                textAlign: "left",
              }}
            >
              <p style={{ marginBottom: 8 }}>Order reference</p>

              <p
                style={{
                  fontWeight: 700,
                  overflowWrap: "anywhere",
                  marginBottom: 18,
                }}
              >
                {order.id}
              </p>

              <p style={{ marginBottom: 8 }}>
                <strong>Order status:</strong> {order.status}
              </p>

              <p style={{ marginBottom: 8 }}>
                <strong>Payment status:</strong>{" "}
                <span
                  style={{
                    color: isPaid
                      ? "#15803d"
                      : isCancelled
                        ? "#b91c1c"
                        : "#b45309",
                    fontWeight: 700,
                  }}
                >
                  {order.paymentStatus}
                </span>
              </p>

              <p style={{ marginBottom: 8 }}>
                <strong>Order total:</strong>{" "}
                {formatPrice(Number(order.total))}
              </p>

              {order.paymentExpiresAt && !isPaid && (
                <p style={{ fontSize: 13, color: "#64748b" }}>
                  Payment deadline:{" "}
                  {formatDate(order.paymentExpiresAt)}
                </p>
              )}

              <p style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>
                Order placed: {formatDate(order.createdAt)}
              </p>
            </div>

            {/* Customer order tracking */}
            {isPaid && !isCancelled && (
              <div
                style={{
                  padding: 22,
                  marginBottom: 24,
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  background: "#fff",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 24,
                  }}
                >
                  <div>
                    <p className="detail-eyebrow">DELIVERY UPDATES</p>
                    <h2 style={{ fontSize: 22, marginTop: 6 }}>
                      Track your order
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={refreshOrder}
                    disabled={refreshing}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      padding: "9px 14px",
                      background: "#fff",
                      color: "#334155",
                      cursor: refreshing ? "wait" : "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {refreshing ? "Refreshing..." : "↻ Refresh"}
                  </button>
                </div>

                <TrackingStep
                  title="Order confirmed"
                  description="Your payment has been verified and your order is confirmed."
                  completed={true}
                  timestamp={order.createdAt}
                />

                <TrackingStep
                  title="Shipped by vendor"
                  description="Your items have been shipped and are ready for delivery."
                  completed={isShipped}
                  timestamp={order.deliveryAssignedAt}
                />

                <TrackingStep
                  title="Out for delivery"
                  description="Your delivery partner is on the way."
                  completed={isOutForDelivery}
                  timestamp={order.pickedUpAt}
                />

                <TrackingStep
                  title="Delivered"
                  description="Your order has been successfully delivered."
                  completed={isDelivered}
                  timestamp={order.deliveredAt}
                  last={true}
                />

                {/* Delivery partner details */}
                <div
                  style={{
                    marginTop: 12,
                    padding: 16,
                    borderRadius: 10,
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <h3 style={{ fontSize: 16, marginBottom: 10 }}>
                    Delivery partner
                  </h3>

                  {order.deliveryPartner ? (
                    <>
                      <p style={{ marginBottom: 6, fontWeight: 700 }}>
                        {order.deliveryPartner.name}
                      </p>

                      <p
                        style={{
                          color: "#64748b",
                          fontSize: 13,
                          overflowWrap: "anywhere",
                        }}
                      >
                        {order.deliveryPartner.email}
                      </p>

                      {order.deliveryAssignedAt && (
                        <p
                          style={{
                            color: "#64748b",
                            fontSize: 12,
                            marginTop: 10,
                          }}
                        >
                          Assigned: {formatDate(order.deliveryAssignedAt)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p style={{ color: "#64748b", fontSize: 13 }}>
                      A delivery partner will be assigned after the vendor
                      ships your items.
                    </p>
                  )}
                </div>

                <p
                  style={{
                    color: "#94a3b8",
                    fontSize: 12,
                    marginTop: 16,
                    textAlign: "center",
                  }}
                >
                  Refresh to check for the latest delivery updates.
                </p>
              </div>
            )}

            {notice && (
              <p
                role="status"
                style={{
                  color: "#15803d",
                  marginBottom: 20,
                }}
              >
                {notice}
              </p>
            )}

            {error && (
              <p
                role="alert"
                style={{
                  color: "#b91c1c",
                  marginBottom: 20,
                }}
              >
                {error}
              </p>
            )}

            {canRetry && (
              <button
                type="button"
                className="cart-primary-button"
                onClick={retryPayment}
                disabled={retrying}
                style={{
                  width: "100%",
                  marginBottom: 12,
                  cursor: retrying ? "wait" : "pointer",
                }}
              >
                {retrying ? "Preparing payment..." : "Retry payment"}
              </button>
            )}

            <Link href="/" className="cart-primary-button">
              Continue shopping
            </Link>
          </>
        )}
      </section>

      <footer className="detail-footer">
        <span>MarketHub</span>
        <span>Good finds start here.</span>
      </footer>
    </main>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense
      fallback={
        <main className="detail-page">
          <p className="detail-status">
            Loading order confirmation...
          </p>
        </main>
      }
    >
      <OrderConfirmationContent />
    </Suspense>
  );
}