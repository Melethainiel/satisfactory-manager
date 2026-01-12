#!/bin/bash

# Test Database Management Script
# Provides utilities for managing the Docker PostgreSQL test database

set -e

# Configuration
CONTAINER_NAME="satisfactory-postgres-test"
COMPOSE_SERVICE="postgres-test"
TEST_DB_URL="postgres://app:app@localhost:5433/satisfactory_test"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is available
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker is not running"
        exit 1
    fi
}

# Check if docker compose is available
check_docker_compose() {
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not available"
        exit 1
    fi
}

# Start the test database
start_db() {
    log_info "Starting test database..."
    docker compose up -d $COMPOSE_SERVICE
    
    log_info "Waiting for database to be ready..."
    if node scripts/wait-for-db.js; then
        log_success "Test database is running and ready"
    else
        log_error "Failed to start test database"
        return 1
    fi
}

# Stop the test database
stop_db() {
    log_info "Stopping test database..."
    docker compose stop $COMPOSE_SERVICE
    log_success "Test database stopped"
}

# Remove the test database container
remove_db() {
    log_info "Removing test database container..."
    docker compose down $COMPOSE_SERVICE
    log_success "Test database container removed"
}

# Check database status
status_db() {
    if docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}" | grep -q $CONTAINER_NAME; then
        log_success "Test database is running"
        docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        return 0
    else
        log_warning "Test database is not running"
        return 1
    fi
}

# Show database logs
logs_db() {
    log_info "Showing test database logs..."
    docker compose logs $COMPOSE_SERVICE
}

# Reset the test database (remove and restart)
reset_db() {
    log_info "Resetting test database..."
    remove_db
    start_db
}

# Run database shell
shell_db() {
    if ! status_db &> /dev/null; then
        log_error "Test database is not running. Start it first with: $0 start"
        exit 1
    fi
    
    log_info "Opening database shell..."
    docker exec -it $CONTAINER_NAME psql -U app -d satisfactory_test
}

# Run tests with automatic database management
test_with_db() {
    log_info "Running tests with automatic database management..."
    
    # Start database
    start_db
    
    # Run tests
    log_info "Running tests..."
    if npm run test:run; then
        log_success "All tests passed"
        exit_code=0
    else
        log_error "Some tests failed"
        exit_code=1
    fi
    
    # Cleanup
    if [[ "${TEST_CLEANUP:-true}" != "false" ]]; then
        stop_db
    else
        log_info "Skipping cleanup (TEST_CLEANUP=false)"
    fi
    
    exit $exit_code
}

# Show usage information
usage() {
    echo "Test Database Management Script"
    echo ""
    echo "Usage: $0 COMMAND"
    echo ""
    echo "Commands:"
    echo "  start     Start the test database"
    echo "  stop      Stop the test database"
    echo "  remove    Remove the test database container"
    echo "  reset     Reset the test database (remove and restart)"
    echo "  status    Check test database status"
    echo "  logs      Show test database logs"
    echo "  shell     Open database shell (psql)"
    echo "  test      Run tests with automatic database management"
    echo "  help      Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  TEST_CLEANUP=false    Skip database cleanup after tests"
    echo ""
    echo "Examples:"
    echo "  $0 start              # Start test database"
    echo "  $0 test               # Run tests (start DB, run tests, stop DB)"
    echo "  TEST_CLEANUP=false $0 test  # Run tests but leave DB running"
    echo "  $0 shell              # Open psql shell to test database"
}

# Main script
main() {
    # Check prerequisites
    check_docker
    check_docker_compose
    
    # Handle commands
    case "${1:-help}" in
        start)
            start_db
            ;;
        stop)
            stop_db
            ;;
        remove|rm)
            remove_db
            ;;
        reset)
            reset_db
            ;;
        status)
            status_db
            ;;
        logs)
            logs_db
            ;;
        shell|psql)
            shell_db
            ;;
        test)
            test_with_db
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            log_error "Unknown command: $1"
            echo ""
            usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"