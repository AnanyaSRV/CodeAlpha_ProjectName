"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

type FulfillmentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

type OrderItem = {
  id: string;
  quantity: number;
  unitPrice: number | string;
  fulfillmentStatus?: FulfillmentStatus;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
};

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  total: number | string;
  createdAt: string;
  shippingName: string;
  shippingPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  contactEmail: string | null;
  deliveryAssignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  deliveryPartner: {
    id: string;
    name: string;
    email: string;
  } | null;
  items: OrderItem[];
};

const TRACKING_STEPS: FulfillmentStatus[] = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

function formatPrice(value: number | string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatDate(value: string | null) {
  if (!value) return "Awaiting update";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function readableStatus(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getFulfillmentStatus(item: OrderItem): FulfillmentStatus {
  const validStatuses: FulfillmentStatus[] = [
    "PENDING",
    "PROCESSING",
    "SHIPPED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
  ];

  return validStatuses.includes(item.fulfillmentStatus as FulfillmentStatus)
    ? (item.fulfillmentStatus as FulfillmentStatus)
    : "PENDING";
}

function statusClass(value: string) {
  switch (value.toUpperCase()) {
    case "DELIVERED":
    case "PAID":
      return "my-orders-status status-success";

    case "CANCELLED":
    case "FAILED":
      return "my-orders-status status-danger";

    case "SHIPPED":
    case "OUT_FOR_DELIVERY":
      return "my-orders-status status-info";

    default:
      return "my-orders-status status-pending";
  }
}

function TrackingProgress({ item }: { item: OrderItem }) {
  const status = getFulfillmentStatus(item);
  const cancelled = status === "CANCELLED";
  const currentIndex = TRACKING_STEPS.indexOf(status);

  return (
    <section
      aria-label={`Fulfillment tracking: ${readableStatus(status)}`}
      style={{
        marginTop: 16,
        padding: 16,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <h4 style={{ fontSize: 14, fontWeight: 700 }}>
          Product fulfilment progress
        </h4>

        <span className={statusClass(status)}>
          {readableStatus(status)}
        </span>
      </div>

      {cancelled ? (
        <p style={{ color: "#b91c1c", fontSize: 14 }}>
          This item has been cancelled.
        </p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: 4,
            }}
          >
            {TRACKING_STEPS.map((step, index) => {
              const completed = index <= currentIndex;

              return (
                <div
                  key={step}
                  style={{
                    height: 5,
                    borderRadius: 999,
                    background: completed ? "#16a34a" : "#e2e8f0",
                  }}
                />
              );
            })}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: 4,
              marginTop: 10,
            }}
          >
            {TRACKING_STEPS.map((step, index) => {
              const completed = index <= currentIndex;

              return (
                <span
                  key={step}
                  style={{
                    fontSize: 10,
                    lineHeight: 1.4,
                    color: completed ? "#166534" : "#64748b",
                    fontWeight: index === currentIndex ? 700 : 400,
                    textAlign:
                      index === 0
                        ? "left"
                        : index === TRACKING_STEPS.length - 1
                          ? "right"
                          : "center",
                    overflowWrap: "anywhere",
                  }}
                >
                  {readableStatus(step)}
                </span>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function OrderDeliveryDetails({ order }: { order: Order }) {
  const status = order.status.toUpperCase();

  const shipped = [
    "SHIPPED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ].includes(status);

  const outForDelivery = [
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ].includes(status);

  const delivered = status === "DELIVERED";

  return (
    <section
      style={{
        marginTop: 20,
        padding: 18,
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        background: "#fff",
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
        Order delivery tracking
      </h3>

      {status === "CANCELLED" ? (
        <p style={{ color: "#b91c1c", fontSize: 14 }}>
          This order has been cancelled.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {[
            {
              title: "Order confirmed",
              completed: order.paymentStatus === "PAID",
              date: order.createdAt,
            },
            {
              title: "Shipped by vendor",
              completed: shipped,
              date: order.deliveryAssignedAt,
            },
            {
              title: "Out for delivery",
              completed: outForDelivery,
              date: order.pickedUpAt,
            },
            {
              title: "Delivered",
              completed: delivered,
              date: order.deliveredAt,
            },
          ].map((step, index) => (
            <div
              key={step.title}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <span
                style={{
                  width: 23,
                  height: 23,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: step.completed ? "#16a34a" : "#e2e8f0",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {step.completed ? "✓" : index + 1}
              </span>

              <div>
                <p
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: step.completed ? "#166534" : "#64748b",
                  }}
                >
                  {step.title}
                </p>

                <p style={{ color: "#94a3b8", fontSize: 12 }}>
                  {step.completed
                    ? formatDate(step.date)
                    : "Pending"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 18,
          padding: 14,
          borderRadius: 9,
          background: "#f8fafc",
        }}
      >
        <h4 style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
          Delivery partner
        </h4>

        {order.deliveryPartner ? (
          <>
            <p style={{ fontWeight: 600, fontSize: 14 }}>
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
              <p style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
                Assigned: {formatDate(order.deliveryAssignedAt)}
              </p>
            )}
          </>
        ) : (
          <p style={{ color: "#64748b", fontSize: 13 }}>
            A delivery partner will be assigned after your items are shipped.
          </p>
        )}
      </div>

      <Link
        href={`/orders/${encodeURIComponent(order.id)}`}
        className="cart-primary-button"
        style={{
          display: "inline-block",
          marginTop: 16,
          textAlign: "center",
          textDecoration: "none",
        }}
      >
        View order & track delivery
      </Link>
    </section>
  );
}

export default function MyOrdersPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadOrders = useCallback(
    async (signal: AbortSignal, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const token = localStorage.getItem("markethub-access-token");

      if (!token) {
        router.replace("/account?next=/my-orders");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/orders/my`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          signal,
        });

        if (response.status === 401) {
          localStorage.removeItem("markethub-access-token");
          localStorage.removeItem("markethub-user");
          router.replace("/account?next=/my-orders");
          return;
        }

        if (response.status === 403) {
          throw new Error(
            "My Orders is available to customer accounts only."
          );
        }

        if (!response.ok) {
          throw new Error(
            `Couldn't load your orders (HTTP ${response.status}). Please try again.`
          );
        }

        const result: Order[] = await response.json();

        if (!Array.isArray(result)) {
          throw new Error(
            "The server returned an unexpected orders response."
          );
        }

        if (!signal.aborted) {
          setOrders(result);
          setLastUpdated(new Date());
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        if (!signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong while loading your orders."
          );
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [router]
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadOrders(controller.signal);

    return () => controller.abort();
  }, [loadOrders]);

  const allItems = orders.flatMap((order) => order.items);

  const deliveredItems = allItems.filter(
    (item) => getFulfillmentStatus(item) === "DELIVERED"
  ).length;

  const activeOrders = orders.filter(
    (order) =>
      order.status !== "DELIVERED" &&
      order.status !== "CANCELLED"
  ).length;

  return (
    <main className="my-orders-page">
      <header className="my-orders-header">
        <Link href="/" className="detail-brand">
          MarketHub
        </Link>

        <nav className="my-orders-nav" aria-label="Account navigation">
          <Link href="/account">My account</Link>
          <Link href="/">Continue shopping</Link>
          <Link href="/cart">Shopping cart</Link>
        </nav>
      </header>

      <section className="my-orders-main">
        <div className="my-orders-heading">
          <p className="detail-eyebrow">YOUR MARKETHUB ACCOUNT</p>
          <h1>My orders</h1>
          <p>
            View your previous purchases, track deliveries, and check payment
            status.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {lastUpdated ? (
            <p style={{ fontSize: 12, color: "#64748b" }}>
              Last updated: {lastUpdated.toLocaleTimeString("en-IN")}
            </p>
          ) : (
            <span />
          )}

          <button
            type="button"
            className="secondary-button"
            disabled={loading || refreshing}
            onClick={() => {
              const controller = new AbortController();
              void loadOrders(controller.signal, true);
            }}
          >
            {refreshing ? "Refreshing..." : "Refresh tracking"}
          </button>
        </div>

        {loading ? (
          <div className="my-orders-message">
            <p>Loading your order history...</p>
          </div>
        ) : error ? (
          <div className="my-orders-message my-orders-error" role="alert">
            <h2>We couldn't load your orders.</h2>
            <p>{error}</p>

            <button
              type="button"
              className="cart-primary-button"
              onClick={() => {
                const controller = new AbortController();
                void loadOrders(controller.signal);
              }}
            >
              Try again
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="my-orders-empty">
            <div className="my-orders-empty-icon">M.</div>
            <h2>Your order history starts here.</h2>
            <p>
              Once you place an order, you'll be able to see it here.
            </p>

            <Link href="/" className="cart-primary-button">
              Explore the marketplace
            </Link>
          </div>
        ) : (
          <>
            <div className="my-orders-summary">
              <div>
                <span className="my-orders-summary-number">
                  {orders.length}
                </span>
                <span className="my-orders-summary-label">
                  {orders.length === 1 ? "Order placed" : "Orders placed"}
                </span>
              </div>

              <div>
                <span className="my-orders-summary-number">
                  {activeOrders}
                </span>
                <span className="my-orders-summary-label">
                  Active orders
                </span>
              </div>

              <div>
                <span className="my-orders-summary-number">
                  {deliveredItems}
                </span>
                <span className="my-orders-summary-label">
                  Products delivered
                </span>
              </div>
            </div>

            <div className="my-orders-list">
              {orders.map((order) => (
                <article className="my-order-card" key={order.id}>
                  <div className="my-order-top">
                    <div>
                      <p className="my-order-label">ORDER REFERENCE</p>

                      <h2 className="my-order-id">{order.id}</h2>

                      <p className="my-order-date">
                        Placed {formatDate(order.createdAt)}
                      </p>
                    </div>

                    <div className="my-order-statuses">
                      <span className={statusClass(order.status)}>
                        {readableStatus(order.status)}
                      </span>

                      <span className={statusClass(order.paymentStatus)}>
                        Payment: {readableStatus(order.paymentStatus)}
                      </span>
                    </div>
                  </div>

                  <div className="my-order-products">
                    {order.items.map((item) => (
                      <div className="my-order-product" key={item.id}>
                        <div className="my-order-product-image">
                          {item.product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.product.imageUrl}
                              alt={item.product.name}
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <span>M.</span>
                          )}
                        </div>

                        <div className="my-order-product-info">
                          <h3>{item.product.name}</h3>
                          <p>Quantity: {item.quantity}</p>
                          <p>
                            Unit price: {formatPrice(item.unitPrice)}
                          </p>
                        </div>

                        <strong className="my-order-line-total">
                          {formatPrice(
                            Number(item.unitPrice) * item.quantity
                          )}
                        </strong>

                        <div style={{ width: "100%" }}>
                          <TrackingProgress item={item} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <OrderDeliveryDetails order={order} />

                  <div className="my-order-bottom">
                    <div className="my-order-delivery">
                      <h3>Delivery address</h3>
                      <p>{order.shippingName}</p>
                      <p>{order.addressLine1}</p>

                      {order.addressLine2 && (
                        <p>{order.addressLine2}</p>
                      )}

                      <p>
                        {order.city}, {order.state} {order.postalCode}
                      </p>

                      <p>Phone: {order.shippingPhone}</p>

                      {order.contactEmail && (
                        <p>{order.contactEmail}</p>
                      )}
                    </div>

                    <div className="my-order-total">
                      <span>Order total</span>
                      <strong>{formatPrice(order.total)}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
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