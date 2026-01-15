#!/bin/bash
# ============================================================================
# PERM Tracker v1 to v2 Migration - Step 6: Code Decommission
# ============================================================================
#
# This script cleans up the repository after v2 go-live by:
# 1. Moving v2/ contents to repository root
# 2. Removing v1 directories (backend/, frontend/)
# 3. Cleaning up migration-specific files
#
# Run T+14 days after go-live once v2 is confirmed stable.
#
# Prerequisites:
#   - Git repository with clean working directory
#   - All v1 services decommissioned
#
# Usage:
#   ./06_decommission.sh [OPTIONS]
#
# Options:
#   -h, --help      Show this help message
#   --preview       Show what would happen without making changes
#   --confirm       Actually perform the cleanup (DESTRUCTIVE)
#
# ============================================================================

set -e

# ============================================================================
# Help/Usage
# ============================================================================

show_help() {
    cat << EOF
PERM Tracker v1 to v2 Migration - Code Decommission

This script cleans up the repository by moving v2/ to root and removing v1 code.
Run this T+14 days after go-live once all services are confirmed stable.

Usage:
    ./06_decommission.sh [OPTIONS]

Options:
    -h, --help      Show this help message and exit
    --preview       Show what would happen (dry run)
    --confirm       Actually perform the cleanup (REQUIRED for changes)

Safety:
    - This script will NOT run without --preview or --confirm
    - Creates a backup branch before making changes
    - Requires clean git working directory

Examples:
    # Preview what would happen
    ./06_decommission.sh --preview

    # Actually perform cleanup (DESTRUCTIVE)
    ./06_decommission.sh --confirm

EOF
    exit 0
}

# ============================================================================
# Parse Arguments
# ============================================================================

PREVIEW=false
CONFIRM=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            ;;
        --preview)
            PREVIEW=true
            shift
            ;;
        --confirm)
            CONFIRM=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Require either --preview or --confirm
if [[ "$PREVIEW" == false && "$CONFIRM" == false ]]; then
    echo "ERROR: Must specify either --preview or --confirm"
    echo "Use --help for usage information"
    exit 1
fi

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
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# ============================================================================
# Helper Functions
# ============================================================================

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ============================================================================
# Validation
# ============================================================================

validate_environment() {
    log_info "Validating environment..."

    # Check we're in a git repo
    if ! git -C "$REPO_ROOT" rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi
    log_success "Git repository found"

    # Check for clean working directory
    if [[ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]]; then
        log_error "Working directory is not clean. Commit or stash changes first."
        exit 1
    fi
    log_success "Working directory is clean"

    # Check v2 directory exists
    if [[ ! -d "$REPO_ROOT/v2" ]]; then
        log_warn "v2/ directory not found - may already be decommissioned"
        exit 0
    fi
    log_success "v2/ directory found"
}

# ============================================================================
# Preview Mode
# ============================================================================

run_preview() {
    echo ""
    echo "============================================================================"
    echo "                    CODE DECOMMISSION - PREVIEW"
    echo "============================================================================"
    echo ""

    log_info "The following changes would be made:"
    echo ""

    echo "1. CREATE BACKUP BRANCH"
    echo "   - Branch: pre-decommission-backup"
    echo ""

    echo "2. MOVE v2/ CONTENTS TO ROOT"
    echo "   - v2/src/ → src/"
    echo "   - v2/public/ → public/"
    echo "   - v2/convex/ → convex/"
    echo "   - v2/package.json → package.json"
    echo "   - (all other v2/ contents)"
    echo ""

    echo "3. REMOVE v1 DIRECTORIES"
    if [[ -d "$REPO_ROOT/backend" ]]; then
        echo "   - backend/ ($(find "$REPO_ROOT/backend" -type f | wc -l | tr -d ' ') files)"
    fi
    if [[ -d "$REPO_ROOT/frontend" ]]; then
        echo "   - frontend/ ($(find "$REPO_ROOT/frontend" -type f | wc -l | tr -d ' ') files)"
    fi
    echo ""

    echo "4. UPDATE CONFIGURATION"
    echo "   - Update import paths if needed"
    echo "   - Update .gitignore"
    echo ""

    echo "5. COMMIT CHANGES"
    echo "   - Single commit with all changes"
    echo ""

    log_warn "This is a PREVIEW. No changes have been made."
    log_info "To perform these changes, run: ./06_decommission.sh --confirm"
}

# ============================================================================
# Confirm Mode (Actual Execution)
# ============================================================================

run_confirm() {
    echo ""
    echo "============================================================================"
    echo "                    CODE DECOMMISSION - LIVE EXECUTION"
    echo "============================================================================"
    echo ""

    log_warn "THIS WILL MAKE PERMANENT CHANGES TO THE REPOSITORY"
    echo ""
    read -p "Are you sure you want to proceed? (yes/no): " confirmation
    if [[ "$confirmation" != "yes" ]]; then
        log_info "Aborted by user"
        exit 0
    fi

    # Step 1: Create backup branch
    log_info "Creating backup branch..."
    cd "$REPO_ROOT"
    local backup_branch="pre-decommission-backup-$(date +%Y%m%d_%H%M%S)"
    git branch "$backup_branch"
    log_success "Created backup branch: $backup_branch"

    # Step 2: Move v2 contents to root
    log_info "Moving v2/ contents to root..."

    # Get list of files/dirs in v2 (excluding . and ..)
    for item in "$REPO_ROOT/v2"/*; do
        if [[ -e "$item" ]]; then
            local basename=$(basename "$item")
            if [[ -e "$REPO_ROOT/$basename" ]]; then
                log_warn "Overwriting existing $basename"
                rm -rf "$REPO_ROOT/$basename"
            fi
            mv "$item" "$REPO_ROOT/"
            log_info "  Moved: $basename"
        fi
    done

    # Move hidden files too
    for item in "$REPO_ROOT/v2"/.*; do
        local basename=$(basename "$item")
        if [[ "$basename" != "." && "$basename" != ".." ]]; then
            if [[ -e "$REPO_ROOT/$basename" ]]; then
                log_warn "Overwriting existing $basename"
                rm -rf "$REPO_ROOT/$basename"
            fi
            mv "$item" "$REPO_ROOT/"
            log_info "  Moved: $basename"
        fi
    done

    # Remove empty v2 directory
    rmdir "$REPO_ROOT/v2" 2>/dev/null || true
    log_success "v2/ contents moved to root"

    # Step 3: Remove v1 directories
    log_info "Removing v1 directories..."

    if [[ -d "$REPO_ROOT/backend" ]]; then
        rm -rf "$REPO_ROOT/backend"
        log_success "Removed: backend/"
    fi

    if [[ -d "$REPO_ROOT/frontend" ]]; then
        rm -rf "$REPO_ROOT/frontend"
        log_success "Removed: frontend/"
    fi

    # Step 4: Git operations
    log_info "Staging changes..."
    git add -A

    log_info "Creating commit..."
    git commit -m "chore: decommission v1, promote v2 to root

- Move v2/ contents to repository root
- Remove v1 backend/ and frontend/ directories
- Clean up migration artifacts

BREAKING CHANGE: Repository structure changed. v2 is now at root level.

Backup branch: $backup_branch"

    log_success "Changes committed"

    echo ""
    echo "============================================================================"
    log_success "CODE DECOMMISSION COMPLETE"
    echo "============================================================================"
    echo ""
    log_info "Backup branch: $backup_branch"
    log_info "To undo: git reset --hard $backup_branch"
    echo ""
    log_warn "Don't forget to:"
    echo "  1. Run 'pnpm install' to update dependencies"
    echo "  2. Run 'pnpm test' to verify everything works"
    echo "  3. Push changes to remote: git push origin main"
}

# ============================================================================
# Main
# ============================================================================

main() {
    echo ""
    echo "============================================================================"
    echo "          PERM Tracker Migration - Step 6: Code Decommission"
    echo "============================================================================"
    echo ""

    validate_environment

    if [[ "$PREVIEW" == true ]]; then
        run_preview
    elif [[ "$CONFIRM" == true ]]; then
        run_confirm
    fi

    echo "============================================================================"
}

main "$@"
