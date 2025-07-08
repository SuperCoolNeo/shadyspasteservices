// Firebase SDKs imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Global Variables (Provided by the Canvas environment) ---
// Firebase configuration object
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
// Unique application ID for Firestore paths
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-paste-app';
// Initial authentication token (if provided, for seamless sign-in)
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig); // Initialize Firebase app
const db = getFirestore(app);             // Get Firestore instance
const auth = getAuth(app);               // Get Auth instance

let userId = null; // Stores the current user's ID, updated on auth state change

// --- DOM Element References ---
const pasteContentInput = document.getElementById('pasteContent');
const savePasteBtn = document.getElementById('savePasteBtn');
const viewPasteSection = document.getElementById('viewPasteSection');
const createPasteSection = document.getElementById('createPasteSection');
const displayPasteContent = document.getElementById('displayPasteContent');
const pasteLinkInput = document.getElementById('pasteLink');
const copyLinkBtn = document.getElementById('copyLinkBtn');
const createNewPasteBtn = document.getElementById('createNewPasteBtn');
const messageBox = document.getElementById('messageBox');
const messageText = document.getElementById('messageText');

// --- Utility Functions ---

/**
 * Displays a message to the user in a styled message box.
 * @param {string} message - The text content of the message.
 * @param {string} type - The type of message ('info', 'success', 'error') to apply specific styling.
 */
function showMessage(message, type = 'info') {
    // Reset all type-specific classes
    messageBox.classList.remove(
        'hidden',
        'bg-blue-100', 'border-blue-400', 'text-blue-700',
        'bg-red-100', 'border-red-400', 'text-red-700',
        'bg-green-100', 'border-green-400', 'text-green-700'
    );

    // Apply classes based on message type
    if (type === 'success') {
        messageBox.classList.add('bg-green-100', 'border-green-400', 'text-green-700');
    } else if (type === 'error') {
        messageBox.classList.add('bg-red-100', 'border-red-400', 'text-red-700');
    } else { // Default to info
        messageBox.classList.add('bg-blue-100', 'border-blue-400', 'text-blue-700');
    }

    messageText.textContent = message; // Set message text
    messageBox.classList.remove('hidden'); // Make message box visible
}

/**
 * Hides the message box.
 */
function hideMessage() {
    messageBox.classList.add('hidden');
}

/**
 * Generates a simple, short unique ID for paste documents.
 * @returns {string} An 8-character alphanumeric unique ID.
 */
function generateUniqueId() {
    return Math.random().toString(36).substring(2, 10);
}

// --- Firebase Data Operations ---

/**
 * Saves paste content to a Firestore document.
 * The paste is stored in a public collection for easy sharing.
 * @param {string} id - The unique ID for the paste document.
 * @param {string} content - The text content of the paste.
 * @returns {Promise<boolean>} True if save was successful, false otherwise.
 */
async function savePaste(id, content) {
    try {
        // Construct the Firestore document reference path for public data
        // Path: artifacts/{appId}/public/data/pastes/{pasteId}
        const pasteRef = doc(db, `artifacts/${appId}/public/data/pastes`, id);
        await setDoc(pasteRef, {
            content: content,
            createdAt: new Date().toISOString(), // Timestamp for creation
            userId: userId // Store the ID of the user who created it (can be anonymous)
        });
        showMessage('Paste saved successfully!', 'success');
        return true;
    } catch (error) {
        console.error("Error saving paste:", error);
        showMessage('Error saving paste. Please try again.', 'error');
        return false;
    }
}

/**
 * Retrieves paste content from a Firestore document.
 * @param {string} id - The unique ID of the paste document to retrieve.
 * @returns {Promise<string|null>} The paste content string if found, otherwise null.
 */
async function getPaste(id) {
    try {
        // Construct the Firestore document reference path
        const pasteRef = doc(db, `artifacts/${appId}/public/data/pastes`, id);
        const docSnap = await getDoc(pasteRef); // Get the document snapshot

        if (docSnap.exists()) {
            // If document exists, return its 'content' field
            return docSnap.data().content;
        } else {
            console.log("No such paste document found with ID:", id);
            return null; // Document does not exist
        }
    } catch (error) {
        console.error("Error getting paste:", error);
        showMessage('Error retrieving paste. It might not exist or there was a network issue.', 'error');
        return null;
    }
}

// --- UI Logic and Event Handlers ---

/**
 * Handles the click event for saving a new paste.
 * Validates input, saves to Firestore, and updates UI.
 */
savePasteBtn.addEventListener('click', async () => {
    const content = pasteContentInput.value.trim(); // Get and trim content

    if (!content) {
        showMessage('Please enter some text to paste.', 'info');
        return; // Stop if content is empty
    }

    hideMessage(); // Hide any previous messages
    savePasteBtn.textContent = 'Saving...'; // Update button text
    savePasteBtn.disabled = true; // Disable button to prevent multiple clicks

    const pasteId = generateUniqueId(); // Generate a unique ID for the new paste
    const success = await savePaste(pasteId, content); // Attempt to save

    savePasteBtn.textContent = 'Generate Shareable Link'; // Restore button text
    savePasteBtn.disabled = false; // Re-enable button

    if (success) {
        // Construct the shareable URL using the current origin and the paste ID as a hash
        const shareableLink = `${window.location.origin}${window.location.pathname}#${pasteId}`;
        pasteLinkInput.value = shareableLink; // Display the link
        displayPasteContent.textContent = content; // Display the paste content

        // Switch UI sections
        createPasteSection.classList.add('hidden');
        viewPasteSection.classList.remove('hidden');
        showMessage('Your paste has been saved! Share the link below.', 'success');
    }
});

/**
 * Handles the click event for copying the generated link to the clipboard.
 * Uses document.execCommand('copy') for broader compatibility in iframe environments.
 */
copyLinkBtn.addEventListener('click', () => {
    try {
        pasteLinkInput.select(); // Select the text in the input field
        document.execCommand('copy'); // Execute the copy command
        showMessage('Link copied to clipboard!', 'success');
    } catch (err) {
        console.error('Failed to copy text:', err);
        showMessage('Failed to copy link. Please copy it manually.', 'error');
    }
});

/**
 * Handles the click event for creating a new paste.
 * Resets the UI to the paste creation form.
 */
createNewPasteBtn.addEventListener('click', () => {
    // Clear input fields and displayed content
    pasteContentInput.value = '';
    pasteLinkInput.value = '';
    displayPasteContent.textContent = '';
    hideMessage(); // Hide any active messages

    // Switch UI sections back to creation mode
    viewPasteSection.classList.add('hidden');
    createPasteSection.classList.remove('hidden');
});

/**
 * Handles routing based on the URL hash (e.g., #pasteId).
 * Loads and displays the corresponding paste if a hash is present.
 */
async function handleUrlHash() {
    // Get the hash part of the URL, removing the leading '#'
    const hash = window.location.hash.substring(1);

    if (hash) {
        // If a hash exists, attempt to load the paste
        hideMessage();
        showMessage('Loading paste...', 'info');
        const content = await getPaste(hash); // Fetch paste content

        if (content !== null) {
            // If paste found, display it and update link
            displayPasteContent.textContent = content;
            pasteLinkInput.value = window.location.href; // Show the full current URL
            createPasteSection.classList.add('hidden');
            viewPasteSection.classList.remove('hidden');
            showMessage('Paste loaded successfully!', 'success');
        } else {
            // If paste not found, show error and revert to creation section
            showMessage('Paste not found or invalid link. Please create a new one.', 'error');
            createPasteSection.classList.remove('hidden');
            viewPasteSection.classList.add('hidden');
        }
    } else {
        // No hash, ensure the create paste section is visible
        createPasteSection.classList.remove('hidden');
        viewPasteSection.classList.add('hidden');
        hideMessage(); // Ensure no lingering messages if user navigates to root
    }
}

// --- Firebase Authentication and Initial Load ---

/**
 * Listens for Firebase authentication state changes.
 * This ensures Firestore operations only happen after a user (even anonymous) is authenticated.
 */
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in.
        userId = user.uid; // Store the authenticated user's ID
        console.log("Authenticated with Firebase. User ID:", userId);
        // After successful authentication, handle any URL hash to load content
        handleUrlHash();
    } else {
        // User is signed out or not yet authenticated.
        // Attempt to sign in anonymously or with a custom token if available.
        try {
            if (initialAuthToken) {
                // Use custom token if provided (e.g., from a secure environment)
                await signInWithCustomToken(auth, initialAuthToken);
            } else {
                // Otherwise, sign in anonymously
                await signInAnonymously(auth);
            }
        } catch (error) {
            console.error("Error signing in:", error);
            showMessage('Failed to authenticate with Firebase. Some features might not work.', 'error');
        }
    }
});

// --- Event Listeners ---

// Listen for changes in the URL hash (e.g., when user navigates back/forward or manually changes hash)
window.addEventListener('hashchange', handleUrlHash);

// The initial call to handleUrlHash is now managed within onAuthStateChanged
// to ensure Firebase authentication is ready before attempting to fetch data.
