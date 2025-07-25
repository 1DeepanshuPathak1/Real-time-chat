class HealthController {
    getStatus(req, res) {
        res.json({ message: 'Chat Server API is running', status: 'OK' });
    }

    getHealth(req, res) {
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    }

    getCheckup(req, res) {
        res.send('Server is working');
    }
}

module.exports = HealthController;
