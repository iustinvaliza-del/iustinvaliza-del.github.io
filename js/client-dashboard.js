/* ============================================
   Legacy Stewards — Client Dashboard Logic
   ============================================ */

const ClientDashboard = (() => {
    let currentCase = null;
    let unsubMilestones = null;
    let unsubNotes = null;

    /**
     * Initialize the dashboard after auth is confirmed
     */
    function init(profile) {
        Auth.updateNavDisplay(profile, document.getElementById('user-name'), null);
        document.getElementById('welcome-name').textContent = profile.displayName || 'there';
        loadCase(profile);
    }

    /**
     * Load the client's active case
     */
    async function loadCase(profile) {
        try {
            const casesSnap = await db.collection('cases')
                .where('clientId', '==', profile.uid)
                .where('status', '==', 'active')
                .limit(1)
                .get();

            if (casesSnap.empty) {
                // Check for any case (completed, on-hold)
                const allCases = await db.collection('cases')
                    .where('clientId', '==', profile.uid)
                    .limit(1)
                    .get();

                if (allCases.empty) {
                    showEmptyState();
                    return;
                }
                currentCase = { id: allCases.docs[0].id, ...allCases.docs[0].data() };
            } else {
                currentCase = { id: casesSnap.docs[0].id, ...casesSnap.docs[0].data() };
            }

            renderCaseInfo(currentCase, profile);
            subscribeMilestones(currentCase.id);
            subscribeNotes(currentCase.id);
            loadDocuments(currentCase.id);
        } catch (err) {
            console.error('Failed to load case:', err);
            showError('Unable to load your case data. Please try again later.');
        }
    }

    /**
     * Render case info in the summary cards
     */
    function renderCaseInfo(caseData, profile) {
        // Steward name
        const stewardEl = document.getElementById('steward-name');
        if (stewardEl) stewardEl.textContent = caseData.assignedEmployeeName || 'Not yet assigned';

        // Case status
        const statusEl = document.getElementById('case-status');
        if (statusEl) {
            const statusLabels = { active: 'Active', completed: 'Completed', 'on-hold': 'On Hold' };
            statusEl.textContent = statusLabels[caseData.status] || caseData.status;
            statusEl.className = `badge badge-${caseData.status === 'active' ? 'active' : caseData.status === 'on-hold' ? 'on-hold' : 'completed'}`;
        }

        // Case title
        const titleEl = document.getElementById('case-title');
        if (titleEl) titleEl.textContent = caseData.title || 'Stewardship Journey';
    }

    /**
     * Subscribe to milestones in real-time
     */
    function subscribeMilestones(caseId) {
        if (unsubMilestones) unsubMilestones();

        unsubMilestones = db.collection('cases').doc(caseId)
            .collection('milestones')
            .orderBy('order')
            .onSnapshot((snap) => {
                const milestones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                renderMilestones(milestones);
                renderMilestoneProgress(milestones);
            }, (err) => {
                console.error('Milestone listener error:', err);
            });
    }

    /**
     * Render the milestone timeline
     */
    function renderMilestones(milestones) {
        const container = document.getElementById('timeline-container');
        if (!container) return;

        if (milestones.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path d="M12 6v6l4 2M12 2a10 10 0 100 20 10 10 0 000-20z"/>
                    </svg>
                    <p class="text-muted">Your stewardship timeline will appear here once your journey begins.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = milestones.map(m => {
            const dotClass = m.status === 'completed' ? 'timeline-dot-completed' :
                            m.status === 'in-progress' ? 'timeline-dot-in-progress' :
                            'timeline-dot-upcoming';

            const checkmark = m.status === 'completed'
                ? '<svg width="12" height="12" fill="white" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>'
                : m.status === 'in-progress'
                ? '<div class="w-2 h-2 rounded-full bg-white"></div>'
                : '';

            const dateStr = m.status === 'completed' && m.completedAt
                ? formatDate(m.completedAt)
                : m.status === 'in-progress'
                ? 'In Progress'
                : 'Upcoming';

            const cardBg = m.status === 'in-progress' ? 'bg-[#FDFAF6] border-gold/30' : '';

            return `
                <div class="timeline-item">
                    <div class="timeline-dot ${dotClass}">${checkmark}</div>
                    <div class="card p-5 ${cardBg}">
                        <div class="flex items-start justify-between mb-2">
                            <h4 class="font-serif text-lg ${m.status === 'upcoming' ? 'text-muted' : 'text-charcoal'}">${escapeHtml(m.title)}</h4>
                            <span class="badge badge-${m.status} ml-3 flex-shrink-0">${formatStatus(m.status)}</span>
                        </div>
                        ${m.description ? `<p class="text-sm text-muted leading-relaxed mb-2">${escapeHtml(m.description)}</p>` : ''}
                        <p class="text-xs text-muted/70">${dateStr}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Render milestone progress in the summary card
     */
    function renderMilestoneProgress(milestones) {
        const total = milestones.length;
        const completed = milestones.filter(m => m.status === 'completed').length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

        const countEl = document.getElementById('milestone-count');
        const barEl = document.getElementById('milestone-bar');
        const pctEl = document.getElementById('milestone-pct');

        if (countEl) countEl.textContent = `${completed} of ${total} milestones`;
        if (barEl) barEl.style.width = `${pct}%`;
        if (pctEl) pctEl.textContent = `${pct}%`;

        // Update latest activity
        const inProgress = milestones.find(m => m.status === 'in-progress');
        const latestEl = document.getElementById('latest-activity');
        if (latestEl && inProgress) {
            latestEl.textContent = inProgress.title;
        } else if (latestEl && completed === total && total > 0) {
            latestEl.textContent = 'All milestones complete!';
        }
    }

    /**
     * Subscribe to notes in real-time
     */
    function subscribeNotes(caseId) {
        if (unsubNotes) unsubNotes();

        unsubNotes = db.collection('cases').doc(caseId)
            .collection('notes')
            .where('visibleToClient', '==', true)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .onSnapshot((snap) => {
                const notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                renderNotes(notes);
            }, (err) => {
                console.error('Notes listener error:', err);
            });
    }

    /**
     * Render notes section
     */
    function renderNotes(notes) {
        const container = document.getElementById('notes-container');
        if (!container) return;

        if (notes.length === 0) {
            container.innerHTML = `
                <div class="empty-state py-8">
                    <p class="text-muted text-sm">No updates from your steward yet.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = notes.map(n => `
            <div class="card p-5 mb-3">
                <div class="flex items-center gap-2 mb-2">
                    <div class="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center">
                        <span class="text-gold text-xs font-semibold">${getInitials(n.authorName)}</span>
                    </div>
                    <span class="text-sm font-medium text-charcoal">${escapeHtml(n.authorName || 'Steward')}</span>
                    <span class="text-xs text-muted ml-auto">${formatDate(n.createdAt)}</span>
                </div>
                <p class="text-sm text-muted leading-relaxed">${escapeHtml(n.content)}</p>
            </div>
        `).join('');
    }

    /**
     * Load documents for the case
     */
    async function loadDocuments(caseId) {
        const container = document.getElementById('documents-container');
        if (!container) return;

        try {
            const snap = await db.collection('cases').doc(caseId)
                .collection('documents')
                .where('visibleToClient', '==', true)
                .orderBy('uploadedAt', 'desc')
                .get();

            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderDocuments(docs);
        } catch (err) {
            console.error('Failed to load documents:', err);
        }
    }

    /**
     * Render documents section
     */
    function renderDocuments(docs) {
        const container = document.getElementById('documents-container');
        if (!container) return;

        if (docs.length === 0) {
            container.innerHTML = `
                <div class="empty-state py-8">
                    <p class="text-muted text-sm">No documents shared yet.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `<div class="grid sm:grid-cols-2 gap-3">${docs.map(d => `
            <a href="${escapeHtml(d.downloadUrl)}" target="_blank" rel="noopener" class="card p-4 flex items-center gap-3 card-hover">
                <div class="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" fill="none" stroke="#c9a96e" stroke-width="1.5" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                    </svg>
                </div>
                <div class="min-w-0">
                    <p class="text-sm font-medium text-charcoal truncate">${escapeHtml(d.name)}</p>
                    <p class="text-xs text-muted">${formatDate(d.uploadedAt)}${d.fileSize ? ' &middot; ' + formatFileSize(d.fileSize) : ''}</p>
                </div>
            </a>
        `).join('')}</div>`;
    }

    /**
     * Show empty state when no cases exist
     */
    function showEmptyState() {
        const main = document.getElementById('dashboard-content');
        if (main) {
            main.innerHTML = `
                <div class="empty-state py-20">
                    <svg width="64" height="64" fill="none" stroke="currentColor" stroke-width="1" viewBox="0 0 24 24" class="mx-auto mb-4 text-gold/40">
                        <path d="M12 6v6l4 2M12 2a10 10 0 100 20 10 10 0 000-20z"/>
                    </svg>
                    <h3 class="font-serif text-xl text-charcoal mb-2">Your Journey Hasn't Started Yet</h3>
                    <p class="text-muted text-sm max-w-md mx-auto mb-6">
                        Once your steward sets up your case, your progress timeline and updates will appear here.
                    </p>
                    <a href="index.html#contact" class="btn-outline btn-sm">Contact Us</a>
                </div>
            `;
        }
    }

    /**
     * Show error message
     */
    function showError(message) {
        const main = document.getElementById('dashboard-content');
        if (main) {
            main.innerHTML = `
                <div class="empty-state py-20">
                    <p class="text-red-500 text-sm">${escapeHtml(message)}</p>
                    <button onclick="location.reload()" class="btn-outline btn-sm mt-4">Try Again</button>
                </div>
            `;
        }
    }

    // ─── Helpers ───

    function formatDate(timestamp) {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatStatus(status) {
        const labels = { completed: 'Completed', 'in-progress': 'In Progress', upcoming: 'Upcoming' };
        return labels[status] || status;
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function getInitials(name) {
        if (!name) return '?';
        return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { init };
})();

// ─── Page Init ───
Auth.requireAuth(['client'], (profile) => {
    ClientDashboard.init(profile);
});
