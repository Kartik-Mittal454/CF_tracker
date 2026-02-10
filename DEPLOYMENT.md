# Deployment Checklist

## ✅ Pre-Deployment Checklist

### Environment Setup
- [ ] Azure SQL Database is set up and accessible
- [ ] Database schema (`schema.sql`) has been executed
- [ ] Environment variables are ready:
  - `AZURE_SQL_SERVER`
  - `AZURE_SQL_DATABASE`
  - `AZURE_SQL_USER`
  - `AZURE_SQL_PASSWORD`

### Code Preparation
- [x] All hardcoded credentials removed
- [x] Dead code and unused files removed
- [x] `.gitignore` updated
- [x] `vercel.json` configured
- [x] `.vercelignore` created
- [x] Build successful locally (`npm run build`)

### Git Repository
- [ ] All changes committed
- [ ] Pushed to GitHub/GitLab/Bitbucket
- [ ] Repository is accessible

## 🚀 Vercel Deployment Steps

### Method 1: Vercel Dashboard (Recommended)

1. **Import Project**
   - Go to https://vercel.com/new
   - Import your Git repository
   - Select the repository

2. **Configure Project**
   - Framework Preset: Next.js (auto-detected)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)

3. **Add Environment Variables**
   Click "Environment Variables" and add:
   ```
   AZURE_SQL_SERVER=your-server.database.windows.net
   AZURE_SQL_DATABASE=your-database-name
   AZURE_SQL_USER=your-username
   AZURE_SQL_PASSWORD=your-password
   ```
   - Set for: Production, Preview, and Development
   - Click "Add" for each variable

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Visit your deployed URL

### Method 2: Vercel CLI

```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (first time will ask questions)
vercel

# Add environment variables
vercel env add AZURE_SQL_SERVER production
# Enter value: your-server.database.windows.net

vercel env add AZURE_SQL_DATABASE production
# Enter value: your-database-name

vercel env add AZURE_SQL_USER production
# Enter value: your-username

vercel env add AZURE_SQL_PASSWORD production
# Enter value: your-password

# Deploy to production
vercel --prod
```

## 🔍 Post-Deployment Verification

- [ ] Application loads successfully
- [ ] Database connection works (check dashboard loads)
- [ ] Can view existing cases
- [ ] Can add a new case
- [ ] Can edit a case
- [ ] Can delete a case
- [ ] Filters work correctly
- [ ] Search functionality works
- [ ] Billing management accessible
- [ ] Team analytics accessible
- [ ] Excel export works

## 🐛 Troubleshooting

### Database Connection Issues
- Verify Azure SQL firewall allows Vercel IPs
- Add `0.0.0.0 - 255.255.255.255` to allowed IPs (or specific Vercel IPs)
- Check environment variables are set correctly
- Verify database credentials

### Build Failures
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Verify TypeScript types are correct

### Runtime Errors
- Check Function Logs in Vercel dashboard
- Verify database schema is up to date
- Check environment variables are available

## 📊 Monitoring

### Vercel Analytics (Optional)
- Enable Web Analytics in Vercel dashboard
- Monitor page views and performance

### Error Tracking (Optional)
- Consider adding Sentry or similar for error tracking
- Add to `next.config.js` if needed

## 🔄 Continuous Deployment

Once set up, Vercel will automatically:
- Deploy on every push to main branch
- Create preview deployments for PRs
- Run builds and tests

## 🔒 Security Best Practices

- [x] No credentials in code
- [ ] Azure SQL firewall configured
- [ ] Environment variables secured in Vercel
- [ ] HTTPS enforced (automatic with Vercel)
- [ ] Regular password rotation for database

## 📝 Notes

- Vercel has generous free tier for personal projects
- Production deployments are optimized automatically
- Serverless functions have timeout limits (check Vercel docs)
- Database connection pooling is handled by the app

---

**Deployment Date**: _____________
**Deployed By**: _____________
**Production URL**: _____________
