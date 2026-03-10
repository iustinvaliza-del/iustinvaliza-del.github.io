/* ============================================
   Legacy Stewards — Admin Dashboard Logic
   ============================================ */

const AdminDashboard = (() => {
    let currentProfile = null;
    let currentCaseId = null;
    let currentCaseData = null;
    let unsubAdminMessages = null;
    let phaseChartInstance = null;

    const PHASES = [
        'Discovery & Assessment',
        'Heir Readiness Evaluation',
        'Legal Framework Review',
        'Tax Strategy',
        'Family Navigation',
        'Investment & Impact',
        'Transition Complete'
    ];

    // Default milestones for new cases
    const DEFAULT_MILESTONES = [
        { title: 'Initial Discovery & Assessment', description: 'Comprehensive review of family wealth structure, goals, and readiness baseline.', order: 1 },
        { title: 'Heir Readiness Evaluation', description: 'Detailed assessment of leadership capabilities, knowledge gaps, and development areas.', order: 2 },
        { title: 'Legal Framework Review', description: 'Country-specific inheritance law analysis and estate planning review.', order: 3 },
        { title: 'Tax Strategy Development', description: 'Optimization of tax obligations across relevant jurisdictions.', order: 4 },
        { title: 'Family Navigation Planning', description: 'Facilitation framework for succession conversations and family alignment.', order: 5 },
        { title: 'Investment & Impact Alignment', description: 'Values-aligned portfolio strategy and ESG investment planning.', order: 6 },
        { title: 'Stewardship Transition Complete', description: 'Final readiness confirmation and independent leadership transition.', order: 7 },
    ];

    // ─── Initialization ───

    function init(profile) {
        currentProfile = profile;
        Auth.updateNavDisplay(profile, document.getElementById('sidebar-user-name'), document.getElementById('sidebar-user-role'));

        // Show/hide admin-only elements
        if (profile.role === 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        }

        // Set up navigation
        setupNavigation();
        setupModals();

        // Load default view
        showView('overview');
    }

    // ─── Navigation & View Switching ───

    function setupNavigation() {
        document.querySelectorAll('.sidebar-link[data-view]').forEach(link => {
            link.addEventListener('click', () => {
                const viewId = link.dataset.view;
                showView(viewId);
                // Close mobile sidebar
                document.getElementById('admin-sidebar').classList.remove('open');
                document.getElementById('sidebar-overlay').classList.add('hidden');
            });
        });
    }

    function showView(viewId) {
        document.querySelectorAll('.dashboard-view').forEach(v => v.classList.add('hidden'));
        const view = document.getElementById('view-' + viewId);
        if (view) view.classList.remove('hidden');

        document.querySelectorAll('.sidebar-link[data-view]').forEach(l => l.classList.remove('active'));
        const link = document.querySelector(`.sidebar-link[data-view="${viewId}"]`);
        if (link) link.classList.add('active');

        // Load data for the view
        if (viewId === 'overview') loadOverview();
        else if (viewId === 'clients') loadClients();
        else if (viewId === 'team') loadTeam();
    }

    // ─── Overview View ───

    async function loadOverview() {
        try {
            let casesQuery;
            if (currentProfile.role === 'admin') {
                casesQuery = db.collection('cases');
            } else {
                casesQuery = db.collection('cases').where('assignedEmployeeId', '==', currentProfile.uid);
            }

            const snap = await casesQuery.get();
            const cases = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            const active = cases.filter(c => c.status === 'active').length;
            const completed = cases.filter(c => c.status === 'completed').length;
            const onHold = cases.filter(c => c.status === 'on-hold').length;
            const totalClients = cases.length;

            // Mock financial metrics based on client count
            const avgAumPerClient = 12.5; // USD millions
            const totalAum = totalClients * avgAumPerClient;
            const avgReturn = 8.7; // percent
            const revenuePerClient = 0.15; // USD millions
            const revenue = totalClients * revenuePerClient;

            const el = id => document.getElementById(id);
            el('stat-total-aum').textContent = `$${totalAum.toFixed(1)}M`;
            el('stat-avg-return').textContent = `${avgReturn}%`;
            el('stat-revenue').textContent = `$${revenue.toFixed(1)}M`;
            el('stat-active-clients').textContent = active;
            el('stat-in-progress').textContent = active;
            el('stat-completed').textContent = completed;
            el('stat-on-hold').textContent = onHold;

            // Compute phase distribution from milestones
            await renderPhaseChart(cases);

            // Recent activity
            const recent = cases
                .sort((a, b) => {
                    const ta = a.updatedAt?.toDate?.() || new Date(0);
                    const tb = b.updatedAt?.toDate?.() || new Date(0);
                    return tb - ta;
                })
                .slice(0, 5);

            const activityEl = el('recent-activity');
            if (activityEl) {
                if (recent.length === 0) {
                    activityEl.innerHTML = '<p class="text-muted text-sm py-4 text-center">No recent activity.</p>';
                } else {
                    activityEl.innerHTML = recent.map(c => `
                        <div class="flex items-center gap-3 py-3 border-b border-gold/5 last:border-0 cursor-pointer hover:bg-gold/5 px-3 rounded-lg transition-colors" onclick="AdminDashboard.openCase('${c.id}')">
                            <div class="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                                <span class="text-gold text-xs font-semibold">${getInitials(c.clientName)}</span>
                            </div>
                            <div class="min-w-0 flex-1">
                                <p class="text-sm font-medium text-charcoal truncate">${escapeHtml(c.clientName)}</p>
                                <p class="text-xs text-muted truncate">${escapeHtml(c.title)}</p>
                            </div>
                            <span class="badge badge-${c.status === 'active' ? 'active' : c.status === 'on-hold' ? 'on-hold' : 'completed'} flex-shrink-0">${c.status}</span>
                        </div>
                    `).join('');
                }
            }
        } catch (err) {
            console.error('Failed to load overview:', err);
        }
    }

    async function renderPhaseChart(cases) {
        const phaseCounts = new Array(PHASES.length).fill(0);
        let hasPhaseData = false;
        for (const c of cases) {
            if (c.currentPhase != null) {
                hasPhaseData = true;
                const phaseIdx = c.currentPhase;
                if (phaseIdx >= 0 && phaseIdx < PHASES.length) {
                    phaseCounts[phaseIdx]++;
                }
            }
        }
        // If no cases have phase data yet, show illustrative distribution
        if (!hasPhaseData && cases.length > 0) {
            const n = cases.length;
            phaseCounts[0] = Math.round(n * 0.08);  // Discovery
            phaseCounts[1] = Math.round(n * 0.17);  // Heir Readiness
            phaseCounts[2] = Math.round(n * 0.17);  // Legal Framework
            phaseCounts[3] = Math.round(n * 0.17);  // Tax Strategy
            phaseCounts[4] = Math.round(n * 0.17);  // Family Navigation
            phaseCounts[5] = Math.round(n * 0.16);  // Investment & Impact
            phaseCounts[6] = Math.round(n * 0.08);  // Transition Complete
            // Adjust rounding so total matches
            const diff = n - phaseCounts.reduce((a, b) => a + b, 0);
            phaseCounts[3] += diff;
        }

        const canvas = document.getElementById('phase-chart');
        if (!canvas) return;

        if (phaseChartInstance) phaseChartInstance.destroy();

        phaseChartInstance = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: PHASES.map(p => p.length > 18 ? p.substring(0, 16) + '...' : p),
                datasets: [{
                    data: phaseCounts,
                    backgroundColor: 'rgba(201, 169, 110, 0.6)',
                    borderColor: '#c9a96e',
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, font: { size: 11 }, color: '#6B6B7B' },
                        grid: { color: 'rgba(201,169,110,0.1)' }
                    },
                    x: {
                        ticks: { font: { size: 9 }, color: '#6B6B7B', maxRotation: 45 },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // ─── Clients View ───

    let allCases = [];

    async function loadClients(filter = 'all') {
        const container = document.getElementById('clients-table-body');
        if (!container) return;

        container.innerHTML = '<tr><td colspan="5" class="text-center py-8"><div class="skeleton h-8 w-full mb-2"></div><div class="skeleton h-8 w-full mb-2"></div><div class="skeleton h-8 w-full"></div></td></tr>';

        try {
            let query;
            if (currentProfile.role === 'admin') {
                query = db.collection('cases');
            } else {
                query = db.collection('cases').where('assignedEmployeeId', '==', currentProfile.uid);
            }

            const snap = await query.get();
            allCases = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            renderClients(allCases, filter);
        } catch (err) {
            console.error('Failed to load clients:', err);
            container.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-red-500 text-sm">Failed to load clients.</td></tr>';
        }
    }

    function renderClients(cases, filter = 'all') {
        const container = document.getElementById('clients-table-body');
        if (!container) return;

        let filtered = cases;
        if (filter !== 'all') {
            filtered = cases.filter(c => c.status === filter);
        }

        // Apply search
        const searchVal = document.getElementById('client-search')?.value?.toLowerCase() || '';
        if (searchVal) {
            filtered = filtered.filter(c =>
                (c.clientName || '').toLowerCase().includes(searchVal) ||
                (c.clientEmail || '').toLowerCase().includes(searchVal)
            );
        }

        if (filtered.length === 0) {
            container.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-muted text-sm">No clients found.</td></tr>';
            return;
        }

        container.innerHTML = filtered.map(c => `
            <tr class="cursor-pointer" onclick="AdminDashboard.openCase('${c.id}')">
                <td class="td-name">
                    <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
                            <span class="text-gold text-[10px] font-semibold">${getInitials(c.clientName)}</span>
                        </div>
                        ${escapeHtml(c.clientName)}
                    </div>
                </td>
                <td>${escapeHtml(c.clientEmail)}</td>
                <td>${escapeHtml(c.assignedEmployeeName || '—')}</td>
                <td><span class="badge badge-${c.status === 'active' ? 'active' : c.status === 'on-hold' ? 'on-hold' : 'completed'}">${c.status}</span></td>
                <td>${formatDate(c.updatedAt)}</td>
            </tr>
        `).join('');
    }

    function filterClients() {
        const filter = document.getElementById('client-filter')?.value || 'all';
        renderClients(allCases, filter);
    }

    function searchClients() {
        const filter = document.getElementById('client-filter')?.value || 'all';
        renderClients(allCases, filter);
    }

    // ─── Add Client ───

    async function addClient(formData) {
        const { firstName, lastName, email, phone, assignedEmployeeId, assignedEmployeeName, caseTitle, country } = formData;
        const displayName = `${firstName} ${lastName}`;

        try {
            // Create a placeholder user doc (real auth account created in Firebase Console)
            const userRef = db.collection('users').doc();
            const userData = {
                email,
                displayName,
                role: 'client',
                phone: phone || '',
                assignedEmployeeId: assignedEmployeeId || currentProfile.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            };
            if (country) userData.country = country;
            await userRef.set(userData);

            // Create case
            const caseRef = await db.collection('cases').add({
                clientId: userRef.id,
                clientName: displayName,
                clientEmail: email,
                assignedEmployeeId: assignedEmployeeId || currentProfile.uid,
                assignedEmployeeName: assignedEmployeeName || currentProfile.displayName,
                status: 'active',
                title: caseTitle || 'Inheritance Stewardship',
                summary: '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });

            // Create default milestones
            const batch = db.batch();
            DEFAULT_MILESTONES.forEach(m => {
                const ref = caseRef.collection('milestones').doc();
                batch.set(ref, {
                    ...m,
                    status: 'upcoming',
                    completedAt: null,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: currentProfile.uid,
                });
            });
            await batch.commit();

            closeModal('add-client-modal');
            loadClients();
            return true;
        } catch (err) {
            console.error('Failed to add client:', err);
            return false;
        }
    }

    // ─── Case Detail View ───

    async function openCase(caseId) {
        currentCaseId = caseId;
        showView('case-detail');

        const container = document.getElementById('case-detail-content');
        if (!container) return;

        try {
            const caseDoc = await db.collection('cases').doc(caseId).get();
            if (!caseDoc.exists) {
                container.innerHTML = '<div class="empty-state py-20"><p class="text-muted">Case not found.</p></div>';
                return;
            }

            currentCaseData = { id: caseDoc.id, ...caseDoc.data() };
            renderCaseHeader(currentCaseData);
            loadCaseMilestones(caseId);
            loadCaseNotes(caseId);
            loadCaseDocuments(caseId);
            initAdminMessaging(caseId);
        } catch (err) {
            console.error('Failed to open case:', err);
        }
    }

    function renderCaseHeader(caseData) {
        document.getElementById('case-client-name').textContent = caseData.clientName;
        document.getElementById('case-title-display').textContent = caseData.title;
        document.getElementById('case-assigned-to').textContent = caseData.assignedEmployeeName || 'Unassigned';

        const statusEl = document.getElementById('case-status-badge');
        statusEl.textContent = caseData.status;
        statusEl.className = `badge badge-${caseData.status === 'active' ? 'active' : caseData.status === 'on-hold' ? 'on-hold' : 'completed'}`;

        // Status dropdown
        const statusSelect = document.getElementById('case-status-select');
        if (statusSelect) statusSelect.value = caseData.status;

        // Phase indicator
        renderPhaseIndicator(caseData);
    }

    function renderPhaseIndicator(caseData) {
        const container = document.getElementById('case-phase-indicator');
        if (!container) return;

        const currentPhase = caseData.currentPhase != null ? caseData.currentPhase : 0;
        const pct = Math.round((currentPhase / (PHASES.length - 1)) * 100);

        container.innerHTML = `
            <div class="flex items-center gap-3 mb-3">
                <label class="text-xs text-muted font-medium whitespace-nowrap">Journey Phase:</label>
                <select onchange="AdminDashboard.updateCasePhase(parseInt(this.value))" class="form-select-sm flex-1 max-w-xs">
                    ${PHASES.map((p, i) => `<option value="${i}" ${i === currentPhase ? 'selected' : ''}>${p}</option>`).join('')}
                </select>
            </div>
            <div class="flex items-center gap-3">
                <div class="flex-1 h-2 bg-sand rounded-full overflow-hidden">
                    <div class="h-full bg-gold rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                </div>
                <span class="text-xs text-muted font-medium whitespace-nowrap">${currentPhase + 1} of ${PHASES.length}</span>
            </div>
        `;
    }

    async function updateCasePhase(phaseIdx) {
        if (!currentCaseId) return;
        try {
            await db.collection('cases').doc(currentCaseId).update({
                currentPhase: phaseIdx,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            currentCaseData.currentPhase = phaseIdx;
            renderPhaseIndicator(currentCaseData);
        } catch (err) {
            console.error('Failed to update case phase:', err);
        }
    }

    async function updateCaseStatus(newStatus) {
        if (!currentCaseId) return;
        try {
            await db.collection('cases').doc(currentCaseId).update({
                status: newStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
            currentCaseData.status = newStatus;
            renderCaseHeader(currentCaseData);
        } catch (err) {
            console.error('Failed to update case status:', err);
        }
    }

    // ─── Case Milestones ───

    async function loadCaseMilestones(caseId) {
        const container = document.getElementById('case-milestones');
        if (!container) return;

        try {
            const snap = await db.collection('cases').doc(caseId)
                .collection('milestones')
                .orderBy('order')
                .get();

            const milestones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderCaseMilestones(milestones, container);
        } catch (err) {
            console.error('Failed to load milestones:', err);
        }
    }

    function renderCaseMilestones(milestones, container) {
        if (milestones.length === 0) {
            container.innerHTML = '<div class="empty-state py-8"><p class="text-muted text-sm">No milestones yet.</p></div>';
            return;
        }

        const total = milestones.length;
        const completedCount = milestones.filter(m => m.status === 'completed').length;
        const pct = Math.round((completedCount / total) * 100);

        const progressBar = `
            <div class="mb-4 p-3 bg-sand/30 rounded-lg">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-medium text-charcoal">${completedCount} of ${total} milestones completed</span>
                    <span class="text-xs font-semibold text-gold">${pct}%</span>
                </div>
                <div class="h-2 bg-sand rounded-full overflow-hidden">
                    <div class="h-full bg-gold rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                </div>
            </div>
        `;

        container.innerHTML = progressBar + `<div class="timeline">${milestones.map(m => {
            const dotClass = m.status === 'completed' ? 'timeline-dot-completed' :
                            m.status === 'in-progress' ? 'timeline-dot-in-progress' :
                            'timeline-dot-upcoming';

            const checkmark = m.status === 'completed'
                ? '<svg width="12" height="12" fill="white" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>'
                : m.status === 'in-progress'
                ? '<div class="w-2 h-2 rounded-full bg-white"></div>'
                : '';

            const statusBadge = m.status === 'completed'
                ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Completed</span>'
                : m.status === 'in-progress'
                ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-gold/15 text-gold-dark font-medium">In Progress</span>'
                : '<span class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Upcoming</span>';

            const dateInfo = m.status === 'completed' && m.completedAt
                ? `<span class="text-[10px] text-muted">${formatDate(m.completedAt)}</span>`
                : '';

            const cardBorder = m.status === 'in-progress' ? 'border-l-2 border-l-gold' : '';
            const titleOpacity = m.status === 'upcoming' ? 'opacity-60' : '';

            return `
                <div class="timeline-item" data-milestone-id="${m.id}">
                    <div class="timeline-dot ${dotClass}">${checkmark}</div>
                    <div class="card p-4 ${cardBorder}">
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-1">
                                    <h4 class="font-serif text-base text-charcoal ${titleOpacity}">${escapeHtml(m.title)}</h4>
                                    ${statusBadge}
                                </div>
                                ${m.description ? `<p class="text-sm text-muted leading-relaxed">${escapeHtml(m.description)}</p>` : ''}
                                ${dateInfo}
                            </div>
                            <div class="flex items-center gap-2 flex-shrink-0">
                                <select onchange="AdminDashboard.updateMilestoneStatus('${m.id}', this.value)" class="form-select-sm">
                                    <option value="upcoming" ${m.status === 'upcoming' ? 'selected' : ''}>Upcoming</option>
                                    <option value="in-progress" ${m.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
                                    <option value="completed" ${m.status === 'completed' ? 'selected' : ''}>Completed</option>
                                </select>
                                <button onclick="AdminDashboard.editMilestone('${m.id}')" class="text-muted hover:text-gold transition-colors" title="Edit">
                                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                </button>
                                <button onclick="AdminDashboard.deleteMilestone('${m.id}')" class="text-muted hover:text-red-500 transition-colors" title="Delete">
                                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                                        <path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('')}</div>`;
    }

    function formatDate(ts) {
        if (!ts) return '';
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    async function updateMilestoneStatus(milestoneId, newStatus) {
        if (!currentCaseId) return;
        try {
            const update = {
                status: newStatus,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: currentProfile.uid,
            };
            if (newStatus === 'completed') {
                update.completedAt = firebase.firestore.FieldValue.serverTimestamp();
            } else {
                update.completedAt = null;
            }

            await db.collection('cases').doc(currentCaseId)
                .collection('milestones').doc(milestoneId)
                .update(update);

            await db.collection('cases').doc(currentCaseId).update({
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });

            loadCaseMilestones(currentCaseId);
        } catch (err) {
            console.error('Failed to update milestone:', err);
        }
    }

    function editMilestone(milestoneId) {
        // Find milestone data from DOM
        const item = document.querySelector(`[data-milestone-id="${milestoneId}"]`);
        if (!item) return;

        const titleEl = item.querySelector('h4');
        const descEl = item.querySelector('p.text-muted');
        const currentTitle = titleEl?.textContent || '';
        const currentDesc = descEl?.textContent || '';

        document.getElementById('edit-milestone-id').value = milestoneId;
        document.getElementById('edit-milestone-title').value = currentTitle;
        document.getElementById('edit-milestone-desc').value = currentDesc;
        openModal('edit-milestone-modal');
    }

    async function saveEditedMilestone() {
        const milestoneId = document.getElementById('edit-milestone-id').value;
        const title = document.getElementById('edit-milestone-title').value.trim();
        const desc = document.getElementById('edit-milestone-desc').value.trim();

        if (!title || !currentCaseId) return;

        try {
            await db.collection('cases').doc(currentCaseId)
                .collection('milestones').doc(milestoneId)
                .update({
                    title,
                    description: desc,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: currentProfile.uid,
                });

            closeModal('edit-milestone-modal');
            loadCaseMilestones(currentCaseId);
        } catch (err) {
            console.error('Failed to save milestone:', err);
        }
    }

    async function deleteMilestone(milestoneId) {
        if (!currentCaseId || !confirm('Delete this milestone?')) return;

        try {
            await db.collection('cases').doc(currentCaseId)
                .collection('milestones').doc(milestoneId)
                .delete();
            loadCaseMilestones(currentCaseId);
        } catch (err) {
            console.error('Failed to delete milestone:', err);
        }
    }

    async function addMilestone() {
        const title = document.getElementById('new-milestone-title').value.trim();
        const desc = document.getElementById('new-milestone-desc').value.trim();

        if (!title || !currentCaseId) return;

        try {
            // Get max order
            const snap = await db.collection('cases').doc(currentCaseId)
                .collection('milestones')
                .orderBy('order', 'desc')
                .limit(1)
                .get();

            const maxOrder = snap.empty ? 0 : (snap.docs[0].data().order || 0);

            await db.collection('cases').doc(currentCaseId)
                .collection('milestones')
                .add({
                    title,
                    description: desc,
                    status: 'upcoming',
                    order: maxOrder + 1,
                    completedAt: null,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: currentProfile.uid,
                });

            document.getElementById('new-milestone-title').value = '';
            document.getElementById('new-milestone-desc').value = '';
            closeModal('add-milestone-modal');
            loadCaseMilestones(currentCaseId);
        } catch (err) {
            console.error('Failed to add milestone:', err);
        }
    }

    // ─── Case Notes ───

    async function loadCaseNotes(caseId) {
        const container = document.getElementById('case-notes');
        if (!container) return;

        try {
            const snap = await db.collection('cases').doc(caseId)
                .collection('notes')
                .orderBy('createdAt', 'desc')
                .get();

            const notes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderCaseNotes(notes, container);
        } catch (err) {
            console.error('Failed to load notes:', err);
        }
    }

    function renderCaseNotes(notes, container) {
        const addForm = `
            <div class="card p-4 mb-4 border-gold/20">
                <textarea id="new-note-content" class="form-input mb-3" rows="3" placeholder="Write a note or update..."></textarea>
                <div class="flex items-center justify-between">
                    <label class="flex items-center gap-2 text-sm text-muted cursor-pointer">
                        <div id="note-visibility-toggle" class="toggle active" onclick="this.classList.toggle('active')"></div>
                        <span>Visible to client</span>
                    </label>
                    <button onclick="AdminDashboard.addNote()" class="btn-gold btn-sm">Add Note</button>
                </div>
            </div>
        `;

        if (notes.length === 0) {
            container.innerHTML = addForm + '<div class="empty-state py-6"><p class="text-muted text-sm">No notes yet.</p></div>';
            return;
        }

        container.innerHTML = addForm + notes.map(n => `
            <div class="card p-4 mb-3">
                <div class="flex items-center gap-2 mb-2">
                    <div class="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center">
                        <span class="text-gold text-[10px] font-semibold">${getInitials(n.authorName)}</span>
                    </div>
                    <span class="text-sm font-medium text-charcoal">${escapeHtml(n.authorName || 'Unknown')}</span>
                    ${!n.visibleToClient ? '<span class="text-[10px] text-muted bg-muted/10 px-2 py-0.5 rounded-full">Internal</span>' : ''}
                    <span class="text-xs text-muted ml-auto">${formatDate(n.createdAt)}</span>
                    <button onclick="AdminDashboard.deleteNote('${n.id}')" class="text-muted hover:text-red-500 transition-colors ml-1" title="Delete">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <p class="text-sm text-muted leading-relaxed">${escapeHtml(n.content)}</p>
            </div>
        `).join('');
    }

    async function addNote() {
        const content = document.getElementById('new-note-content')?.value?.trim();
        if (!content || !currentCaseId) return;

        const visibleToggle = document.getElementById('note-visibility-toggle');
        const visibleToClient = visibleToggle?.classList.contains('active') ?? true;

        try {
            await db.collection('cases').doc(currentCaseId)
                .collection('notes')
                .add({
                    content,
                    authorId: currentProfile.uid,
                    authorName: currentProfile.displayName || currentProfile.email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    visibleToClient,
                });

            await db.collection('cases').doc(currentCaseId).update({
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });

            loadCaseNotes(currentCaseId);
        } catch (err) {
            console.error('Failed to add note:', err);
        }
    }

    async function deleteNote(noteId) {
        if (!currentCaseId || !confirm('Delete this note?')) return;

        try {
            await db.collection('cases').doc(currentCaseId)
                .collection('notes').doc(noteId)
                .delete();
            loadCaseNotes(currentCaseId);
        } catch (err) {
            console.error('Failed to delete note:', err);
        }
    }

    // ─── Case Documents ───

    async function loadCaseDocuments(caseId) {
        const container = document.getElementById('case-documents');
        if (!container) return;

        try {
            const snap = await db.collection('cases').doc(caseId)
                .collection('documents')
                .orderBy('uploadedAt', 'desc')
                .get();

            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderCaseDocuments(docs, container);
        } catch (err) {
            console.error('Failed to load documents:', err);
        }
    }

    function renderCaseDocuments(docs, container) {
        const uploadBtn = `
            <div class="mb-4">
                <label class="btn-outline btn-sm cursor-pointer inline-flex items-center gap-2">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                    Upload Document
                    <input type="file" class="hidden" onchange="AdminDashboard.uploadDocument(this.files)" multiple>
                </label>
            </div>
        `;

        if (docs.length === 0) {
            container.innerHTML = uploadBtn + '<div class="empty-state py-6"><p class="text-muted text-sm">No documents uploaded.</p></div>';
            return;
        }

        container.innerHTML = uploadBtn + `
            <div class="space-y-2">${docs.map(d => `
                <div class="card p-3 flex items-center gap-3">
                    <div class="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
                        <svg width="18" height="18" fill="none" stroke="#c9a96e" stroke-width="1.5" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14,2 14,8 20,8"/>
                        </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-charcoal truncate">${escapeHtml(d.name)}</p>
                        <p class="text-xs text-muted">${formatDate(d.uploadedAt)} &middot; ${formatFileSize(d.fileSize || 0)}</p>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                        <div class="toggle ${d.visibleToClient ? 'active' : ''}" onclick="AdminDashboard.toggleDocVisibility('${d.id}', ${!d.visibleToClient})" title="${d.visibleToClient ? 'Visible to client' : 'Hidden from client'}"></div>
                        <a href="${escapeHtml(d.downloadUrl)}" target="_blank" rel="noopener" class="text-gold hover:text-gold-dark transition-colors" title="Download">
                            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                            </svg>
                        </a>
                        <button onclick="AdminDashboard.deleteDocument('${d.id}', '${escapeHtml(d.storagePath)}')" class="text-muted hover:text-red-500 transition-colors" title="Delete">
                            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `).join('')}</div>
        `;
    }

    async function uploadDocument(files) {
        if (!files || files.length === 0 || !currentCaseId) return;

        for (const file of files) {
            if (file.size > 25 * 1024 * 1024) {
                alert(`File "${file.name}" exceeds 25MB limit.`);
                continue;
            }

            try {
                const storagePath = `cases/${currentCaseId}/${Date.now()}_${file.name}`;
                const ref = storage.ref(storagePath);
                await ref.put(file);
                const downloadUrl = await ref.getDownloadURL();

                await db.collection('cases').doc(currentCaseId)
                    .collection('documents')
                    .add({
                        name: file.name,
                        fileName: file.name,
                        storagePath,
                        downloadUrl,
                        uploadedBy: currentProfile.uid,
                        uploadedByName: currentProfile.displayName || currentProfile.email,
                        uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        fileSize: file.size,
                        mimeType: file.type,
                        visibleToClient: false,
                    });

                await db.collection('cases').doc(currentCaseId).update({
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                });
            } catch (err) {
                console.error(`Failed to upload ${file.name}:`, err);
                alert(`Failed to upload "${file.name}". Please try again.`);
            }
        }

        loadCaseDocuments(currentCaseId);
    }

    async function toggleDocVisibility(docId, visible) {
        if (!currentCaseId) return;
        try {
            await db.collection('cases').doc(currentCaseId)
                .collection('documents').doc(docId)
                .update({ visibleToClient: visible });
            loadCaseDocuments(currentCaseId);
        } catch (err) {
            console.error('Failed to toggle doc visibility:', err);
        }
    }

    async function deleteDocument(docId, storagePath) {
        if (!currentCaseId || !confirm('Delete this document?')) return;

        try {
            // Delete from Storage
            if (storagePath) {
                try { await storage.ref(storagePath).delete(); } catch (e) { /* file may not exist */ }
            }
            // Delete from Firestore
            await db.collection('cases').doc(currentCaseId)
                .collection('documents').doc(docId)
                .delete();
            loadCaseDocuments(currentCaseId);
        } catch (err) {
            console.error('Failed to delete document:', err);
        }
    }

    // ─── Team Management ───

    async function loadTeam() {
        if (currentProfile.role !== 'admin') return;

        const container = document.getElementById('team-table-body');
        if (!container) return;

        try {
            const snap = await db.collection('teamMembers').get();
            const members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            renderTeam(members, container);
        } catch (err) {
            console.error('Failed to load team:', err);
            container.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-red-500 text-sm">Failed to load team.</td></tr>';
        }
    }

    function renderTeam(members, container) {
        if (members.length === 0) {
            container.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-muted text-sm">No team members found.</td></tr>';
            return;
        }

        container.innerHTML = members.map(m => `
            <tr>
                <td class="td-name">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center text-gold font-serif text-xs font-bold overflow-hidden flex-shrink-0">
                            ${m.photoURL ? `<img src="${escapeHtml(m.photoURL)}" class="w-full h-full object-cover" alt="${escapeHtml(m.displayName)}">` : getInitials(m.displayName)}
                        </div>
                        ${escapeHtml(m.displayName)}
                    </div>
                </td>
                <td>${escapeHtml(m.email)}</td>
                <td>
                    <select onchange="AdminDashboard.updateTeamRole('${m.id}', this.value)" class="form-select-sm">
                        <option value="employee" ${m.role === 'employee' ? 'selected' : ''}>Employee</option>
                        <option value="admin" ${m.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
                <td>${m.activeCaseCount || 0}</td>
            </tr>
        `).join('');
    }

    async function updateTeamRole(memberId, newRole) {
        try {
            await db.collection('teamMembers').doc(memberId).update({ role: newRole });
            await db.collection('users').doc(memberId).update({ role: newRole });
        } catch (err) {
            console.error('Failed to update team role:', err);
        }
    }

    async function addTeamMember() {
        const name = document.getElementById('team-member-name')?.value?.trim();
        const email = document.getElementById('team-member-email')?.value?.trim();
        const role = document.getElementById('team-member-role')?.value || 'employee';

        if (!name || !email) return;

        try {
            const id = email.replace(/[^a-zA-Z0-9]/g, '_');
            await db.collection('teamMembers').doc(id).set({
                displayName: name,
                email,
                role,
                activeCaseCount: 0,
                joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
            });

            closeModal('add-team-modal');
            loadTeam();
        } catch (err) {
            console.error('Failed to add team member:', err);
        }
    }

    // ─── Admin Messaging ───

    function initAdminMessaging(caseId) {
        if (unsubAdminMessages) unsubAdminMessages();

        const messagesRef = db.collection('cases').doc(caseId).collection('messages');
        const q = messagesRef.orderBy('timestamp', 'asc');

        unsubAdminMessages = q.onSnapshot((snapshot) => {
            const thread = document.getElementById('admin-message-thread');
            if (!thread) return;

            if (snapshot.empty) {
                thread.innerHTML = '<p class="text-sm text-muted text-center mt-8">No messages with this client yet.</p>';
                return;
            }

            thread.innerHTML = '';
            snapshot.forEach(docSnap => {
                const msg = docSnap.data();
                const isSteward = msg.senderRole === 'steward';
                const bubble = document.createElement('div');
                bubble.className = `flex flex-col max-w-[80%] ${isSteward ? 'self-end items-end' : 'self-start items-start'}`;
                bubble.innerHTML = `
                    <div class="px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                        ${isSteward
                            ? 'bg-gold text-white rounded-br-sm'
                            : 'bg-charcoal/5 text-charcoal rounded-bl-sm border border-charcoal/10'}">
                        ${escapeHtml(msg.text)}
                    </div>
                    <span class="text-[10px] text-muted mt-1">
                        ${escapeHtml(msg.senderName || (isSteward ? 'Steward' : 'Client'))} &middot; ${msg.timestamp ? formatAdminTimestamp(msg.timestamp) : 'Just now'}
                    </span>
                `;
                thread.appendChild(bubble);
            });

            thread.scrollTop = thread.scrollHeight;

            // Mark client messages as read
            snapshot.forEach(docSnap => {
                const msg = docSnap.data();
                if (msg.senderRole === 'client' && !msg.read) {
                    docSnap.ref.update({ read: true }).catch(() => {});
                }
            });
        }, (err) => {
            console.error('Admin messages listener error:', err);
        });

        // Send handler
        const sendBtn = document.getElementById('admin-send-message-btn');
        const input = document.getElementById('admin-message-input');

        if (sendBtn && input) {
            // Remove old listeners by replacing elements
            const newBtn = sendBtn.cloneNode(true);
            sendBtn.parentNode.replaceChild(newBtn, sendBtn);
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);

            newBtn.addEventListener('click', () => sendAdminMessage(messagesRef, newInput));
            newInput.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    newBtn.click();
                }
            });
        }
    }

    async function sendAdminMessage(messagesRef, input) {
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        input.disabled = true;
        const sendBtn = document.getElementById('admin-send-message-btn');
        if (sendBtn) sendBtn.disabled = true;

        try {
            await messagesRef.add({
                text,
                senderId: currentProfile.uid,
                senderName: currentProfile.displayName || currentProfile.email,
                senderRole: 'steward',
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                read: false,
            });
        } catch (e) {
            console.error('Failed to send admin message:', e);
            input.value = text;
        } finally {
            input.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            input.focus();
        }
    }

    function formatAdminTimestamp(ts) {
        if (!ts?.toDate) return '';
        const d = ts.toDate();
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

    // ─── Modal Helpers ───

    function setupModals() {
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal(overlay.id);
            });
        });
    }

    function openModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.remove('hidden');
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('hidden');
    }

    // ─── Mobile Sidebar ───

    function toggleSidebar() {
        const sidebar = document.getElementById('admin-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar.classList.toggle('open');
        overlay.classList.toggle('hidden');
    }

    // ─── Helpers ───

    function formatDate(timestamp) {
        if (!timestamp) return '—';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

    // ─── Public API ───

    return {
        init,
        showView,
        openCase,
        filterClients,
        searchClients,
        addClient,
        updateMilestoneStatus,
        editMilestone,
        saveEditedMilestone,
        deleteMilestone,
        addMilestone,
        addNote,
        deleteNote,
        uploadDocument,
        toggleDocVisibility,
        deleteDocument,
        updateCaseStatus,
        updateCasePhase,
        loadTeam,
        updateTeamRole,
        addTeamMember,
        openModal,
        closeModal,
        toggleSidebar,
    };
})();

// ─── Page Init ───
Auth.requireAuth(['employee', 'admin'], (profile) => {
    AdminDashboard.init(profile);
});
