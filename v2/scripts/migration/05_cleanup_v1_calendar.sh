#!/bin/bash
# ============================================================================
# PERM Tracker v1 to v2 Migration - Step 5: Cleanup v1 Calendar Events
# ============================================================================
#
# This script cleans up all PERM Tracker calendar events from Google Calendar
# for users who had calendar sync enabled in v1.
#
# Run T+24hr after go-live to give users time to confirm v2 is working.
#
# Prerequisites:
#   - Python 3.9+ with required packages
#   - Required environment variables set
#
# Usage:
#   ./05_cleanup_v1_calendar.sh [OPTIONS]
#
# Options:
#   -h, --help      Show this help message
#   --dry-run       Show what would be deleted without deleting
#
# ============================================================================

set -e

# ============================================================================
# Help/Usage
# ============================================================================

show_help() {
    cat << EOF
PERM Tracker v1 to v2 Migration - Cleanup v1 Calendar Events

This script removes all PERM Tracker calendar events from users' Google
Calendars. Run this T+24hr after go-live once v2 is confirmed working.

Usage:
    ./05_cleanup_v1_calendar.sh [OPTIONS]

Options:
    -h, --help      Show this help message and exit
    --dry-run       Show what would be deleted without actually deleting

Environment Variables (required):
    SUPABASE_URL           v1 Supabase URL
    SUPABASE_KEY           v1 Supabase service key
    ENCRYPTION_KEY         Key for decrypting OAuth tokens
    GOOGLE_CLIENT_ID       Google OAuth client ID
    GOOGLE_CLIENT_SECRET   Google OAuth client secret

Examples:
    # Preview what would be deleted
    ./05_cleanup_v1_calendar.sh --dry-run

    # Actually delete events
    ./05_cleanup_v1_calendar.sh

EOF
    exit 0
}

# ============================================================================
# Parse Arguments
# ============================================================================

DRY_RUN=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            ;;
        --dry-run)
            DRY_RUN="--dry-run"
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# ============================================================================
# Colors
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# Script Directories
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGS_DIR="$SCRIPT_DIR/logs"
CLEANUP_SCRIPT="$SCRIPT_DIR/cleanup_v1_calendar.py"

# ============================================================================
# Helper Functions
# ============================================================================

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================================
# Prerequisites Check
# ============================================================================

check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v python3 &> /dev/null; then
        log_error "python3 is not installed"
        exit 1
    fi
    log_success "Python found: $(python3 --version)"

    if [[ ! -f "$CLEANUP_SCRIPT" ]]; then
        log_error "Cleanup script not found: $CLEANUP_SCRIPT"
        exit 1
    fi
    log_success "Cleanup script found"

    local missing_vars=()
    [[ -z "$SUPABASE_URL" ]] && missing_vars+=("SUPABASE_URL")
    [[ -z "$SUPABASE_KEY" ]] && missing_vars+=("SUPABASE_KEY")
    [[ -z "$ENCRYPTION_KEY" ]] && missing_vars+=("ENCRYPTION_KEY")
    [[ -z "$GOOGLE_CLIENT_ID" ]] && missing_vars+=("GOOGLE_CLIENT_ID")
    [[ -z "$GOOGLE_CLIENT_SECRET" ]] && missing_vars+=("GOOGLE_CLIENT_SECRET")

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    log_success "All required environment variables set"
}

# ============================================================================
# Run Cleanup
# ============================================================================

run_cleanup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local log_file="$LOGS_DIR/calendar_cleanup_${timestamp}.log"

    mkdir -p "$LOGS_DIR"

    log_info "Running calendar cleanup..."
    [[ -n "$DRY_RUN" ]] && log_warn "DRY RUN MODE - No events will be deleted"

    log_info "Logging to: $log_file"
    echo ""

    if python3 "$CLEANUP_SCRIPT" $DRY_RUN 2>&1 | tee "$log_file"; then
        log_success "Calendar cleanup completed"
        return 0
    else
        log_error "Calendar cleanup failed"
        return 1
    fi
}

# ============================================================================
# Main
# ============================================================================

main() {
    echo ""
    echo "============================================================================"
    echo "          PERM Tracker Migration - Step 5: Cleanup v1 Calendar"
    echo "============================================================================"
    echo ""

    [[ -n "$DRY_RUN" ]] && log_info "DRY RUN MODE" && echo ""

    check_prerequisites
    echo ""

    if run_cleanup; then
        echo ""
        log_success "Calendar cleanup step complete!"
        if [[ -n "$DRY_RUN" ]]; then
            echo ""
            log_info "This was a dry run. To actually delete events, run:"
            echo "    ./05_cleanup_v1_calendar.sh"
        fi
    else
        echo ""
        log_error "Calendar cleanup failed. Check logs for details."
        exit 1
    fi

    echo "============================================================================"
}

main "$@"
