document.addEventListener("DOMContentLoaded", () => {
    const deptFilter = document.getElementById("deptFilter");
    const statusFilter = document.getElementById("statusFilter");
    const ticketBody = document.getElementById("ticketBody");
    const sortOrder = document.getElementById("sortOrder");
    const navItems = document.querySelectorAll(".nav-item");
    const sections = document.querySelectorAll(".nav-section");

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

            if (targetId === "accounts") fetchExistingAccounts();
            if (targetId === "approvement") fetchPendingAccounts();
            if (targetId === "tickets") fetchFilteredTickets();
            if (targetId === "emailLogs") fetchEmailLogs();
        });
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

    if (deptFilter && !deptFilter.value) deptFilter.value = "All";
    if (statusFilter && !statusFilter.value) statusFilter.value = "All";

     function setupTablePagination(tbodyId) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll("tr"));
        const rowsPerPage = 5;
        if (rows.length <= rowsPerPage) return;

        // Remove existing pagination if present
        const existingPagination = tbody.parentNode.parentNode.querySelector(".pagination");
        if (existingPagination) existingPagination.remove();

        let currentPage = 1;
        const totalPages = Math.ceil(rows.length / rowsPerPage);

        // Create pagination container
        const pagination = document.createElement("div");
        pagination.className = "pagination mt-2 text-center";
        tbody.parentNode.parentNode.appendChild(pagination);

        function showPage(page) {
            const start = (page - 1) * rowsPerPage;
            const end = start + rowsPerPage;

            // Show/hide rows
            rows.forEach((row, idx) => {
                row.style.display = idx >= start && idx < end ? "table-row" : "none";
            });

            // Render pagination buttons
            pagination.innerHTML = "";
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement("button");
                btn.textContent = i;
                btn.className = i === page ? "btn btn-sm btn-danger mx-1" : "btn btn-sm btn-outline-danger mx-1";
                btn.addEventListener("click", () => {
                    currentPage = i;
                    showPage(currentPage);
                });
                pagination.appendChild(btn);
            }

            // Next button
            if (page < totalPages) {
                const nextBtn = document.createElement("button");
                nextBtn.textContent = "Next";
                nextBtn.className = "btn btn-sm btn-outline-danger ms-2";
                nextBtn.addEventListener("click", () => {
                    currentPage++;
                    showPage(currentPage);
                });
                pagination.appendChild(nextBtn);
            }
        }

        showPage(currentPage);
    }

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
                    ticketBody.innerHTML = `<td colspan="7" class="text-center text-muted py-3">No tickets found.</td>`;
                    return;
                }

                data.forEach(t => {
                    const ticketId = t.id;
                    const title = t.title || "";
                    const description = t.description || "";
                    const department = t.category || t.department || "";
                    const submittedName = t.submitted_name || `${t.employee_first_name || ''} ${t.employee_last_name || ''}`.trim();
                    const statusText = t.status || "Done";
                    const dateSubmitted = t.date_submitted || t.date_done || "";

                    const formattedDate = dateSubmitted
                        ? (() => {
                            const fixedDate = dateSubmitted.replace(" ", "T");
                            const parsed = new Date(fixedDate);
                            return isNaN(parsed)
                                ? dateSubmitted
                                : parsed.toLocaleDateString("en-US", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                });
                        })()
                        : "N/A";

                    let buttonsHtml = `<button class="btn btn-info btn-sm view-ticket-btn"
                        data-id="${t.id}"
                        data-title="${t.title}"
                        data-description="${t.description}"
                        data-category="${t.category}"> View </button>`;


                    if (t.photo_data) {
                        const imageUrl = statusText === "Done" ? `/done_image/${ticketId}` : `/image/${ticketId}`;
                        buttonsHtml += `<button class="btn btn-secondary btn-sm view-image-btn" data-url="${imageUrl}">View Image</button>`;
                    }

                    const transferBtnHtml = (statusText === 'Pending')
                        ? `<a class="btn btn-warning btn-sm" href="/transfer_ticket/${ticketId}">Transfer</a>`
                        : '';

                    ticketBody.innerHTML += `
                        <tr>
                            <td>${t.id}</td>
                            <td>${submittedName}</td>
                            <td>${department}</td>
                            <td>
                                <div class="d-flex gap-1">${buttonsHtml}</div>
                            </td>
                            <td>${dateSubmitted}</td>
                            <td>${statusText}</td>
                            <td>${transferBtnHtml}</td>
                        </tr>
                    `;

                    document.body.insertAdjacentHTML('beforeend', `
                        <div class="modal fade" id="viewModal${ticketId}" tabindex="-1" aria-labelledby="viewModalLabel${ticketId}" aria-hidden="true">
                            <div class="modal-dialog modal-dialog-centered">
                                <div class="modal-content">
                                    <div class="modal-header bg-dark text-white">
                                        <h5 class="modal-title" id="viewModalLabel${ticketId}">${title}</h5>
                                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                                    </div>
                                    <div class="modal-body">
                                        <p><strong>Description:</strong></p>
                                        <p>${description}</p>
                                        <p><strong>Category:</strong> ${department}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `);
                });

                setupTablePagination("ticketBody");
            })
            .catch(() => {
                ticketBody.innerHTML = `<td colspan="7" class="text-center text-danger py-3">Failed to load tickets.</td>`;
            });
    }

     document.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('view-image-btn')) {
            const modal = document.getElementById('imageModal');
            modal.querySelector('#modalImage').src = e.target.dataset.url;
            new bootstrap.Modal(modal).show();
        }

        // Optional: global ticket view delegation
        if (e.target && e.target.classList.contains('view-ticket-btn')) {
            const modal = document.getElementById('viewModalGlobal');
            modal.querySelector('.modal-title').textContent = e.target.dataset.title;
            modal.querySelector('.modal-body').innerHTML = `
                <p><strong>Description:</strong></p>
                <p>${e.target.dataset.description}</p>
                <hr>
                <p><strong>Category:</strong> ${e.target.dataset.category}</p>
            `;
            new bootstrap.Modal(modal).show();
        }
    });

    // FETCH PENDING ACCOUNTS
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
                document.querySelectorAll(".approve-btn").forEach(btn => {
                    btn.addEventListener("click", () => {
                        currentUserId = btn.dataset.id;
                        currentAction = "approve";
                        new bootstrap.Modal(document.getElementById("approveModal")).show();
                    });
                });

                document.querySelectorAll(".reject-btn").forEach(btn => {
                    btn.addEventListener("click", () => {
                        currentUserId = btn.dataset.id;
                        currentAction = "reject";
                        new bootstrap.Modal(document.getElementById("rejectModal")).show();
                    });
                });

                setupTablePagination("pendingAccountsBody");
            })
            .catch(err => {
                console.error("Error fetching accounts:", err);
                tableBody.innerHTML = `<td colspan="8" class="text-center text-danger py-3">Failed to load accounts.</td>`;
            });
    }

    function showSuccessModal(message) {
        document.getElementById("successMessage").textContent = message;
        new bootstrap.Modal(document.getElementById("successModal")).show();
    }

    function updateAccountStatus(userId, approve) {
        fetch(`/update_account_status/${userId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ approve }),
        })
        .then(res => res.json())
        .then(data => {
            showSuccessModal(approve ? "Account approved successfully!" : "Account rejected successfully!");
            setTimeout(() => {
                fetchPendingAccounts();
                fetchExistingAccounts();
            }, 800);
        })
        .catch(err => console.error("Error updating account:", err));
    }

    // Approve/Reject modal buttons at bottom
    document.getElementById("approveYes").addEventListener("click", () => {
        bootstrap.Modal.getInstance(document.getElementById("approveModal")).hide();
        updateAccountStatus(currentUserId, true);
    });

    document.getElementById("rejectYes").addEventListener("click", () => {
        bootstrap.Modal.getInstance(document.getElementById("rejectModal")).hide();
        updateAccountStatus(currentUserId, false);
    });

    //FETCH EXISTING ACCOUNTS
    function fetchExistingAccounts() {
        const tableBody = document.getElementById("existingAccountsBody");
        if (!tableBody) return;

        fetch("/existing_accounts")
            .then(res => res.json())
            .then(data => {
                tableBody.innerHTML = "";

                if (data.length === 0) {
                    tableBody.innerHTML = `
                        <tr>
                            <td colspan="8" class="text-center text-muted py-3">
                                No approved accounts found.
                            </td>
                        </tr>`;
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
                                <button class="btn btn-danger btn-sm delete-btn" data-id="${u.id}">
                                    Delete
                                </button>
                            </td>
                        </tr>`;
                });

                // Attach click handlers to delete buttons
                document.querySelectorAll(".delete-btn").forEach(btn => {
                    btn.addEventListener("click", () => {
                        currentUserId = btn.dataset.id;
                        new bootstrap.Modal(document.getElementById("deleteModal")).show();
                    });
                });

                setupTablePagination("existingAccountsBody");
            })
            .catch(err => console.error("Error fetching existing accounts:", err));
    }

    document.getElementById("deleteYes").addEventListener("click", () => {
        if (!currentUserId) return;

        bootstrap.Modal.getInstance(document.getElementById("deleteModal")).hide();

        fetch(`/delete_account/${currentUserId}`, { method: "DELETE" })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
            showSuccessModal(data.message || "Account deleted successfully!");
            fetchExistingAccounts(); // Refresh table
        } else {
            alert(data.message || "Failed to delete account.");
        }
        currentUserId = null;
            })
            .catch(err => console.error("Error deleting account:", err));
    });

    function fetchEmailLogs() {
        fetch("/get_email_logs")
            .then(res => res.json())
            .then(data => {
                const body = document.getElementById("emailLogsBody");
                body.innerHTML = "";

                if (data.length === 0) {
                    body.innerHTML = `
                        <tr>
                            <td colspan="5" class="text-center text-muted py-3">
                                No email logs found.
                            </td>
                        </tr>`;
                    return;
                }

                data.forEach(log => {
                    body.innerHTML += `
                        <tr>
                            <td>${log.id}</td>
                            <td>${log.recipient}</td>
                            <td>${log.subject}</td>
                            <td>${log.status}</td>
                            <td>${log.date_sent}</td>
                        </tr>`;
                });

                setupTablePagination("emailLogsBody");
            })
            .catch(() => {
                body.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-danger py-3">
                            Failed to load email logs.
                        </td>
                    </tr>`;
            });
    }

    item.addEventListener("click", () => {
        navItems.forEach(i => i.classList.remove("active"));
        sections.forEach(s => s.classList.remove("active"));

        item.classList.add("active");
        const targetId = item.getAttribute("data-target");
        document.getElementById(targetId).classList.add("active");

        if (targetId === "accounts") fetchExistingAccounts();
        if (targetId === "approvement") fetchPendingAccounts();
        if (targetId === "tickets") fetchFilteredTickets();
        if (targetId === "emailLogs") fetchEmailLogs();
    });

    // INITIAL LOAD
    fetchExistingAccounts();
    fetchFilteredTickets();
    fetchPendingAccounts();

    // FILTER/SORT EVENT LISTENERS
    deptFilter?.addEventListener("change", fetchFilteredTickets);
    statusFilter?.addEventListener("change", fetchFilteredTickets);
    sortOrder?.addEventListener("change", fetchFilteredTickets);
});

