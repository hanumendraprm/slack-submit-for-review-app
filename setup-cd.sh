#!/bin/bash

# Continuous Deployment Setup Helper Script
# This script helps you get the information needed for GitHub secrets

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Continuous Deployment Setup Helper${NC}"
echo "=============================================="

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo -e "${RED}❌ Heroku CLI is not installed. Please install it first:${NC}"
    echo "   macOS: brew tap heroku/brew && brew install heroku"
    echo "   Windows: Download from https://devcenter.heroku.com/articles/heroku-cli"
    echo "   Linux: curl https://cli-assets.heroku.com/install.sh | sh"
    exit 1
fi

# Check if logged in to Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo -e "${YELLOW}🔐 Please log in to Heroku first:${NC}"
    heroku login
fi

echo -e "${GREEN}✅ Heroku CLI is ready${NC}"

# Get Heroku email
HEROKU_EMAIL=$(heroku auth:whoami)
echo -e "${GREEN}📧 Heroku Email: $HEROKU_EMAIL${NC}"

# List Heroku apps
echo -e "${BLUE}📱 Your Heroku Apps:${NC}"
heroku apps

echo ""
echo -e "${YELLOW}⚠️  Please note your app name from the list above${NC}"

# Generate API key
echo -e "${BLUE}🔑 Generating Heroku API Key...${NC}"
API_KEY=$(heroku authorizations:create --json | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$API_KEY" ]; then
    echo -e "${RED}❌ Failed to generate API key. Please run manually:${NC}"
    echo "   heroku authorizations:create"
    exit 1
fi

echo -e "${GREEN}✅ API Key generated successfully${NC}"

echo ""
echo -e "${BLUE}📋 GitHub Secrets Configuration${NC}"
echo "======================================"
echo ""
echo -e "${YELLOW}Please add these secrets to your GitHub repository:${NC}"
echo ""
echo -e "${GREEN}1. HEROKU_API_KEY${NC}"
echo "   Value: $API_KEY"
echo ""
echo -e "${GREEN}2. HEROKU_EMAIL${NC}"
echo "   Value: $HEROKU_EMAIL"
echo ""
echo -e "${GREEN}3. HEROKU_APP_NAME${NC}"
echo "   Value: [Your app name from the list above]"
echo ""
echo -e "${BLUE}📖 How to add secrets:${NC}"
echo "1. Go to: https://github.com/hanumendraprm/slack-submit-for-review-app/settings/secrets/actions"
echo "2. Click 'New repository secret'"
echo "3. Add each secret with the values above"
echo ""
echo -e "${GREEN}✅ After adding secrets, your continuous deployment will be ready!${NC}"
echo ""
echo -e "${BLUE}📚 For detailed instructions, see: CONTINUOUS_DEPLOYMENT.md${NC}"
