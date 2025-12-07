# Render Deployment Configuration

This file contains the exact configuration needed to deploy The Café on Render.

## Step 1: Create Neon PostgreSQL Database

1. Go to https://neon.tech and create an account
2. Create a new project
3. Copy the connection string (looks like: `postgresql://user:password@host.region.aws.neon.tech/dbname`)
4. Keep this safe - you'll need it for Render

## Step 2: Create render.yaml (Optional - Use Dashboard Instead)

If you want Infrastructure as Code, create this file in project root:

```yaml
services:
  - type: web
    name: the-cafe
    env: node
    region: oregon  # or your preferred region
    plan: starter   # or pro if needed
    buildCommand: npm run build
    startCommand: node dist/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: DATABASE_URL
        scope: build,runtime
        sync: false  # Don't sync - set in dashboard
```

## Step 3: Configure on Render Dashboard

### Step 3a: Connect Repository
1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Select: `/cuddly-sniffle/The Cafe/The Cafe` as root directory (if needed)

### Step 3b: Configure Build Settings
- **Name**: `the-cafe` (or your preferred name)
- **Build Command**: `npm run build`
- **Start Command**: `node dist/index.js`
- **Instance Type**: Starter (free tier works)

### Step 3c: Set Environment Variables
Click "Advanced" and add these variables:

```
KEY                 VALUE                                               SCOPE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NODE_ENV            production                                           build, runtime
PORT                3000                                                build, runtime
DATABASE_URL        postgresql://user:password@host.neon.tech/dbname    runtime
```

**Important**: 
- Do NOT commit `DATABASE_URL` to GitHub
- Set it only in Render dashboard
- Mark `DATABASE_URL` as runtime only (not build)

## Step 4: Deploy

1. Click "Create Web Service"
2. Render will automatically build and deploy
3. Wait for build to complete (3-5 minutes)
4. Check deployment logs for errors

## Step 5: Test

After deployment completes:

### Test Desktop UI
```
Open in browser: https://your-app.render.com
You should see the Login page (desktop UI)
```

### Test Mobile UI
```
Option 1: Open on mobile device
https://your-app.render.com
(Should auto-detect and show mobile UI)

Option 2: Force mobile in browser
https://your-app.render.com?mobile=true
```

### Login Credentials
```
Admin:       admin / admin123
Manager:     manager / manager123
Employee:    employee1 / password123
```

## Troubleshooting Render Deployment

### Issue: Build Fails

**Check these things:**

1. **TypeScript errors**: Run locally first
   ```bash
   npm run check
   npm run build
   ```

2. **Build logs in Render**: Click the failed deployment to see errors

3. **Node version**: Render uses Node 18+ (should be fine)

4. **Build takes too long**: Render free tier has 30-minute limit

### Issue: "DATABASE_URL is required"

**Solution**:
1. Go to Render dashboard → Web Service → Settings
2. Click "Environment" 
3. Add `DATABASE_URL` with your Neon connection string
4. Redeploy (click "Manual Deploy")

### Issue: Application Starts But Database Errors

**Check**:
1. `DATABASE_URL` is correct
2. Neon database exists and is accessible
3. Try clearing Render cache:
   - Settings → "Clear Build Cache"
   - Redeploy

### Issue: Cannot See Mobile UI on Mobile Device

**Solutions**:
1. Hard refresh browser (pull-to-refresh + reload)
2. Add `?mobile=true` to URL: `https://app.render.com?mobile=true`
3. Check device User-Agent in browser dev tools
4. Try different mobile browser

### Issue: 404 Errors on Page Refresh

**This is normal** - Single Page App behavior. Already configured in server.

### Issue: Session Lost After Refresh

**Check**:
1. Cookies are enabled in browser
2. Not in private/incognito mode
3. Check `httpOnly` and `secure` flags in server/routes.ts
4. May need Redis for session persistence at scale

## Performance Considerations

### Free Tier Limits (Render Starter)
- CPU: Shared
- Memory: 512 MB
- Egress: 100 GB/month
- Downtime: Auto-sleeps after 15 min of inactivity

### For Production Use
- Upgrade to "Standard" or "Pro" instance
- Add Redis for session storage
- Add CDN for static assets
- Set up monitoring and alerts

## Database Backup

### Backup Neon Database

1. Use `pg_dump` locally or on Render
2. Download backup files
3. Store securely

```bash
# On Render Terminal (if available)
pg_dump $DATABASE_URL > backup.sql
```

## Monitoring

### Set Up Logs
1. Render → Web Service → Logs
2. Watch for errors in production
3. Check both stdout and stderr

### Health Checks
Render automatically monitors:
- Application startup
- HTTP status codes
- Process crashes

## Updating Your App

### Deploy Changes
1. Commit to GitHub
2. Push to main branch
3. Render auto-deploys (enable auto-deploy in settings)

### Manual Redeploy
- Render dashboard → Web Service → "Manual Deploy"

### Rollback
- Render → Deployments → Select previous → "Deploy"

## Custom Domain

### Add Custom Domain
1. Render Dashboard → Web Service → Settings
2. Add custom domain (e.g., cafe.example.com)
3. Update DNS records (instructions provided by Render)
4. HTTPS automatically enabled

## Free Tier Considerations

### What's Included
✅ 750 hours/month (enough for small apps)
✅ Auto HTTPS/TLS
✅ PostgreSQL database support
✅ Automatic deployments from GitHub

### Limitations
⚠️ Shared resources (CPU/RAM)
⚠️ Auto-sleeps after 15 min inactivity
⚠️ ~5 second cold start on wake
⚠️ 100 GB egress/month

### Upgrade Recommendation
- Upgrade to Standard if you expect consistent traffic
- Keep free tier for testing/staging

## Security Checklist

- [ ] `DATABASE_URL` NOT in GitHub (only in Render)
- [ ] Change default credentials (admin, manager, employee1)
- [ ] Enable auto-HTTPS on Render
- [ ] Monitor logs for errors
- [ ] Set up regular backups
- [ ] Update dependencies regularly
- [ ] Use strong admin passwords

## Useful Render Commands

### View Logs
```
Render Dashboard → Web Service → Logs
```

### SSH into Environment
Not available in free tier, but available in Pro

### Manual Redeploy
```
Render Dashboard → Manual Deploy
```

### View Environment Variables
```
Render Dashboard → Environment
```

## Support & Help

- **Render Docs**: https://render.com/docs
- **Render Support**: support@render.com
- **Neon Docs**: https://neon.tech/docs
- **Neon Support**: https://neon.tech/support

---

**Last Updated**: December 7, 2025
**Version**: 1.0
**Status**: Ready for Production
