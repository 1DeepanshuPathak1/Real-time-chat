class UserModel {
    constructor(db) {
        this.db = db;
        this.collection = 'users';
    }

    async fetchUser(userEmail) {
        try {
            const userQuery = await this.db.collection(this.collection)
                .where('email', '==', userEmail)
                .get();
            
            if (userQuery.empty) {
                return { message: 'User not found' };
            }

            const userData = {
                id: userQuery.docs[0].id,
                ...userQuery.docs[0].data()
            };

            return { userData, message: 'success' };
        } catch (err) {
            return { message: err.message, code: err.code };
        }
    }

    async addNewUser(userDetails) {
        try {
            const existingUser = await this.db.collection(this.collection)
                .where('email', '==', userDetails.email)
                .get();

            if (!existingUser.empty) {
                return { message: 'User already exists', code: 'auth/email-already-exists' };
            }

            let userCode;
            let codeExists = true;
            while (codeExists) {
                userCode = await this.generateUserCode();
                const existingCodeCheck = await this.db.collection(this.collection)
                    .where('userCode', '==', userCode)
                    .get();
                codeExists = !existingCodeCheck.empty;
            }

            await this.db.collection(this.collection).doc(userDetails.uid).set({
                name: userDetails.name,
                email: userDetails.email,
                userCode: userCode,
                createdAt: new Date().toISOString(),
                isOnline: false,
                lastSeenTimestamp: Date.now()
            });

            return { message: 'success' };
        } catch (err) {
            return { message: err.message, code: err.code };
        }
    }

    async generateUserCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    async ensureUserCode(userId) {
        try {
            const userRef = this.db.collection(this.collection).doc(userId);
            const userDoc = await userRef.get();
            
            if (userDoc.exists && !userDoc.data().userCode) {
                let userCode;
                let codeExists = true;
                
                while (codeExists) {
                    userCode = await this.generateUserCode();
                    const existingUser = await this.db.collection(this.collection)
                        .where('userCode', '==', userCode)
                        .get();
                    codeExists = !existingUser.empty;
                }
                
                await userRef.update({ userCode });
                return userCode;
            }
            
            return userDoc.data()?.userCode;
        } catch (error) {
            console.error('Error ensuring user code:', error);
            return null;
        }
    }

    async findUserByEmail(email) {
        try {
            const userQuery = await this.db.collection(this.collection)
                .where('email', '==', email)
                .get();
            return userQuery.empty ? null : { id: userQuery.docs[0].id, ...userQuery.docs[0].data() };
        } catch (error) {
            console.error('Error finding user by email:', error);
            return null;
        }
    }

    async findUserByCode(code) {
        try {
            const userQuery = await this.db.collection(this.collection)
                .where('userCode', '==', code.toUpperCase())
                .get();
            return userQuery.empty ? null : { id: userQuery.docs[0].id, ...userQuery.docs[0].data() };
        } catch (error) {
            console.error('Error finding user by code:', error);
            return null;
        }
    }

    async getUserById(userId) {
        try {
            const userDoc = await this.db.collection(this.collection).doc(userId).get();
            return userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : null;
        } catch (error) {
            console.error('Error getting user by id:', error);
            return null;
        }
    }
}

module.exports = UserModel;