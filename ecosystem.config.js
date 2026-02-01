/**
 * PM2 Ecosystem Configuration
 *
 * This file configures PM2 to manage the Sminventory dev/prod server.
 *
 * QUICK START:
 *   pm2 start ecosystem.config.js          # Start the server
 *   pm2 logs sminventory                   # View live logs
 *   pm2 stop sminventory                   # Stop the server
 *   pm2 restart sminventory                # Restart the server
 *   pm2 delete sminventory                 # Remove from PM2
 *   pm2 save                               # Save PM2 state
 *
 * FOR AGENTS:
 *   If the app is broken and you need to debug:
 *   1. Run: pm2 logs sminventory
 *   2. Look for red error messages (they're the real errors)
 *   3. Read the stack trace to find the issue
 *   4. Fix the code
 *   5. PM2 will auto-restart and you'll see the fix in the logs
 */

module.exports = {
  apps: [
    {
      name: 'sminventory',
      script: 'npm',
      args: 'run dev',

      // Auto-restart settings
      restart_delay: 3000,      // Wait 3s before restarting on crash
      max_memory_restart: '1G', // Restart if memory exceeds 1GB

      // Logging configuration
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 6660,
      },

      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,

      // Watch mode (auto-restart on file changes)
      watch: false, // Next.js has its own hot reload, don't watch
      ignore_watch: ['node_modules', 'logs', '.next', 'data'],
    },
  ],

  // Global settings
  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'your-repo-url',
      path: '/var/www/sminventory',
      'post-deploy': 'npm install && npm run build && pm2 restart ecosystem.config.js --env production',
    },
  },
};
