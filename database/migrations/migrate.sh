#!/bin/bash

# Database Migration Script Wrapper
# Provides a convenient shell interface to the Node.js migration runner

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Function to print colored output
print_color() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Function to check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_color "$RED" "❌ Node.js is not installed"
        print_color "$YELLOW" "Please install Node.js from https://nodejs.org/"
        exit 1
    fi
}

# Function to check if .env file exists
check_env() {
    if [ ! -f "$SCRIPT_DIR/../../.env" ]; then
        print_color "$YELLOW" "⚠️  Warning: .env file not found"
        print_color "$YELLOW" "Database connection may fail without proper configuration"
    fi
}

# Function to show usage
show_usage() {
    print_color "$BLUE" "
╔════════════════════════════════════════════════════════════════╗
║           Database Migration Script                            ║
╚════════════════════════════════════════════════════════════════╝
"
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  status              Show migration status"
    echo "  up [version]        Apply migration(s)"
    echo "  down <version>      Rollback a migration"
    echo "  test                Test migration (dry-run)"
    echo "  verify              Verify schema after migration"
    echo "  help                Show this help message"
    echo ""
    echo "Options:"
    echo "  --dry-run           Test without applying (for up command)"
    echo ""
    echo "Examples:"
    echo "  $0 status           # Show current status"
    echo "  $0 test             # Test migration without applying"
    echo "  $0 up               # Apply all pending migrations"
    echo "  $0 up 002           # Apply specific migration"
    echo "  $0 down 002         # Rollback migration 002"
    echo "  $0 verify           # Verify schema"
    echo ""
}

# Main script
main() {
    check_node
    check_env
    
    local command=${1:-help}
    
    case "$command" in
        status)
            print_color "$BLUE" "📊 Checking migration status..."
            node "$SCRIPT_DIR/migrate.js" status
            ;;
            
        up)
            shift
            if [[ "$*" == *"--dry-run"* ]] || [[ "$1" == "test" ]]; then
                print_color "$YELLOW" "🧪 Testing migration (dry-run)..."
                node "$SCRIPT_DIR/migrate.js" up ${2:-} --dry-run
            else
                print_color "$GREEN" "🚀 Applying migration..."
                node "$SCRIPT_DIR/migrate.js" up "$@"
            fi
            ;;
            
        down)
            shift
            if [ -z "$1" ]; then
                print_color "$RED" "❌ Error: Version required for rollback"
                echo "Usage: $0 down <version>"
                exit 1
            fi
            print_color "$YELLOW" "⏪ Rolling back migration..."
            node "$SCRIPT_DIR/migrate.js" down "$@"
            ;;
            
        test)
            print_color "$YELLOW" "🧪 Testing migration (dry-run)..."
            node "$SCRIPT_DIR/migrate.js" up --dry-run
            ;;
            
        verify)
            print_color "$BLUE" "🔍 Verifying schema..."
            if [ -f "$SCRIPT_DIR/../verify-seaport-schema.js" ]; then
                node "$SCRIPT_DIR/../verify-seaport-schema.js"
            else
                print_color "$YELLOW" "⚠️  Verification script not found"
            fi
            ;;
            
        help|--help|-h)
            show_usage
            ;;
            
        *)
            print_color "$RED" "❌ Unknown command: $command"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
