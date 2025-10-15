# DBeaver Setup Guide for Entangle Database

## 🚀 **Step-by-Step Setup:**

### 1. **Create New Connection**
1. Open DBeaver
2. Click **"New Database Connection"** (plug icon) or `Ctrl+Shift+N`
3. Select **PostgreSQL** from the list
4. Click **Next**

### 2. **Database Connection Settings**
```
Host: 209.38.123.139
Port: 5432
Database: entangle_meetings
Username: entangle_user
Password: entangle_secure_2024
```

### 3. **Advanced Settings (Important for Real-time)**
1. Click **"Edit Driver Settings"**
2. Go to **"Connection"** tab
3. Set **"Connection timeout"** to `30` seconds
4. Set **"Socket timeout"** to `30` seconds
5. Check **"Auto-commit"** (for real-time updates)
6. Click **"Test Connection"**
7. If successful, click **"Finish"**

## 📊 **Viewing Dynamic Tables:**

### **Method 1: Table Viewer (Real-time)**
1. Expand your connection in the Database Navigator
2. Navigate to: `entangle_meetings` → `Schemas` → `public` → `Tables`
3. **Right-click** on any table (e.g., `users`, `auctions`, `meetings`)
4. Select **"View Data"**
5. Your table will open in a new tab with live data!

### **Method 2: SQL Editor (Custom Queries)**
1. Right-click your connection
2. Select **"SQL Editor"** → **"New SQL Script"**
3. Write your query:
```sql
-- View all users
SELECT * FROM users ORDER BY created_at DESC;

-- View active auctions
SELECT * FROM auctions WHERE auto_ended = false;

-- View recent meetings
SELECT * FROM meetings ORDER BY created_at DESC LIMIT 10;
```
4. Press **F5** or click **"Execute"** to run

### **Method 3: Dashboard View**
1. Right-click your connection
2. Select **"Generate ER Diagram"** to see table relationships
3. Use **"Data Transfer"** to export data to Excel/CSV

## 🔄 **Real-time Features:**

### **Auto-refresh Tables:**
1. In any table view, click the **"Refresh"** button (🔄)
2. Or press **F5** to refresh data
3. Enable **"Auto-refresh"** in table settings for live updates

### **Live Monitoring:**
1. Open **"SQL Editor"**
2. Run monitoring queries:
```sql
-- Live user count
SELECT COUNT(*) as total_users FROM users;

-- Live auction status
SELECT 
  COUNT(*) as total_auctions,
  SUM(CASE WHEN auto_ended = false THEN 1 ELSE 0 END) as active_auctions,
  SUM(CASE WHEN auto_ended = true THEN 1 ELSE 0 END) as ended_auctions
FROM auctions;

-- Recent activity
SELECT 
  'users' as table_name, COUNT(*) as count, MAX(created_at) as latest
FROM users
UNION ALL
SELECT 
  'auctions' as table_name, COUNT(*) as count, MAX(created_at) as latest
FROM auctions;
```

## 🎨 **Table Customization:**

### **Column Formatting:**
1. Right-click any column header
2. Select **"Format"** → **"Column Format"**
3. Choose format (Date, Number, Text, etc.)

### **Data Filtering:**
1. Click the **"Filter"** button in table toolbar
2. Set conditions (e.g., `created_at > '2024-01-01'`)
3. Click **"Apply"**

### **Sorting:**
1. Click any column header to sort
2. Click again to reverse sort
3. Hold **Ctrl** and click multiple columns for multi-column sort

## 📈 **Advanced Features:**

### **Data Visualization:**
1. Select data in table
2. Right-click → **"Visualize"**
3. Choose chart type (Bar, Line, Pie, etc.)

### **Export Data:**
1. Select rows in table
2. Right-click → **"Export Data"**
3. Choose format (Excel, CSV, JSON, etc.)

### **Edit Data:**
1. Double-click any cell to edit
2. Press **Ctrl+S** to save changes
3. Use **"Commit"** to apply changes to database

## 🔧 **Troubleshooting:**

### **Connection Issues:**
- Check if you're on the server network
- Verify credentials are correct
- Try increasing timeout values

### **Performance:**
- Use **LIMIT** in queries for large tables
- Enable **"Lazy loading"** in table settings
- Use **"Read-only"** mode for large datasets

## 💡 **Pro Tips:**

1. **Bookmark Queries**: Save frequently used queries
2. **Use Favorites**: Mark important tables for quick access
3. **Enable SQL History**: Track all executed queries
4. **Use Templates**: Create query templates for common operations
5. **Set up Alerts**: Monitor specific data changes

## 🎯 **Quick Start Commands:**

```sql
-- View all tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Get table row counts
SELECT 
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes
FROM pg_stat_user_tables;

-- View table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users';
```

Your database is now ready for dynamic, real-time viewing in DBeaver! 🚀
