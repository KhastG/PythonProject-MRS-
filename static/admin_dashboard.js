document.addEventListener("DOMContentLoaded", () => {
    const deptFilter = document.getElementById("deptFilter");
    const statusFilter = document.getElementById("statusFilter");
    const ticketBody = document.getElementById("ticketBody");
    const sortOrder = document.getElementById("sortOrder");
    const navItems = document.querySelectorAll(".nav-item");
    const sections = document.querySelectorAll(".nav-section");
    const approveModal = document.getElementById("approveModal");
    const rejectModal = document.getElementById("rejectModal");
    const successModal = document.getElementById("successModal");
    const successMessage = document.getElementById("successMessage");

    let currentUserId = null;
    let currentAction = null;

    // NAVIGATION SWITCH HANDLER
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            navItems.forEach(i => i.classList.remove("active"));
            sections.forEach(s => s.classList.remove("active"));

            item.classList.add("active");
            const targetId = item.getAttribute("data-target");
            document.getElementById(targetId).classList.add("active");

            // Auto-refresh content per tab
            if (targetId === "approvement") fetchPendingAccounts();
            if (targetId === "tickets") fetchFilteredTickets();
            if (targetId === "existingAccounts") fetchExistingAccounts();
        });
    });

    if (deptFilter && !deptFilter.value) deptFilter.value = "All";
    if (statusFilter && !statusFilter.value) statusFilter.value = "All";

    // FETCH FILTERED TICKETS
    function fetchFilteredTickets() {
        const dept = deptFilter?.value || "All";
        const status = statusFilter?.value || "All";
        const order = sortOrder?.value || "asc";

        fetch(`/filter_tickets?department=${dept}&status=${status}`)
            .then(res => res.json())
            .then(data => {
                ticketBody.innerHTML = "";

                if (order === "asc") data.sort((a, b) => a.id - b.id);
                else if (order === "desc") data.sort((a, b) => b.id - a.id);

                if (data.length === 0) {
                    ticketBody.innerHTML = `<td colspan="6" class="text-center text-muted py-3">No tickets found.</td>`;
                    return;
                }

                data.forEach(t => {
                    const department = t.category
                        ? t.category.charAt(0).toUpperCase() + t.category.slice(1).toLowerCase()
                        : "";
                    const dateSubmitted = t.date_submitted
                        ? (() => {
                            const fixedDate = t.date_submitted.replace(" ", "T");
                            const parsed = new Date(fixedDate);
                            return isNaN(parsed)
                                ? t.date_submitted
                                : parsed.toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                });
                        })()
                        : "N/A";

                    ticketBody.innerHTML += `
                        <tr>
                            <td>${t.id}</td>
                            <td>${t.submitted_name}</td>
                            <td>${department}</td>
                            <td>${t.description}</td>
                            <td>${dateSubmitted}</td>
                            <td>${t.status}</td>
                        </tr>
                    `;
                });
            })
            .catch(() => {
                ticketBody.innerHTML = `<td colspan="6" class="text-center text-danger py-3">Failed to load tickets.</td>`;
            });
    }

    // FETCH PENDING ACCOUNTS (APPROVAL TAB)
    function fetchPendingAccounts() {
        const tableBody = document.getElementById("pendingAccountsBody");
        if (!tableBody) return;

        fetch("/pending_accounts")
            .then(res => res.json())
            .then(data => {
                tableBody.innerHTML = "";

                if (data.length === 0) {
                    tableBody.innerHTML = `<td colspan="8" class="text-center text-muted py-3">No pending accounts found.</td>`;
                    return;
                }

                data.forEach(u => {
                    tableBody.innerHTML += `
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
                });
            })
            .catch(err => {
                console.error("Error fetching accounts:", err);
                tableBody.innerHTML = `<td colspan="8" class="text-center text-danger py-3">Failed to load accounts.</td>`;
            });
    }

    // FETCH APPROVED EXISTING ACCOUNTS
    function fetchExistingAccounts() {
        const tableBody = document.getElementById("existingAccountsBody");
        if (!tableBody) return;

        fetch("/existing_accounts")
            .then(res => res.json())
            .then(data => {
                tableBody.innerHTML = "";

                if (data.length === 0) {
                    tableBody.innerHTML = `<td colspan="8" class="text-center text-muted py-3">No approved accounts found.</td>`;
                    return;
                }

                data.forEach(u => {
                    tableBody.innerHTML += `
                        <tr>
                            <td>${u.id}</td>
                            <td>${u.first_name}</td>
                            <td>${u.last_name}</td>
                            <td>${u.username}</td>
                            <td>${u.email}</td>
                            <td>${u.role}</td>
                            <td>${u.department}</td>
                            <td>
                                <button class="btn btn-danger btn-sm delete-btn" data-id="${u.id}">Delete</button>
                            </td>
                        </tr>
                    `;
                });

                // Add delete event listeners
                document.querySelectorAll(".delete-btn").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const userId = btn.getAttribute("data-id");
                        if (confirm("Are you sure you want to delete this account?")) {
                            fetch(`/delete_account/${userId}`, { method: "DELETE" })
                                .then(res => res.json())
                                .then(result => {
                                    alert(result.message || "Account deleted successfully!");
                                    fetchExistingAccounts(); // Refresh table
                                })
                                .catch(() => alert("Error deleting account."));
                        }
                    });
                });
            })
            .catch(err => {
                console.error("Error fetching existing accounts:", err);
                tableBody.innerHTML = `<td colspan="8" class="text-center text-danger py-3">Failed to load accounts.</td>`;
            });
    }

    // APPROVE / REJECT MODALS
    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("approve-btn")) {
            currentUserId = e.target.getAttribute("data-id");
            currentAction = "approve";
            approveModal.style.display = "flex";
        }
        else if (e.target.classList.contains("reject-btn")) {
            currentUserId = e.target.getAttribute("data-id");
            currentAction = "reject";
            rejectModal.style.display = "flex";
        }
    });

    // APPROVE MODAL BUTTONS
    document.getElementById("approveYes").addEventListener("click", () => {
        approveModal.style.display = "none";
        updateAccountStatus(currentUserId, true);
    });

    document.getElementById("approveNo").addEventListener("click", () => {
        approveModal.style.display = "none";
    });

    // REJECT MODAL BUTTONS
    document.getElementById("rejectYes").addEventListener("click", () => {
        rejectModal.style.display = "none";
        updateAccountStatus(currentUserId, false);
    });

    document.getElementById("rejectNo").addEventListener("click", () => {
        rejectModal.style.display = "none";
    });

    // Click outside modal content to close approve/reject modals
    [approveModal, rejectModal].forEach(modal => {
        modal.addEventListener("click", (e) => {
            // Only close if the overlay itself was clicked, not the modal content
            if (e.target === modal) {
                modal.style.display = "none";
            }
        });
    });

    // SUCCESS MODAL CLICK-TO-CLOSE
    window.addEventListener("click", (e) => {
        if (e.target === successModal) successModal.style.display = "none";
    });

    // ACCOUNT STATUS UPDATE
    function updateAccountStatus(userId, approve) {
        fetch(`/update_account_status/${userId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approve }),
        })
        .then((res) => res.json())
        .then((data) => {
            successMessage.textContent = approve
                ? "Account approved successfully!"
                : "Account rejected successfully!";
            successModal.style.display = "flex";
            setTimeout(() => {
                fetchPendingAccounts();
            }, 800);
        })
        .catch((err) => console.error("Error updating account:", err));
    }

    // INITIAL LOAD
    fetchFilteredTickets();
    fetchPendingAccounts();
    fetchExistingAccounts();

    // FILTER/SORT EVENT LISTENERS
    deptFilter?.addEventListener("change", fetchFilteredTickets);
    statusFilter?.addEventListener("change", fetchFilteredTickets);
    sortOrder?.addEventListener("change", fetchFilteredTickets);
});
