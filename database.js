const Database = require('better-sqlite3')

const db = new Database('notevault.db')

db.pragma('foreign_keys = ON')

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL
    )
    `)

db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        ciphertext TEXT NOT NULL,
        iv TEXT NOT NULL, 
        crypto_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_notes_user_id
        ON notes(user_id);

    `)





const findUserByEmailStatement = db.prepare(`
    SELECT id, name, email, password_hash
    FROM users
    WHERE email = ?
    `)

const findUserByIdStatement = db.prepare(`
    SELECT id, name, email, password_hash
    FROM users
    WHERE id = ?
    `)

function getUserByEmail(email) {
    return findUserByEmailStatement.get(email)
}

function getUserById(id) {
    return findUserByIdStatement.get(id)
}



const insertUserStatement = db.prepare(`
    INSERT INTO users (name, email, password_hash)
    VALUES (?, ?, ?)
    `)

function createUser(name, email, passwordHash) {
    const result = insertUserStatement.run(name, email, passwordHash)
    return result.lastInsertRowid
}

    // INSERT INTO users (name, email)
    // VALUES ('Nozlet', nozlet@giplet.comlet)

module.exports = {
    db, getUserByEmail, createUser, getUserById
}