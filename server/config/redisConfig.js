const Redis = require('redis');

const client = Redis.createClient({
    url: 'redis://default:kKmEmIOdgSXYddpHNFzRSOoMbfbbgnKf@caboose.proxy.rlwy.net:22361'
});

client.on('error', (err) => console.error('Redis Client Error', err));
client.on('connect', () => console.log('Redis Client Connected'));

const connectRedis = async () => {
    if (!client.isOpen) {
        await client.connect();
    }
    return client;
};

module.exports = { client, connectRedis };