-- ====================================================================
-- KOBBY SMS MESSAGING SYSTEM SCHEMA
-- Prefix: ks_ (Kobby SMS)
-- ====================================================================

-- 1. Constituents & Contact Directory Table
CREATE TABLE IF NOT EXISTS ks_constituents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    electoral_area TEXT NOT NULL DEFAULT 'Other',
    gender TEXT,
    occupation TEXT,
    notes TEXT DEFAULT '',
    source TEXT DEFAULT 'manual', -- 'manual', 'import', 'kobbydrive', 'registration'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint on phone_number so contacts don't duplicate
CREATE UNIQUE INDEX IF NOT EXISTS idx_ks_constituents_phone ON ks_constituents(phone_number);
CREATE INDEX IF NOT EXISTS idx_ks_constituents_locality ON ks_constituents(electoral_area);
CREATE INDEX IF NOT EXISTS idx_ks_constituents_created ON ks_constituents(created_at DESC);

-- 2. Message Templates for MP Communications
CREATE TABLE IF NOT EXISTS ks_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General', -- 'Announcement', 'Festival', 'Townhall', 'Emergency', 'Development'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Broadcast Campaigns
CREATE TABLE IF NOT EXISTS ks_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    sender_id TEXT NOT NULL DEFAULT 'KOBBYMP',
    message TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT 'all', -- 'all', 'localities', 'custom'
    target_localities JSONB DEFAULT '[]'::jsonb,
    total_recipients INT NOT NULL DEFAULT 0,
    successful_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', -- 'draft', 'sending', 'completed', 'failed'
    sent_by TEXT DEFAULT 'Hon. Kwabena Okyere Darko-Mensah MP Office',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- 4. Individual SMS Delivery Logs
CREATE TABLE IF NOT EXISTS ks_sms_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES ks_campaigns(id) ON DELETE SET NULL,
    recipient_name TEXT,
    phone_number TEXT NOT NULL,
    electoral_area TEXT,
    message TEXT NOT NULL,
    sender_id TEXT NOT NULL DEFAULT 'KOBBYMP',
    status TEXT NOT NULL DEFAULT 'pending', -- 'sent', 'failed', 'delivered'
    gateway_response JSONB,
    cost_units NUMERIC DEFAULT 1.0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ks_sms_logs_campaign ON ks_sms_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ks_sms_logs_phone ON ks_sms_logs(phone_number);
CREATE INDEX IF NOT EXISTS idx_ks_sms_logs_created ON ks_sms_logs(created_at DESC);

-- 5. System Settings & Localities list
CREATE TABLE IF NOT EXISTS ks_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security
ALTER TABLE ks_constituents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ks_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ks_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ks_sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ks_settings ENABLE ROW LEVEL SECURITY;

-- Permissive policies for our API & Dashboard access
DROP POLICY IF EXISTS ks_constituents_all ON ks_constituents;
CREATE POLICY ks_constituents_all ON ks_constituents FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ks_templates_all ON ks_templates;
CREATE POLICY ks_templates_all ON ks_templates FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ks_campaigns_all ON ks_campaigns;
CREATE POLICY ks_campaigns_all ON ks_campaigns FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ks_sms_logs_all ON ks_sms_logs;
CREATE POLICY ks_sms_logs_all ON ks_sms_logs FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS ks_settings_all ON ks_settings;
CREATE POLICY ks_settings_all ON ks_settings FOR ALL TO anon, authenticated, service_role USING (true) WITH CHECK (true);

-- Insert Default Takoradi Electoral Areas / Localities into ks_settings
INSERT INTO ks_settings (key, value)
VALUES (
    'takoradi_localities',
    '["Airport Ridge", "Airforce", "Airforce ( Airforce, adakope, kokompe & princess)", "Amanful East", "Amanful West", "Beach Road", "Cassava Farm", "Chapel Hill", "Essikafo Ambitem No. 1", "Essikafo Ambitem No. 2", "New-Takoradi Lower", "Old Adra", "Poasi - Upper New-Takoradi", "Presby", "Railway & Harbour", "Zenith", "Other"]'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Seed Default SMS Templates for Hon. MP
INSERT INTO ks_templates (title, category, content)
VALUES
(
    'Community Townhall Invitation',
    'Townhall',
    'Dear Constituent, Hon. Kwabena Okyere Darko-Mensah invites you to an open Community Townhall Meeting this Saturday at 3:00 PM. Let us discuss Takoradi development together. See you there!'
),
(
    'Infrastructure & Road Project Update',
    'Development',
    'Good day! Hon. Kobby Darko-Mensah wishes to update residents of {locality} that rehabilitation works on our inner roads and drainage systems have commenced. Takoradi forward!'
),
(
    'Kundu Festival / Festive Greetings',
    'Festival',
    'On behalf of Hon. Kwabena Okyere Darko-Mensah, MP for Takoradi, I wish you and your family joyful celebrations and abundant blessings. May Takoradi prosper!'
),
(
    'Kobby Youth Empowerment Announcement',
    'Announcement',
    'Youth Empowerment Alert: Registration for the next cohort of skill acquisition & empowerment programs by Hon. Kobby Darko-Mensah is now open. Visit the MP Constituency Office for info.'
)
ON CONFLICT DO NOTHING;

-- Populate ks_constituents from distinct clean phone numbers from kbdr_applications
WITH distinct_candidates AS (
    SELECT DISTINCT ON (REGEXP_REPLACE(phone_number, '[^\d+]', '', 'g'))
        surname AS first_name,
        last_name AS last_name,
        REGEXP_REPLACE(phone_number, '[^\d+]', '', 'g') AS cleaned_phone,
        COALESCE(NULLIF(electoral_area, ''), 'Other') AS electoral_area,
        gender
    FROM kbdr_applications
    WHERE phone_number IS NOT NULL 
      AND LENGTH(REGEXP_REPLACE(phone_number, '[^\d+]', '', 'g')) >= 9
    ORDER BY REGEXP_REPLACE(phone_number, '[^\d+]', '', 'g'), created_at DESC
)
INSERT INTO ks_constituents (first_name, last_name, phone_number, electoral_area, gender, source)
SELECT first_name, last_name, cleaned_phone, electoral_area, gender, 'kobbydrive'
FROM distinct_candidates
ON CONFLICT (phone_number) DO NOTHING;
