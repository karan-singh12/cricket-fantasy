module.exports = {
    apps: [
        {
            name: "api",
            script: "app.js",
            instances: 4,         // Run 4 clustered instances
            exec_mode: "cluster", // Load balancing mode
        },
        {
            name: "cron-worker",
            script: "cron/sportmonks.js",
            instances: 1,         // Only one cron instance
        }
    ]
};