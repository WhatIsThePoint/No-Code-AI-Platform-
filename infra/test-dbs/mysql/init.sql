-- Test fixture for the SQL Connector Wizard (MySQL flavour).
-- Same dataset as the Postgres seed — exercising the same wizard flow
-- against both engines confirms the cross-dialect SQLAlchemy probe.

CREATE TABLE IF NOT EXISTS customers (
    customer_id     INT AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    full_name       VARCHAR(120) NOT NULL,
    country         CHAR(2)      NOT NULL,
    signup_date     DATE         NOT NULL,
    lifetime_spend  DECIMAL(10, 2) NOT NULL DEFAULT 0
) ENGINE=InnoDB CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS products (
    product_id   INT AUTO_INCREMENT PRIMARY KEY,
    sku          VARCHAR(40) NOT NULL UNIQUE,
    name         VARCHAR(120) NOT NULL,
    category     VARCHAR(60)  NOT NULL,
    unit_price   DECIMAL(10, 2) NOT NULL
) ENGINE=InnoDB CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
    order_id     INT AUTO_INCREMENT PRIMARY KEY,
    customer_id  INT NOT NULL,
    product_id   INT NOT NULL,
    quantity     INT NOT NULL,
    order_total  DECIMAL(10, 2) NOT NULL,
    placed_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_orders_customer (customer_id),
    INDEX idx_orders_placed_at (placed_at),
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id)  REFERENCES products(product_id)
) ENGINE=InnoDB CHARSET=utf8mb4;

INSERT IGNORE INTO customers (email, full_name, country, signup_date, lifetime_spend) VALUES
    ('alice@example.com',  'Alice Martin',   'FR', '2025-01-12',  482.50),
    ('bob@example.com',    'Bob Chen',       'US', '2025-02-03', 1240.00),
    ('clara@example.com',  'Clara Rossi',    'IT', '2025-02-22',   89.75),
    ('diego@example.com',  'Diego Alvarez',  'ES', '2025-03-08',  601.20),
    ('emma@example.com',   'Emma Schmidt',   'DE', '2025-03-19',   45.00),
    ('felix@example.com',  'Felix Bauer',    'AT', '2025-04-01',  812.45),
    ('gina@example.com',   'Gina Park',      'KR', '2025-04-12',  234.00),
    ('hari@example.com',   'Hari Nambiar',   'IN', '2025-05-02',  118.30);

INSERT IGNORE INTO products (sku, name, category, unit_price) VALUES
    ('SKU-001', 'Wireless Mouse',     'electronics', 24.99),
    ('SKU-002', 'Mechanical Keyboard','electronics', 89.50),
    ('SKU-003', 'USB-C Hub',          'electronics', 34.00),
    ('SKU-004', 'Coffee Beans 1kg',   'grocery',     18.75),
    ('SKU-005', 'Notebook A5',        'stationery',   8.40),
    ('SKU-006', 'Desk Lamp',          'home',        42.00),
    ('SKU-007', 'Yoga Mat',           'fitness',     29.99),
    ('SKU-008', 'Water Bottle',       'fitness',     14.50);

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
    (8, 1, 1,  24.99, '2025-05-01 13:12:00');

-- ── ML demo table ───────────────────────────────────────────────────────────
-- Mirror of the Postgres customer_churn fixture: 800 deterministic rows,
-- pull with `SELECT * FROM customer_churn`, target column `churned` (0/1).
CREATE TABLE IF NOT EXISTS customer_churn (
    customer_id         INT AUTO_INCREMENT PRIMARY KEY,
    tenure_months       INT           NOT NULL,
    monthly_charges     DECIMAL(7, 2) NOT NULL,
    total_charges       DECIMAL(10, 2) NOT NULL,
    num_support_tickets INT           NOT NULL,
    contract_type       VARCHAR(12)   NOT NULL,
    has_premium_support TINYINT       NOT NULL,
    country             CHAR(2)       NOT NULL,
    churned             TINYINT       NOT NULL
) ENGINE=InnoDB CHARSET=utf8mb4;

INSERT INTO customer_churn
    (tenure_months, monthly_charges, total_charges, num_support_tickets,
     contract_type, has_premium_support, country, churned)
WITH RECURSIVE seq(g) AS (
    SELECT 1 UNION ALL SELECT g + 1 FROM seq WHERE g < 800
),
base AS (
    SELECT
        g,
        1  + (g * 7  MOD 60)                             AS t,
        20 + (g * 13 MOD 90)                             AS mc,
        (g * 3 MOD 9)                                    AS st,
        ELT(1 + (g MOD 3), 'monthly','annual','two_year') AS ct,
        (g MOD 2)                                        AS ps,
        ELT(1 + (g MOD 8), 'FR','US','IT','ES','DE','IN','KR','BR') AS cy
    FROM seq
)
SELECT
    t, mc, ROUND(mc * t, 2), st, ct, ps, cy,
    CASE WHEN (
          (CASE WHEN ct = 'monthly' THEN 0.35 ELSE 0 END)
        + (CASE WHEN t  < 6         THEN 0.30 ELSE 0 END)
        + (CASE WHEN mc > 80        THEN 0.20 ELSE 0 END)
        + (st * 0.05)
        - (CASE WHEN ps = 1         THEN 0.15 ELSE 0 END)
        + ((g MOD 7) - 3) * 0.03
    ) > 0.28 THEN 1 ELSE 0 END
FROM base
WHERE (SELECT COUNT(*) FROM customer_churn) = 0;
