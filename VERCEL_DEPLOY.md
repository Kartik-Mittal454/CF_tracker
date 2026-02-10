# 🚀 Quick Deploy to Vercel - Step by Step

## Option 1: Vercel Dashboard (Easiest) ⭐

### Step 1: Go to Vercel
1. Visit https://vercel.com
2. Click **"New Project"** or **Sign in** if you don't have an account

### Step 2: Import Repository
1. Click **"Import Project"** or **"Import Git Repository"**
2. Paste your repository URL: `https://github.com/Kartik-Mittal454/CF_tracker.git`
3. Wait for it to find your repo
4. Click **"Import"**

### Step 3: Configure Project
Vercel will auto-detect it's a Next.js project. You should see:
- **Framework Preset**: Next.js ✅
- **Build Command**: `npm run build` ✅
- **Output Directory**: `.next` ✅
- **Install Command**: `npm install` ✅

No changes needed - all auto-configured!

### Step 4: Add Environment Variables (CRITICAL!)
Before deploying, scroll down to **"Environment Variables"** and add these 4 variables:

```
Key: AZURE_SQL_SERVER
Value: your-server.database.windows.net

Key: AZURE_SQL_DATABASE  
Value: your-database-name

Key: AZURE_SQL_USER
Value: your-username

Key: AZURE_SQL_PASSWORD
Value: your-password
```

**Important:** Set each variable for:
- ☑️ Production
- ☑️ Preview  
- ☑️ Development

### Step 5: Deploy!
1. Click **"Deploy"** button
2. Wait 2-5 minutes for deployment
3. You'll see a success screen with your live URL

---

## Option 2: Vercel CLI (Advanced)

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login
```bash
vercel login
```
Follow the prompts to authenticate

### Step 3: Deploy
From your project directory:
```bash
vercel
```

When prompted, answer:
- **Which scope?** → Your account
- **Project name?** → CF_tracker (or your choice)
- **Linked to GitHub?** → No (or Yes if already connected)

### Step 4: Add Environment Variables
```bash
vercel env add AZURE_SQL_SERVER production
# Paste: your-server.database.windows.net

vercel env add AZURE_SQL_DATABASE production
# Paste: your-database-name

vercel env add AZURE_SQL_USER production
# Paste: your-username

vercel env add AZURE_SQL_PASSWORD production
# Paste: your-password
```

### Step 5: Deploy to Production
```bash
vercel --prod
```

---

## 🔍 Verify Deployment

After deployment completes:

1. **Visit your site** - Click the URL provided by Vercel
2. **Test functionality:**
   - ✅ Page loads without errors
   - ✅ Dashboard displays (might be empty - that's normal)
   - ✅ Try to view cases (tests database connection)
   - ✅ Try to add a case
   - ✅ Try to filter/search

If you see database connection errors:
- Double-check environment variables are correct
- Ensure Azure SQL firewall allows Vercel IPs (add `0.0.0.0/0` or Vercel's IPs)

---

## ⚙️ Future Deployments

Once set up, Vercel will:
- **Automatically deploy** when you push to `main` branch
- **Create preview URLs** for pull requests
- **Run builds and tests** automatically

To make updates:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

That's it! Vercel deploys automatically.

---

## 🆘 Troubleshooting

### Build Fails
Check **Deployment Logs** in Vercel dashboard:
- Look for TypeScript errors
- Check all dependencies are in package.json

### Can't Connect to Database
1. Verify environment variables in Vercel dashboard
2. Update Azure SQL Server firewall:
   - Go to Azure Portal
   - Find your SQL Server
   - Click "Firewalls and virtual networks"
   - Add Vercel IP range or `0.0.0.0 - 255.255.255.255`

### Page Loads but Shows Errors
Check **Function Logs** in Vercel dashboard:
- Look for database connection errors
- Verify Azure SQL credentials

---

## 📊 Monitoring

Once deployed, you can:
- View analytics in Vercel dashboard
- Check deployment logs
- See function execution times
- Monitor errors and performance

---

## 💡 Pro Tips

1. **Custom Domain**: Add your domain in Vercel project settings
2. **Auto-scaling**: Vercel automatically scales based on traffic
3. **Free tier**: Generous free tier for personal projects
4. **Billing**: Only pay if you exceed free limits

---

**Congratulations!** Your app is now production-ready! 🎉

Questions? Check Vercel docs: https://vercel.com/docs
