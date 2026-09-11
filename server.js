if (process.env.NODE_ENV !== 'production') { // load environment variables from .env when not running in production
   require('dotenv').config()
}

const {
   getUserByEmail,
   getUserById,
   createUser,
   createNote,
   getNotesByUserId,
   deleteNoteForUser,
   updateNoteForUser
} = require('./database')

const { randomBytes } = require('node:crypto')

const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const flash = require('express-flash')
const session = require('express-session')

const initialisePassport = require('./passport-config')
const passport = require('passport')


initialisePassport(
   passport,
   getUserByEmail,
   getUserById
)



app.set('view engine', 'ejs')
app.use(express.urlencoded({ extended: false })) // converts form data into url-encoded form
app.use(express.json({ limit: '100kb' })) // prevents large requests
app.use(flash())
app.use(session({
   name: 'notevault.sid',
   secret: process.env.SESSION_SECRET, // signs cookie with secret
   resave: false, // does not save an unchanged session on every request
   saveUninitialized: false, // do not create a session until something is stored in it
   cookie: {
      httpOnly: true, 
      sameSite: 'lax', 
      secure: process.env.NODE_ENV === 'production', // use https in production
      maxAge: 60 * 60 * 1000 // 1 hour
   }
}))

app.use(passport.initialize())
app.use(passport.session())
app.use(express.static('public'))


function checkAuthenticated(req, res, next) {
   if (req.isAuthenticated()) {
      next()
   } else {
      return res.redirect('/login')
   }
}

app.get('/', checkAuthenticated, (req, res) => {
    res.render('index.ejs',
      { name: req.user.name,
         encryptionSalt: req.user.encryption_salt}
   )
})

app.get('/login', (req, res) => {
   res.render('login.ejs')
})

app.post('/logout', (req, res, next) => {
   req.logout(error => {
      if (error) {
         return next(error)
      }
   
   req.session.destroy(error => {
      if (error) {
         return next(error)
      }
      res.clearCookie('notevault.sid')
      return res.redirect('/login')
      
      })
   })
})

app.get('/register', (req, res) => {
   res.render('register.ejs')
})

app.post('/login', passport.authenticate('local', {
   successRedirect: '/',
   failureRedirect: 'login',
   failureFlash: true // save failure message temporarily
}))

app.post('/register', async (req, res) => {
   try {
      const hashedPassword = await bcrypt.hash(req.body.password, 10) // bcrypt creates own salt

      const encryptionSalt = randomBytes(16).toString('base64')

      createUser(req.body.name, req.body.email, hashedPassword, encryptionSalt)

         res.redirect('/login')

   } catch (error) {
      console.log(error)
      res.redirect('/register')
   }

})

app.post('/api/notes', checkApiAuthenticated, (req, res) => {
   const ciphertext = req.body.ciphertext
   const iv = req.body.iv
   const cryptoVersion = req.body.cryptoVersion

   const validCiphertext = typeof ciphertext === 'string' && ciphertext.length > 0
   const validIv = typeof iv === 'string' && iv.length > 0
   const validCryptoVersion = cryptoVersion === 1

   if (!validCiphertext || !validIv || !validCryptoVersion) {
      return res.status(400).json({ error: 'Invalid encrypted note'})
   }

   const noteId = createNote(req.user.id, ciphertext, iv, cryptoVersion)
   return res.status(201).json({ id: noteId })
})



function checkApiAuthenticated(req, res, next) {
   if (req.isAuthenticated()) {
      return next()
   }

   return res.status(401).json({
      error: 'Authentication required'
   })
}

app.get('/api/notes', checkApiAuthenticated, (req, res) => {
   const userNotes = getNotesByUserId(req.user.id)

   return res.json(userNotes)
})

app.delete('/api/notes/:id', checkApiAuthenticated, (req, res) => {

   const noteId = Number(req.params.id)

   if (!Number.isSafeInteger(noteId) || noteId <= 0) {
      return res.status(400).json({
         error: 'Invalid note ID'
      })
   }

   const deleteCount = deleteNoteForUser(noteId, req.user.id)
   if (deleteCount === 0) {
         return res.status(404).json({
            error: 'Note not found'
         })
   }

   return res.sendStatus(204)

})

app.put('/api/notes/:id', checkApiAuthenticated, (req, res) => {
   const noteId = Number(req.params.id)

   if (!Number.isSafeInteger(noteId) || noteId <= 0) {
      return res.status(400).json({
         error: 'Invalid note ID'
      })
   }

   const ciphertext =  req.body.ciphertext
   const iv = req.body.iv
   const cryptoVersion = req.body.cryptoVersion

   const validCiphertext = typeof ciphertext === 'string' && ciphertext.length > 0
   const validIv = typeof iv === 'string' && iv.length > 0
   const validCryptoVersion = cryptoVersion === 1

   if (!validCiphertext || !validIv || !validCryptoVersion) {
      return res.status(400).json({
         error: 'Invalid encrypted note'
      })
   }

   const changedCount = updateNoteForUser(noteId, req.user.id, ciphertext, iv, cryptoVersion)

   if (changedCount === 0) {
      return res.status(404).json({
         error: 'Note not found'
      })
   }

   return res.sendStatus(204)
})


app.listen(3000)