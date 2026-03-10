/* ============================================
   Legacy Stewards — Client Dashboard Logic
   ============================================ */

const ClientDashboard = (() => {
    let currentCase = null;
    let currentProfile = null;
    let unsubMilestones = null;
    let unsubNotes = null;
    let unsubMessages = null;

    // ─── Constants ───

    const PHASES = [
        { id: 1, name: 'Discovery',    desc: 'Initial assessment, discovery call, and onboarding intake.' },
        { id: 2, name: 'Diagnosis',    desc: 'Deep-dive knowledge assessments (Legal, Tax, Finance) reviewed by your steward.' },
        { id: 3, name: 'Roadmap',      desc: 'Your personalised stewardship plan is delivered and approved together.' },
        { id: 4, name: 'Learning',     desc: 'Coaching sessions, curated resources, and family conversation practice.' },
        { id: 5, name: 'Structuring',  desc: 'Legal, tax, and investment structures put in place with specialist advisors.' },
        { id: 6, name: 'Stewardship',  desc: 'Ongoing advisory, governance reviews, and access to the peer community.' },
    ];

    const STATUS_MAP = {
        'pending': {
            color: 'bg-amber-100 text-amber-700',
            meaning: 'Your onboarding is being reviewed by your steward.',
            next: 'Next step: Your steward will reach out within 2 business days to schedule your first discovery call.'
        },
        'active': {
            color: 'bg-emerald-100 text-emerald-700',
            meaning: 'You are an active Legacy Stewards client.',
            next: 'Next step: Check your upcoming sessions and complete any open action items below.'
        },
        'in_progress': {
            color: 'bg-blue-100 text-blue-700',
            meaning: 'Your steward is actively working on your roadmap.',
            next: 'Next step: Review the latest milestone update and confirm any pending decisions.'
        },
        'under_review': {
            color: 'bg-purple-100 text-purple-700',
            meaning: 'Your steward is reviewing documents or assessments you have submitted.',
            next: 'Next step: No action needed — your steward will respond with feedback within 3 business days.'
        },
        'awaiting_client': {
            color: 'bg-orange-100 text-orange-700',
            meaning: 'Your steward is waiting for information or a decision from you.',
            next: 'Next step: Check the messages below or the latest milestone note — there is something that needs your attention.'
        },
        'paused': {
            color: 'bg-gray-100 text-gray-600',
            meaning: 'Your engagement is temporarily paused.',
            next: 'Next step: Contact your steward to resume. Reply in the messages panel below or book a call.'
        },
        'on-hold': {
            color: 'bg-gray-100 text-gray-600',
            meaning: 'Your engagement is temporarily on hold.',
            next: 'Next step: Contact your steward to resume. Reply in the messages panel below or book a call.'
        },
        'completed': {
            color: 'bg-gold/20 text-gold-dark',
            meaning: 'Your initial stewardship programme is complete.',
            next: 'Next step: You now have ongoing access to your steward and the Legacy Stewards community. Reach out any time.'
        },
    };

    /**
     * Initialize the dashboard after auth is confirmed
     */
    function init(profile) {
        currentProfile = profile;
        Auth.updateNavDisplay(profile, document.getElementById('user-name'), null);
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

            // Render all new components
            renderProfileHeader(profile, currentCase);
            renderStatus(currentCase.status, currentCase.updatedAt);
            renderJourneyTracker(currentCase.phase || 1);
            renderGlanceBar(currentCase, profile);

            // Existing subscriptions
            subscribeMilestones(currentCase.id);
            subscribeNotes(currentCase.id);
            loadDocuments(currentCase.id);

            // New: messaging
            initMessaging(currentCase.id, profile);

            // New: unread count for glance bar
            loadUnreadCount(currentCase.id, profile.uid);
        } catch (err) {
            console.error('Failed to load case:', err);
            showError('Unable to load your case data. Please try again later.');
        }
    }

    // ─── Change 3: Profile Header ───

    async function renderProfileHeader(profile, caseData) {
        // Client name
        const clientNameEl = document.getElementById('client-name');
        if (clientNameEl) clientNameEl.textContent = profile.displayName || 'Client';

        // Client avatar
        const clientAvatar = document.getElementById('client-avatar');
        if (clientAvatar) {
            if (profile.photoURL) {
                clientAvatar.innerHTML = `<img src="${escapeHtml(profile.photoURL)}" class="w-full h-full object-cover" alt="Profile">`;
            } else {
                clientAvatar.textContent = getInitials(profile.displayName || 'C');
            }
        }

        // Client since
        const sinceEl = document.getElementById('client-since');
        if (sinceEl && profile.createdAt) {
            sinceEl.textContent = `Client since ${formatDate(profile.createdAt)}`;
        }

        // Steward info
        const stewardNameEl = document.getElementById('steward-name');
        if (stewardNameEl) {
            stewardNameEl.textContent = caseData.assignedEmployeeName || 'Not yet assigned';
        }

        // Fetch steward data for avatar
        if (caseData.assignedEmployeeId) {
            try {
                const stewardDoc = await db.collection('users').doc(caseData.assignedEmployeeId).get();
                if (stewardDoc.exists) {
                    const stewardData = stewardDoc.data();
                    const stewardAvatar = document.getElementById('steward-avatar');
                    if (stewardAvatar) {
                        if (stewardData.photoURL) {
                            stewardAvatar.innerHTML = `<img src="${escapeHtml(stewardData.photoURL)}" class="w-full h-full object-cover" alt="${escapeHtml(stewardData.displayName)}">`;
                        } else {
                            stewardAvatar.textContent = getInitials(stewardData.displayName || 'S');
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to fetch steward data:', err);
            }
        }

    }

    // ─── Change 5: At a Glance Summary Bar ───

    function renderGlanceBar(caseData, profile) {
        const phase = caseData.phase || 1;
        const phaseEl = document.getElementById('glance-phase');
        const phaseNameEl = document.getElementById('glance-phase-name');
        if (phaseEl) phaseEl.textContent = `${phase} / 6`;
        if (phaseNameEl) phaseNameEl.textContent = PHASES[phase - 1]?.name || '';

        // Days as client
        const daysEl = document.getElementById('glance-days');
        if (daysEl && profile.createdAt) {
            const created = profile.createdAt.toDate ? profile.createdAt.toDate() : new Date(profile.createdAt);
            const days = Math.floor((Date.now() - created.getTime()) / 86400000);
            daysEl.textContent = days;
        }
    }

    function updateGlanceMilestones(completed, total) {
        const el = document.getElementById('glance-milestones');
        const labelEl = document.getElementById('glance-milestones-label');
        if (el) el.textContent = `${completed} / ${total}`;
        if (labelEl) labelEl.textContent = `milestone${completed !== 1 ? 's' : ''} completed`;
    }

    function updateGlanceMessages(count) {
        const el = document.getElementById('glance-messages');
        const labelEl = document.getElementById('glance-messages-label');
        if (el) el.textContent = count;
        if (labelEl) {
            labelEl.textContent = count === 0 ? 'no new messages' : count === 1 ? '1 new message' : `${count} new messages`;
        }
    }

    // ─── Change 2: Status Clarity Block ───

    function renderStatus(status, updatedAt) {
        const s = STATUS_MAP[status] || STATUS_MAP['active'];
        const label = (status || 'active').replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        // Populate both desktop and mobile status blocks
        ['', '-mobile'].forEach(suffix => {
            const badgeEl = document.getElementById('status-badge' + suffix);
            if (badgeEl) {
                badgeEl.className = `px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.color}`;
                badgeEl.textContent = label;
            }

            const meaningEl = document.getElementById('status-meaning' + suffix);
            if (meaningEl) meaningEl.textContent = s.meaning;

            const nextEl = document.getElementById('status-next-action' + suffix);
            if (nextEl) nextEl.textContent = s.next;
        });

        const updatedEl = document.getElementById('status-updated');
        if (updatedEl && updatedAt) {
            updatedEl.textContent = `Updated ${formatDate(updatedAt)}`;
        }
    }

    // ─── Change 1: Journey Progress Tracker ───

    function renderJourneyTracker(currentPhase) {
        // Desktop: vertical compact list in left column
        const container = document.getElementById('journey-steps');
        if (container) {
            container.innerHTML = '';
            PHASES.forEach(phase => {
                const isComplete = phase.id < currentPhase;
                const isCurrent = phase.id === currentPhase;
                const isFuture = phase.id > currentPhase;

                const step = document.createElement('div');
                step.className = `flex items-center gap-2 py-1.5 cursor-pointer rounded-md px-2 transition-colors ${isCurrent ? 'bg-gold/10' : 'hover:bg-charcoal/3'} ${isFuture ? 'opacity-40' : ''}`;
                step.innerHTML = `
                    <div class="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold border-2
                        ${isComplete ? 'bg-gold border-gold text-white' : ''}
                        ${isCurrent ? 'bg-white border-gold text-gold' : ''}
                        ${isFuture ? 'bg-cream border-charcoal/20 text-charcoal/30' : ''}
                    ">${isComplete ? '&#10003;' : phase.id}</div>
                    <span class="text-xs font-medium leading-tight
                        ${isComplete ? 'text-gold' : ''}
                        ${isCurrent ? 'text-charcoal font-semibold' : ''}
                        ${isFuture ? 'text-charcoal/30' : ''}
                    ">${phase.name}</span>
                `;
                step.addEventListener('click', () => showJourneyDetail(phase, isComplete, isCurrent));
                container.appendChild(step);
            });
        }

        // Mobile: horizontal scrollable pills
        const mobileContainer = document.getElementById('journey-steps-mobile');
        if (mobileContainer) {
            mobileContainer.innerHTML = '';
            PHASES.forEach(phase => {
                const isComplete = phase.id < currentPhase;
                const isCurrent = phase.id === currentPhase;
                const isFuture = phase.id > currentPhase;

                const pill = document.createElement('div');
                pill.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 cursor-pointer border
                    ${isComplete ? 'bg-gold/10 border-gold/30 text-gold' : ''}
                    ${isCurrent ? 'bg-gold text-white border-gold' : ''}
                    ${isFuture ? 'bg-charcoal/5 border-charcoal/10 text-charcoal/30' : ''}
                `;
                pill.innerHTML = `${isComplete ? '&#10003;' : phase.id}. ${phase.name}`;
                pill.addEventListener('click', () => showJourneyDetail(phase, isComplete, isCurrent));
                mobileContainer.appendChild(pill);
            });
        }
    }

    function showJourneyDetail(phase, isComplete, isCurrent) {
        const detail = document.getElementById('journey-detail');
        if (!detail) return;
        detail.classList.remove('hidden');
        document.getElementById('journey-detail-title').textContent = `Phase ${phase.id}: ${phase.name}`;
        document.getElementById('journey-detail-desc').textContent = phase.desc;
        document.getElementById('journey-detail-status').textContent =
            isComplete ? '\u2713 Completed' :
            isCurrent ? '\u2192 In progress \u2014 your steward is working with you on this phase.' :
                        'Coming up \u2014 you\u2019ll be guided into this phase at the right time.';
    }

    // ─── Change 4: Messaging Panel ───

    function initMessaging(caseId, profile) {
        if (unsubMessages) unsubMessages();

        const messagesRef = db.collection('cases').doc(caseId).collection('messages');
        const q = messagesRef.orderBy('timestamp', 'asc');

        // Real-time listener
        unsubMessages = q.onSnapshot((snapshot) => {
            const thread = document.getElementById('message-thread');
            if (!thread) return;

            if (snapshot.empty) {
                thread.innerHTML = '<p class="text-sm text-charcoal/40 text-center mt-8">No messages yet. Send your steward a message below.</p>';
                return;
            }

            thread.innerHTML = '';
            snapshot.forEach(docSnap => {
                const msg = docSnap.data();
                const isOwn = msg.senderId === profile.uid;
                const bubble = document.createElement('div');
                bubble.className = `flex flex-col max-w-[80%] ${isOwn ? 'self-end items-end' : 'self-start items-start'}`;
                bubble.innerHTML = `
                    <div class="px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                        ${isOwn
                            ? 'bg-gold text-white rounded-br-sm'
                            : 'bg-charcoal/5 text-charcoal rounded-bl-sm border border-charcoal/10'}">
                        ${escapeHtml(msg.text)}
                    </div>
                    <span class="text-[10px] text-charcoal/35 mt-1">
                        ${isOwn ? 'You' : escapeHtml(msg.senderName || 'Steward')} &middot; ${msg.timestamp ? formatTimestamp(msg.timestamp) : 'Just now'}
                    </span>
                `;
                thread.appendChild(bubble);
            });

            // Auto-scroll to bottom
            thread.scrollTop = thread.scrollHeight;

            // Mark steward messages as read
            snapshot.forEach(docSnap => {
                const msg = docSnap.data();
                if (msg.senderRole === 'steward' && !msg.read) {
                    docSnap.ref.update({ read: true }).catch(() => {});
                }
            });
        }, (err) => {
            console.error('Messages listener error:', err);
        });

        // Send handler
        const sendBtn = document.getElementById('send-message-btn');
        const input = document.getElementById('message-input');

        if (sendBtn && input) {
            sendBtn.addEventListener('click', () => sendMessage(messagesRef, input, profile));

            // Ctrl/Cmd+Enter to send
            input.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    sendBtn.click();
                }
            });
        }
    }

    async function sendMessage(messagesRef, input, profile) {
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        input.disabled = true;
        const sendBtn = document.getElementById('send-message-btn');
        if (sendBtn) sendBtn.disabled = true;

        try {
            await messagesRef.add({
                text,
                senderId: profile.uid,
                senderName: profile.displayName || 'Client',
                senderRole: 'client',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false,
            });
        } catch (e) {
            console.error('Failed to send message:', e);
            input.value = text; // restore on error
        } finally {
            input.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            input.focus();
        }
    }

    async function loadUnreadCount(caseId, clientUid) {
        try {
            const snap = await db.collection('cases').doc(caseId)
                .collection('messages')
                .where('read', '==', false)
                .where('senderRole', '==', 'steward')
                .get();
            updateGlanceMessages(snap.size);
        } catch (err) {
            // Index may not exist yet — show 0
            updateGlanceMessages(0);
        }
    }

    // ─── Tab Switching ───

    function switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.dashboard-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        // Show/hide panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('hidden', panel.id !== `tab-panel-${tabName}`);
        });
        // Update messages badge visibility
        if (tabName === 'messages') {
            const badge = document.getElementById('tab-msg-badge');
            if (badge) badge.classList.add('hidden');
        }
    }

    // ─── Existing: Milestones ───

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
                    <div class="card p-4 ${cardBg}">
                        <div class="flex items-start justify-between mb-1">
                            <h4 class="font-serif text-sm ${m.status === 'upcoming' ? 'text-muted' : 'text-charcoal'}">${escapeHtml(m.title)}</h4>
                            <span class="badge badge-${m.status} ml-2 flex-shrink-0">${formatStatus(m.status)}</span>
                        </div>
                        ${m.description ? `<p class="text-xs text-muted leading-relaxed mb-1">${escapeHtml(m.description)}</p>` : ''}
                        <p class="text-[10px] text-muted/70">${dateStr}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderMilestoneProgress(milestones) {
        const total = milestones.length;
        const completed = milestones.filter(m => m.status === 'completed').length;

        // Update glance bar milestones
        updateGlanceMilestones(completed, total);
    }

    // ─── Existing: Notes ───

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
            <div class="p-3 mb-2 rounded-lg border border-charcoal/8 bg-white/40">
                <div class="flex items-center gap-2 mb-1.5">
                    <div class="w-5 h-5 rounded-full bg-gold/10 flex items-center justify-center">
                        <span class="text-gold text-[9px] font-semibold">${getInitials(n.authorName)}</span>
                    </div>
                    <span class="text-xs font-medium text-charcoal">${escapeHtml(n.authorName || 'Steward')}</span>
                    <span class="text-[10px] text-muted ml-auto">${formatDate(n.createdAt)}</span>
                </div>
                <p class="text-xs text-muted leading-relaxed">${escapeHtml(n.content)}</p>
            </div>
        `).join('');
    }

    // ─── Existing: Documents ───

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

        container.innerHTML = docs.map(d => `
            <a href="${escapeHtml(d.downloadUrl)}" target="_blank" rel="noopener" class="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-charcoal/3 transition-colors border border-transparent hover:border-gold/15">
                <div class="w-8 h-8 rounded-md bg-gold/10 flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" fill="none" stroke="#c9a96e" stroke-width="1.5" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                    </svg>
                </div>
                <div class="min-w-0">
                    <p class="text-xs font-medium text-charcoal truncate">${escapeHtml(d.name)}</p>
                    <p class="text-[10px] text-muted">${formatDate(d.uploadedAt)}${d.fileSize ? ' &middot; ' + formatFileSize(d.fileSize) : ''}</p>
                </div>
            </a>
        `).join('');
    }

    // ─── Empty & Error States ───

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

    function formatTimestamp(ts) {
        if (!ts?.toDate) return '';
        const d = ts.toDate();
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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

    return { init, switchTab };
})();

// ─── Page Init ───
Auth.requireAuth(['client'], (profile) => {
    ClientDashboard.init(profile);
});
