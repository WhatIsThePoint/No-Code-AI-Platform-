-- Test fixture for the SQL Connector Wizard (Postgres flavour).
--
-- Three small tables — wide-enough rows that the data-ingestion pipeline
-- can profile something meaningful, narrow-enough that the entire dataset
-- fits in one screen for the demo. Schema is deliberately mundane (a
-- pretend retail-analytics dataset) so it doesn't surprise a panel of
-- reviewers with anything domain-specific.

CREATE TABLE IF NOT EXISTS customers (
    customer_id   SERIAL PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    full_name     VARCHAR(120) NOT NULL,
    country       VARCHAR(2)   NOT NULL,
    signup_date   DATE         NOT NULL,
    lifetime_spend NUMERIC(10, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
    product_id    SERIAL PRIMARY KEY,
    sku           VARCHAR(40) UNIQUE NOT NULL,
    name          VARCHAR(120) NOT NULL,
    category      VARCHAR(60)  NOT NULL,
    unit_price    NUMERIC(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    order_id      SERIAL PRIMARY KEY,
    customer_id   INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    product_id    INTEGER NOT NULL REFERENCES products(product_id),
    quantity      INTEGER NOT NULL,
    order_total   NUMERIC(10, 2) NOT NULL,
    placed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON orders (placed_at);

-- ── seed: customers ─────────────────────────────────────────────────────────
INSERT INTO customers (email, full_name, country, signup_date, lifetime_spend) VALUES
    ('alice@example.com',  'Alice Martin',   'FR', '2025-01-12',  482.50),
    ('bob@example.com',    'Bob Chen',       'US', '2025-02-03', 1240.00),
    ('clara@example.com',  'Clara Rossi',    'IT', '2025-02-22',   89.75),
    ('diego@example.com',  'Diego Alvarez',  'ES', '2025-03-08',  601.20),
    ('emma@example.com',   'Emma Schmidt',   'DE', '2025-03-19',   45.00),
    ('felix@example.com',  'Felix Bauer',    'AT', '2025-04-01',  812.45),
    ('gina@example.com',   'Gina Park',      'KR', '2025-04-12',  234.00),
    ('hari@example.com',   'Hari Nambiar',   'IN', '2025-05-02',  118.30)
ON CONFLICT (email) DO NOTHING;

-- ── seed: products ─────────────────────────────────────────────────────────
INSERT INTO products (sku, name, category, unit_price) VALUES
    ('SKU-001', 'Wireless Mouse',    'electronics', 24.99),
    ('SKU-002', 'Mechanical Keyboard','electronics', 89.50),
    ('SKU-003', 'USB-C Hub',         'electronics', 34.00),
    ('SKU-004', 'Coffee Beans 1kg',  'grocery',     18.75),
    ('SKU-005', 'Notebook A5',       'stationery',   8.40),
    ('SKU-006', 'Desk Lamp',         'home',        42.00),
    ('SKU-007', 'Yoga Mat',          'fitness',     29.99),
    ('SKU-008', 'Water Bottle',      'fitness',     14.50)
ON CONFLICT (sku) DO NOTHING;

-- ── seed: orders ────────────────────────────────────────────────────────────
INSERT INTO orders (customer_id, product_id, quantity, order_total, placed_at) VALUES
    (1, 2, 1,  89.50, '2025-04-15 09:12:00'),
    (1, 5, 3,  25.20, '2025-04-22 14:33:00'),
    (2, 1, 2,  49.98, '2025-03-12 11:05:00'),
    (2, 3, 1,  34.00, '2025-04-02 17:21:00'),
    (2, 6, 2,  84.00, '2025-04-30 08:50:00'),
    (3, 5, 1,   8.40, '2025-03-04 12:40:00'),
    (4, 4, 4,  75.00, '2025-04-08 19:18:00'),
    (4, 7, 1,  29.99, '2025-04-19 07:02:00'),
    (5, 5, 2,  16.80, '2025-04-12 16:55:00'),
    (6, 6, 1,  42.00, '2025-04-25 10:00:00'),
    (6, 2, 1,  89.50, '2025-04-29 22:14:00'),
    (7, 8, 3,  43.50, '2025-04-30 09:30:00'),
    (8, 1, 1,  24.99, '2025-05-01 13:12:00')
ON CONFLICT DO NOTHING;

-- ── ML demo table ───────────────────────────────────────────────────────────
-- A single wide, denormalised table the SQL Connector can pull with
-- `SELECT * FROM customer_churn`. 800 deterministic rows with a real
-- signal-plus-noise relationship so a classifier trained from the wizard
-- lands around 0.85 accuracy — high enough to demo, not a giveaway.
-- Target column: `churned` (0/1).
CREATE TABLE IF NOT EXISTS customer_churn (
    customer_id         SERIAL PRIMARY KEY,
    tenure_months       INTEGER       NOT NULL,
    monthly_charges     NUMERIC(7, 2) NOT NULL,
    total_charges       NUMERIC(10, 2) NOT NULL,
    num_support_tickets INTEGER       NOT NULL,
    contract_type       VARCHAR(12)   NOT NULL,
    has_premium_support SMALLINT      NOT NULL,
    country             VARCHAR(2)    NOT NULL,
    churned             SMALLINT      NOT NULL
);

INSERT INTO customer_churn
    (tenure_months, monthly_charges, total_charges, num_support_tickets,
     contract_type, has_premium_support, country, churned)
SELECT
    v.t,
    v.mc,
    round(v.mc * v.t, 2),
    v.st,
    v.ct,
    v.ps,
    v.cy,
    CASE WHEN (
          (CASE WHEN v.ct = 'monthly'  THEN 0.35 ELSE 0 END)
        + (CASE WHEN v.t  < 6          THEN 0.30 ELSE 0 END)
        + (CASE WHEN v.mc > 80         THEN 0.20 ELSE 0 END)
        + (v.st * 0.05)
        - (CASE WHEN v.ps = 1          THEN 0.15 ELSE 0 END)
        + ((g % 7) - 3) * 0.03
    ) > 0.28 THEN 1 ELSE 0 END
FROM generate_series(1, 800) AS g
CROSS JOIN LATERAL (SELECT
    1  + (g * 7  % 60)                                       AS t,
    (20 + (g * 13 % 90))::numeric(7,2)                       AS mc,
    (g * 3 % 9)                                              AS st,
    (ARRAY['monthly','annual','two_year'])[1 + (g % 3)]      AS ct,
    (g % 2)                                                  AS ps,
    (ARRAY['FR','US','IT','ES','DE','IN','KR','BR'])[1 + (g % 8)] AS cy
) AS v
WHERE NOT EXISTS (SELECT 1 FROM customer_churn);
