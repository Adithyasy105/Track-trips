# ⚡ Quick Setup: Keep Server Awake (2 Minutes)

## 🎯 Fastest Solution: UptimeRobot

### Step 1: Sign Up (30 seconds)
1. Go to: **https://uptimerobot.com**
2. Click **"Sign Up"** (free)
3. Verify your email

### Step 2: Create Monitor (1 minute)
1. Click **"+ Add New Monitor"**
2. Fill in:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `Splitwise Backend`
   - **URL**: `https://track-trips.onrender.com`
   - **Monitoring Interval**: `5 minutes`
3. Click **"Create Monitor"**

### ✅ Done!
Your server will now stay awake 24/7. UptimeRobot will ping it every 5 minutes.

---

## 🔍 Verify It Works

After 20 minutes, test your server:
```bash
curl https://track-trips.onrender.com
```

Should respond **immediately** (not take 30-60 seconds).

---

## 📊 Alternative: cron-job.org

If you want a backup:

1. Go to: **https://cron-job.org**
2. Sign up (free)
3. Create cronjob:
   - **URL**: `https://track-trips.onrender.com`
   - **Schedule**: Every 10 minutes
4. Done!

---

## 💡 Pro Tip

Use **both services** for redundancy:
- **UptimeRobot**: Every 5 minutes (primary)
- **cron-job.org**: Every 10 minutes (backup)

This ensures your server never spins down!

---

**Full guide**: See [KEEP_SERVER_AWAKE.md](./KEEP_SERVER_AWAKE.md) for detailed instructions.

