# Case Management System

A modern web application for managing cases with comprehensive filtering, analytics, and billing features built with Next.js 16 and Azure SQL Database.

## 🚀 Features

- **Case Management**: View, filter, add, edit cases with 40+ fields
- **Advanced Filtering**: By status, priority, team, office, region, industry, date ranges
- **Billing Management**: Monthly summaries, adjustments tracking, transaction details
- **Team Analytics**: Performance metrics, requestor tracking, trend analysis
- **Multiple Views**: Manager, Delivery, NPS, Region, Billing, Teams presets
- **Export**: Excel export with full case and billing details

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router) with TypeScript
- **UI**: React 19, Tailwind CSS
- **Database**: Azure SQL Database with mssql driver
- **Backend**: Server Actions
- **Date Handling**: date-fns
- **Export**: xlsx

## 📦 Installation & Development

### Prerequisites
- Node.js 18+ 
- Azure SQL Database with credentials

### Setup

1. **Clone and install dependencies**
```bash
git clone <your-repo-url>
cd case-management
npm install
```

2. **Configure environment variables**
```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=your-database-name
AZURE_SQL_USER=your-username
AZURE_SQL_PASSWORD=your-password
```

3. **Initialize database**
Run `schema.sql` in Azure Portal Query Editor or Azure Data Studio

4. **Start development server**
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## 🌐 Deploy to Vercel

### Option 1: Vercel Dashboard

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Add environment variables:
   - `AZURE_SQL_SERVER`
   - `AZURE_SQL_DATABASE`
   - `AZURE_SQL_USER`
   - `AZURE_SQL_PASSWORD`
4. Deploy

### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables
vercel env add AZURE_SQL_SERVER
vercel env add AZURE_SQL_DATABASE
vercel env add AZURE_SQL_USER
vercel env add AZURE_SQL_PASSWORD

# Deploy to production
vercel --prod
```

## 📁 Project Structure

```
src/
├── app/
│   ├── page.tsx          # Main application
│   ├── actions.ts        # Server actions
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── components/
│   ├── CaseForm.tsx      # Case form
│   ├── CaseTable.tsx     # Cases table
│   ├── CaseDrawer.tsx    # Details drawer
│   ├── Filters.tsx       # Filters
│   ├── BillingManager.tsx # Billing
│   ├── CaseMatrix.tsx    # Analytics
│   └── TeamManager.tsx   # Team analytics
└── lib/
    ├── azuresql.ts       # DB connection
    ├── db.ts             # Case queries
    ├── billingDb.ts      # Billing queries
    ├── types.ts          # TypeScript types
    ├── caseUtils.ts      # Utilities
    ├── formatters.ts     # Formatters
    └── styles.ts         # Styles
```

## 🗄️ Database

The application uses Azure SQL Database with the `case_manage` schema:

- `case_manage.cases` - Main cases table
- `case_manage.billing_adjustments` - Billing adjustments

The schema is isolated from other database objects for safety.

## 📝 Usage

### Adding a Case
1. Click "+ Add Case"
2. Fill required fields: Date Received, Team, Status, Client, Requestor
3. Add optional details (billing, timeline, deliverables)
4. Save

### Filtering
- Use quick filter buttons for status/priority
- Select team from dropdown
- Search across all fields
- Apply date range filters
- Switch between view presets

### Billing Management
1. Switch to "💰 Billing" view
2. View monthly summaries by case type
3. Add adjustments for corrections
4. Drill down to transaction details
5. Export to Excel

### Team Analytics
1. Switch to "👥 Teams" view
2. Review team performance metrics
3. Track requestor statistics
4. Export team reports

## 🔒 Security Notes

- Environment variables are required (no hardcoded credentials)
- All database operations use parameterized queries
- Server-side rendering with Server Actions
- Azure SQL encryption enabled

## 📄 License

MIT

---

For issues or questions, please open an issue on GitHub.

2. View team performance metrics
3. Analyze requestor activity
4. Track trends over time

### Exporting Data
- **Main View**: Click "📊 Export" button for full case export
- **Billing View**: Click "📊 Export to Excel" for billing reports
- Exports include all visible columns based on current view

## Key Features

### Auto-Generated Fields
- **Billing Case Code**: Auto-generates as `BC-YYYY-###` (e.g., BC-2026-001)
- **Timestamps**: `created_at` and `updated_at` auto-managed

### Smart Dropdowns
- **Status**: 11 predefined statuses (Not confirmed, In Progress, Delivered, etc.)
- **Priority**: P1, P1A, P2, P3
- **Team**: All teams from your data
- **Office**: 65 offices organized by region (EMEA, Americas, APAC)
- **Level**: Top 20 partner levels (Partner, Consultant, Manager, etc.)
- **Currency**: 18 currencies (USD, EUR, GBP, etc.)
- **CD/Client**: CD, Client, TBD

### Data Caching
- In-memory server-side cache (30 seconds)
- Automatic cache invalidation on data changes
- Optimized for fast page loads

### View Presets
- **Manager**: Essential columns for case oversight
- **All Data**: Complete view with all 40+ fields
- **Delivery**: Focus on delivery dates and status
- **NPS**: NPS-flagged cases only
- **Region**: Office and region focus
- **Billing**: Financial and billing details
- **Teams**: Team-focused analytics
- **Custom**: Save your own column selections

## Scripts

```bash
npm run dev          # Start development server (Turbopack)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## Security Notes

**Environment Variables:**
- Never commit `.env.local` to version control
- Use Azure Key Vault or similar for production secrets
- Rotate database passwords regularly

**Database Access:**
- Uses parameterized queries to prevent SQL injection
- Server Actions ensure database operations run server-side only
- Connection pooling for optimal performance

## Performance Optimizations

- **Server-Side Caching**: Reduces database calls
- **Connection Pooling**: Reuses database connections
- **Incremental Loading**: Load initial batch quickly, fetch more as needed
- **Indexed Queries**: Database indexes on frequently queried columns
- **Column Pruning**: Only select needed columns for list views

## Troubleshooting

### Can't connect to database
- Verify Azure SQL firewall allows your IP
- Check credentials in `.env.local`
- Ensure server name doesn't include protocol (no `https://`)

### TypeScript errors after pull
```bash
npm install              # Reinstall dependencies
rm -rf .next             # Clear Next.js cache
npm run dev              # Rebuild
```

### Data not refreshing
- Server cache is 30 seconds - wait briefly
- Force refresh by reloading page
- Check browser console for errors

## Contributing

1. Make changes in feature branch
2. Test locally with `npm run dev`
3. Ensure no TypeScript errors: `npm run build`
4. Test all CRUD operations
5. Submit pull request

## License

MIT
