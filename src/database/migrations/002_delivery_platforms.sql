-- ============================================================================
-- DELIVERY PLATFORM INTEGRATION
-- ============================================================================

CREATE TABLE delivery_platform_credentials (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    platform TEXT NOT NULL CHECK (platform IN ('doordash', 'ubereats', 'grubhub', 'postmates')),
    username TEXT NOT NULL,
    password_encrypted TEXT NOT NULL,
    portal_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_sync_at TIMESTAMP,
    last_sync_status TEXT,
    sync_config TEXT DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, platform)
);

CREATE TABLE delivery_platform_sync_logs (
    id TEXT PRIMARY KEY,
    credential_id TEXT NOT NULL REFERENCES delivery_platform_credentials(id),
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    platform TEXT NOT NULL,
    sync_type TEXT NOT NULL CHECK (sync_type IN ('menu_update', 'stock_update', 'price_update', 'full_sync')),
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed', 'partial')),
    items_synced INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    error_message TEXT,
    details TEXT DEFAULT '{}',
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE delivery_platform_menu_mappings (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
    platform TEXT NOT NULL,
    platform_item_id TEXT,
    platform_item_name TEXT,
    last_synced_at TIMESTAMP,
    sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, menu_item_id, platform)
);

CREATE INDEX idx_delivery_credentials_restaurant ON delivery_platform_credentials(restaurant_id);
CREATE INDEX idx_delivery_sync_logs_restaurant ON delivery_platform_sync_logs(restaurant_id);
CREATE INDEX idx_delivery_sync_logs_started ON delivery_platform_sync_logs(started_at);
CREATE INDEX idx_delivery_mappings_menu_item ON delivery_platform_menu_mappings(menu_item_id);
