const unlockForm = document.querySelector('#unlock-form')
const passphraseInput = document.querySelector('#encryption-passphrase')
const unlockStatus = document.querySelector('#unlock-status')
const noteControls = document.querySelector('#note-controls')
const createNoteForm = document.querySelector('#create-note-form')
const noteContentsInput = document.querySelector('#note-contents')
const noteStatus = document.querySelector('#note-status')
const notesList = document.querySelector('#notes-list')



const PBKDF2_ITERATIONS = 600000

let activeEncryptionKey = null

function base64ToBytes(base64) {
    const binaryString = atob(base64)

    return Uint8Array.from(
        binaryString,
        character => character.charCodeAt(0)
    )
}

function bytesToBase64(bytes) {
    let binaryString = ''

    for (const byte of bytes) {
        binaryString += String.fromCharCode(byte)
    }

    return btoa(binaryString)
}

async function encryptText(plaintext, key) {
    const plaintextBytes = new TextEncoder().encode(plaintext)
    const ivBytes = window.crypto.getRandomValues(new Uint8Array(12))

    const ciphertextBuffer = 
        await window.crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: ivBytes
            },
            key,
            plaintextBytes
        )

        return {
            ciphertext: bytesToBase64(
                new Uint8Array(ciphertextBuffer)
            ),
            iv: bytesToBase64(ivBytes),
            cryptoVersion: 1
        }
}

async function decryptText(encryptedNote, key) {
    const ciphertextBytes =
        base64ToBytes(encryptedNote.ciphertext)
    const ivBytes = 
        base64ToBytes(encryptedNote.iv)

    const plaintextBuffer =
        await window.crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: ivBytes
            },
            key,
            ciphertextBytes
        )
    
        return new TextDecoder().decode(plaintextBuffer)
}

async function deriveEncryptionKey(passphrase, saltBase64) {
    const encoder = new TextEncoder()
    const passphraseBytes = encoder.encode(passphrase)
    const saltBytes = base64ToBytes(saltBase64)

    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        passphraseBytes,
        'PBKDF2',
        false,
        ['deriveKey']
    )

    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltBytes,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        keyMaterial,
        {
            name: 'AES-GCM',
            length: 256,
        },
        false,
        ['encrypt', 'decrypt']
    )
    
}

async function fetchEncryptedNotes() {
    const response = await fetch('/api/notes')

    if (response.status === 401) {
        throw new Error('Authentication required')
    }

    if (!response.ok) {
        throw new Error('Unable to load notes')
    }
    
    return response.json()
}

async function renderDecryptedNotes(encryptedNotes, key) {
    const fragment = document.createDocumentFragment()

    for (const encryptedNote of encryptedNotes) {
        if (encryptedNote.crypto_version !== 1) {
            throw new Error('Unsupported crypto version')
        }

        const plaintext = await decryptText(
            encryptedNote,
            key
        )

        const article = document.createElement('article')
        article.dataset.noteId = String(encryptedNote.id)

        const contents = document.createElement('pre')
        contents.textContent = plaintext

        article.appendChild(contents)
        fragment.appendChild(article)
    }

    notesList.replaceChildren(fragment)

    if (encryptedNotes.length === 0) {
        notesList.textContent = 'No notes yet'
    }
}

unlockForm.addEventListener('submit' , async (event) => {
    event.preventDefault();
    const passphrase = passphraseInput.value;
    const saltBase64 = document.querySelector('#notes-app').dataset.encryptionSalt

    unlockStatus.textContent = "Deriving encryption key...";

    try {
        activeEncryptionKey = await deriveEncryptionKey(
        passphrase,
        saltBase64
    )
        

        const encryptedNotes = await fetchEncryptedNotes()
        console.log('Encrypted note count: ', encryptedNotes.length)

        await renderDecryptedNotes(encryptedNotes, activeEncryptionKey)

        unlockStatus.textContent = "Notes unlocked"
        noteControls.hidden = false
        unlockForm.hidden = true

        

        
     
    } catch {
        activeEncryptionKey = null
        unlockStatus.textContent = "Unable to unlock notes"
        noteControls.hidden = true
    } finally {
        passphraseInput.value = ''
    }


});

createNoteForm.addEventListener('submit', async (event) => {

    event.preventDefault()
    
    if (activeEncryptionKey ===  null) {
        noteStatus.textContent = 'Unlock notes first'
        return
    }

    const plaintext = noteContentsInput.value

    try {
        const encryptedNote = await encryptText(plaintext, activeEncryptionKey)

        const decryptedNote = await decryptText(encryptedNote, activeEncryptionKey)

        if (decryptedNote !== plaintext) {
            throw new Error('Round-trip mismatch')
        }
        
        const response = await fetch('/api/notes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(encryptedNote)
        })

        if (!response.ok) {
            throw new Error('Server rejected note')
        }

        const savedNote = await response.json()
        const encryptedNotes = await fetchEncryptedNotes()
        
        await renderDecryptedNotes(
            encryptedNotes,
            activeEncryptionKey
        )

        noteContentsInput.value = ''
        noteStatus.textContent = `Note ${savedNote.id} saved`

    } catch {
        noteStatus.textContent = 'Encryption round trip failed'
    }

    
})