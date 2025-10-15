# Database Viewing Tools

This guide shows you how to view your database tables in a properly formatted way.

## Available Scripts

### 1. Basic Database Viewer
```bash
node verify-database.js
```
- Shows all tables with basic formatting
- Good for quick overview
- Enhanced with table formatting

### 2. Advanced Formatted Viewer
```bash
node view-database-formatted.js
```
- Shows data in beautiful table format
- Better column alignment
- Truncates long values for readability

### 3. Advanced Database Viewer
```bash
node view-database-advanced.js
```
- Most advanced formatting with Unicode box characters
- Better visual separation
- Configurable column widths

### 4. Single Table Viewer
```bash
# View specific table
node view-table.js users 10
node view-table.js auctions 5 created_at
node view-table.js meetings 20

# Usage: node view-table.js <table_name> [limit] [order_by]
```

### 5. Database Dashboard
```bash
node database-dashboard.js
```
- Comprehensive database analysis
- System health check
- User analytics
- Performance metrics
- Recommendations

## Table Names Available

- `users` - User accounts
- `auctions` - Auction listings
- `meetings` - Meeting rooms
- `meeting_access_logs` - Access tracking
- `notifications` - User notifications
- `para_sessions` - Para authentication sessions
- `lit_gate_passes` - NFT gating passes

## Examples

### View Recent Users
```bash
node view-table.js users 5
```

### View Active Auctions
```bash
node view-table.js auctions 10 created_at
```

### View All Meetings
```bash
node view-table.js meetings 20
```

### Get Database Overview
```bash
node database-dashboard.js
```

## Database Connection

All scripts use the same database configuration:
- Production: `postgresql://entangle_user:entangle_secure_2024@209.38.123.139:5432/entangle_meetings`
- Local: Uses environment variables from `.env` file

## Troubleshooting

If you get connection timeouts:
1. Make sure you're running on the server (209.38.123.139)
2. Check your network connection
3. Verify database credentials

## Tips

1. **Start with the dashboard** - `node database-dashboard.js` gives you the best overview
2. **Use specific table viewer** - `node view-table.js <table>` for focused data
3. **Check system health** - The dashboard shows orphaned records and issues
4. **Monitor activity** - Use the dashboard to track user engagement

## Output Format

All scripts provide:
- ✅ Formatted tables with proper alignment
- 📊 Summary statistics
- 🔍 Health checks
- 💡 Recommendations
- ⚠️ Warnings for issues

Choose the script that best fits your needs!
