document.addEventListener("DOMContentLoaded", () => {
    console.log("Dashboard loaded!");

    const statusFilter = document.getElementById('statusFilter');
    const deptFilter = document.getElementById('deptFilter');
    const ticketContainer = document.getElementById('ticketContainer'); // use unique id

    // If container missing, stop early (prevents errors)
    if (!ticketContainer) {
        console.warn("Ticket container (#ticketContainer) not found. Filter script will not run.");
        return;
    }

    // safe getter for filter values
    const getFilterValue = (el, fallback = 'All') => (el ? el.value : fallback);

    async function fetchTickets() {
        const status = encodeURIComponent(getFilterValue(statusFilter, 'All'));
        const dept = encodeURIComponent(getFilterValue(deptFilter, 'All'));
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

            // Build cards
            const fragment = document.createDocumentFragment();
            tickets.forEach(t => {
                const col = document.createElement('div');
                col.className = 'col-md-4';

                // pick border color based on status
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
                        </div>
                    </div>
                `;
                fragment.appendChild(col);
            });

            ticketContainer.appendChild(fragment);

        } catch (err) {
            console.error("Error fetching tickets:", err);
            ticketContainer.innerHTML = '<p class="text-danger">Error fetching tickets (network).</p>';
        }
    }

    // small HTML-escape utility to avoid injection
    function escapeHtml(str) {
        if (!str && str !== 0) return '';
        return String(str)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    // wire events if filters exist
    if (statusFilter) statusFilter.addEventListener('change', fetchTickets);
    if (deptFilter) deptFilter.addEventListener('change', fetchTickets);

    // initial fetch so page reflects current filter state
    fetchTickets();
});
