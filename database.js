const Database = require('better-sqlite3')

const db = new Database('notevault.db')

db.pragma('foreign_keys = ON')

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        encryption_salt TEXT NOT NULL
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
    SELECT id, name, email, password_hash, encryption_salt
    FROM users
    WHERE email = ?
    `)


const findUserByIdStatement = db.prepare(`
    SELECT id, name, email, password_hash, encryption_salt
    FROM users
    WHERE id = ?
    `)

const findNotesByUser = db.prepare(`
    SELECT id, user_id, ciphertext, iv, crypto_version, created_at, updated_at
    FROM notes
    WHERE user_id = ?
    ORDER BY updated_at DESC
    `)

const getNoteByIdForUserStatement = db.prepare(`
    SELECT id, user_id, ciphertext, iv, crypto_version, created_at, updated_at
    FROM notes
    WHERE id = ?
    AND user_id = ?
    `)

const updateNoteForUserStatement = db.prepare(`
    UPDATE notes
    SET ciphertext = ?, iv = ?, crypto_version = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    AND user_id = ?
    `)

const deleteNoteForUserStatement = db.prepare(`
    DELETE FROM notes
    WHERE id = ?
    AND user_id = ?
    `)

function getUserByEmail(email) {
    return findUserByEmailStatement.get(email)
}

function getUserById(id) {
    return findUserByIdStatement.get(id)
}

function getNotesByUserId(userId) {
    return findNotesByUser.all(userId)
}


function getNoteByIdForUser(noteId, userId) {
    return getNoteByIdForUserStatement.get(noteId, userId)
}



const insertUserStatement = db.prepare(`
    INSERT INTO users (name, email, password_hash, encryption_salt)
    VALUES (?, ?, ?, ?)
    `)

const insertNoteStatement = db.prepare(`
    INSERT INTO notes (user_id, ciphertext, iv, crypto_version)
    VALUES (?, ?, ?, ?)
    `)



function createUser(name, email, passwordHash, encryptionSalt) {
    const result = insertUserStatement.run(name, email, passwordHash, encryptionSalt)
    return result.lastInsertRowid
}

function createNote(userId, ciphertext, iv, cryptoVersion = 1) {
    const result = insertNoteStatement.run(userId, ciphertext, iv, cryptoVersion)
    return result.lastInsertRowid
}

function updateNoteForUser(noteId, userId, ciphertext, iv,  cryptoVersion = 1) {
    const result = updateNoteForUserStatement.run(ciphertext, iv, cryptoVersion, noteId, userId)
    return result.changes
}

function deleteNoteForUser(noteId, userId) {
    const result = deleteNoteForUserStatement.run(noteId, userId)
    return result.changes
}


module.exports = {
    db,
    getUserByEmail,
    createUser,
    getUserById,
    getNotesByUserId,
    createNote,
    getNoteByIdForUser,
    updateNoteForUser,
    deleteNoteForUser

}