const unlockForm = document.querySelector('#unlock-form')
const passphraseInput = document.querySelector('#encryption-passphrase')
const unlockStatus = document.querySelector('#unlock-status')
const noteControls = document.querySelector('#note-controls')
const createNoteForm = document.querySelector('#create-note-form')
const noteContentsInput = document.querySelector('#note-contents')
const noteStatus = document.querySelector('#note-status')



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
        unlockStatus.textContent = "Encryption key ready"

        noteControls.hidden = false
     
    } catch {
        activeEncryptionKey = null
        unlockStatus.textContent = "Unable to derive encryption key"
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

        noteStatus.textContent = 'Encryption round trip succeeded'
    } catch {
        noteStatus.textContent = 'Encryption round trip failed'
    }
})