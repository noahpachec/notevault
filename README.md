# NoteVault

NoteVault is a web-based note-taking application built with Node.js, Express, EJS and SQLite. Users can register, log in, and create, read, edit and delete their own encrypted notes.

Passwordless authentication was an optional bonus and is not implemented.

## How to run

### Requirements

- Node.js 24 (the version used during development)
- npm

### Setup

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project directory:

   ```env
   SESSION_SECRET=replace_this_with_a_long_random_value
   ```

   A suitable value can be generated with:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

3. Start the development server:

   ```bash
   npm run devStart
   ```

4. Open [http://localhost:3000](http://localhost:3000).

The SQLite database (`notevault.db`) and its tables are created automatically when the application starts.

## Using the application

1. Register with a name, email and login password.
2. Log in with the registered credentials.
3. Enter an encryption passphrase to unlock the notes page.
4. Create, edit or delete notes.
5. Use the same encryption passphrase on later visits. A forgotten passphrase cannot be recovered, and existing notes cannot be decrypted with a different one.

The login password and encryption passphrase have different purposes. The login password authenticates the user. The encryption passphrase derives the key that encrypts and decrypts notes.

## How it works

- Passport Local authenticates an email and password. bcrypt compares the submitted password with the password hash stored in SQLite.
- Express Session stores the authenticated session on the server and sends the browser a session-ID cookie. Passport serializes the user's database ID into the session and deserializes it on later requests to populate `req.user`.
- Protected routes reject unauthenticated requests.
- Note queries use `req.user.id` and include `user_id` in their SQL conditions. This prevents one authenticated user from loading, updating or deleting another user's notes by changing a note ID.
- Prepared SQL statements keep submitted values separate from SQL commands, mitigating SQL injection.
- The browser derives a non-exportable 256-bit AES-GCM key from the encryption passphrase using PBKDF2-SHA-256, 600,000 iterations and a per-user random salt.
- Notes are encrypted in the browser with a fresh random 12-byte IV before being sent to the server. SQLite stores only the ciphertext, IV and encryption metadata—not the note plaintext, passphrase or encryption key.
- The encryption key remains in browser memory only for the current page. Refreshing or leaving the page requires the passphrase again.

## Security considerations

- **Broken access control:** authentication middleware and owner-scoped SQL queries restrict notes to their owner.
- **SQL injection:** database operations use prepared statements with parameter placeholders.
- **Cross-site scripting:** decrypted note text is rendered using `textContent`, and EJS escapes interpolated values. Untrusted content must not be inserted with `innerHTML`.
- **Password disclosure:** login passwords are hashed with bcrypt rather than stored in plaintext.
- **Database or backup disclosure:** client-side encryption prevents a passive database reader from directly reading note contents. Per-user salts and an expensive PBKDF2 derivation slow offline passphrase guesses, but weak passphrases may still be guessed.
- **Ciphertext tampering:** AES-GCM authentication causes modified ciphertext to fail decryption. It does not prevent an administrator from deleting notes or viewing metadata such as owners, timestamps and ciphertext sizes.
- **Session theft:** cookies are HTTP-only, use `SameSite=Lax`, expire after one hour and are marked `Secure` in production. Production deployment must use HTTPS.

This design protects note contents from an administrator who passively reads the database. It does **not** protect against a malicious administrator who changes the JavaScript sent to the browser to capture a passphrase or plaintext.

Current production limitations include Express Session's in-memory session store, no login rate limiting, distinguishable login failure messages, and no explicit CSRF token or Content Security Policy. These should be addressed before exposing the application publicly.

## Main files

- `server.js` — Express routes, sessions, authentication and note API
- `passport-config.js` — Passport Local strategy and session serialization
- `database.js` — SQLite schema and prepared queries
- `public/crypto.js` — browser-side key derivation, encryption, decryption and note UI logic
- `views/` — EJS pages
- `public/styles.css` — application styling
