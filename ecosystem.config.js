// PM2 Ecosystem configuration for Servio Restaurant Platform
module.exports = {
  apps: [
    {
      name: 'servio-frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/Users/bobbyc/Servio Restaurant Platform/frontend',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: 5000,
      restart_delay: 1000
    }
  ]
};
