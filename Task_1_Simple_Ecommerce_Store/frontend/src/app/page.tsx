
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  active: boolean;
  vendor: {
    id: string;
    storeName: string;
  };
};

type ProductResponse = {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

const PAGE_SIZE = 24;

const DEFAULT_CATEGORIES = [
  "Fashion",
  "Bags",
  "Stationery",
  "Home Decor",
  "Electronics Accessories",
  "Fitness",
  "Beauty Accessories",
  "Kitchen",
  "Outdoor and Travel",
  "Gifts and Lifestyle",
];

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(price);
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState("All products");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCategories() {
      try {
        const response = await fetch(`${API_URL}/products/categories`, {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Category API returned ${response.status}.`);
        }

        const result: unknown = await response.json();

        if (Array.isArray(result)) {
          const validCategories = result.filter(
            (category): category is string =>
              typeof category === "string" && category.trim().length > 0,
          );

          setCategories((current) => {
            const combined = new Set([
              ...validCategories,
              ...current.filter((category) => category === "Uncategorized"),
            ]);

            return Array.from(combined).sort((a, b) => a.localeCompare(b));
          });
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        // Keep the known category list available if the category endpoint
        // temporarily fails. Product filtering still uses the backend API.
      }
    }

    void loadCategories();

    return () => controller.abort();
  }, [retryKey]);

  const loadProducts = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });

        const query = search.trim();

        if (query) {
          params.set("search", query);
        }

        if (selectedCategory !== "All products") {
          params.set("category", selectedCategory);
        }

        const response = await fetch(
          `${API_URL}/products?${params.toString()}`,
          {
            signal,
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(`Product API returned ${response.status}.`);
        }

        const result: ProductResponse = await response.json();

        if (
          !Array.isArray(result.products) ||
          !result.pagination ||
          typeof result.pagination.total !== "number" ||
          typeof result.pagination.totalPages !== "number"
        ) {
          throw new Error("Unexpected product API response.");
        }

        setProducts(result.products.filter((product) => product.active));
        setTotalProducts(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        setError(
          "We couldn't load products. Make sure your backend is running on port 4000.",
        );
        setProducts([]);
        setTotalProducts(0);
        setTotalPages(0);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [page, search, selectedCategory],
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadProducts(controller.signal);

    return () => controller.abort();
  }, [loadProducts, retryKey]);

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleCategoryChange(category: string) {
    setSelectedCategory(category);
    setPage(1);
  }

  function goToPage(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPages || loading) {
      return;
    }

    setPage(nextPage);

    document.getElementById("products")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  const hasActiveFilter =
    search.trim().length > 0 || selectedCategory !== "All products";

  return (
    <main className="storefront">
      <div className="announcement">
        A marketplace for independent brands and everyday discoveries
      </div>

      <header className="site-header">
        <Link className="brand" href="/" aria-label="MarketHub home">
          <span className="brand-mark">M</span>
          <span>
            market<span className="brand-light">hub</span>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="Main navigation">
          <a className="nav-link active" href="#discover">
            Discover
          </a>
          <a className="nav-link" href="#products">
            Shop all
          </a>
          <a className="nav-link" href="#sell">
            Sell on MarketHub
          </a>
        </nav>

        <a className="header-action" href="#products">
          Explore <span aria-hidden="true">â†—</span>
        </a>
      </header>

      <section className="hero" id="discover">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            YOUR NEXT GREAT FIND
          </span>

          <h1>
            Good things,
            <br />
            <span>all in one place.</span>
          </h1>

          <p>
            Discover thoughtful finds from independent sellers. A little
            something for every kind of day.
          </p>

          <a className="primary-button" href="#products">
            Explore the marketplace <span aria-hidden="true">â†’</span>
          </a>

          <div className="hero-note">
            <span className="note-stars" aria-hidden="true">
              âœ³ âœ³ âœ³
            </span>
            <span>One marketplace. Many unique stores.</span>
          </div>
        </div>

        <div
          className="hero-art"
          aria-label="MarketHub marketplace illustration"
        >
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />

          <div className="art-card art-card-back">
            <span className="art-mini-label">CURATED FOR YOU</span>
            <div className="art-sun" />
            <div className="art-shape shape-one" />
            <div className="art-shape shape-two" />
          </div>

          <div className="art-card art-card-front">
            <div className="art-tile art-tile-one">
              <span>âœ³</span>
            </div>
            <div className="art-tile art-tile-two">
              <span>â—’</span>
            </div>
            <div className="art-tile art-tile-three">
              <span>âœ¦</span>
            </div>
            <div className="art-tile art-tile-four">
              <span>â—Ž</span>
            </div>
          </div>

          <div className="floating-label floating-label-top">
            <span className="floating-icon">âœ¦</span>
            <span>Made to be found</span>
          </div>

          <div className="floating-label floating-label-bottom">
            <span className="floating-status" />
            <span>Small stores, big ideas</span>
          </div>

          <span className="hero-spark spark-one">âœ³</span>
          <span className="hero-spark spark-two">âœ¦</span>
        </div>
      </section>

      <section className="benefits" aria-label="Marketplace highlights">
        <div className="benefit">
          <span className="benefit-icon">â—‡</span>
          <span>
            <strong>Independent sellers</strong>
            <small>Discover unique stores</small>
          </span>
        </div>

        <div className="benefit">
          <span className="benefit-icon">â—Ž</span>
          <span>
            <strong>Easy discovery</strong>
            <small>Find your next favourite</small>
          </span>
        </div>

        <div className="benefit">
          <span className="benefit-icon">âœ³</span>
          <span>
            <strong>Fresh finds</strong>
            <small>Browse active listings</small>
          </span>
        </div>
      </section>

      <section className="catalogue" id="products">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE MARKETPLACE</span>
            <h2>
              Find your kind of <span>good.</span>
            </h2>
            <p>Explore products from our marketplace sellers.</p>
          </div>

          <div className="catalogue-count">
            <span className="count-number">
              {loading ? "â€”" : totalProducts.toLocaleString("en-IN")}
            </span>
            <span className="count-label">
              {hasActiveFilter ? "matching products" : "available products"}
            </span>
          </div>
        </div>

        <div className="catalogue-tools">
          <div className="category-list" aria-label="Product categories">
            <button
              type="button"
              className={`category-button ${
                selectedCategory === "All products" ? "selected" : ""
              }`}
              aria-pressed={selectedCategory === "All products"}
              onClick={() => handleCategoryChange("All products")}
            >
              All products
            </button>

            {categories.map((category) => (
              <button
                type="button"
                key={category}
                className={`category-button ${
                  selectedCategory === category ? "selected" : ""
                }`}
                aria-pressed={selectedCategory === category}
                onClick={() => handleCategoryChange(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <label className="search-box">
            <span className="search-symbol" aria-hidden="true">
              âŒ•
            </span>
            <input
              type="search"
              placeholder="Search product names or descriptions..."
              value={search}
              onChange={(event) => handleSearchChange(event.target.value)}
              aria-label="Search product names or descriptions"
            />
          </label>
        </div>

        {error ? (
          <div className="state-panel error-panel" role="alert">
            <span className="state-icon">!</span>
            <h3>Catalogue unavailable</h3>
            <p>{error}</p>
            <button
              type="button"
              className="primary-button"
              onClick={() => setRetryKey((value) => value + 1)}
            >
              Try again <span aria-hidden="true">â†»</span>
            </button>
          </div>
        ) : loading ? (
          <div className="product-grid" aria-label="Loading products">
            {Array.from({ length: 8 }, (_, index) => (
              <div className="product-card skeleton-card" key={index}>
                <div className="skeleton-image" />
                <div className="skeleton-line" />
                <div className="skeleton-line short" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="state-panel">
            <span className="state-icon">âŒ•</span>
            <h3>
              {hasActiveFilter
                ? "No matches just yet."
                : "Your next find is on its way."}
            </h3>
            <p>
              {hasActiveFilter
                ? "Try another search term or category to discover something different."
                : "There are no active products to show right now."}
            </p>

            {hasActiveFilter && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  handleSearchChange("");
                  handleCategoryChange("All products");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="product-grid">
              {products.map((product, index) => (
                <Link
                  className="product-card product-card-link"
                  href={`/products/${product.id}`}
                  key={product.id}
                >
                  <div
                    className={`product-image-wrap product-tone-${index % 4}`}
                  >
                    <div className="product-image-placeholder">
                      <span>âœ³</span>
                      <small>MARKETHUB FIND</small>
                    </div>

                    {product.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="product-image"
                        src={product.imageUrl}
                        alt={product.name}
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                        }}
                      />
                    )}

                    <span className="product-tag">
                      {product.stock > 0 ? "Available now" : "Out of stock"}
                    </span>
                  </div>

                  <div className="product-details">
                    <div className="product-vendor">
                      <span className="vendor-dot" />
                      {product.vendor.storeName}
                    </div>

                    <h3>{product.name}</h3>
                    <p className="product-description">{product.description}</p>

                    <div className="product-card-bottom">
                      <span className="product-price">
                        {formatPrice(product.price)}
                      </span>
                      <span
                        className={`stock-label ${
                          product.stock > 0 ? "in-stock" : ""
                        }`}
                      >
                        {product.stock > 0
                          ? `${product.stock} in stock`
                          : "Sold out"}
                      </span>
                    </div>

                    <span className="product-view-link">View product â†’</span>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <nav
                className="catalogue-pagination"
                aria-label="Product pages"
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page <= 1 || loading}
                >
                  â† Previous
                </button>

                <span className="pagination-status" aria-live="polite">
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page >= totalPages || loading}
                >
                  Next â†’
                </button>
              </nav>
            )}

            <p className="catalogue-results-note">
              Showing {(page - 1) * PAGE_SIZE + 1}â€“
              {Math.min(page * PAGE_SIZE, totalProducts)} of{" "}
              {totalProducts.toLocaleString("en-IN")} products
            </p>
          </>
        )}
      </section>

      <section className="seller-banner" id="sell">
        <div className="seller-banner-symbol">M.</div>

        <div className="seller-banner-copy">
          <span className="eyebrow">HAVE SOMETHING TO SHARE?</span>
          <h2>
            Your store could be <span>here.</span>
          </h2>
          <p>
            Bring your products to a marketplace made for discovering new
            favourites.
          </p>
        </div>

        <a className="seller-button" href="/vendor-application">
          Become a seller <span aria-hidden="true">â†—</span>
        </a>
      </section>

      <footer className="site-footer">
        <Link className="brand footer-brand" href="/">
          <span className="brand-mark">M</span>
          <span>
            market<span className="brand-light">hub</span>
          </span>
        </Link>

        <span>Good finds start here.</span>
        <span>Â© 2026 MarketHub</span>
      </footer>
    </main>
  );
}

