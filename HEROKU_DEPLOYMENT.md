# Heroku Deployment Guide

This guide will walk you through deploying the Slack Submit for Review App to Heroku using the Eco Dyno plan.

## 🚀 **Prerequisites**

- [Heroku Account](https://signup.heroku.com/) (Free tier available)
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
- [Git](https://git-scm.com/) installed
- Your Slack app credentials ready
- (Optional) Google Sheets credentials for integration

## 📋 **Step-by-Step Deployment Process**

### **Step 1: Install Heroku CLI**

```bash
# macOS (using Homebrew)
brew tap heroku/brew && brew install heroku

# Windows
# Download from: https://devcenter.heroku.com/articles/heroku-cli

# Linux
curl https://cli-assets.heroku.com/install.sh | sh
```

### **Step 2: Login to Heroku**

```bash
heroku login
```

### **Step 3: Create Heroku App**

```bash
# Navigate to your project directory
cd slack-submit-for-review-app

# Create a new Heroku app
heroku create your-app-name-slack-review

# Example: heroku create my-slack-review-app
```

### **Step 4: Set Up Heroku Stack**

```bash
# Set the stack to heroku-22 (recommended)
heroku stack:set heroku-22
```

### **Step 5: Configure Environment Variables**

```bash
# Set Slack credentials
heroku config:set SLACK_BOT_TOKEN=xoxb-your-bot-token-here
heroku config:set SLACK_SIGNING_SECRET=your-signing-secret-here
heroku config:set SLACK_APP_TOKEN=xapp-your-app-token-here

# Set channel configuration
heroku config:set CHANNEL_NAME=production-ems-in8code-gwunspoken
# OR use CHANNEL_ID
# heroku config:set CHANNEL_ID=C09ABPWMUEN

# Set Google Sheets credentials (optional)
heroku config:set GOOGLE_SHEET_ID=your-google-sheet-id
heroku config:set GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
heroku config:set GOOGLE_SHEET_RANGE=Sheet1!A:Z
```

### **Step 6: Deploy to Heroku**

```bash
# Add Heroku remote
heroku git:remote -a your-app-name-slack-review

# Deploy the app
git push heroku main
```

### **Step 7: Scale to Eco Dyno**

```bash
# Scale to Eco dyno (recommended for production)
heroku ps:scale web=1:eco

# Verify the dyno is running
heroku ps
```

### **Step 8: Test the Deployment**

```bash
# Open the app in browser
heroku open

# Check logs
heroku logs --tail

# Test health endpoint
curl https://your-app-name-slack-review.herokuapp.com/health
```

## 🔧 **Advanced Configuration**

### **Custom Domain (Optional)**

```bash
# Add custom domain
heroku domains:add yourdomain.com

# Configure DNS records as instructed
```

### **Environment Variables Management**

```bash
# View all config vars
heroku config

# Remove a config var
heroku config:unset VARIABLE_NAME

# Set multiple variables at once
heroku config:set VAR1=value1 VAR2=value2
```

### **Database Add-ons (If Needed)**

```bash
# Add PostgreSQL (if you need a database later)
heroku addons:create heroku-postgresql:mini
```

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Build Failures**
   ```bash
   # Check build logs
   heroku logs --tail
   
   # Common fixes:
   # - Ensure all dependencies are in package.json
   # - Check Node.js version compatibility
   # - Verify Procfile syntax
   ```

2. **App Crashes**
   ```bash
   # Check runtime logs
   heroku logs --tail
   
   # Restart the app
   heroku restart
   ```

3. **Environment Variables**
   ```bash
   # Verify all required variables are set
   heroku config
   
   # Check if variables are being read correctly
   heroku run node -e "console.log(process.env.SLACK_BOT_TOKEN ? 'Token set' : 'Token missing')"
   ```

4. **Dyno Issues**
   ```bash
   # Check dyno status
   heroku ps
   
   # Restart dynos
   heroku restart
   
   # Scale down and up
   heroku ps:scale web=0
   heroku ps:scale web=1:eco
   ```

### **Performance Monitoring**

```bash
# Enable Heroku metrics
heroku labs:enable runtime-metrics

# View metrics
heroku metrics:web
```

## 🔄 **Continuous Deployment with GitHub Actions**

### **Step 1: Set Up GitHub Secrets**

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Add the following secrets:
   - `HEROKU_API_KEY`: Your Heroku API key
   - `HEROKU_APP_NAME`: Your Heroku app name
   - `HEROKU_EMAIL`: Your Heroku email

### **Step 2: Get Heroku API Key**

```bash
# Generate API key
heroku authorizations:create

# Or get existing key
heroku authorizations
```

### **Step 3: Automatic Deployment**

Once set up, every push to the `main` branch will automatically deploy to Heroku.

## 💰 **Cost Management**

### **Eco Dyno Pricing**
- **Eco Dyno**: $5/month (when active)
- **Free Dyno**: Free (sleeps after 30 minutes of inactivity)

### **Cost Optimization**

```bash
# Scale down when not in use
heroku ps:scale web=0

# Scale up when needed
heroku ps:scale web=1:eco

# Set up auto-scaling (if needed)
heroku ps:autoscale:enable web --min=0 --max=1
```

## 🔒 **Security Best Practices**

1. **Never commit sensitive data**
   ```bash
   # Ensure .env is in .gitignore
   echo ".env" >> .gitignore
   ```

2. **Use environment variables**
   ```bash
   # All sensitive data should be in Heroku config vars
   heroku config:set SECRET_KEY=your-secret-key
   ```

3. **Regular updates**
   ```bash
   # Update dependencies regularly
   npm audit fix
   git add package*.json
   git commit -m "Update dependencies"
   git push heroku main
   ```

## 📊 **Monitoring and Maintenance**

### **Log Management**

```bash
# View real-time logs
heroku logs --tail

# Download logs
heroku logs --num 1000 > app.log

# Clear logs
heroku logs:clear
```

### **Performance Monitoring**

```bash
# Enable add-ons for monitoring
heroku addons:create papertrail:choklad
heroku addons:create newrelic:wayne
```

### **Backup Strategy**

```bash
# Backup configuration
heroku config > heroku-config-backup.txt

# Backup database (if using one)
heroku pg:backups:capture
```

## 🎯 **Post-Deployment Checklist**

- [ ] App is running: `heroku ps`
- [ ] Health check passes: `curl https://your-app.herokuapp.com/health`
- [ ] Slack app is connected and responding
- [ ] Google Sheets integration is working (if configured)
- [ ] Environment variables are set correctly
- [ ] Logs show no errors: `heroku logs --tail`
- [ ] Dyno is on Eco plan: `heroku ps:scale web=1:eco`

## 🆘 **Support**

If you encounter issues:

1. Check the logs: `heroku logs --tail`
2. Verify environment variables: `heroku config`
3. Test locally with Heroku environment: `heroku local`
4. Contact Heroku support if needed

---

**Your Slack app is now deployed and ready for production use! 🚀**
