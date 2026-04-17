-- ============================================================
-- KavachAI — Zone Seeding (No PostGIS)
-- Migration 02: Pre-load Q-Commerce zones
-- Phase 1 cities: Delhi NCR, Mumbai, Bengaluru, Hyderabad, Pune, Kolkata
-- Boundary stored as WKT text (no PostGIS extension needed)
-- ============================================================

-- ── DELHI NCR ZONES ──────────────────────────────────────────────────────────

INSERT INTO zones (zone_code, zone_name, city, geohash, boundary, risk_multiplier) VALUES

('delhi_rohini',
 'Rohini, Delhi',
 'delhi_ncr',
 'ttnf',
 'POLYGON((77.0900 28.7100, 77.1400 28.7100, 77.1400 28.7500, 77.0900 28.7500, 77.0900 28.7100))',
 2.6),

('delhi_dwarka',
 'Dwarka, Delhi',
 'delhi_ncr',
 'ttmc',
 'POLYGON((76.9700 28.5500, 77.0200 28.5500, 77.0200 28.6000, 76.9700 28.6000, 76.9700 28.5500))',
 2.4),

('delhi_lajpat_nagar',
 'Lajpat Nagar, Delhi',
 'delhi_ncr',
 'ttnk',
 'POLYGON((77.2300 28.5600, 77.2700 28.5600, 77.2700 28.5900, 77.2300 28.5900, 77.2300 28.5600))',
 2.6),

('delhi_karol_bagh',
 'Karol Bagh, Delhi',
 'delhi_ncr',
 'ttnj',
 'POLYGON((77.1800 28.6400, 77.2100 28.6400, 77.2100 28.6600, 77.1800 28.6600, 77.1800 28.6400))',
 2.5),

('delhi_saket',
 'Saket, Delhi',
 'delhi_ncr',
 'ttnm',
 'POLYGON((77.2000 28.5200, 77.2300 28.5200, 77.2300 28.5400, 77.2000 28.5400, 77.2000 28.5200))',
 2.4),

('gurgaon_cyber_city',
 'Cyber City, Gurgaon',
 'delhi_ncr',
 'ttmg',
 'POLYGON((77.0700 28.4900, 77.1100 28.4900, 77.1100 28.5200, 77.0700 28.5200, 77.0700 28.4900))',
 2.3),

-- ── MUMBAI ZONES ─────────────────────────────────────────────────────────────

('mumbai_kurla',
 'Kurla, Mumbai',
 'mumbai',
 'te7u',
 'POLYGON((72.8700 19.0600, 72.9000 19.0600, 72.9000 19.0850, 72.8700 19.0850, 72.8700 19.0600))',
 2.4),

('mumbai_andheri_west',
 'Andheri West, Mumbai',
 'mumbai',
 'te7t',
 'POLYGON((72.8200 19.1200, 72.8550 19.1200, 72.8550 19.1500, 72.8200 19.1500, 72.8200 19.1200))',
 2.2),

('mumbai_bandra',
 'Bandra, Mumbai',
 'mumbai',
 'te7s',
 'POLYGON((72.8200 19.0500, 72.8550 19.0500, 72.8550 19.0800, 72.8200 19.0800, 72.8200 19.0500))',
 2.4),

('mumbai_malad',
 'Malad, Mumbai',
 'mumbai',
 'te7v',
 'POLYGON((72.8300 19.1700, 72.8700 19.1700, 72.8700 19.2000, 72.8300 19.2000, 72.8300 19.1700))',
 2.3),

('mumbai_thane',
 'Thane West, Mumbai',
 'mumbai',
 'te7y',
 'POLYGON((72.9600 19.2000, 73.0100 19.2000, 73.0100 19.2500, 72.9600 19.2500, 72.9600 19.2000))',
 2.1),

-- ── BENGALURU ZONES ───────────────────────────────────────────────────────────

('bengaluru_koramangala',
 'Koramangala, Bengaluru',
 'bengaluru',
 'tdr1',
 'POLYGON((77.6200 12.9200, 77.6500 12.9200, 77.6500 12.9450, 77.6200 12.9450, 77.6200 12.9200))',
 1.4),

('bengaluru_hsr_layout',
 'HSR Layout, Bengaluru',
 'bengaluru',
 'tdr0',
 'POLYGON((77.6400 12.9000, 77.6750 12.9000, 77.6750 12.9200, 77.6400 12.9200, 77.6400 12.9000))',
 1.4),

('bengaluru_whitefield',
 'Whitefield, Bengaluru',
 'bengaluru',
 'tdr7',
 'POLYGON((77.7400 12.9600, 77.7800 12.9600, 77.7800 12.9900, 77.7400 12.9900, 77.7400 12.9600))',
 1.3),

('bengaluru_jp_nagar',
 'JP Nagar, Bengaluru',
 'bengaluru',
 'tdqx',
 'POLYGON((77.5800 12.9000, 77.6100 12.9000, 77.6100 12.9200, 77.5800 12.9200, 77.5800 12.9000))',
 1.5),

-- ── HYDERABAD ZONES ───────────────────────────────────────────────────────────

('hyderabad_hitech_city',
 'HiTech City, Hyderabad',
 'hyderabad',
 'tep1',
 'POLYGON((78.3700 17.4400, 78.4000 17.4400, 78.4000 17.4700, 78.3700 17.4700, 78.3700 17.4400))',
 1.9),

('hyderabad_banjara_hills',
 'Banjara Hills, Hyderabad',
 'hyderabad',
 'tenh',
 'POLYGON((78.4100 17.4100, 78.4400 17.4100, 78.4400 17.4300, 78.4100 17.4300, 78.4100 17.4100))',
 1.9),

-- ── PUNE ZONES ────────────────────────────────────────────────────────────────

('pune_kothrud',
 'Kothrud, Pune',
 'pune',
 'tdn4',
 'POLYGON((73.8100 18.5000, 73.8400 18.5000, 73.8400 18.5250, 73.8100 18.5250, 73.8100 18.5000))',
 1.7),

('pune_viman_nagar',
 'Viman Nagar, Pune',
 'pune',
 'tdn6',
 'POLYGON((73.9100 18.5600, 73.9400 18.5600, 73.9400 18.5850, 73.9100 18.5850, 73.9100 18.5600))',
 1.6),

-- ── KOLKATA ZONES ─────────────────────────────────────────────────────────────

('kolkata_salt_lake',
 'Salt Lake, Kolkata',
 'kolkata',
 'tgkm',
 'POLYGON((88.4000 22.5700, 88.4300 22.5700, 88.4300 22.6000, 88.4000 22.6000, 88.4000 22.5700))',
 2.1),

('kolkata_park_street',
 'Park Street, Kolkata',
 'kolkata',
 'tgkj',
 'POLYGON((88.3500 22.5400, 88.3800 22.5400, 88.3800 22.5650, 88.3500 22.5650, 88.3500 22.5400))',
 2.0);

-- ── REFRESH ─────────────────────────────────────────────────────────────────
ANALYZE zones;
