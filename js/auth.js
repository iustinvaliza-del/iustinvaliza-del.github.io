/* ============================================
   Legacy Stewards — Authentication Module
   ============================================ */

const Auth = (() => {
    // Cache user profile to avoid repeated Firestore reads
    let cachedProfile = null;

    /**
     * Sign in with email and password
     */
    async function login(email, password) {
        const credential = await auth.signInWithEmailAndPassword(email, password);
        return credential.user;
    }

    /**
     * Sign out and redirect to home
     */
    async function logout() {
        cachedProfile = null;
        await auth.signOut();
        window.location.href = 'index.html';
    }

    /**
     * Get user profile from Firestore
     */
    async function getUserProfile(uid) {
        if (cachedProfile && cachedProfile.uid === uid) return cachedProfile;
        const doc = await db.collection('users').doc(uid).get();
        if (!doc.exists) return null;
        cachedProfile = { uid, ...doc.data() };
        return cachedProfile;
    }

    /**
     * Clear cached profile (call on auth state change)
     */
    function clearCache() {
        cachedProfile = null;
    }

    /**
     * Require authentication and role — redirects if unauthorized.
     * Call on page load for protected pages.
     * @param {string[]} allowedRoles - Array of roles allowed to access this page
     * @param {function} onReady - Called with user profile when auth is confirmed
     */
    function requireAuth(allowedRoles, onReady) {
        // Show loading state
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.3s ease';

        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = 'login.html';
                return;
            }

            try {
                const profile = await getUserProfile(user.uid);
                if (!profile || !allowedRoles.includes(profile.role)) {
                    // Wrong role — redirect to correct dashboard or login
                    if (profile && profile.role === 'client') {
                        window.location.href = 'client-dashboard.html';
                    } else if (profile && (profile.role === 'employee' || profile.role === 'admin')) {
                        window.location.href = 'admin-dashboard.html';
                    } else {
                        window.location.href = 'login.html';
                    }
                    return;
                }

                // Authorized — show page and call ready callback
                document.body.style.opacity = '1';
                if (onReady) onReady(profile);
            } catch (err) {
                console.error('Auth check failed:', err);
                window.location.href = 'login.html';
            }
        });
    }

    /**
     * Handle login form submission with role-based redirect
     */
    async function handleLogin(email, password, errorEl) {
        try {
            errorEl.textContent = '';
            errorEl.classList.add('hidden');

            const user = await login(email, password);
            const profile = await getUserProfile(user.uid);

            if (!profile) {
                errorEl.textContent = 'Account not configured. Please contact support.';
                errorEl.classList.remove('hidden');
                await auth.signOut();
                return;
            }

            // Route based on role
            if (profile.role === 'client') {
                window.location.href = 'client-dashboard.html';
            } else if (profile.role === 'employee' || profile.role === 'admin') {
                window.location.href = 'admin-dashboard.html';
            } else {
                errorEl.textContent = 'Unknown account type. Please contact support.';
                errorEl.classList.remove('hidden');
                await auth.signOut();
            }
        } catch (err) {
            let message = 'Login failed. Please try again.';
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                message = 'Invalid email or password.';
            } else if (err.code === 'auth/too-many-requests') {
                message = 'Too many attempts. Please try again later.';
            } else if (err.code === 'auth/invalid-email') {
                message = 'Please enter a valid email address.';
            }
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
    }

    /**
     * Update the user display in navigation
     */
    function updateNavDisplay(profile, nameEl, roleEl) {
        if (nameEl) nameEl.textContent = profile.displayName || profile.email;
        if (roleEl) {
            const roleLabels = { client: 'Client', employee: 'Steward', admin: 'Admin' };
            roleEl.textContent = roleLabels[profile.role] || profile.role;
        }
    }

    return {
        login,
        logout,
        getUserProfile,
        clearCache,
        requireAuth,
        handleLogin,
        updateNavDisplay
    };
})();
