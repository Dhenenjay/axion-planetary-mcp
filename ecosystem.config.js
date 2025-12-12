module.exports = {
  apps: [{
    name: 'mcp-server',
    script: 'npm',
    args: 'run start:next',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      GOOGLE_APPLICATION_CREDENTIALS: 'C:\\Users\\Dhenenjay\\Downloads\\ee-key.json'
    },
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    error_file: './logs/error.log',
    out_file: './logs/output.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
