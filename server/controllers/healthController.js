class HealthController {
    getStatus(req, res) {
        res.json({
            status: 'healthy',
            message: 'Chat Server API is running',
            timestamp: new Date().toISOString(),
            env: process.env.NODE_ENV || 'development'
        });
    }
}

module.exports = HealthController;
