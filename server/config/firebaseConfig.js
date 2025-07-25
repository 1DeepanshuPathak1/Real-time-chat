const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const initializeFirebase = () => {
    if (!process.env.FIREBASE_PRIVATE_KEY) {
        console.error('Error: FIREBASE_PRIVATE_KEY is not defined in .env');
        process.exit(1);
    }

    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
    }

    privateKey = privateKey.replace(/\\n/g, '\n');

    const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey
    };

    try {
        initializeApp({
            credential: cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });
        console.log('Firebase Admin initialized successfully');
        return getFirestore();
    } catch (error) {
        console.error('Error initializing Firebase Admin:', error);
        process.exit(1);
    }
};

module.exports = initializeFirebase;
