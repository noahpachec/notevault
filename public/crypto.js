const unlockForm = document.querySelector('#unlock-form')
const passphraseInput = document.querySelector('#encryption-passphrase')
const unlockStatus = document.querySelector('#unlock-status')
const noteControls = document.querySelector('#note-controls')



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

    for (const byte of bytes)
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