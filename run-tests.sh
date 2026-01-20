#!/bin/bash

# Test runner script for semantic-chunker

set -e

echo "🧪 Running Semantic Chunker Tests"
echo "=================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Install test dependencies if not present
if [ ! -f "node_modules/.bin/jest" ]; then
    echo -e "${YELLOW}Installing test dependencies...${NC}"
    npm install --save-dev jest@^29.7.0 \
                          jest-environment-jsdom@^29.7.0 \
                          puppeteer@^21.6.1 \
                          supertest@^6.3.3 \
                          mongodb-memory-server@^9.1.3
fi

# Default to all tests if no argument provided
TEST_TYPE=${1:-all}

case $TEST_TYPE in
  unit)
    echo -e "${GREEN}Running Unit Tests...${NC}"
    npm test -- --testPathPattern=tests/unit
    ;;
  
  integration)
    echo -e "${GREEN}Running Integration Tests...${NC}"
    npm test -- --testPathPattern=tests/integration
    ;;
  
  api)
    echo -e "${GREEN}Running API Tests...${NC}"
    npm test -- --testPathPattern=tests/api
    ;;
  
  frontend)
    echo -e "${GREEN}Running Frontend Tests...${NC}"
    npm test -- --testPathPattern=tests/frontend
    ;;
  
  e2e)
    echo -e "${GREEN}Running E2E Tests...${NC}"
    # Start the server if not running
    if ! nc -z localhost 3001 2>/dev/null; then
        echo -e "${YELLOW}Starting test server...${NC}"
        npm start &
        SERVER_PID=$!
        sleep 5
        npm test -- --testPathPattern=tests/e2e
        kill $SERVER_PID
    else
        npm test -- --testPathPattern=tests/e2e
    fi
    ;;
  
  coverage)
    echo -e "${GREEN}Running Tests with Coverage...${NC}"
    npm test -- --coverage
    ;;
  
  watch)
    echo -e "${GREEN}Running Tests in Watch Mode...${NC}"
    npm test -- --watch
    ;;
  
  all)
    echo -e "${GREEN}Running All Tests...${NC}"
    npm test
    ;;
  
  *)
    echo -e "${RED}Unknown test type: $TEST_TYPE${NC}"
    echo "Usage: ./run-tests.sh [unit|integration|api|frontend|e2e|coverage|watch|all]"
    exit 1
    ;;
esac

echo ""
echo -e "${GREEN}✅ Tests Complete!${NC}"
