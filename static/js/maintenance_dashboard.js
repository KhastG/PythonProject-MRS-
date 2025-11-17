document.addEventListener("DOMContentLoaded", () => {
    const statusFilter = document.getElementById("statusFilter");
    const deptFilter = document.getElementById("deptFilter");
    const tickets = document.querySelectorAll("#ticketContainer .col-md-4");
    const noTicketsMessage = document.getElementById("noTicketsMessage");

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

    function filterTickets() {
        let statusValue = statusFilter.value;
        let deptValue = deptFilter ? deptFilter.value : "All";
        let visibleCount = 0;

        tickets.forEach(ticket => {
            const statusText = ticket.querySelector(".card-body p strong")?.nextSibling?.textContent.trim() || "";
            const deptText = ticket.querySelector(".card-body p:nth-of-type(2)")?.textContent.trim() || "";

            const matchesStatus = (statusValue === "All" || statusText.includes(statusValue));
            const matchesDept = (deptValue === "All" || deptText.includes(deptValue));

            if (matchesStatus && matchesDept) {
                ticket.style.display = "block";
                visibleCount++;
            } else {
                ticket.style.display = "none";
            }
        });

        // Toggle the "No tickets" message
        noTicketsMessage.style.display = visibleCount === 0 ? "block" : "none";
    }

    if (statusFilter) statusFilter.addEventListener("change", filterTickets);
    if (deptFilter) deptFilter.addEventListener("change", filterTickets);
});
