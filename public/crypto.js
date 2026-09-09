const unlockForm = document.querySelector('#unlock-form')
const passphraseInput = document.querySelector('#encryption-passphrase')
const unlockStatus = document.querySelector('#unlock-status')
const noteControls = document.querySelector('#note-controls')
const createNoteForm = document.querySelector('#create-note-form')
const noteContentsInput = document.querySelector('#note-contents')
const noteStatus = document.querySelector('#note-status')
const notesList = document.querySelector('#notes-list')
const saveNoteButton = document.querySelector('#save-note-button')
const cancelEditButton = document.querySelector('#cancel-edit-button')



const PBKDF2_ITERATIONS = 600000

let activeEncryptionKey = null
let editingNoteId = null

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

        const deleteButton = document.createElement('button')
        deleteButton.type = "button"
        deleteButton.textContent = "Delete"

        const editButton = document.createElement('button')
        editButton.type = 'button'
        editButton.textContent = 'Edit'

        editButton.addEventListener('click', () => {
            editingNoteId = encryptedNote.id
            noteContentsInput.value = plaintext
            saveNoteButton.textContent = 'Update note'
            cancelEditButton.hidden = false
            noteStatus.textContent = `Editing note`
            noteContentsInput.focus()
        })

        deleteButton.addEventListener('click', () => {
        deleteNote(encryptedNote.id)
        })

        article.appendChild(contents)
        article.appendChild(editButton)
        article.appendChild(deleteButton)
        fragment.appendChild(article)
    }

    notesList.replaceChildren(fragment)

    if (encryptedNotes.length === 0) {
        notesList.textContent = 'No notes yet'
    }


}

async function deleteNote(noteId) {
    const confirmed = window.confirm(
        'Permanently delete this note?'
    )

    if (!confirmed) {
        return
    }

    try {
        const response = await fetch(
            `/api/notes/${encodeURIComponent(noteId)}`,
            {
                method: 'DELETE'
            })

            if (!response.ok) {
                throw new Error('Server rejected deletion')
            }

            const encryptedNotes = await fetchEncryptedNotes()

            await renderDecryptedNotes(
                encryptedNotes,
                activeEncryptionKey
            )

            noteStatus.textContent = 'Note deleted'
    } catch {
        noteStatus.textContent = 'Unable to delete note'
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

    const noteIdBeingEdited = editingNoteId
    const isEditing = noteIdBeingEdited !== null

    try {
        const encryptedNote = await encryptText(plaintext, activeEncryptionKey)

        const requestUrl = isEditing ? `/api/notes/${encodeURIComponent(noteIdBeingEdited)}` : `/api/notes`
        const requestMethod = isEditing ? 'PUT' : 'POST'

        const decryptedNote = await decryptText(encryptedNote, activeEncryptionKey)

        if (decryptedNote !== plaintext) {
            throw new Error('Round-trip mismatch')
        }
        
        const response = await fetch(requestUrl, {
        method: requestMethod,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(encryptedNote)
        })

        if (!response.ok) {
            throw new Error('Server rejected note')
        }

        let successMessage

        if (isEditing) {
            successMessage = `Note updated`
        } else {
            const savedNote = await response.json()
            successMessage = `Note ${savedNote.id} saved`
        }


        const encryptedNotes = await fetchEncryptedNotes()
        
        await renderDecryptedNotes(
            encryptedNotes,
            activeEncryptionKey
        )

        editingNoteId = null
        noteContentsInput.value = ''
        saveNoteButton.textContent = 'Save note'
        cancelEditButton.hidden = true
        noteStatus.textContent = successMessage



    } catch {
        noteStatus.textContent = 'Unable to save note'
    }

    
})

cancelEditButton.addEventListener('click', () => {
    editingNoteId = null
    noteContentsInput.value = ''
    saveNoteButton.textContent = 'Save note'
    cancelEditButton.hidden = true
    noteStatus.textContent = ''
})