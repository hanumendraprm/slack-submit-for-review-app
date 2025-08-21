#!/bin/bash

# Heroku Deployment Script for Slack Submit for Review App
# Usage: ./deploy-to-heroku.sh [app-name]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Heroku Deployment Script for Slack Submit for Review App${NC}"
echo "=================================================="

# Check if app name is provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}⚠️  No app name provided. Using default naming...${NC}"
    APP_NAME="slack-review-app-$(date +%s)"
else
    APP_NAME="$1"
fi

echo -e "${GREEN}📋 App Name: $APP_NAME${NC}"

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

# Create Heroku app
echo -e "${BLUE}📦 Creating Heroku app...${NC}"
heroku create "$APP_NAME" --stack heroku-22

# Set buildpack
echo -e "${BLUE}🔧 Setting up buildpack...${NC}"
heroku buildpacks:set heroku/nodejs

# Add Heroku remote
echo -e "${BLUE}🔗 Adding Heroku remote...${NC}"
heroku git:remote -a "$APP_NAME"

# Deploy the app
echo -e "${BLUE}🚀 Deploying to Heroku...${NC}"
git push heroku main

# Scale to Eco dyno
echo -e "${BLUE}⚖️  Scaling to Eco dyno...${NC}"
heroku ps:scale web=1:eco

# Wait a moment for the app to start
echo -e "${BLUE}⏳ Waiting for app to start...${NC}"
sleep 10

# Check app status
echo -e "${BLUE}📊 Checking app status...${NC}"
heroku ps

# Test health endpoint
echo -e "${BLUE}🏥 Testing health endpoint...${NC}"
HEALTH_URL="https://$APP_NAME.herokuapp.com/health"
if curl -s "$HEALTH_URL" | grep -q "ok"; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
else
    echo -e "${YELLOW}⚠️  Health check failed. Check logs with: heroku logs --tail${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Deployment completed!${NC}"
echo "=================================================="
echo -e "${BLUE}📱 Your app URL: https://$APP_NAME.herokuapp.com${NC}"
echo -e "${BLUE}📊 App dashboard: https://dashboard.heroku.com/apps/$APP_NAME${NC}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Don't forget to set your environment variables:${NC}"
echo "   heroku config:set SLACK_BOT_TOKEN=xoxb-your-token"
echo "   heroku config:set SLACK_SIGNING_SECRET=your-secret"
echo "   heroku config:set SLACK_APP_TOKEN=xapp-your-token"
echo "   heroku config:set CHANNEL_NAME=your-channel-name"
echo ""
echo -e "${GREEN}📖 For detailed setup instructions, see: HEROKU_DEPLOYMENT.md${NC}"
