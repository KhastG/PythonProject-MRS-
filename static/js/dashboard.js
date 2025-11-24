document.addEventListener("DOMContentLoaded", () => {
    console.log("Dashboard loaded!");

    const statusFilter = document.getElementById('statusFilter');
    const deptFilter = document.getElementById('deptFilter');
    const ticketContainer = document.getElementById('ticketContainer');
    const tickets = document.querySelectorAll("#ticketContainer .card");

    if (deptFilter && !deptFilter.value) deptFilter.value = 'All';
    if (statusFilter && !statusFilter.value) statusFilter.value = 'All';

    // PREVENTION ERROR KUNG THE CONTAINER WAS MISSING (TO AVOID SYSTEM ERR)
    if (!ticketContainer) {
        console.warn("Ticket container (#ticketContainer) not found. Filter script will not run.");
    }

    // --- DARK/LIGHT MODE TOGGLE LOGIC ---
    const body = document.body;
    const darkModeToggle = document.getElementById('darkModeToggle');
    const darkModeKey = 'darkModeState'; // Key for sessionStorage

    function applyMode(isLight) {
        if (isLight) {
            body.classList.add('light-mode');
            darkModeToggle.checked = false; // Checkbox should be unchecked for Light Mode
            darkModeToggle.parentElement.querySelector('label').textContent = 'Light Mode';
        } else {
            body.classList.remove('light-mode');
            darkModeToggle.checked = true; // Checkbox should be checked for Dark Mode
            darkModeToggle.parentElement.querySelector('label').textContent = 'Dark Mode';
        }
    }

    const savedMode = sessionStorage.getItem(darkModeKey);

    if (savedMode === 'light') {
        applyMode(true);
    } else {
        applyMode(false);
    }

    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', function() {
            if (this.checked) {
                applyMode(false);
                sessionStorage.setItem(darkModeKey, 'dark');
            } else {
                applyMode(true);
                sessionStorage.setItem(darkModeKey, 'light');
            }
        });
    }

    // LOG-OUT TRIGGER
    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", function (e) {
            e.preventDefault();
            const modal = new bootstrap.Modal(
                document.getElementById("logoutConfirmModal")
            );
            modal.show();
        });
    }

    const getFilterValue = (el, fallback = 'All') => (el ? el.value : fallback);

    async function fetchTickets() {
        const status = encodeURIComponent(getFilterValue(statusFilter, 'All') || 'All');
        const dept = encodeURIComponent(getFilterValue(deptFilter, 'All') || 'All');
        const url = `/filter_tickets?status=${status}&department=${dept}`;

        try {
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) {
                console.error('Server returned', response.status, response.statusText);
                ticketContainer.innerHTML = '<p class="text-danger">Error loading tickets.</p>';
                return;
            }

            const tickets = await response.json();
            // Clear existing content
            ticketContainer.innerHTML = '';

            if (!tickets || tickets.length === 0) {
                ticketContainer.innerHTML = '<p>No tickets found.</p>';
                return;
            }
            // CARDSSSSSSSSS
            const fragment = document.createDocumentFragment();
            tickets.forEach(t => {
                const col = document.createElement('div');
                col.className = 'col-md-4';
                let borderClass = 'border-primary';
                if (t.status === 'Pending') borderClass = 'border-danger';
                else if (t.status === 'Approved') borderClass = 'border-success';
                else if (t.status === 'Done') borderClass = 'border-secondary';

                col.innerHTML = `
                  <div class="card mb-4 shadow-sm ${borderClass}">
                    <div class="card-body">
                      <h5 class="card-title fw-bold">${escapeHtml(t.title)}</h5>
                      <p class="mb-1"><strong>Status:</strong> ${escapeHtml(t.status)}</p>
                      <p class="mb-1"><strong>Department:</strong> ${escapeHtml((t.category || '').toUpperCase())}</p>
                      <p class="mb-1"><strong>Submitted By:</strong> ${escapeHtml(t.submitted_name || '')}</p>
                      <p class="text-muted"><small>Submitted: ${escapeHtml(t.date_submitted || '')}</small></p>
                      ${t.photo ? `<button type="button" class="btn btn-info btn-sm view-image-btn" data-ticket-id="${t.id}">View Image</button>` : ''}
                      ${t.status === 'Approved' ? `<button class="btn btn-sm btn-success approve-btn" data-ticket-id="${t.id}">Done</button>` : ''}
                    </div>
                  </div>
                `;
                fragment.appendChild(col);
            });

            ticketContainer.appendChild(fragment);

            // Attach approve button listeners dynamically after loading tickets
            attachApproveListeners();

        } catch (err) {
            console.error("Error fetching tickets:", err);
            ticketContainer.innerHTML = '<p class="text-danger">Error fetching tickets (network).</p>';
        }
    }

    document.addEventListener("click", function (e) {

        if (e.target.classList.contains("view-image-btn")) {

            const imageUrl = e.target.dataset.url;

            const modalImg = document.getElementById("modalImage");
            modalImg.src = imageUrl; // Set image URL dynamically

            const modal = new bootstrap.Modal(document.getElementById("imageModal"));
            modal.show();
        }
    });

    //PROTECTION FOR INJECTIONS
    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    // reloader of the webpage
    function attachApproveListeners() {
        document.querySelectorAll('.approve-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const ticketId = btn.dataset.ticketId;
                const res = await fetch(`/approve_ticket/${ticketId}`, { method: 'POST' });
                if (res.ok) {
                    console.log(`Ticket ${ticketId} marked done.`);
                    fetchTickets();
                }
            });
        });
    }
    window.addEventListener("load", () => {
        setTimeout(fetchTickets, 150); // small delay to let defaults apply
    });

    if (statusFilter) statusFilter.addEventListener('change', fetchTickets);
    if (deptFilter) deptFilter.addEventListener('change', fetchTickets);

    fetchTickets();

});
