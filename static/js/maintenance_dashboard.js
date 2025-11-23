document.addEventListener('DOMContentLoaded', function() {
    // Global Image Modal Trigger (For both Tickets Table and Submit Tab)
    document.addEventListener("click", function (e) {
        if (e.target.classList.contains("view-image-btn")) {
            const imageUrl = e.target.getAttribute('data-url');
            if (imageUrl) {
                const modalImg = document.getElementById("modalImage");
                modalImg.src = imageUrl;
                const modal = new bootstrap.Modal(document.getElementById("imageModal"));
                modal.show();
            }
        }
    });

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

    const statusFilter = document.getElementById('statusFilter');
    const searchInput = document.getElementById('searchTickets');
    const ticketRows = document.querySelectorAll('.ticket-row');
    const noTicketsMessage = document.getElementById('noTicketsMessage');

    function applyFilters() {
        const selectedStatus = statusFilter.value;
        // Use an array to store search fields to easily expand search scope if needed
        const searchFields = ['data-title', 'data-submitter'];
        const searchTerm = searchInput.value.toLowerCase().trim();
        let visibleCount = 0;

        ticketRows.forEach(row => {
            const status = row.getAttribute('data-status');

            // Check if status matches filter
            const statusMatch = selectedStatus === 'All' || status === selectedStatus;

            // Check if search term is found in any searchable field
            const searchMatch = !searchTerm || searchFields.some(field =>
                row.getAttribute(field).includes(searchTerm)
            );

            if (statusMatch && searchMatch) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });

        noTicketsMessage.style.display = visibleCount === 0 ? 'block' : 'none';
    }

    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (searchInput) searchInput.addEventListener('input', applyFilters);

    // Initial filter application
    if (statusFilter || searchInput) {
        applyFilters();
    }

    const activeAlerts = document.querySelectorAll('.alert');

    if (activeAlerts.length > 0) {
        let submissionRelated = false;
        activeAlerts.forEach(alert => {
            if (alert.textContent.includes('Ticket submitted successfully') ||
                alert.textContent.includes('maximum of 4 active tickets') ||
                alert.textContent.includes('fill in all required fields')) {
                submissionRelated = true;
            }
        });

        if (submissionRelated) {
            const submitTab = document.getElementById('submit-tab');
            const ticketsTab = document.getElementById('tickets-tab');
            const submitBody = document.getElementById('submit-body');
            const ticketsBody = document.getElementById('tickets-body');

            if (submitTab && submitBody) {
                // Deactivate default tab
                ticketsTab.classList.remove('active');
                ticketsBody.classList.remove('show', 'active');

                // Activate submit tab
                submitTab.classList.add('active');
                submitBody.classList.add('show', 'active');
            }
        }
    }
});