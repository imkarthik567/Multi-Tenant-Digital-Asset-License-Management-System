-- ==============================================================================
-- AssetVault: Realistic Production Seed Data (06_seed.sql)
-- Course: VIT, BCSE307L Database Systems (Fall 2026-27)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Seed Roles
-- ------------------------------------------------------------------------------
INSERT INTO roles (id, name, description) VALUES
    (1, 'super_admin', 'Global platform administrator across all tenants'),
    (2, 'tenant_admin', 'Administrator with full management authority over tenant resources'),
    (3, 'asset_manager', 'Manager permitted to create, modify, and license assets'),
    (4, 'member', 'Standard employee with access to view, checkout, and download assets'),
    (5, 'auditor', 'Compliance officer with read-only access to audit trails and logs')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 2. Seed Tenants
-- ------------------------------------------------------------------------------
-- System Tenant (for Super Admin scope)
INSERT INTO tenants (id, name, slug, status, subscription_tier) VALUES
    ('00000000-0000-0000-0000-000000000000', 'AssetVault System', 'system', 'active', 'enterprise'),
    ('11111111-1111-1111-1111-111111111111', 'Acme Media Labs', 'acme-media', 'active', 'standard'),
    ('22222222-2222-2222-2222-222222222222', 'Nexus Tech Labs', 'nexus-tech', 'active', 'enterprise')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. Seed Users
-- Password for all seeded users is: Password123!
-- BCrypt Cost 12 Hash: $2b$12$K1nS5Jz8Q1iYmO0Z6XwBxe1hBvXmG8L8E3YvC5p4yD6J0vE1W3M2K
-- ------------------------------------------------------------------------------
INSERT INTO users (id, tenant_id, role_id, email, password_hash, full_name, avatar_url, is_active) VALUES
    -- Global Super Admin
    ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 1, 'superadmin@assetvault.internal', '$2b$12$K1nS5Jz8Q1iYmO0Z6XwBxe1hBvXmG8L8E3YvC5p4yD6J0vE1W3M2K', 'Karthikeyan System Admin', 'https://api.dicebear.com/7.x/bottts/svg?seed=superadmin', true),
    
    -- Acme Media Labs Users
    ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 2, 'alice.admin@acme.io', '$2b$12$K1nS5Jz8Q1iYmO0Z6XwBxe1hBvXmG8L8E3YvC5p4yD6J0vE1W3M2K', 'Alice Vance (Tenant Admin)', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice', true),
    ('a1111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 3, 'bob.manager@acme.io', '$2b$12$K1nS5Jz8Q1iYmO0Z6XwBxe1hBvXmG8L8E3YvC5p4yD6J0vE1W3M2K', 'Bob Martinez (Asset Manager)', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob', true),
    ('a1111111-1111-1111-1111-111111111113', '11111111-1111-1111-1111-111111111111', 4, 'charlie.designer@acme.io', '$2b$12$K1nS5Jz8Q1iYmO0Z6XwBxe1hBvXmG8L8E3YvC5p4yD6J0vE1W3M2K', 'Charlie Davis (Lead Designer)', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie', true),

    -- Nexus Tech Labs Users
    ('a2222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 2, 'david.admin@nexus.io', '$2b$12$K1nS5Jz8Q1iYmO0Z6XwBxe1hBvXmG8L8E3YvC5p4yD6J0vE1W3M2K', 'David Reynolds (VP Engineering)', 'https://api.dicebear.com/7.x/avataaars/svg?seed=David', true),
    ('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 4, 'eva.dev@nexus.io', '$2b$12$K1nS5Jz8Q1iYmO0Z6XwBxe1hBvXmG8L8E3YvC5p4yD6J0vE1W3M2K', 'Eva Chen (Senior AI Researcher)', 'https://api.dicebear.com/7.x/avataaars/svg?seed=Eva', true)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. Seed Vendors
-- ------------------------------------------------------------------------------
INSERT INTO vendors (id, tenant_id, name, contact_email, contact_phone, website_url, address) VALUES
    ('b1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Adobe Systems Inc.', 'enterprisesales@adobe.com', '+1-800-833-6687', 'https://adobe.com', '345 Park Avenue, San Jose, CA'),
    ('b1111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'Monotype Imaging', 'licensing@monotype.com', '+1-781-970-6000', 'https://monotype.com', '600 Unicorn Park Dr, Woburn, MA'),
    ('b2222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 'JetBrains s.r.o.', 'sales@jetbrains.com', '+420-241-722-540', 'https://jetbrains.com', 'Na hrebenech II 1718/8, Prague, CZ'),
    ('b2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Hugging Face Inc.', 'sales@huggingface.co', '+1-415-555-0199', 'https://huggingface.co', '230 9th St, San Francisco, CA')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. Seed Categories
-- ------------------------------------------------------------------------------
INSERT INTO categories (id, tenant_id, name, description, parent_category_id) VALUES
    ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Typography & Fonts', 'Commercial and open license digital typefaces', NULL),
    ('c1111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'Design & Creative Suites', 'Creative applications and motion graphics', NULL),
    ('c2222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 'Developer Tools & IDEs', 'Integrated development environments & compilers', NULL),
    ('c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'AI & Machine Learning Datasets', 'Curated vision and natural language training sets', NULL)
ON CONFLICT (id) DO NOTHING;

-- Sub-category
INSERT INTO categories (id, tenant_id, name, description, parent_category_id) VALUES
    ('c1111111-1111-1111-1111-111111111113', '11111111-1111-1111-1111-111111111111', 'Serif Web Fonts', 'Web-optimized serif typeface families', 'c1111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. Seed Tags
-- ------------------------------------------------------------------------------
INSERT INTO tags (id, tenant_id, name, color_hex) VALUES
    ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'brand-guideline', '#3B82F6'),
    ('d1111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'commercial-use', '#10B981'),
    ('d2222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 'production', '#EF4444'),
    ('d2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'nlp-models', '#8B5CF6')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 7. Seed Assets
-- ------------------------------------------------------------------------------
INSERT INTO assets (id, tenant_id, category_id, name, asset_type, description, file_url, file_size_bytes, mime_type, version, metadata, created_by_user_id) VALUES
    ('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111113', 'Helvetica Now Pro Complete Suite', 'font', 'Complete 48-font family OpenType layout for marketing', 'https://storage.assetvault.internal/acme/fonts/helvetica-now-pro.zip', 45000000, 'application/zip', '2.1.0', '{"weights": 48, "foundry": "Monotype", "format": "OTF"}'::jsonb, 'a1111111-1111-1111-1111-111111111112'),
    ('e1111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111112', 'Adobe Premiere Pro 2026 Production Master', 'software', 'Professional video editing binary suite installer', 'https://storage.assetvault.internal/acme/software/premiere-pro-2026.dmg', 1850000000, 'application/x-apple-diskimage', '26.0.1', '{"platform": "macOS-arm64", "min_ram_gb": 32}'::jsonb, 'a1111111-1111-1111-1111-111111111112'),
    ('e2222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222221', 'IntelliJ IDEA Ultimate 2026.2 Linux X64', 'software', 'Enterprise Java, Kotlin and TypeScript development environment', 'https://storage.assetvault.internal/nexus/binaries/ideaIU-2026.2.tar.gz', 1240000000, 'application/gzip', '2026.2.0', '{"build": "IU-262.1088", "jdk": "21"}'::jsonb, 'a2222222-2222-2222-2222-222222222221'),
    ('e2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'Nexus Multimodal Dialogue Corpus v4', 'dataset', '10M token dialogue dataset cleaned for conversational reasoning', 'https://storage.assetvault.internal/nexus/datasets/dialogue-corpus-v4.parquet', 8500000000, 'application/vnd.apache.parquet', '4.0.0', '{"sample_count": 10000000, "license": "Commercial Research"}'::jsonb, 'a2222222-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 8. Seed Asset Tags
-- ------------------------------------------------------------------------------
INSERT INTO asset_tags (id, asset_id, tag_id) VALUES
    (gen_random_uuid(), 'e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111'),
    (gen_random_uuid(), 'e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111112'),
    (gen_random_uuid(), 'e2222222-2222-2222-2222-222222222221', 'd2222222-2222-2222-2222-222222222221'),
    (gen_random_uuid(), 'e2222222-2222-2222-2222-222222222222', 'd2222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 9. Seed Licenses
-- ------------------------------------------------------------------------------
INSERT INTO licenses (id, tenant_id, vendor_id, name, license_key, license_type, total_seats, cost, currency, starts_at, expires_at, is_auto_renew, renewal_reminder_days, status) VALUES
    ('f1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'Adobe Creative Cloud All Apps - Enterprise 10 Seats', 'ADOBE-CC-2026-9938-X821', 'per_seat', 10, 899.99, 'USD', now() - INTERVAL '60 days', now() + INTERVAL '305 days', true, 30, 'active'),
    ('f1111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111112', 'Monotype Desktop Typography Studio Site License', 'MONO-CORP-SITE-88219-PRO', 'site', 100, 4500.00, 'USD', now() - INTERVAL '180 days', now() + INTERVAL '185 days', false, 45, 'active'),
    ('f2222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222221', 'JetBrains All Products Commercial Pack - 25 Seats', 'JB-ALLPACK-COMM-2026-NEXUS', 'per_seat', 25, 12490.00, 'USD', now() - INTERVAL '340 days', now() + INTERVAL '25 days', false, 30, 'active'),
    ('f2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', 'Hugging Face Enterprise Hub Access', 'HF-ENT-HUB-KEY-881920', 'subscription', 5, 2400.00, 'USD', now() - INTERVAL '10 days', now() + INTERVAL '355 days', true, 15, 'active')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 10. Seed Asset Licenses
-- ------------------------------------------------------------------------------
INSERT INTO asset_licenses (id, asset_id, license_id, notes) VALUES
    (gen_random_uuid(), 'e1111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111112', 'Governed by Monotype Studio Commercial Term'),
    (gen_random_uuid(), 'e1111111-1111-1111-1111-111111111112', 'f1111111-1111-1111-1111-111111111111', 'Enterprise All Apps provisioned seat'),
    (gen_random_uuid(), 'e2222222-2222-2222-2222-222222222221', 'f2222222-2222-2222-2222-222222222221', 'Developer seat assignment'),
    (gen_random_uuid(), 'e2222222-2222-2222-2222-222222222222', 'f2222222-2222-2222-2222-222222222222', 'Enterprise dataset download compliance')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 11. Seed License Allocations
-- ------------------------------------------------------------------------------
INSERT INTO license_allocations (id, license_id, user_id, allocated_at, notes) VALUES
    ('91111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111113', now() - INTERVAL '45 days', 'Assigned to Charlie Davis for Motion Design work'),
    ('92222222-2222-2222-2222-222222222221', 'f2222222-2222-2222-2222-222222222221', 'a2222222-2222-2222-2222-222222222222', now() - INTERVAL '120 days', 'Assigned to Eva Chen for model pipeline engineering')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 12. Seed Access Logs
-- ------------------------------------------------------------------------------
INSERT INTO asset_access_logs (id, asset_id, user_id, action, ip_address, user_agent) VALUES
    (gen_random_uuid(), 'e1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111113', 'download', '192.168.1.45', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/122.0.0.0'),
    (gen_random_uuid(), 'e2222222-2222-2222-2222-222222222221', 'a2222222-2222-2222-2222-222222222222', 'download', '10.0.4.12', 'Mozilla/5.0 (X11; Linux x86_64) Firefox/124.0')
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------------------------
-- 13. Seed Notifications
-- ------------------------------------------------------------------------------
INSERT INTO notifications (id, tenant_id, user_id, title, message, type, is_read) VALUES
    (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222221', 'License Renewal Warning: JetBrains Commercial Pack', 'The JetBrains All Products Commercial Pack expires in 25 days on ' || to_char(now() + INTERVAL '25 days', 'YYYY-MM-DD') || '. Immediate procurement action is advised.', 'renewal_due', false)
ON CONFLICT DO NOTHING;
