# Continuous Deployment Setup Guide

This guide will help you set up automatic deployment from GitHub to Heroku using GitHub Actions.

## 🚀 **Overview**

With continuous deployment set up, every push to the `main` branch will automatically deploy your Slack app to Heroku.

## 📋 **Prerequisites**

- ✅ Heroku account and app already created
- ✅ GitHub repository with your code
- ✅ Heroku CLI installed and configured
- ✅ App deployed at least once manually

## 🔧 **Step-by-Step Setup**

### **Step 1: Get Your Heroku API Key**

```bash
# Generate a new API key
heroku authorizations:create

# Or list existing keys
heroku authorizations

# Copy the API key (starts with a long string)
```

**Important**: Save this API key securely - you'll need it for GitHub secrets.

### **Step 2: Get Your Heroku App Name**

```bash
# List your Heroku apps
heroku apps

# Or if you're in your app directory
heroku apps:info
```

**Note**: Your app name is the part before `.herokuapp.com` in your app URL.

### **Step 3: Set Up GitHub Secrets**

1. **Go to your GitHub repository**: https://github.com/hanumendraprm/slack-submit-for-review-app

2. **Navigate to Settings**:
   - Click on "Settings" tab
   - Scroll down to "Security" section
   - Click "Secrets and variables" → "Actions"

3. **Add the following secrets**:

   #### **HEROKU_API_KEY**
   - **Name**: `HEROKU_API_KEY`
   - **Value**: Your Heroku API key (from Step 1)
   - **Description**: Heroku API key for deployment

   #### **HEROKU_APP_NAME**
   - **Name**: `HEROKU_APP_NAME`
   - **Value**: Your Heroku app name (from Step 2)
   - **Description**: Name of your Heroku app

   #### **HEROKU_EMAIL**
   - **Name**: `HEROKU_EMAIL`
   - **Value**: Your Heroku account email
   - **Description**: Email associated with your Heroku account

### **Step 4: Verify GitHub Actions Workflow**

The workflow file `.github/workflows/heroku-deploy.yml` should already be in your repository. It includes:

- ✅ **Automatic deployment** on push to `main`
- ✅ **Health checks** to ensure deployment success
- ✅ **Rollback** on failed health checks
- ✅ **Manual trigger** option
- ✅ **Pull request testing** (without deployment)

### **Step 5: Test the Workflow**

1. **Make a small change** to your code:
   ```bash
   # Add a comment or update README
   echo "# Updated for CD testing" >> README.md
   git add README.md
   git commit -m "Test continuous deployment"
   git push origin main
   ```

2. **Monitor the deployment**:
   - Go to your GitHub repository
   - Click "Actions" tab
   - Watch the "Deploy to Heroku" workflow run

3. **Check Heroku**:
   ```bash
   # Check if deployment was successful
   heroku logs --tail
   
   # Test health endpoint
   curl https://your-app-name.herokuapp.com/health
   ```

## 🔄 **How It Works**

### **Workflow Triggers**
- **Push to main**: Automatically deploys
- **Pull Request**: Runs tests but doesn't deploy
- **Manual**: Can be triggered manually from GitHub Actions

### **Deployment Process**
1. **Checkout code** from GitHub
2. **Setup Node.js** environment
3. **Install dependencies** (`npm ci`)
4. **Run tests** (if any)
5. **Deploy to Heroku** using API
6. **Health check** to verify deployment
7. **Rollback** if health check fails

### **Health Check**
- **Endpoint**: `https://your-app.herokuapp.com/health`
- **Expected Response**: `{"status":"ok","timestamp":"..."}`
- **Timeout**: 10 seconds
- **Rollback**: Automatic if health check fails

## 🛠️ **Configuration Options**

### **Environment-Specific Deployments**

You can modify the workflow to deploy to different environments:

```yaml
# Deploy to staging on pull requests
- name: Deploy to Staging
  if: github.event_name == 'pull_request'
  uses: akhileshns/heroku-deploy@v3.12.14
  with:
    heroku_app_name: ${{ secrets.HEROKU_STAGING_APP_NAME }}

# Deploy to production on main
- name: Deploy to Production
  if: github.ref == 'refs/heads/main'
  uses: akhileshns/heroku-deploy@v3.12.14
  with:
    heroku_app_name: ${{ secrets.HEROKU_PRODUCTION_APP_NAME }}
```

### **Custom Health Checks**

```yaml
# Custom health check
healthcheck: "https://${{ secrets.HEROKU_APP_NAME }}.herokuapp.com/api/health"
checkstring: "healthy"
delay: "30"
```

### **Pre-deployment Steps**

```yaml
# Add pre-deployment steps
- name: Run linting
  run: npm run lint

- name: Run security audit
  run: npm audit --audit-level moderate

- name: Build application
  run: npm run build
```

## 🚨 **Troubleshooting**

### **Common Issues**

1. **"Invalid API key"**
   ```bash
   # Regenerate API key
   heroku authorizations:create
   # Update GitHub secret
   ```

2. **"App not found"**
   ```bash
   # Verify app name
   heroku apps
   # Update HEROKU_APP_NAME secret
   ```

3. **"Health check failed"**
   ```bash
   # Check app logs
   heroku logs --tail
   
   # Test health endpoint manually
   curl https://your-app.herokuapp.com/health
   ```

4. **"Permission denied"**
   - Ensure your Heroku account has access to the app
   - Check if you're the app owner or collaborator

### **Debug Workflow**

1. **Check workflow logs**:
   - Go to GitHub Actions tab
   - Click on the failed workflow
   - Review each step's logs

2. **Test locally**:
   ```bash
   # Test the deployment process locally
   git push heroku main
   ```

3. **Verify secrets**:
   - Go to GitHub repository settings
   - Check that all secrets are set correctly
   - Ensure no extra spaces or characters

## 🔒 **Security Best Practices**

1. **API Key Security**:
   - Never commit API keys to code
   - Use GitHub secrets for all sensitive data
   - Rotate API keys regularly

2. **Access Control**:
   - Limit who can push to main branch
   - Use branch protection rules
   - Require pull request reviews

3. **Monitoring**:
   - Set up alerts for failed deployments
   - Monitor app performance
   - Review deployment logs regularly

## 📊 **Monitoring and Alerts**

### **GitHub Actions Notifications**

1. **Email notifications**:
   - Go to GitHub Settings → Notifications
   - Enable email notifications for Actions

2. **Slack notifications** (optional):
   ```yaml
   - name: Notify Slack
     if: failure()
     uses: 8398a7/action-slack@v3
     with:
       status: failure
       webhook_url: ${{ secrets.SLACK_WEBHOOK }}
   ```

### **Heroku Monitoring**

```bash
# Set up Heroku monitoring
heroku addons:create papertrail:choklad
heroku addons:create newrelic:wayne

# View metrics
heroku metrics:web
```

## 🎯 **Post-Setup Checklist**

- [ ] API key generated and saved
- [ ] GitHub secrets configured
- [ ] Workflow file committed to repository
- [ ] Test deployment successful
- [ ] Health check passing
- [ ] Notifications configured (optional)
- [ ] Team members informed about deployment process

## 🚀 **Advanced Features**

### **Branch-Based Deployments**

```yaml
# Deploy different branches to different environments
- name: Deploy to Staging
  if: github.ref == 'refs/heads/develop'
  uses: akhileshns/heroku-deploy@v3.12.14
  with:
    heroku_app_name: ${{ secrets.HEROKU_STAGING_APP_NAME }}

- name: Deploy to Production
  if: github.ref == 'refs/heads/main'
  uses: akhileshns/heroku-deploy@v3.12.14
  with:
    heroku_app_name: ${{ secrets.HEROKU_PRODUCTION_APP_NAME }}
```

### **Database Migrations**

```yaml
- name: Run database migrations
  run: |
    heroku run npm run migrate --app ${{ secrets.HEROKU_APP_NAME }}
```

### **Post-Deployment Tasks**

```yaml
- name: Clear cache
  run: |
    heroku run npm run cache:clear --app ${{ secrets.HEROKU_APP_NAME }}

- name: Warm up application
  run: |
    curl https://${{ secrets.HEROKU_APP_NAME }}.herokuapp.com/health
```

---

**Your continuous deployment pipeline is now ready! 🎉**

Every push to main will automatically deploy your Slack app to Heroku with health checks and rollback capabilities.
