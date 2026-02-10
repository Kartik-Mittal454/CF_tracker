-- =====================================================
-- Azure SQL Schema for Case Management System
-- =====================================================
-- Server: sql-srv-bcncopor-ci-d-467.database.windows.net
-- Database: sql-db-bcncopor-ci-d-467
-- Schema: case_manage (isolated from existing tables)
-- =====================================================

-- 1. CREATE SCHEMA
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'case_manage')
BEGIN
    EXEC('CREATE SCHEMA case_manage')
    PRINT '✅ Schema case_manage created'
END
ELSE
BEGIN
    PRINT 'ℹ️ Schema case_manage already exists'
END
GO

-- 2. CREATE CASES TABLE
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'case_manage.cases') AND type = 'U')
BEGIN
    CREATE TABLE case_manage.cases (
        -- Primary Key
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        
        -- IDs & References
        billing_case_code NVARCHAR(255) NULL,
        cd_client NVARCHAR(255) NULL,
        
        -- Core Fields
        date_received DATE NULL,
        team NVARCHAR(255) NULL,
        status NVARCHAR(255) NULL,
        
        -- Requestor & Geography
        requestor NVARCHAR(255) NULL,
        nps_flag NVARCHAR(500) NULL,
        level NVARCHAR(100) NULL,
        office NVARCHAR(255) NULL,
        region NVARCHAR(255) NULL,
        
        -- Client & Classification
        client NVARCHAR(500) NULL,
        priority_level NVARCHAR(100) NULL,
        industry NVARCHAR(255) NULL,
        bain_industry_classification NVARCHAR(255) NULL,
        
        -- Request Content & Delivery
        scope_of_request NVARCHAR(MAX) NULL,
        delivered_request NVARCHAR(MAX) NULL,
        promised_date_for_delivery DATE NULL,
        actual_date_for_delivery DATE NULL,
        date_for_client_meeting DATE NULL,
        
        -- Commercial / Billing
        currency NVARCHAR(10) NULL,
        amount NVARCHAR(50) NULL,
        type NVARCHAR(255) NULL,
        add_on_ip_delivered NVARCHAR(MAX) NULL,
        add_ons_billing NVARCHAR(MAX) NULL,
        add_ons_only NVARCHAR(MAX) NULL,
        billing NVARCHAR(MAX) NULL,
        
        -- Additional Requestors
        additional_requestor1 NVARCHAR(255) NULL,
        additional_requestor1_level NVARCHAR(100) NULL,
        additional_requestor2 NVARCHAR(255) NULL,
        additional_requestor2_level NVARCHAR(100) NULL,
        
        -- Post-delivery
        post_delivery_reachouts NVARCHAR(MAX) NULL,
        response_received NVARCHAR(MAX) NULL,
        deck_material_shared NVARCHAR(MAX) NULL,
        next_steps NVARCHAR(MAX) NULL,
        
        -- JSON Fields
        comments NVARCHAR(MAX) NULL DEFAULT '[]',
        activity_log NVARCHAR(MAX) NULL DEFAULT '[]',
        
        -- Timestamps
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    )

    PRINT '✅ Table case_manage.cases created'
    
    -- Create indexes
    CREATE INDEX idx_cases_date_received ON case_manage.cases(date_received DESC)
    CREATE INDEX idx_cases_status ON case_manage.cases(status)
    CREATE INDEX idx_cases_team ON case_manage.cases(team)
    CREATE INDEX idx_cases_requestor ON case_manage.cases(requestor)
    
    PRINT '✅ Indexes created on case_manage.cases'
END
ELSE
BEGIN
    PRINT 'ℹ️ Table case_manage.cases already exists'
END
GO

-- Create trigger for updated_at
IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_cases_updated_at')
BEGIN
    EXEC('
    CREATE TRIGGER case_manage.trg_cases_updated_at
    ON case_manage.cases
    AFTER UPDATE
    AS
    BEGIN
        SET NOCOUNT ON;
        UPDATE case_manage.cases
        SET updated_at = GETDATE()
        FROM case_manage.cases c
        INNER JOIN inserted i ON c.id = i.id
    END
    ')
    PRINT '✅ Trigger trg_cases_updated_at created'
END
GO

-- 3. CREATE BILLING ADJUSTMENTS TABLE
-- =====================================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'case_manage.billing_adjustments') AND type = 'U')
BEGIN
    CREATE TABLE case_manage.billing_adjustments (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        month INT NOT NULL CHECK (month >= 1 AND month <= 12),
        year INT NOT NULL CHECK (year >= 2000 AND year <= 2100),
        type NVARCHAR(255) NOT NULL,
        amount DECIMAL(18, 2) NOT NULL,
        reason NVARCHAR(MAX) NOT NULL,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    )

    PRINT '✅ Table case_manage.billing_adjustments created'
    
    -- Create indexes
    CREATE INDEX idx_billing_adjustments_year_month ON case_manage.billing_adjustments(year, month)
    CREATE INDEX idx_billing_adjustments_type ON case_manage.billing_adjustments(type)
    
    PRINT '✅ Indexes created on case_manage.billing_adjustments'
END
ELSE
BEGIN
    PRINT 'ℹ️ Table case_manage.billing_adjustments already exists'
END
GO

-- Create trigger for updated_at
IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'trg_billing_adjustments_updated_at')
BEGIN
    EXEC('
    CREATE TRIGGER case_manage.trg_billing_adjustments_updated_at
    ON case_manage.billing_adjustments
    AFTER UPDATE
    AS
    BEGIN
        SET NOCOUNT ON;
        UPDATE case_manage.billing_adjustments
        SET updated_at = GETDATE()
        FROM case_manage.billing_adjustments ba
        INNER JOIN inserted i ON ba.id = i.id
    END
    ')
    PRINT '✅ Trigger trg_billing_adjustments_updated_at created'
END
GO

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these to verify setup:

-- Check schema exists
-- SELECT * FROM sys.schemas WHERE name = 'case_manage'

-- Check tables exist
-- SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'case_manage'

-- Verify data
-- SELECT COUNT(*) as total_cases FROM case_manage.cases
-- SELECT COUNT(*) as total_adjustments FROM case_manage.billing_adjustments
