document.addEventListener("DOMContentLoaded", () => {
    const deptFilter = document.getElementById("deptFilter");
    const statusFilter = document.getElementById("statusFilter");
    const ticketBody = document.getElementById("ticketBody");
    const sortOrder = document.getElementById("sortOrder");

    if (deptFilter && !deptFilter.value) deptFilter.value = 'All';
    if (statusFilter && !statusFilter.value) statusFilter.value = 'All';

    function fetchFilteredTickets() {
        const dept = deptFilter.value;
        const status = statusFilter.value;
        const order = sortOrder.value;

        fetch(`/filter_tickets?department=${dept}&status=${status}`)
            .then(res => res.json())
            .then(data => {
                // Sort tickets based on dropdown selection
                if (order === "asc") {
                    data.sort((a, b) => a.id - b.id);
                } else if (order === "desc") {
                    data.sort((a, b) => b.id - a.id);
                } else {
                    data.sort((a, b) => a.id - b.id);
                }

                ticketBody.innerHTML = "";

                if (data.length === 0) {
                    ticketBody.innerHTML = `<td colspan="5" class="text-center text-muted py-3">No tickets found.</td>`;
                    return;
                }

                data.forEach(t => {
                    // Capitalize first letter of the department
                    const department = t.category
                        ? t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase()
                        : '';
                    const dateSubmitted = t.date_submitted
                        ? (() => {
                            const fixedDate = t.date_submitted.replace(' ', 'T');
                            const parsed = new Date(fixedDate);
                            return isNaN(parsed)
                                ? t.date_submitted  // fallback to raw date text if invalid
                                : parsed.toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                });
                          })()
                        : 'N/A';
                    const row = `
                        <tr>
                            <td>${t.id}</td>
                            <td>${t.submitted_name}</td>
                            <td>${department}</td>
                            <td>${t.description}</td>
                            <td>${dateSubmitted}</td>
                            <td>${t.status}</td>
                        </tr>
                    `;
                    ticketBody.innerHTML += row;
                });
            });
    }

    // Load tickets on startup (after a short delay to allow filters to load)
    window.addEventListener("load", () => setTimeout(fetchFilteredTickets, 200));

    // Trigger when filters or sorting change
    deptFilter.addEventListener("change", fetchFilteredTickets);
    statusFilter.addEventListener("change", fetchFilteredTickets);
    sortOrder.addEventListener("change", fetchFilteredTickets);
});
