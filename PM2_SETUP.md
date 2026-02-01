# PM2 Setup & Usage Guide

**PM2 is a process manager that captures all server logs automatically.** This makes debugging way easier - instead of asking you for screenshots, I (and future agents) can just read the logs.

---

## Quick Start

### Start the app with PM2:
```bash
pm2 start ecosystem.config.js
```

### View live logs (real-time):
```bash
pm2 logs sminventory
```

### View last 50 lines (no streaming):
```bash
pm2 logs sminventory --nostream --lines 50
```

### Stop the app:
```bash
pm2 stop sminventory
```

### Restart the app:
```bash
pm2 restart sminventory
```

### Delete from PM2 (cleanup):
```bash
pm2 delete sminventory
```

### Check status:
```bash
pm2 status
```

---

## What PM2 Does

1. **Captures all output** - stdout and stderr go to log files automatically
2. **Auto-restarts on crash** - If the app dies, PM2 restarts it after 3 seconds
3. **Logs everything** - Every error, warning, or debug message is saved
4. **Memory monitoring** - Restarts if memory exceeds 1GB

---

## Log Files Location

- **Output logs**: `/mnt/e/Sminventory/logs/pm2-out.log`
- **Error logs**: `/mnt/e/Sminventory/logs/pm2-error.log`

Future agents can read these directly:
```bash
cat /mnt/e/Sminventory/logs/pm2-error.log
cat /mnt/e/Sminventory/logs/pm2-out.log
```

---

## For Agents: How to Debug Errors

**If the app is broken:**

1. **Check PM2 status:**
   ```bash
   pm2 status
   ```
   Look for the `status` column - should be "online"

2. **Read the error log:**
   ```bash
   pm2 logs sminventory --nostream --lines 100
   ```
   Look for red error messages with stack traces

3. **Fix the code** based on the error message

4. **PM2 auto-restarts** when the code changes (watch mode disabled for Next.js)

5. **Manually restart if needed:**
   ```bash
   pm2 restart sminventory
   ```

6. **Check logs again** to see if the fix worked

---

## Why This is Better

| Before | After |
|--------|-------|
| "Can you take a screenshot?" | `pm2 logs` shows everything |
| Errors hidden in terminal | All errors captured to files |
| Have to describe what you see | We can read the exact stack trace |
| Hard to debug async issues | Full error context preserved |

---

## Configuration (ecosystem.config.js)

The app is configured with:
- **Auto-restart**: Yes (on crash, after 3s delay)
- **Port**: 6660
- **Environment**: development
- **Memory limit**: 1GB
- **Graceful shutdown**: 5 seconds

To change settings, edit `ecosystem.config.js` and restart:
```bash
pm2 restart ecosystem.config.js
```

---

## Pro Tips

1. **Keep logs running while coding:**
   ```bash
   pm2 logs sminventory
   ```
   in one terminal, code changes in another

2. **Real-time debugging:**
   Every time you save a file, Next.js hot-reloads
   PM2 logs show you if there are errors immediately

3. **Check memory usage:**
   ```bash
   pm2 status
   ```
   The `mem` column shows current memory

4. **Save PM2 state (so it restarts on system reboot):**
   ```bash
   pm2 save
   pm2 startup
   ```

---

## Troubleshooting

**"Port 6660 already in use"**
```bash
pm2 delete sminventory
# Kill whatever is using the port
lsof -i :6660  # See what's using it
pm2 start ecosystem.config.js
```

**App crashes immediately**
```bash
pm2 logs sminventory --nostream --lines 50
# Read the error log to see what went wrong
```

**Want to see full stack traces**
```bash
cat /mnt/e/Sminventory/logs/pm2-error.log
```

---

## Summary

✅ **Always use PM2** - It captures everything automatically
✅ **Read logs with** `pm2 logs sminventory`
✅ **Check status with** `pm2 status`
✅ **Restart with** `pm2 restart sminventory`
✅ **Logs saved in** `/mnt/e/Sminventory/logs/`

From now on, debugging is much easier! 🎉
