# 🔄 Keep Render Server Active (Free Solutions)

On Render's **free tier**, your backend service will **spin down after 15 minutes of inactivity** and takes 30-60 seconds to wake up when someone makes a request.

## 🆓 Free Solutions to Keep Server Awake

### Solution 1: UptimeRobot (Recommended - Easiest)

**UptimeRobot** is a free uptime monitoring service that can ping your server every 5 minutes.

#### Setup Steps:

1. **Sign up for UptimeRobot** (Free)
   - Go to: https://uptimerobot.com
   - Click **Sign Up** (free account allows 50 monitors)
   - Verify your email

2. **Create a Monitor**
   - Click **Add New Monitor**
   - **Monitor Type**: Select **HTTP(s)**
   - **Friendly Name**: `Splitwise Backend Keep-Alive`
   - **URL**: `https://track-trips.onrender.com`
   - **Monitoring Interval**: Select **5 minutes** (minimum for free tier)
   - Click **Create Monitor**

3. **Done!** 
   - UptimeRobot will ping your server every 5 minutes
   - This keeps it awake and prevents spin-down
   - You'll also get alerts if your server goes down

**Benefits:**
- ✅ Completely free
- ✅ No code changes needed
- ✅ Email alerts if server is down
- ✅ Dashboard to monitor uptime
- ✅ Works automatically

---

### Solution 2: cron-job.org (Free Cron Jobs)

**cron-job.org** allows you to set up free scheduled HTTP requests.

#### Setup Steps:

1. **Sign up**
   - Go to: https://cron-job.org
   - Click **Sign Up** (free account available)
   - Verify your email

2. **Create a Cron Job**
   - Click **Create cronjob**
   - **Title**: `Keep Render Server Awake`
   - **Address (URL)**: `https://track-trips.onrender.com`
   - **Schedule**: Select **Every 5 minutes** or **Every 10 minutes**
   - **Request Method**: `GET`
   - Click **Create cronjob**

3. **Done!**
   - The service will ping your server every 5-10 minutes
   - Keeps your server from spinning down

**Benefits:**
- ✅ Free tier available
- ✅ Customizable schedule
- ✅ No code changes needed

---

### Solution 3: Add a Health Check Endpoint (Optional Enhancement)

You can add a simple health check endpoint that responds quickly. This is already in your code, but here's how to verify it:

Your backend already has:
```javascript
app.get('/', (req, res) => res.send('✅ Splitwise backend running'));
```

This endpoint is perfect for keep-alive pings!

---

### Solution 4: Use Multiple Free Services (Backup)

For maximum reliability, you can use **multiple services**:

1. **UptimeRobot** - Primary (every 5 minutes)
2. **cron-job.org** - Backup (every 10 minutes)
3. **Pingdom** (if available) - Additional backup

This ensures if one service fails, others keep the server awake.

---

## ⚙️ Alternative: Render Paid Plan

If you want guaranteed uptime without spin-downs:

- **Starter Plan**: $7/month
  - No spin-downs
  - Always-on service
  - Better performance

But the free solutions above work great for most use cases!

---

## 🧪 Test Your Setup

After setting up a keep-alive service:

1. **Wait 20 minutes** (longer than the 15-minute spin-down time)
2. **Test your API**:
   ```bash
   curl https://track-trips.onrender.com
   ```
3. **Should respond immediately** (not take 30-60 seconds)
4. **Check UptimeRobot dashboard** to see ping history

---

## 📊 Recommended Setup

**Best Free Solution:**
1. ✅ **UptimeRobot** - Set to ping every 5 minutes
2. ✅ **cron-job.org** - Set as backup (every 10 minutes)

This combination:
- Keeps server awake 24/7
- Provides redundancy
- Sends alerts if issues occur
- Completely free

---

## 🔍 Verify It's Working

### Check UptimeRobot:
1. Go to your UptimeRobot dashboard
2. Check the monitor status - should show **"UP"**
3. View ping history - should show successful pings every 5 minutes

### Check Render Logs:
1. Go to Render dashboard
2. Click on your service
3. Go to **Logs** tab
4. You should see GET requests every 5 minutes from UptimeRobot

### Test Response Time:
```bash
# First request (might be slow if just woke up)
time curl https://track-trips.onrender.com

# After keep-alive is working, should be fast
time curl https://track-trips.onrender.com
```

---

## ⚠️ Important Notes

1. **Free Tier Limitations:**
   - Render free tier: 15-minute spin-down
   - UptimeRobot free: 5-minute minimum interval
   - cron-job.org free: Limited to certain intervals

2. **First Request After Spin-Down:**
   - Even with keep-alive, if server spins down, first request takes 30-60 seconds
   - Keep-alive prevents this by keeping server awake

3. **Rate Limits:**
   - Render free tier has rate limits
   - Pinging every 5 minutes is well within limits
   - No issues expected

---

## 🎯 Quick Start (5 Minutes)

**Fastest setup:**

1. Go to https://uptimerobot.com
2. Sign up (free)
3. Add monitor:
   - URL: `https://track-trips.onrender.com`
   - Interval: 5 minutes
4. Done! ✅

Your server will stay awake 24/7!

---

**Need help?** Check the troubleshooting section in [DEPLOYMENT.md](./DEPLOYMENT.md)

