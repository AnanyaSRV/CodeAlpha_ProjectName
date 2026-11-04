"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

type DeliveryOrder = {
  id: string;
  status: "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED";
  paymentStatus: string;
  total: number;
  createdAt: string;
  deliveryAssignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  shippingName: string;
  shippingPhone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  contactEmail: string | null;
  customer: {
    name: string;
    email: string;
  };
  items: {
    id: string;
    quantity: number;
    unitPrice: number;
    fulfillmentStatus: string;
    product: {
      id: string;
      name: string;
      imageUrl: string | null;
    };
  }[];
};

type DeliveryUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type DeliveryStatus = "SHIPPED" | "OUT_FOR_DELIVERY" | "DELIVERED";

type FilterStatus = "ALL" | DeliveryStatus;

export default function DeliveryPage() {
  const router = useRouter();

  const [user, setUser] = useState<DeliveryUser | null>(null);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("ALL");

  const getToken = () => localStorage.getItem("markethub-access-token");

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("markethub-access-token");
    localStorage.removeItem("markethub-user");
    router.replace("/account");
  }, [router]);

  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      const token = getToken();

      if (!token) {
        handleUnauthorized();
        throw new Error("Your session has expired. Please log in again.");
      }

      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        handleUnauthorized();
        throw new Error("You are not authorized to access this resource.");
      }

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof result?.message === "string"
            ? result.message
            : "The request could not be completed.",
        );
      }

      return result;
    },
    [handleUnauthorized],
  );

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiFetch("/delivery/orders");
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your assigned orders.",
      );
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    const token = getToken();
    const storedUser = localStorage.getItem("markethub-user");

    if (!token || !storedUser) {
      router.replace("/account");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser) as DeliveryUser;

      if (parsedUser.role !== "DELIVERY") {
        if (parsedUser.role === "ADMIN") {
          router.replace("/admin");
        } else if (parsedUser.role === "VENDOR") {
          router.replace("/vendor");
        } else {
          router.replace("/");
        }

        return;
      }

      setUser(parsedUser);
      void loadOrders();
    } catch {
      handleUnauthorized();
    }
  }, [loadOrders, handleUnauthorized, router]);

  async function updateOrderStatus(
    order: DeliveryOrder,
    status: "OUT_FOR_DELIVERY" | "DELIVERED",
  ) {
    const actionText =
      status === "OUT_FOR_DELIVERY"
        ? "mark this order as out for delivery"
        : "confirm that this order has been delivered";

    if (!window.confirm(`Are you sure you want to ${actionText}?`)) {
      return;
    }

    setActionId(order.id);
    setError("");
    setNotice("");

    try {
      const result = await apiFetch(
        `/delivery/orders/${encodeURIComponent(order.id)}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );

      setNotice(
        result?.message || "Delivery status updated successfully.",
      );

      await loadOrders();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update delivery status.",
      );
    } finally {
      setActionId(null);
    }
  }

  function handleLogout() {
    localStorage.removeItem("markethub-access-token");
    localStorage.removeItem("markethub-user");
    router.replace("/account");
  }

  const shippedCount = orders.filter(
    (order) => order.status === "SHIPPED",
  ).length;

  const outForDeliveryCount = orders.filter(
    (order) => order.status === "OUT_FOR_DELIVERY",
  ).length;

  const deliveredCount = orders.filter(
    (order) => order.status === "DELIVERED",
  ).length;

  const filteredOrders =
    filter === "ALL"
      ? orders
      : orders.filter((order) => order.status === filter);

  if (!user) {
    return (
      <main style={styles.page}>
        <p style={styles.muted}>Loading delivery portal...</p>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>MARKETHUB LOGISTICS</p>
          <h1 style={styles.heading}>Delivery dashboard</h1>
          <p style={styles.muted}>
            Welcome, {user.name}. Manage your assigned deliveries.
          </p>
        </div>

        <button onClick={handleLogout} style={styles.logoutButton}>
          Log out
        </button>
      </header>

      {error && (
        <p role="alert" style={styles.error}>
          {error}
        </p>
      )}

      {notice && (
        <p role="status" style={styles.success}>
          {notice}
        </p>
      )}

      <section style={styles.statsGrid}>
        <StatCard label="Assigned orders" value={orders.length} />
        <StatCard label="Ready for pickup" value={shippedCount} />
        <StatCard label="Out for delivery" value={outForDeliveryCount} />
        <StatCard label="Delivered" value={deliveredCount} />
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>My deliveries</h2>
            <p style={styles.muted}>
              View your assignments and update their delivery progress.
            </p>
          </div>

          <button
            onClick={() => void loadOrders()}
            disabled={loading}
            style={styles.refreshButton}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div style={styles.filters}>
          {(
            [
              ["ALL", "All orders"],
              ["SHIPPED", "Ready for pickup"],
              ["OUT_FOR_DELIVERY", "Out for delivery"],
              ["DELIVERED", "Delivered"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              style={{
                ...styles.filterButton,
                ...(filter === value ? styles.activeFilterButton : {}),
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={styles.loading}>Loading your deliveries...</p>
        ) : filteredOrders.length === 0 ? (
          <div style={styles.empty}>
            <h3>No deliveries found</h3>
            <p>
              {filter === "ALL"
                ? "You do not have any assigned deliveries yet."
                : "There are no orders in this delivery status."}
            </p>
          </div>
        ) : (
          <div style={styles.orderList}>
            {filteredOrders.map((order) => (
              <article key={order.id} style={styles.orderCard}>
                <div style={styles.cardHeader}>
                  <div>
                    <h3 style={styles.orderTitle}>
                      Order #{order.id.slice(-10)}
                    </h3>
                    <p style={styles.muted}>
                      Placed: {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <StatusBadge status={order.status} />
                </div>

                <div style={styles.infoGrid}>
                  <div style={styles.infoBox}>
                    <h4 style={styles.subheading}>Customer details</h4>
                    <p>
                      <strong>{order.shippingName}</strong>
                    </p>
                    <p>{order.shippingPhone}</p>
                    <p>{order.contactEmail || order.customer.email}</p>
                  </div>

                  <div style={styles.infoBox}>
                    <h4 style={styles.subheading}>Delivery address</h4>
                    <p>{order.addressLine1}</p>
                    {order.addressLine2 && <p>{order.addressLine2}</p>}
                    <p>
                      {order.city}, {order.state}
                    </p>
                    <p>PIN: {order.postalCode}</p>
                  </div>
                </div>

                <div style={styles.itemsBox}>
                  <h4 style={styles.subheading}>Order items</h4>

                  {order.items.map((item) => (
                    <div key={item.id} style={styles.itemRow}>
                      <div>
                        <strong>{item.product.name}</strong>
                        <p style={styles.muted}>
                          Quantity: {item.quantity}
                        </p>
                      </div>

                      <strong>
                        ₹
                        {Number(
                          item.unitPrice * item.quantity,
                        ).toLocaleString("en-IN", {
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </div>
                  ))}

                  <div style={styles.totalRow}>
                    <strong>Order total</strong>
                    <strong>
                      ₹
                      {Number(order.total).toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                  </div>
                </div>

                <div style={styles.timeline}>
                  <div>
                    <span style={styles.timelineLabel}>Assigned</span>
                    <span>
                      {order.deliveryAssignedAt
                        ? new Date(
                            order.deliveryAssignedAt,
                          ).toLocaleString()
                        : "—"}
                    </span>
                  </div>

                  <div>
                    <span style={styles.timelineLabel}>Picked up</span>
                    <span>
                      {order.pickedUpAt
                        ? new Date(order.pickedUpAt).toLocaleString()
                        : "Not yet picked up"}
                    </span>
                  </div>

                  <div>
                    <span style={styles.timelineLabel}>Delivered</span>
                    <span>
                      {order.deliveredAt
                        ? new Date(order.deliveredAt).toLocaleString()
                        : "Not yet delivered"}
                    </span>
                  </div>
                </div>

                <div style={styles.actionArea}>
                  {order.status === "SHIPPED" && (
                    <button
                      onClick={() =>
                        void updateOrderStatus(order, "OUT_FOR_DELIVERY")
                      }
                      disabled={actionId !== null}
                      style={styles.primaryButton}
                    >
                      {actionId === order.id
                        ? "Updating..."
                        : "Mark Out for Delivery"}
                    </button>
                  )}

                  {order.status === "OUT_FOR_DELIVERY" && (
                    <button
                      onClick={() =>
                        void updateOrderStatus(order, "DELIVERED")
                      }
                      disabled={actionId !== null}
                      style={styles.deliveredButton}
                    >
                      {actionId === order.id
                        ? "Updating..."
                        : "Confirm Delivered"}
                    </button>
                  )}

                  {order.status === "DELIVERED" && (
                    <p style={styles.deliveredMessage}>
                      This order has been successfully delivered.
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer style={styles.footer}>
        <span>MarketHub Delivery Portal</span>
        <span>{user.email}</span>
      </footer>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div style={styles.statCard}>
      <p style={styles.muted}>{label}</p>
      <strong style={styles.statValue}>{value}</strong>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();

  let colors = {
    background: "#e2e8f0",
    color: "#334155",
  };

  if (normalized === "DELIVERED") {
    colors = {
      background: "#dcfce7",
      color: "#166534",
    };
  } else if (
    normalized === "SHIPPED" ||
    normalized === "OUT_FOR_DELIVERY"
  ) {
    colors = {
      background: "#fef3c7",
      color: "#92400e",
    };
  }

  return (
    <span style={{ ...styles.badge, ...colors }}>
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#f8fafc",
    color: "#0f172a",
    padding: "40px 5%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
    marginBottom: 30,
  },
  eyebrow: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 2,
  },
  heading: {
    fontSize: 34,
    margin: "8px 0",
  },
  muted: {
    color: "#64748b",
    fontSize: 14,
    margin: "5px 0",
  },
  logoutButton: {
    padding: "11px 20px",
    border: "1px solid #cbd5e1",
    borderRadius: 10,
    background: "#fff",
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
    marginBottom: 28,
  },
  statCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 20,
  },
  statValue: {
    display: "block",
    fontSize: 30,
    marginTop: 8,
  },
  section: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 24,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 23,
    margin: "0 0 6px",
  },
  refreshButton: {
    padding: "10px 16px",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    background: "#fff",
    cursor: "pointer",
  },
  filters: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 22,
  },
  filterButton: {
    padding: "9px 13px",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    background: "#fff",
    color: "#475569",
    cursor: "pointer",
  },
  activeFilterButton: {
    background: "#0f172a",
    color: "#fff",
    border: "1px solid #0f172a",
  },
  loading: {
    padding: 25,
    color: "#64748b",
  },
  empty: {
    padding: 35,
    textAlign: "center",
    background: "#f8fafc",
    borderRadius: 12,
    color: "#64748b",
  },
  orderList: {
    display: "grid",
    gap: 20,
  },
  orderCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: 22,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 20,
  },
  orderTitle: {
    fontSize: 20,
    margin: "0 0 5px",
  },
  badge: {
    display: "inline-block",
    padding: "7px 11px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
    marginBottom: 18,
  },
  infoBox: {
    padding: 16,
    background: "#f8fafc",
    borderRadius: 10,
  },
  subheading: {
    fontSize: 15,
    margin: "0 0 12px",
  },
  itemsBox: {
    padding: 16,
    background: "#f8fafc",
    borderRadius: 10,
    marginBottom: 18,
  },
  itemRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "12px 0",
    borderBottom: "1px solid #e2e8f0",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    paddingTop: 16,
    marginTop: 6,
    fontSize: 16,
  },
  timeline: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    padding: 16,
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    marginBottom: 18,
  },
  timelineLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 6,
  },
  actionArea: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  primaryButton: {
    padding: "12px 20px",
    border: "none",
    borderRadius: 9,
    background: "#1d4ed8",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  deliveredButton: {
    padding: "12px 20px",
    border: "none",
    borderRadius: 9,
    background: "#15803d",
    color: "#fff",
    fontWeight: 600,
    cursor: "pointer",
  },
  deliveredMessage: {
    color: "#166534",
    fontWeight: 600,
  },
  error: {
    padding: 12,
    background: "#fef2f2",
    color: "#b91c1c",
    borderRadius: 8,
    marginBottom: 18,
  },
  success: {
    padding: 12,
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: 8,
    marginBottom: 18,
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    color: "#64748b",
    fontSize: 13,
    marginTop: 28,
  },
};