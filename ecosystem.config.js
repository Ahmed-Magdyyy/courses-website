module.exports = {
    apps: [
      {
        name: "app",                   // Name of the application
        script: "./app.js",            // Path to the entry point of the application
        instances: 1,                  // Number of instances to run (1 means single instance)
        autorestart: true,             // Automatically restart the app if it crashes
        watch: false,                  // Watch files for changes and restart the app
        max_memory_restart: "2G",      // Restart the app if it uses more than 2GB of memory
        env: {
          NODE_ENV: "development",     // Environment variables for development
        },
        env_production: {
          NODE_ENV: "production",      // Environment variables for production
        },
      },
    ],
  };
  