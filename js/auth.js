/**
 * Auth module
 * Handles Firebase authentication: login, signup, logout.
 * Adapted from cashFollowup project.
 * Credentials: Store ID + Emp ID → email: {storeId}{empId}@cashfollowup.com
 */
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

// Wait briefly for firebase-config.js to set window.firebaseAuth
await new Promise(resolve => setTimeout(resolve, 100));
const auth = window.firebaseAuth;

// ─── DOM Elements ──────────────────────────────────────────────────────
const loginScreen   = document.getElementById('login-screen');
const mainContent   = document.getElementById('main-content');
const storeIdInput  = document.getElementById('store-id');
const empIdInput    = document.getElementById('emp-id');
const loginBtn      = document.getElementById('login-btn');
const signupBtn     = document.getElementById('signup-btn');
const logoutBtn     = document.getElementById('logout-btn');
const userEmailSpan = document.getElementById('user-email');
const authLoading   = document.getElementById('auth-loading');

// Track whether App has been initialised (only once)
let appInitialised = false;

// ─── Helpers ───────────────────────────────────────────────────────────

function convertIdsToCredentials(storeId, empId) {
    return {
        email: storeId + empId + '@cashfollowup.com',
        password: storeId + empId
    };
}

function showLogin() {
    loginScreen.classList.remove('hidden');
    mainContent.classList.add('hidden');
}

function showApp(user) {
    loginScreen.classList.add('hidden');
    mainContent.classList.remove('hidden');
    userEmailSpan.textContent = user.email;

    // Expose current user on window so non-module scripts (transfers.js) can read email
    window.currentAppUser = user;

    // Initialise the main app once (loads DB, scanner, etc.)
    if (!appInitialised) {
        appInitialised = true;
        App.init();
    }
}

function showAuthLoading(show) {
    if (show) {
        authLoading.classList.remove('hidden');
    } else {
        authLoading.classList.add('hidden');
    }
}

// ─── Auth State Listener ───────────────────────────────────────────────

onAuthStateChanged(auth, function (user) {
    if (user) {
        showApp(user);
    } else {
        appInitialised = false;
        window.currentAppUser = null;
        // Stop listening for transfers when user logs out
        if (typeof Transfers !== 'undefined' && Transfers.stopListening) {
            Transfers.stopListening();
        }
        showLogin();
    }
});

// ─── Login ─────────────────────────────────────────────────────────────

loginBtn.addEventListener('click', async function () {
    var storeId = storeIdInput.value.trim();
    var empId   = empIdInput.value.trim();

    if (!storeId || !empId) {
        alert('Please enter Store ID and Emp ID');
        return;
    }

    var creds = convertIdsToCredentials(storeId, empId);

    showAuthLoading(true);
    try {
        await signInWithEmailAndPassword(auth, creds.email, creds.password);
        storeIdInput.value = '';
        empIdInput.value = '';
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed: ' + error.message);
    } finally {
        showAuthLoading(false);
    }
});

// ─── Sign Up ───────────────────────────────────────────────────────────

signupBtn.addEventListener('click', async function () {
    var storeId = storeIdInput.value.trim();
    var empId   = empIdInput.value.trim();

    if (!storeId || !empId) {
        alert('Please enter Store ID and Emp ID');
        return;
    }

    var creds = convertIdsToCredentials(storeId, empId);

    if (creds.password.length < 6) {
        alert('Store ID + Emp ID must be at least 6 characters combined');
        return;
    }

    showAuthLoading(true);
    try {
        await createUserWithEmailAndPassword(auth, creds.email, creds.password);
        storeIdInput.value = '';
        empIdInput.value = '';
        alert('Account created successfully!');
    } catch (error) {
        console.error('Signup error:', error);
        alert('Signup failed: ' + error.message);
    } finally {
        showAuthLoading(false);
    }
});

// ─── Logout ────────────────────────────────────────────────────────────

logoutBtn.addEventListener('click', async function () {
    try {
        await signOut(auth);
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed: ' + error.message);
    }
});

console.log('Auth module initialized');
