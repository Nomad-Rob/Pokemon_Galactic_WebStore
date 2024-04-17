const { admin } = require('./firebaseAdminConfig');
const functions = require('firebase-functions');
const cors = require('cors')({origin: true});

// Create a new user with email, password, and username
exports.signup = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).send({ error: 'Method Not Allowed' });
    }
    const { email, password, username, uid } = req.body;
    if (!email || !password || !username || !uid) {
      return res.status(400).send({ error: 'Email, password, uid, and username are required' });
    }

    const db = admin.firestore();
    // Check if username is already taken
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('username', '==', username).get();
    if (!snapshot.empty) {
      return res.status(400).send({ error: 'Username already taken' });
    }

    try {
      // Initialize user data with username
      await db.collection('users').doc(uid).set({
        email,
        username,
        pokeDollars: 100000,
        lastLogin: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(201).send({ 'success': uid });
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });
});



// Sign in a user with username and password
exports.signin = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).send({ error: 'Method Not Allowed' });
    }

    const { email, uid } = req.body;
    if (!email || !uid) {
      return res.status(400).send({ error: 'Email, and uid are required' });
    }

    const db = admin.firestore();
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();
    if (snapshot.empty) {
      return res.status(404).send({ error: 'User not found' });
    }

    try {
      const doc = await usersRef.doc(uid).get();
      if (doc.exists) {
        const lastLogin = doc.data().lastLogin.toDate();
        const now = new Date();
        const diff = now - lastLogin;

        if (diff >= 1000 * 60 * 60 * 24) {
          await usersRef.doc(uid).update({
            pokeDollars: admin.firestore.FieldValue.increment(25000),
            lastLogin: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      res.status(200).send({ 'success': 'Added 25,000 dollars!' });
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });
});


// Verify Token for user sign in
exports.verifyToken = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).send({ error: 'Method Not Allowed' });
    }

    const token = req.body.token;
    if (!token) {
      return res.status(400).send({ error: 'Token is required' });
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      const uid = decodedToken.uid;

      // Now that the user is verified, perform any further server-side logic here
      res.status(200).send({ uid: uid, message: 'Authentication successful' });
    } catch (error) {
      res.status(401).send({ error: 'Unauthorized: ' + error.message });
    }
  });
});

// Send email verification link
exports.verifyEmail = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).send({ error: 'Method Not Allowed' });
    }
    const { email } = req.body;
    if (!email) {
      return res.status(400).send({ error: 'Email is required' });
    }
    try {
      const link = await admin.auth().generateEmailVerificationLink(email);
      // Implement sending the email with the link
      res.status(200).send({ link: link });
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });
});

// Send password reset link
exports.resetPassword = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).send({ error: 'Method Not Allowed' });
    }
    const { email } = req.body;
    if (!email) {
      return res.status(400).send({ error: 'Email is required' });
    }
    try {
      const link = await admin.auth().generatePasswordResetLink(email);
      // Implement sending the email with the link
      res.status(200).send({ link: link });
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });
});

// Update user password using username
exports.updatePassword = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).send({ error: 'Method Not Allowed' });
    }

    // Expect a session token in the Authorization header
    const sessionToken = req.headers.authorization;
    if (!sessionToken) {
      return res.status(401).send({ error:'No session token provided'});
    }

    const { username, newPassword } = req.body;
    if (!username || !newPassword) {
      return res.status(400).send({ error:'Username and new password are required'});
    }

    try {
      // Verify the session token and retrieve user information
      const decodedToken = await admin.auth().verifyIdToken(sessionToken);
      if (!decodedToken) {
        return res.status(403).send({ error:'Invalid session token'});
      }

      const db = admin.firestore();
      const usersRef = db.collection('users');
      const snapshot = await usersRef.where('username', '==', username).get();
      if (snapshot.empty) {
        return res.status(404).send({ error: 'User not found' });
      }

      const userDoc = snapshot.docs[0];
      const email = userDoc.data().email;
      if (!email) {
        return res.status(400).send({ error: 'Email not found for username' });
      }

      // Check if the logged-in user matches the user whose password is being changed
      const user = await admin.auth().getUserByEmail(email);
      if (user.uid !== decodedToken.uid) {
        return res.status(403).send({ error: 'Unauthorized to change password for this user' });
      }

      // Update the password
      await admin.auth().updateUser(user.uid, {
        password: newPassword
      });
      res.status(200).send({ message: 'Password updated successfully' });
    } catch (error) {
      res.status(500).send({ error: 'Error updating password: ' + error.message });
    }
  });
});


// Sign out user (revoke tokens)
exports.signout = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).send({ error: 'Method Not Allowed' });
    }
    const { uid } = req.body;
    if (!uid) {
      return res.status(400).send({ error: 'User ID is required' });
    }
    try {
      await admin.auth().revokeRefreshTokens(uid);
      res.status(200).send({ message: 'Successfully signed out user' });
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  });
});

// Allow users to see all Pokemon they have purchased
exports.getUserPokemons = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method !== 'GET') {
      return res.status(405).send({ error: 'Method Not Allowed' });
    }
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).send({ error: 'User ID is required' });
    }

    const db = admin.firestore();
    const userPokemonsRef = db.collection('users').doc(userId).collection('pokemons');

    try {
      const snapshot = await userPokemonsRef.get();
      if (snapshot.empty) {
        return res.status(404).send({ error: 'No Pokémon found' });
      }

      const pokemons = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      res.status(200).json(pokemons);
    } catch (error) {
      res.status(500).send({ error: 'Internal Server Error' });
    }
  });
});
