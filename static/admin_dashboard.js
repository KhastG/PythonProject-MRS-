document.addEventListener("DOMContentLoaded", () => {
    const deptFilter = document.getElementById("deptFilter");
    const statusFilter = document.getElementById("statusFilter");
    const ticketBody = document.getElementById("ticketBody");
    const sortOrder = document.getElementById("sortOrder");
    const navItems = document.querySelectorAll(".nav-item");
    const sections = document.querySelectorAll(".nav-section");

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            navItems.forEach(i => i.classList.remove("active"));
            sections.forEach(s => s.classList.remove("active"));

            item.classList.add("active");
            const targetId = item.getAttribute("data-target");
            document.getElementById(targetId).classList.add("active");

            // 🔹 Auto-refresh content per tab
            if (targetId === "approvement") fetchPendingAccounts();
            if (targetId === "tickets") fetchFilteredTickets();
        });
    });

    if (deptFilter && !deptFilter.value) deptFilter.value = 'All';
    if (statusFilter && !statusFilter.value) statusFilter.value = 'All';

    // Fetch tickets (with filters)
    function fetchFilteredTickets() {
        const dept = deptFilter.value;
        const status = statusFilter.value;
        const order = sortOrder.value;

        fetch(`/filter_tickets?department=${dept}&status=${status}`)
            .then(res => res.json())
            .then(data => {
                // Sort tickets
                if (order === "asc") data.sort((a, b) => a.id - b.id);
                else if (order === "desc") data.sort((a, b) => b.id - a.id);

                ticketBody.innerHTML = "";

                if (data.length === 0) {
                    ticketBody.innerHTML = `<td colspan="6" class="text-center text-muted py-3">No tickets found.</td>`;
                    return;
                }

                data.forEach(t => {
                    const department = t.category
                        ? t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase()
                        : '';
                    const dateSubmitted = t.date_submitted
                        ? (() => {
                            const fixedDate = t.date_submitted.replace(' ', 'T');
                            const parsed = new Date(fixedDate);
                            return isNaN(parsed)
                                ? t.date_submitted
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

    // Fetch pending accounts (for approvement section)
    function fetchPendingAccounts() {
        const tableBody = document.getElementById("pendingAccountsBody");
        if (!tableBody) return; // 🔹 Prevent null error

        fetch("/pending_accounts")
            .then(res => res.json())
            .then(data => {
                tableBody.innerHTML = "";

                if (data.length === 0) {
                    tableBody.innerHTML = `<td colspan="8" class="text-center text-muted py-3">No pending accounts found.</td>`;
                    return;
                }

                data.forEach(u => {
                const row = `
                    <tr>
                        <td>${u.id}</td>
                        <td>${u.first_name}</td>
                        <td>${u.last_name}</td>
                        <td>${u.username}</td>
                        <td>${u.email}</td>
                        <td>${u.role}</td>
                        <td>${u.department}</td>
                        <td>
                            <button class="btn btn-success btn-sm approve-btn" data-id="${u.id}">Approve</button>
                            <button class="btn btn-danger btn-sm reject-btn" data-id="${u.id}">Reject</button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
                });

            })
            .catch(err => {
                console.error("Error fetching accounts:", err);
                tableBody.innerHTML = `<td colspan="8" class="text-center text-danger py-3">Failed to load accounts.</td>`;
            });
    }

    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("approve-btn")) {
            const userId = e.target.getAttribute("data-id");
            updateAccountStatus(userId, true);
        } else if (e.target.classList.contains("reject-btn")) {
            const userId = e.target.getAttribute("data-id");
            updateAccountStatus(userId, false);
        }
    });

    function updateAccountStatus(userId, approve) {
        fetch(`/update_account_status/${userId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approve })
        })
        .then(res => res.json())
        .then(data => {
            alert(data.message);
            fetchPendingAccounts(); // Refresh the table
        })
        .catch(err => console.error("Error updating account:", err));
    }

    setTimeout(() => {
        fetchFilteredTickets();
        fetchPendingAccounts();
    }, 300);

    // Trigger when filters or sorting change
    deptFilter?.addEventListener("change", fetchFilteredTickets);
    statusFilter?.addEventListener("change", fetchFilteredTickets);
    sortOrder?.addEventListener("change", fetchFilteredTickets);
});
