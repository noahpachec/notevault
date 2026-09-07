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


const findUserByEmailStatement = db.prepare(`
    SELECT id, name, email, password_hash
    FROM users
    WHERE email = ?
    `)

function getUserByEmail(email) {
    return findUserByEmailStatement.get(email)
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
    db, getUserByEmail, createUser
}