
const bcrypt = require('bcrypt')

const LocalStrategy = require('passport-local').Strategy


function initialise(passport, getUserByEmail, getUserByID) {
    const authenticateUser = async (email, password, done) => {
        const user = getUserByEmail(email)
        if (user == null) {
            return done(null, false, { message: 'No user with that email'}) // null: no error, false: auth failed
        }

        try {
            if (await bcrypt.compare(password, user.password_hash)) {
                return done(null, user)
            } else {
                return done(null, false, { message: 'Password incorrect'})
            }
        } catch (e) {
            return done(e)
        }
    }

    passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser)) // change standard username field to email
    passport.serializeUser((user, done) => done(null, user.id)) // get id to use in session
    passport.deserializeUser((id, done) => { // get id and return user
        return done(null, getUserByID(id))
    })
}

module.exports = initialise