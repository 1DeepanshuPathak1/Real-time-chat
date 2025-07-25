class AuthController {
    constructor(db, userModel) {
        this.db = db;
        this.userModel = userModel;
    }

    async verifyUser(req, res) {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }

            const user = await this.userModel.findUserByEmail(email);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.status(200).json({ message: 'User exists' });
        } catch (error) {
            console.error('Error verifying user:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }

    async createUser(req, res) {
        try {
            const { uid, name, email } = req.body;
            if (!uid || !name || !email) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Check if user exists in our database
            const existingUser = await this.userModel.findUserByEmail(email);
            if (existingUser) {
                // If user exists in our database but has a different UID, something's wrong
                if (existingUser.id !== uid) {
                    return res.status(409).json({ error: 'Email already registered with a different account' });
                }
                // If same UID, this might be a retry of a failed operation, allow it
                return res.status(200).json({ message: 'User already exists', user: existingUser });
            }

            // Create user document with generated user code
            await this.db.collection('users').doc(uid).set({
                name,
                email,
                userCode: await this.userModel.generateUserCode(),
                createdAt: new Date().toISOString()
            });

            res.status(201).json({ message: 'User created successfully' });
        } catch (error) {
            console.error('Error creating user:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
}

module.exports = AuthController;
