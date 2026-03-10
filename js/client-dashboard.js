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

            // Specialist panel
            renderSpecialistPanel();
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
                // Fallback: show initials from case data
                const stewardAvatar = document.getElementById('steward-avatar');
                if (stewardAvatar && !stewardAvatar.innerHTML.includes('img')) {
                    stewardAvatar.textContent = getInitials(caseData.assignedEmployeeName || 'S');
                }
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

    // ─── Portfolio Mock Data ───

    const MOCK_PORTFOLIO = {
        totalValue: 2450000,
        currency: 'USD',
        inceptionDate: '2023-01-01',
        lastUpdated: '2025-03-01',
        benchmarkName: 'MSCI AC World',
        allocation: [
            { class: 'Public Equities',  pct: 32, color: '#c9a96e' },
            { class: 'Private Equity',   pct: 20, color: '#2C2C35' },
            { class: 'Fixed Income',     pct: 15, color: '#8B7355' },
            { class: 'Real Estate',      pct: 12, color: '#D4B896' },
            { class: 'Hedge Funds',      pct: 10, color: '#6B5B45' },
            { class: 'Cash & Equiv.',    pct:  6, color: '#A89070' },
            { class: 'Impact / ESG',     pct:  5, color: '#9CAF88' },
        ],
        performance: {
            labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'],
            portfolio:  [0.0, 1.2, 2.1, 3.8, 3.1, 4.6, 5.2, 7.1, 6.8, 8.4, 9.1, 10.3],
            benchmark:  [0.0, 0.8, 1.5, 3.0, 2.2, 3.5, 4.1, 5.8, 5.2, 7.0, 7.6,  8.9],
        },
        pnl: {
            unrealisedGain:  186500,
            realisedGain:     42300,
            incomeReceived:   38750,
            totalReturn:     10.3,
            vsInception:     11.8,
            annualised:       8.7,
        },
        currencies: [
            { currency: 'USD', pct: 48 },
            { currency: 'SGD', pct: 22 },
            { currency: 'EUR', pct: 14 },
            { currency: 'HKD', pct:  9 },
            { currency: 'THB', pct:  7 },
        ],
        holdings: [
            { name: 'MSCI World Index Fund',         class: 'Public Equities', region: 'Global',       weight: 14.0, value: 343000,  returnPct:  12.4, returnUSD:  37900 },
            { name: 'Asia Pacific Equity Fund',      class: 'Public Equities', region: 'Asia Pacific', weight: 10.0, value: 245000,  returnPct:   7.8, returnUSD:  17700 },
            { name: 'Emerging Markets Growth Fund',  class: 'Public Equities', region: 'EM',           weight:  8.0, value: 196000,  returnPct:   5.2, returnUSD:   9700 },
            { name: 'SEA Buyout Fund III',           class: 'Private Equity',  region: 'SEA',          weight: 12.0, value: 294000,  returnPct:  18.6, returnUSD:  45900 },
            { name: 'Global PE Co-Investment',       class: 'Private Equity',  region: 'Global',       weight:  8.0, value: 196000,  returnPct:  14.2, returnUSD:  23500 },
            { name: 'Investment Grade Bond Fund',    class: 'Fixed Income',    region: 'Global',       weight:  9.0, value: 220500,  returnPct:   4.1, returnUSD:   8700 },
            { name: 'Short Duration SGD Bonds',      class: 'Fixed Income',    region: 'Singapore',    weight:  6.0, value: 147000,  returnPct:   3.8, returnUSD:   5400 },
            { name: 'Singapore Commercial REIT',     class: 'Real Estate',     region: 'Singapore',    weight:  7.0, value: 171500,  returnPct:   6.3, returnUSD:  10200 },
            { name: 'SEA Real Estate Fund',          class: 'Real Estate',     region: 'SEA',          weight:  5.0, value: 122500,  returnPct:   4.7, returnUSD:   5500 },
            { name: 'Global Macro Hedge Fund',       class: 'Hedge Funds',     region: 'Global',       weight:  6.0, value: 147000,  returnPct:   9.2, returnUSD:  12400 },
            { name: 'Long/Short Asia Equity Fund',   class: 'Hedge Funds',     region: 'Asia',         weight:  4.0, value:  98000,  returnPct:   7.1, returnUSD:   6500 },
            { name: 'Cash & Money Market',           class: 'Cash & Equiv.',   region: 'Multi',        weight:  6.0, value: 147000,  returnPct:   4.8, returnUSD:   6700 },
            { name: 'Women in Finance VC Fund',      class: 'Impact / ESG',    region: 'Global',       weight:  3.0, value:  73500,  returnPct:  11.4, returnUSD:   7600 },
            { name: 'SEA Climate Tech Fund',         class: 'Impact / ESG',    region: 'SEA',          weight:  2.0, value:  49000,  returnPct:   8.9, returnUSD:   3900 },
        ],
    };

    // ─── Portfolio: Seed & Load ───

    let portfolioLoaded = false;

    async function ensurePortfolioSeeded(caseId) {
        const portRef = db.collection('cases').doc(caseId).collection('portfolio').doc('overview');
        try {
            const snap = await portRef.get();
            if (!snap.exists) {
                await portRef.set({ ...MOCK_PORTFOLIO, seededAt: firebase.firestore.FieldValue.serverTimestamp() });
                const newSnap = await portRef.get();
                return newSnap.data();
            }
            return snap.data();
        } catch (err) {
            console.warn('Portfolio Firestore access failed, using local mock data:', err);
            return MOCK_PORTFOLIO;
        }
    }

    // ─── Portfolio: Render Functions ───

    function formatCurrency(val, currency) {
        currency = currency || 'USD';
        return new Intl.NumberFormat('en-US', {
            style: 'currency', currency: currency, maximumFractionDigits: 0
        }).format(val);
    }

    function renderPortfolioSummary(p) {
        const el = (id) => document.getElementById(id);
        el('port-total-value').textContent = formatCurrency(p.totalValue, p.currency);
        el('port-currency-label').textContent = 'Illustrative \u00B7 as of ' + p.lastUpdated;
        el('port-total-return').textContent = '+' + p.pnl.totalReturn + '%';
        const benchReturn = p.performance.benchmark[p.performance.benchmark.length - 1];
        el('port-vs-benchmark').textContent = '+' + (p.pnl.totalReturn - benchReturn).toFixed(1) + '% vs ' + p.benchmarkName;
        el('port-unrealised').textContent = '+' + formatCurrency(p.pnl.unrealisedGain, p.currency);
        el('port-income').textContent = formatCurrency(p.pnl.incomeReceived, p.currency);
    }

    function renderAllocationChart(allocation) {
        const ctx = document.getElementById('allocation-chart').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: allocation.map(a => a.class),
                datasets: [{
                    data: allocation.map(a => a.pct),
                    backgroundColor: allocation.map(a => a.color),
                    borderWidth: 2,
                    borderColor: '#F0EBE3',
                    hoverOffset: 6,
                }]
            },
            options: {
                cutout: '68%',
                plugins: { legend: { display: false }, tooltip: {
                    callbacks: { label: function(ctx) { return ' ' + ctx.label + ': ' + ctx.parsed + '%'; } }
                }},
                animation: { animateRotate: true, duration: 800 }
            }
        });

        const legend = document.getElementById('allocation-legend');
        legend.innerHTML = '';
        allocation.forEach(a => {
            legend.innerHTML += '<div class="flex items-center justify-between gap-2">' +
                '<div class="flex items-center gap-1.5">' +
                '<div class="w-2 h-2 rounded-full flex-shrink-0" style="background:' + a.color + '"></div>' +
                '<span class="text-[10px] text-charcoal/70">' + a.class + '</span>' +
                '</div>' +
                '<span class="text-[10px] font-semibold text-charcoal">' + a.pct + '%</span>' +
                '</div>';
        });
    }

    function renderCurrencyBars(currencies) {
        const container = document.getElementById('currency-bars');
        container.innerHTML = '';
        currencies.forEach(c => {
            container.innerHTML += '<div>' +
                '<div class="flex justify-between text-[10px] mb-1">' +
                '<span class="font-medium text-charcoal">' + c.currency + '</span>' +
                '<span class="text-charcoal/60">' + c.pct + '%</span>' +
                '</div>' +
                '<div class="h-1.5 bg-cream rounded-full overflow-hidden">' +
                '<div class="h-1.5 bg-gold rounded-full transition-all duration-700" style="width:' + c.pct + '%"></div>' +
                '</div></div>';
        });
    }

    function renderPerformanceChart(perf, benchmarkName) {
        document.getElementById('benchmark-label').textContent = benchmarkName;
        const ctx = document.getElementById('performance-chart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: perf.labels,
                datasets: [
                    {
                        label: 'Portfolio',
                        data: perf.portfolio,
                        borderColor: '#c9a96e',
                        backgroundColor: 'rgba(201,169,110,0.08)',
                        borderWidth: 2.5,
                        pointRadius: 3,
                        pointBackgroundColor: '#c9a96e',
                        fill: true,
                        tension: 0.4,
                    },
                    {
                        label: benchmarkName,
                        data: perf.benchmark,
                        borderColor: 'rgba(44,44,53,0.3)',
                        borderWidth: 2,
                        borderDash: [5, 4],
                        pointRadius: 0,
                        fill: false,
                        tension: 0.4,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#2C2C35',
                        titleColor: '#c9a96e',
                        bodyColor: '#F0EBE3',
                        padding: 10,
                        callbacks: {
                            label: function(ctx) { return ' ' + ctx.dataset.label + ': +' + ctx.parsed.y.toFixed(1) + '%'; }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: 'rgba(44,44,53,0.4)', font: { size: 10 } }
                    },
                    y: {
                        grid: { color: 'rgba(44,44,53,0.06)' },
                        ticks: {
                            color: 'rgba(44,44,53,0.4)',
                            font: { size: 10 },
                            callback: function(v) { return '+' + v + '%'; }
                        }
                    }
                },
                animation: { duration: 900, easing: 'easeInOutQuart' }
            }
        });
    }

    function renderHoldings(holdings) {
        const filter = document.getElementById('holdings-filter');
        const classes = [];
        holdings.forEach(h => { if (classes.indexOf(h.class) === -1) classes.push(h.class); });
        // Clear existing options beyond "All"
        filter.innerHTML = '<option value="all">All Asset Classes</option>';
        classes.forEach(c => {
            filter.innerHTML += '<option value="' + c + '">' + c + '</option>';
        });

        function renderRows(data) {
            const tbody = document.getElementById('holdings-body');
            tbody.innerHTML = '';
            data.forEach(h => {
                const isPos = h.returnPct >= 0;
                tbody.innerHTML +=
                    '<tr class="border-b border-charcoal/5 hover:bg-cream/40 transition-colors">' +
                    '<td class="py-2 pr-3"><p class="font-medium text-charcoal text-xs">' + escapeHtml(h.name) + '</p><p class="text-[10px] text-charcoal/40">' + h.region + '</p></td>' +
                    '<td class="py-2 pr-3 hidden md:table-cell"><span class="text-[10px] px-1.5 py-0.5 rounded-full bg-gold/10 text-gold font-medium">' + h.class + '</span></td>' +
                    '<td class="py-2 pr-3 text-right"><span class="text-xs text-charcoal font-medium">' + h.weight.toFixed(1) + '%</span></td>' +
                    '<td class="py-2 pr-3 text-right hidden sm:table-cell"><span class="text-xs text-charcoal">' + formatCurrency(h.value) + '</span></td>' +
                    '<td class="py-2 text-right">' +
                    '<span class="text-xs font-semibold ' + (isPos ? 'text-emerald-600' : 'text-red-500') + '">' + (isPos ? '+' : '') + h.returnPct + '%</span>' +
                    '<p class="text-[10px] ' + (isPos ? 'text-emerald-500' : 'text-red-400') + '">' + (isPos ? '+' : '') + formatCurrency(h.returnUSD) + '</p>' +
                    '</td></tr>';
            });
        }

        renderRows(holdings);
        filter.addEventListener('change', function(e) {
            var val = e.target.value;
            renderRows(val === 'all' ? holdings : holdings.filter(function(h) { return h.class === val; }));
        });
    }

    function renderPnL(pnl, benchmarkName, portfolioReturn) {
        const benchReturn = 8.9;
        const outperformance = (portfolioReturn - benchReturn).toFixed(1);
        const el = (id) => document.getElementById(id);
        el('pnl-unrealised').textContent = '+' + formatCurrency(pnl.unrealisedGain);
        el('pnl-realised').textContent   = '+' + formatCurrency(pnl.realisedGain);
        el('pnl-income2').textContent    = formatCurrency(pnl.incomeReceived);
        el('pnl-12m').textContent        = '+' + pnl.totalReturn + '%';
        el('pnl-vs-bench').textContent   = '+' + outperformance + '% vs ' + benchmarkName;
        el('pnl-inception').textContent  = '+' + pnl.vsInception + '%';
        el('pnl-annualised').textContent = '+' + pnl.annualised + '% p.a.';
    }

    async function loadPortfolio(caseId) {
        if (portfolioLoaded) return;
        portfolioLoaded = true;
        const data = await ensurePortfolioSeeded(caseId);
        renderPortfolioSummary(data);
        renderAllocationChart(data.allocation);
        renderCurrencyBars(data.currencies);
        renderPerformanceChart(data.performance, data.benchmarkName);
        renderHoldings(data.holdings);
        renderPnL(data.pnl, data.benchmarkName, data.pnl.totalReturn);
    }

    // ─── Center View Switching (Milestones / Portfolio) ───

    function switchCenterView(viewName) {
        document.querySelectorAll('.center-view-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });
        document.getElementById('center-view-milestones').classList.toggle('hidden', viewName !== 'milestones');
        document.getElementById('center-view-portfolio').classList.toggle('hidden', viewName !== 'portfolio');

        // Lazy-load portfolio on first switch
        if (viewName === 'portfolio' && currentCase) {
            loadPortfolio(currentCase.id);
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

    // ─── Specialist Panel ───

    const SPECIALISTS = {
        indonesia: {
            country: 'Indonesia',
            flag: '\u{1F1EE}\u{1F1E9}',
            legal: {
                name: 'Budi Santoso',
                title: 'Senior Inheritance & Estate Lawyer',
                firm: 'Santoso & Partners, Jakarta',
                focus: 'Civil Code inheritance, Islamic succession law (Faraid), forced heirship disputes, notarial services.',
                initials: 'BS',
                calLink: '#',
            },
            tax: {
                name: 'Dewi Kurniawan',
                title: 'Tax Advisor \u2014 Property & Estate',
                firm: 'PwC Indonesia',
                focus: 'BPHTB property transfer tax, unpaid estate liabilities, foreign ownership structures.',
                initials: 'DK',
                calLink: '#',
            },
        },
        singapore: {
            country: 'Singapore',
            flag: '\u{1F1F8}\u{1F1EC}',
            legal: {
                name: 'Rachel Lim',
                title: 'Estate Planning & Trust Specialist',
                firm: 'Allen & Gledhill LLP',
                focus: 'Intestate Succession Act, Wills Act, trust structuring, Women\'s Charter, digital asset estates.',
                initials: 'RL',
                calLink: '#',
            },
            tax: {
                name: 'James Teo',
                title: 'Private Client Tax Advisor',
                firm: 'Deloitte Singapore',
                focus: 'Income tax on estate assets, SRS planning, cross-border structuring for Singapore-domiciled families.',
                initials: 'JT',
                calLink: '#',
            },
        },
        philippines: {
            country: 'Philippines',
            flag: '\u{1F1F5}\u{1F1ED}',
            legal: {
                name: 'Maria Santos',
                title: 'Civil Law & Succession Specialist',
                firm: 'SyCip Salazar Hernandez & Gatmaitan',
                focus: 'Compulsory heirship (legitime), wills, intestate succession, estate administration.',
                initials: 'MS',
                calLink: '#',
            },
            tax: {
                name: 'Carlo Reyes',
                title: 'Estate Tax Specialist',
                firm: 'SGV & Co. (EY Philippines)',
                focus: 'Estate tax filing (6% flat rate), deductions, one-year filing deadlines, BIR compliance.',
                initials: 'CR',
                calLink: '#',
            },
        },
        malaysia: {
            country: 'Malaysia',
            flag: '\u{1F1F2}\u{1F1FE}',
            legal: {
                name: 'Nurul Huda Ibrahim',
                title: 'Dual-System Estate Lawyer',
                firm: 'Zaid Ibrahim & Co.',
                focus: 'Distribution Act 1958, Faraid Islamic succession, hibah, amanah trust structures.',
                initials: 'NI',
                calLink: '#',
            },
            tax: {
                name: 'David Wong',
                title: 'Property & Capital Gains Advisor',
                firm: 'KPMG Malaysia',
                focus: 'Real Property Gains Tax (RPGT) on inherited property, private residence exemptions, stamp duty.',
                initials: 'DW',
                calLink: '#',
            },
        },
        thailand: {
            country: 'Thailand',
            flag: '\u{1F1F9}\u{1F1ED}',
            legal: {
                name: 'Siriporn Chaiyasit',
                title: 'Civil & Commercial Code Specialist',
                firm: 'Baker McKenzie Thailand',
                focus: 'Statutory heirs hierarchy, Thai wills, foreign ownership restrictions, Land Department procedures.',
                initials: 'SC',
                calLink: '#',
            },
            tax: {
                name: 'Thanakorn Pattanaporn',
                title: 'Inheritance & Property Tax Advisor',
                firm: 'Deloitte Thailand',
                focus: 'Inheritance tax (>100M THB threshold), property transfer fees, Land Department registration.',
                initials: 'TP',
                calLink: '#',
            },
        },
        vietnam: {
            country: 'Vietnam',
            flag: '\u{1F1FB}\u{1F1F3}',
            legal: {
                name: 'Linh Pham',
                title: 'Civil Law & Succession Specialist',
                firm: 'VILAF (Vietnam International Law Firm)',
                focus: 'Heirs-at-law hierarchy, wills and forced heirs, foreign ownership restrictions on land.',
                initials: 'LP',
                calLink: '#',
            },
            tax: {
                name: 'Minh Tran',
                title: 'Personal Income & Estate Tax Advisor',
                firm: 'PwC Vietnam',
                focus: '10% inheritance tax on assets over 10M VND, family exemptions, cross-border asset planning.',
                initials: 'MT',
                calLink: '#',
            },
        },
    };

    function renderSpecialistCard(specialist, type) {
        return `
            <div class="bg-white/60 border border-gold/20 rounded-xl p-5 flex flex-col">
                <div class="flex items-center gap-4 mb-4">
                    <div class="w-14 h-14 rounded-full bg-gold/10 border-2 border-gold/40 flex items-center
                                justify-center font-serif text-lg font-bold text-gold flex-shrink-0">
                        ${specialist.initials}
                    </div>
                    <div>
                        <span class="text-xs px-2 py-0.5 rounded-full bg-gold/10 text-gold font-medium">
                            ${type} Specialist
                        </span>
                        <h4 class="font-serif text-base text-charcoal mt-1 leading-tight">${escapeHtml(specialist.name)}</h4>
                        <p class="text-xs text-charcoal/50">${escapeHtml(specialist.title)}</p>
                        <p class="text-xs text-charcoal/40">${escapeHtml(specialist.firm)}</p>
                    </div>
                </div>
                <p class="text-xs text-charcoal/60 leading-relaxed flex-1">${escapeHtml(specialist.focus)}</p>
                <a href="${specialist.calLink}"
                   class="mt-5 w-full text-center block px-4 py-2.5 bg-charcoal text-white text-xs font-semibold
                          rounded-lg hover:bg-gold transition-colors">
                    Book a 30-Min Consultation \u2192
                </a>
            </div>
        `;
    }

    function renderSpecialistPanel() {
        const panel = document.getElementById('specialist-panel');
        if (!panel) return;

        const countryKey = (currentProfile.country || '').toLowerCase();
        const data = SPECIALISTS[countryKey];

        if (!data) {
            panel.innerHTML = `
                <div class="text-center py-8 text-charcoal/40 text-sm">
                    No specialist assigned yet. Your steward will connect you with the right advisor
                    once your country profile is confirmed.
                </div>
            `;
            return;
        }

        panel.innerHTML = `
            <div class="flex items-center gap-3 mb-6">
                <span class="text-3xl">${data.flag}</span>
                <div>
                    <h3 class="font-serif text-xl text-charcoal">Your ${escapeHtml(data.country)} Specialist Team</h3>
                    <p class="text-xs text-charcoal/50 mt-0.5">
                        Pre-matched to your jurisdiction \u2014 book directly below.
                    </p>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${renderSpecialistCard(data.legal, 'Legal')}
                ${renderSpecialistCard(data.tax, 'Tax')}
            </div>
            <p class="text-xs text-charcoal/35 mt-5 text-center">
                Based in a different country or need a different specialist?
                <span class="text-gold hover:underline cursor-pointer" onclick="ClientDashboard.switchTab('messages')">
                    Message your steward \u2192
                </span>
            </p>
        `;
    }

    return { init, switchTab, switchCenterView };
})();

// ─── Page Init ───
Auth.requireAuth(['client'], (profile) => {
    ClientDashboard.init(profile);
});
