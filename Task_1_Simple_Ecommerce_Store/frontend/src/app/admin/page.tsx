
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

type ApplicationStatus = "PENDING" | "APPROVED" | "REJECTED";

type VendorApplication = {
  id: string;
  storeName: string;
  description: string | null;
  commission: number;
  applicationStatus: ApplicationStatus;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
  vendorProfile?: {
    storeName: string;
    applicationStatus: string;
  } | null;
};

type Overview = {
  totalUsers: number;
  totalVendors: number;
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  paidRevenue: number;
};

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  active: boolean;
  imageUrl: string | null;
  vendor: {
    storeName: string;
    user: {
      name: string;
      email: string;
    };
  };
};

type DeliveryPartner = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  _count: {
    deliveryOrders: number;
  };
};

type Order = {
  id: string;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  paidAt: string | null;
  shippingName: string;
  shippingPhone: string;
  city: string;
  state: string;
  deliveryPartnerId: string | null;
  deliveryAssignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  deliveryPartner: {
    id: string;
    name: string;
    email: string;
  } | null;
  customer: {
    id: string;
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
      category: string;
    };
  }[];
};

type Section =
  | "overview"
  | "users"
  | "products"
  | "orders"
  | "applications";

const sections: { id: Section; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "products", label: "Products" },
  { id: "orders", label: "Orders" },
  { id: "applications", label: "Vendor applications" },
];

export default function AdminPage() {
  const router = useRouter();

  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [section, setSection] = useState<Section>("overview");

  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartner[]>(
    [],
  );

  const [selectedPartners, setSelectedPartners] = useState<
    Record<string, string>
  >({});

  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        overviewData,
        usersData,
        productsData,
        ordersData,
        applicationsData,
        partnersData,
      ] = await Promise.all([
        apiFetch("/admin/overview"),
        apiFetch("/admin/users"),
        apiFetch("/admin/products"),
        apiFetch("/admin/orders"),
        apiFetch("/vendors/admin/applications"),
        apiFetch("/admin/delivery-partners"),
      ]);

      setOverview(overviewData);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setApplications(
        Array.isArray(applicationsData) ? applicationsData : [],
      );
      setDeliveryPartners(
        Array.isArray(partnersData) ? partnersData : [],
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load admin dashboard.",
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
      const parsedUser = JSON.parse(storedUser) as AdminUser;

      if (parsedUser.role !== "ADMIN") {
        router.replace(parsedUser.role === "VENDOR" ? "/vendor" : "/");
        return;
      }

      setAdmin(parsedUser);
      void loadDashboard();
    } catch {
      handleUnauthorized();
    }
  }, [loadDashboard, handleUnauthorized, router]);

  async function handleApplicationAction(
    applicationId: string,
    action: "approve" | "reject",
  ) {
    let reason = "";

    if (action === "reject") {
      const enteredReason = window.prompt(
        "Enter the reason for rejecting this vendor application:",
      );

      if (enteredReason === null) return;

      reason = enteredReason.trim();

      if (reason.length < 5 || reason.length > 500) {
        setError("Rejection reason must be between 5 and 500 characters.");
        return;
      }
    }

    setActionId(applicationId);
    setError("");
    setNotice("");

    try {
      await apiFetch(
        `/vendors/admin/applications/${applicationId}/${action}`,
        {
          method: "PATCH",
          ...(action === "reject"
            ? { body: JSON.stringify({ reason }) }
            : {}),
        },
      );

      setNotice(
        action === "approve"
          ? "Vendor application approved successfully."
          : "Vendor application rejected successfully.",
      );

      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update application.",
      );
    } finally {
      setActionId(null);
    }
  }

  async function handleProductStatus(product: Product) {
    const nextStatus = !product.active;

    setActionId(product.id);
    setError("");
    setNotice("");

    try {
      await apiFetch(`/admin/products/${product.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ active: nextStatus }),
      });

      setNotice(
        nextStatus
          ? `${product.name} has been activated.`
          : `${product.name} has been deactivated.`,
      );

      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update product.",
      );
    } finally {
      setActionId(null);
    }
  }

  async function handlePromoteToDeliveryPartner(user: AdminUser) {
    if (user.role !== "CUSTOMER") return;

    const confirmed = window.confirm(
      `Promote ${user.name} (${user.email}) to a delivery partner? They will use their existing account and password to log in.`,
    );

    if (!confirmed) return;

    setActionId(user.id);
    setError("");
    setNotice("");

    try {
      const result = await apiFetch(
        `/admin/users/${user.id}/delivery-role`,
        { method: "PATCH" },
      );

      setNotice(
        result?.message || `${user.name} is now a delivery partner.`,
      );

      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to promote this user to a delivery partner.",
      );
    } finally {
      setActionId(null);
    }
  }

  async function handleDeliveryAssignment(order: Order) {
    const deliveryPartnerId = selectedPartners[order.id];

    if (!deliveryPartnerId) {
      setError("Please select a delivery partner first.");
      return;
    }

    setActionId(order.id);
    setError("");
    setNotice("");

    try {
      const result = await apiFetch(
        `/admin/orders/${order.id}/assign-delivery`,
        {
          method: "PATCH",
          body: JSON.stringify({ deliveryPartnerId }),
        },
      );

      setNotice(
        result?.message || "Delivery partner assigned successfully.",
      );

      await loadDashboard();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to assign delivery partner.",
      );
    } finally {
      setActionId(null);
    }
  }

  function canAssignDelivery(order: Order) {
    return (
      order.paymentStatus === "PAID" &&
      order.status !== "CANCELLED" &&
      order.status !== "DELIVERED" &&
      !order.deliveryPartnerId &&
      order.items.length > 0 &&
      order.items.every((item) => item.fulfillmentStatus === "SHIPPED")
    );
  }

  function handleLogout() {
    localStorage.removeItem("markethub-access-token");
    localStorage.removeItem("markethub-user");
    router.replace("/account");
  }

  const pendingCount = applications.filter(
    (application) => application.applicationStatus === "PENDING",
  ).length;

  const approvedCount = applications.filter(
    (application) => application.applicationStatus === "APPROVED",
  ).length;

  const rejectedCount = applications.filter(
    (application) => application.applicationStatus === "REJECTED",
  ).length;

  if (!admin) {
    return (
      <main style={styles.page}>
        <p>Loading administrator dashboard...</p>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>MARKETHUB MANAGEMENT</p>
          <h1 style={styles.heading}>Admin dashboard</h1>
          <p style={styles.muted}>
            Welcome, {admin.name}. Manage your marketplace.
          </p>
        </div>

        <button onClick={handleLogout} style={styles.logoutButton}>
          Log out
        </button>
      </header>

      <nav style={styles.navigation}>
        {sections.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setSection(item.id);
              setError("");
              setNotice("");
            }}
            style={{
              ...styles.navButton,
              ...(section === item.id ? styles.activeNavButton : {}),
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

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

      {loading ? (
        <p style={styles.loading}>Loading dashboard data...</p>
      ) : (
        <>
          {section === "overview" && (
            <section>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Marketplace overview</h2>
                  <p style={styles.muted}>
                    A summary of your MarketHub marketplace.
                  </p>
                </div>
                <button
                  onClick={() => void loadDashboard()}
                  style={styles.secondaryButton}
                >
                  Refresh
                </button>
              </div>

              <div style={styles.statsGrid}>
                <StatCard label="Total users" value={overview?.totalUsers ?? 0} />
                <StatCard
                  label="Approved vendors"
                  value={overview?.totalVendors ?? 0}
                />
                <StatCard
                  label="Total products"
                  value={overview?.totalProducts ?? 0}
                />
                <StatCard
                  label="Active products"
                  value={overview?.activeProducts ?? 0}
                />
                <StatCard
                  label="Total orders"
                  value={overview?.totalOrders ?? 0}
                />
                <StatCard
                  label="Pending orders"
                  value={overview?.pendingOrders ?? 0}
                />
                <StatCard
                  label="Paid revenue"
                  value={`₹${(overview?.paidRevenue ?? 0).toLocaleString(
                    "en-IN",
                    { maximumFractionDigits: 2 },
                  )}`}
                />
                <StatCard
                  label="Delivery partners"
                  value={deliveryPartners.length}
                />
              </div>

              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>
                  Vendor application summary
                </h3>
                <div style={styles.statsGrid}>
                  <StatCard
                    label="Total applications"
                    value={applications.length}
                  />
                  <StatCard label="Pending review" value={pendingCount} />
                  <StatCard label="Approved" value={approvedCount} />
                  <StatCard label="Rejected" value={rejectedCount} />
                </div>
              </div>
            </section>
          )}

          {section === "users" && (
            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>User management</h2>
                  <p style={styles.muted}>
                    View registered MarketHub accounts and their roles.
                  </p>
                </div>
                <span style={styles.countLabel}>{users.length} users</span>
              </div>

              {users.length === 0 ? (
                <EmptyMessage message="No registered users found." />
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Name</th>
                        <th style={styles.th}>Email</th>
                        <th style={styles.th}>Role</th>
                        <th style={styles.th}>Store</th>
                        <th style={styles.th}>Joined</th>
                        <th style={styles.th}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td style={styles.td}>{user.name}</td>
                          <td style={styles.td}>{user.email}</td>
                          <td style={styles.td}>
                            <StatusBadge status={user.role} />
                          </td>
                          <td style={styles.td}>
                            {user.vendorProfile?.storeName ?? "—"}
                          </td>
                          <td style={styles.td}>
                            {user.createdAt
                              ? new Date(user.createdAt).toLocaleDateString()
                              : "—"}
                          </td>
                          <td style={styles.td}>
                            {user.role === "CUSTOMER" ? (
                              <button
                                onClick={() =>
                                  void handlePromoteToDeliveryPartner(user)
                                }
                                disabled={actionId !== null}
                                style={styles.deliveryRoleButton}
                              >
                                {actionId === user.id
                                  ? "Updating..."
                                  : "Make delivery partner"}
                              </button>
                            ) : user.role === "DELIVERY" ? (
                              <span style={styles.muted}>Delivery partner</span>
                            ) : (
                              <span style={styles.muted}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {section === "products" && (
            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Product management</h2>
                  <p style={styles.muted}>
                    Review all product listings and control their visibility.
                  </p>
                </div>
                <span style={styles.countLabel}>
                  {products.length} products
                </span>
              </div>

              {products.length === 0 ? (
                <EmptyMessage message="No products found." />
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Product</th>
                        <th style={styles.th}>Category</th>
                        <th style={styles.th}>Vendor</th>
                        <th style={styles.th}>Price</th>
                        <th style={styles.th}>Stock</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={product.id}>
                          <td style={styles.td}>
                            <strong>{product.name}</strong>
                          </td>
                          <td style={styles.td}>{product.category}</td>
                          <td style={styles.td}>
                            {product.vendor?.storeName ?? "—"}
                          </td>
                          <td style={styles.td}>
                            ₹{Number(product.price).toLocaleString("en-IN")}
                          </td>
                          <td style={styles.td}>{product.stock}</td>
                          <td style={styles.td}>
                            <StatusBadge
                              status={product.active ? "ACTIVE" : "INACTIVE"}
                            />
                          </td>
                          <td style={styles.td}>
                            <button
                              disabled={actionId !== null}
                              onClick={() => void handleProductStatus(product)}
                              style={
                                product.active
                                  ? styles.rejectButton
                                  : styles.approveButton
                              }
                            >
                              {actionId === product.id
                                ? "Updating..."
                                : product.active
                                  ? "Deactivate"
                                  : "Activate"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {section === "orders" && (
            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Order management</h2>
                  <p style={styles.muted}>
                    Review orders, payments, fulfilment and delivery assignments.
                  </p>
                </div>
                <div style={styles.headerActions}>
                  <span style={styles.countLabel}>{orders.length} orders</span>
                  <button
                    onClick={() => void loadDashboard()}
                    style={styles.secondaryButton}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {orders.length === 0 ? (
                <EmptyMessage message="No orders have been placed yet." />
              ) : (
                <div style={styles.orderList}>
                  {orders.map((order) => (
                    <article key={order.id} style={styles.orderCard}>
                      <div style={styles.cardTop}>
                        <div>
                          <h3 style={styles.storeName}>
                            Order #{order.id.slice(-10)}
                          </h3>
                          <p style={styles.muted}>
                            {new Date(order.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <strong style={styles.orderTotal}>
                          ₹
                          {Number(order.total).toLocaleString("en-IN", {
                            maximumFractionDigits: 2,
                          })}
                        </strong>
                      </div>

                      <div style={styles.detailsGrid}>
                        <div>
                          <strong>Customer</strong>
                          <p>{order.customer?.name ?? "—"}</p>
                          <p style={styles.muted}>
                            {order.customer?.email ?? ""}
                          </p>
                        </div>

                        <div>
                          <strong>Order status</strong>
                          <p>
                            <StatusBadge status={order.status} />
                          </p>
                        </div>

                        <div>
                          <strong>Payment</strong>
                          <p>
                            <StatusBadge status={order.paymentStatus} />
                          </p>
                        </div>

                        <div>
                          <strong>Delivery address</strong>
                          <p>
                            {order.city}, {order.state}
                          </p>
                          <p style={styles.muted}>{order.shippingPhone}</p>
                        </div>
                      </div>

                      <div style={styles.description}>
                        <strong>Order items</strong>
                        {order.items.map((item) => (
                          <div key={item.id} style={styles.orderItem}>
                            <div>
                              <strong>{item.product?.name ?? "Product"}</strong>
                              <p style={styles.muted}>
                                Quantity: {item.quantity} · ₹
                                {Number(item.unitPrice).toLocaleString(
                                  "en-IN",
                                )}{" "}
                                each
                              </p>
                            </div>
                            <StatusBadge status={item.fulfillmentStatus} />
                          </div>
                        ))}
                      </div>

                      <div style={styles.deliveryBox}>
                        <h4 style={styles.deliveryHeading}>
                          Delivery assignment
                        </h4>

                        {order.deliveryPartner ? (
                          <>
                            <p>
                              <strong>Assigned partner:</strong>{" "}
                              {order.deliveryPartner.name}
                            </p>
                            <p style={styles.muted}>
                              {order.deliveryPartner.email}
                            </p>
                            <p style={styles.muted}>
                              Assigned:{" "}
                              {order.deliveryAssignedAt
                                ? new Date(
                                    order.deliveryAssignedAt,
                                  ).toLocaleString()
                                : "—"}
                            </p>

                            {order.pickedUpAt && (
                              <p style={styles.muted}>
                                Picked up:{" "}
                                {new Date(order.pickedUpAt).toLocaleString()}
                              </p>
                            )}

                            {order.deliveredAt && (
                              <p style={styles.muted}>
                                Delivered:{" "}
                                {new Date(order.deliveredAt).toLocaleString()}
                              </p>
                            )}

                            <StatusBadge status={order.status} />
                          </>
                        ) : canAssignDelivery(order) ? (
                          <>
                            {deliveryPartners.length === 0 ? (
                              <p style={styles.muted}>
                                No delivery partners are registered yet.
                              </p>
                            ) : (
                              <div style={styles.assignmentControls}>
                                <select
                                  value={selectedPartners[order.id] ?? ""}
                                  onChange={(event) =>
                                    setSelectedPartners((current) => ({
                                      ...current,
                                      [order.id]: event.target.value,
                                    }))
                                  }
                                  style={styles.select}
                                >
                                  <option value="">
                                    Select delivery partner
                                  </option>
                                  {deliveryPartners.map((partner) => (
                                    <option
                                      key={partner.id}
                                      value={partner.id}
                                    >
                                      {partner.name} ({partner.email})
                                    </option>
                                  ))}
                                </select>

                                <button
                                  onClick={() =>
                                    void handleDeliveryAssignment(order)
                                  }
                                  disabled={actionId !== null}
                                  style={styles.assignButton}
                                >
                                  {actionId === order.id
                                    ? "Assigning..."
                                    : "Assign partner"}
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <p style={styles.muted}>
                            Assignment available after payment is confirmed
                            and all vendor items are shipped.
                          </p>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {section === "applications" && (
            <section style={styles.section}>
              <div style={styles.sectionHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Vendor applications</h2>
                  <p style={styles.muted}>
                    Review applications and decide which stores can join MarketHub.
                  </p>
                </div>
                <button
                  onClick={() => void loadDashboard()}
                  style={styles.secondaryButton}
                >
                  Refresh
                </button>
              </div>

              <div style={styles.statsGrid}>
                <StatCard
                  label="Total applications"
                  value={applications.length}
                />
                <StatCard label="Pending review" value={pendingCount} />
                <StatCard label="Approved" value={approvedCount} />
                <StatCard label="Rejected" value={rejectedCount} />
              </div>

              {applications.length === 0 ? (
                <EmptyMessage message="No vendor applications yet." />
              ) : (
                <div style={styles.applicationList}>
                  {applications.map((application) => (
                    <article
                      key={application.id}
                      style={styles.applicationCard}
                    >
                      <div style={styles.cardTop}>
                        <div>
                          <h3 style={styles.storeName}>
                            {application.storeName}
                          </h3>
                          <p style={styles.muted}>
                            Submitted{" "}
                            {new Date(application.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <StatusBadge status={application.applicationStatus} />
                      </div>

                      <div style={styles.detailsGrid}>
                        <div>
                          <strong>Applicant</strong>
                          <p>{application.user.name}</p>
                        </div>
                        <div>
                          <strong>Email</strong>
                          <p>{application.user.email}</p>
                        </div>
                        <div>
                          <strong>Current role</strong>
                          <p>{application.user.role}</p>
                        </div>
                        <div>
                          <strong>Commission</strong>
                          <p>{application.commission}%</p>
                        </div>
                      </div>

                      <div style={styles.description}>
                        <strong>Store description</strong>
                        <p>
                          {application.description ||
                            "No description provided."}
                        </p>
                      </div>

                      {application.applicationStatus === "REJECTED" &&
                        application.rejectionReason && (
                          <div style={styles.rejectionReason}>
                            <strong>Previous rejection reason</strong>
                            <p>{application.rejectionReason}</p>
                          </div>
                        )}

                      {application.reviewedAt && (
                        <p style={styles.muted}>
                          Reviewed{" "}
                          {new Date(application.reviewedAt).toLocaleString()}
                        </p>
                      )}

                      {application.applicationStatus === "PENDING" && (
                        <div style={styles.actions}>
                          <button
                            onClick={() =>
                              void handleApplicationAction(
                                application.id,
                                "approve",
                              )
                            }
                            disabled={actionId !== null}
                            style={styles.approveButton}
                          >
                            {actionId === application.id
                              ? "Processing..."
                              : "Approve"}
                          </button>

                          <button
                            onClick={() =>
                              void handleApplicationAction(
                                application.id,
                                "reject",
                              )
                            }
                            disabled={actionId !== null}
                            style={styles.rejectButton}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div style={styles.statCard}>
      <p style={styles.muted}>{label}</p>
      <strong style={styles.statValue}>{value}</strong>
    </div>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <div style={styles.empty}>
      <p>{message}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();

  let colors = { background: "#e2e8f0", color: "#334155" };

  if (
    ["APPROVED", "ACTIVE", "PAID", "DELIVERED", "CONFIRMED"].includes(
      normalized,
    )
  ) {
    colors = { background: "#dcfce7", color: "#166534" };
  } else if (
    ["PENDING", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"].includes(
      normalized,
    )
  ) {
    colors = { background: "#fef3c7", color: "#92400e" };
  } else if (
    ["REJECTED", "INACTIVE", "FAILED", "CANCELLED", "REFUNDED"].includes(
      normalized,
    )
  ) {
    colors = { background: "#fee2e2", color: "#991b1b" };
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
    padding: "40px 5%",
    color: "#0f172a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
    marginBottom: 28,
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
  navigation: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 28,
    padding: 8,
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
  },
  navButton: {
    padding: "11px 16px",
    border: "none",
    borderRadius: 8,
    background: "transparent",
    color: "#475569",
    cursor: "pointer",
    fontWeight: 600,
  },
  activeNavButton: {
    background: "#0f172a",
    color: "#fff",
  },
  loading: {
    padding: 30,
    color: "#64748b",
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
    fontSize: 27,
    marginTop: 8,
    overflowWrap: "anywhere",
  },
  section: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  secondaryButton: {
    padding: "10px 16px",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    background: "#fff",
    cursor: "pointer",
  },
  countLabel: {
    color: "#475569",
    fontSize: 14,
    fontWeight: 600,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  empty: {
    padding: 32,
    textAlign: "center",
    background: "#f8fafc",
    borderRadius: 12,
    color: "#64748b",
  },
  tableWrapper: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
    fontSize: 14,
  },
  th: {
    padding: "13px 12px",
    background: "#f8fafc",
    color: "#475569",
    borderBottom: "1px solid #e2e8f0",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "14px 12px",
    borderBottom: "1px solid #e2e8f0",
    verticalAlign: "middle",
  },
  badge: {
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  orderList: {
    display: "grid",
    gap: 18,
  },
  orderCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 20,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 20,
  },
  storeName: {
    fontSize: 20,
    margin: "0 0 5px",
  },
  orderTotal: {
    fontSize: 20,
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 16,
    marginBottom: 18,
  },
  description: {
    padding: 14,
    background: "#f8fafc",
    borderRadius: 9,
    marginBottom: 16,
  },
  orderItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 12,
    marginTop: 12,
    borderTop: "1px solid #e2e8f0",
  },
  deliveryBox: {
    padding: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    marginTop: 16,
  },
  deliveryHeading: {
    fontSize: 16,
    margin: "0 0 12px",
  },
  assignmentControls: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  select: {
    flex: "1 1 240px",
    minWidth: 0,
    padding: "11px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 9,
    background: "#fff",
  },
  assignButton: {
    padding: "11px 18px",
    border: "none",
    borderRadius: 9,
    background: "#1d4ed8",
    color: "#fff",
    cursor: "pointer",
  },
  rejectionReason: {
    padding: 14,
    background: "#fef2f2",
    borderRadius: 9,
    marginBottom: 16,
  },
  applicationList: {
    display: "grid",
    gap: 18,
  },
  applicationCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 20,
  },
  actions: {
    display: "flex",
    gap: 10,
    marginTop: 18,
  },
  approveButton: {
    padding: "10px 16px",
    border: "none",
    borderRadius: 9,
    background: "#15803d",
    color: "#fff",
    cursor: "pointer",
  },
  rejectButton: {
    padding: "10px 16px",
    border: "none",
    borderRadius: 9,
    background: "#b91c1c",
    color: "#fff",
    cursor: "pointer",
  },
  deliveryRoleButton: {
    padding: "9px 12px",
    border: "none",
    borderRadius: 9,
    background: "#1d4ed8",
    color: "#fff",
    cursor: "pointer",
    whiteSpace: "nowrap",
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
};
