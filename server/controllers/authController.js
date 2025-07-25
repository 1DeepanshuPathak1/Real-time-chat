class AuthController {
    constructor(db, userModel) {
        this.db = db;
        this.userModel = userModel;
    }

    async verifyUser(req, res) {
        const { email } = req.body;
        
        try {
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }

            const result = await this.userModel.fetchUser(email);
            
            if (result.message === 'User not found') {
                return res.status(404).json({ error: 'User not found' });
            }

            if (result.message === 'success') {
                // Ensure user has a user code
                const userCode = await this.userModel.ensureUserCode(result.userData.id);
                
                return res.status(200).json({ 
                    message: 'User found',
                    userData: {
                        ...result.userData,
                        userCode: userCode
                    }
                });
            }

            return res.status(500).json({ error: result.message });
        } catch (error) {
            console.error('Error verifying user:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }

    async createUser(req, res) {
        const { uid, name, email } = req.body;
        
        try {
            if (!uid || !name || !email) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const result = await this.userModel.addNewUser({
                uid: uid,
                name: name,
                email: email
            });

            if (result.message === 'success') {
                return res.status(201).json({ message: 'User created successfully' });
            }

            if (result.code === 'auth/email-already-exists') {
                return res.status(409).json({ error: 'User already exists' });
            }

            return res.status(500).json({ error: result.message });
        } catch (error) {
            console.error('Error creating user:', error);
            res.status(500).json({ error: 'Server error' });
        }
    }
}

module.exports = AuthController;