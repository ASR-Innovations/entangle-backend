#!/bin/bash
# Quick migration runner script
# Usage: ./run-migration.sh

echo "🔧 Running database migration..."
echo "================================"
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Extract database name from DATABASE_URL if it exists
if [ ! -z "$DATABASE_URL" ]; then
    echo "✅ Found DATABASE_URL in .env"
    psql $DATABASE_URL -f database/001_add_auction_fields.sql
else
    # Manual connection
    echo "⚠️  DATABASE_URL not found, using manual connection"
    echo "Please enter your database details:"
    read -p "Database host (default: localhost): " DB_HOST
    DB_HOST=${DB_HOST:-localhost}

    read -p "Database port (default: 5432): " DB_PORT
    DB_PORT=${DB_PORT:-5432}

    read -p "Database name (default: entangled): " DB_NAME
    DB_NAME=${DB_NAME:-entangled}

    read -p "Database user (default: postgres): " DB_USER
    DB_USER=${DB_USER:-postgres}

    PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f database/001_add_auction_fields.sql
fi

echo ""
echo "================================"
echo "✅ Migration complete!"
echo ""
echo "Next step: Restart your server"
echo "  pm2 restart your-app-name"
echo "  or"
echo "  npm restart"
