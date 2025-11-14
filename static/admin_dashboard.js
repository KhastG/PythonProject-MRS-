document.addEventListener("DOMContentLoaded", () => {
    const deptFilter = document.getElementById("deptFilter");
    const statusFilter = document.getElementById("statusFilter");
    const ticketBody = document.getElementById("ticketBody");
    const sortOrder = document.getElementById("sortOrder");
    //NAVIGATION BAR
    const navItems = document.querySelectorAll(".nav-item");
    const sections = document.querySelectorAll(".nav-section");
    //BUTTON MODALS FOR THE ADMIN PENDING ACCOUNT APPROVALS
    const approveModal = document.getElementById("approveModal");
    const rejectModal = document.getElementById("rejectModal");
    const successModal = document.getElementById("successModal");
    const successMessage = document.getElementById("successMessage");

    let currentUserId = null;
    let currentAction = null;
    let selectedTicketId = null;

    // NAVIGATION SWITCH HANDLER
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            navItems.forEach(i => i.classList.remove("active"));
            sections.forEach(s => s.classList.remove("active"));

            item.classList.add("active");
            const targetId = item.getAttribute("data-target");
            document.getElementById(targetId).classList.add("active");

            // Auto-refresh content per tab
            if (targetId === "accounts") fetchExistingAccounts();
            if (targetId === "approvement") fetchPendingAccounts();
            if (targetId === "tickets") fetchFilteredTickets();
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
                    ticketBody.innerHTML = `<td colspan="7" class="text-center text-muted py-3">No tickets found.</td>`;
                    return;
                }

                data.forEach(t => {
                const ticketId = t.id; // done_ticket.id or ticket_table.id
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

                    // Build buttons conditionally
                    let buttonsHtml = `<button class="btn btn-info btn-sm view-ticket-btn" data-id="${t.id}" data-description="${t.description}"
                                            data-category="${t.category}" data-bs-toggle="modal" data-bs-target="#viewModal${t.id}"> View </button>`;
                    if (t.photo_data) {
                        const imageUrl = statusText === "Done" ? `/done_image/${ticketId}` : `/image/${ticketId}`;
                        buttonsHtml += `<button class="btn btn-secondary btn-sm view-image-btn" data-url="${imageUrl}">View Image</button>`;
                    }

                    const transferBtnHtml = (statusText === 'Pending')
                    ? `<a class="btn btn-warning btn-sm"
                          href="/transfer_ticket/${ticketId}">
                          Transfer
                       </a>`
                    : '';

                    ticketBody.innerHTML += `
                        <tr>
                            <td>${t.id}</td>
                            <td>${t.submitted_name}</td>
                            <td>${department}</td>
                            <td>
                                <div class="d-flex gap-1">
                                    ${buttonsHtml}
                                </div>
                            </td>
                            <td>${dateSubmitted}</td>
                            <td>${t.status}</td>
                            <td>${transferBtnHtml}</td>
                        </tr>
                    `;

                    // Append modal to body
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
        })
        .catch(() => {
            ticketBody.innerHTML = `<td colspan="7" class="text-center text-danger py-3">Failed to load tickets.</td>`;
        });
    }

    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("view-image-btn")) {
            const ticketId = e.target.dataset.ticketId;
            const url = `/image/${ticketId}`;
            window.open(url, "_blank");
        }
    });

    document.getElementById('imageModal').addEventListener('hidden.bs.modal', () => {
      document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.remove());
    });

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

                let deleteUserId = null; // Track which user to delete
                const deleteModal = new bootstrap.Modal(document.getElementById("deleteModal"));

                document.addEventListener("click", (e) => {
                    if (e.target.classList.contains("delete-btn")) {
                        deleteUserId = e.target.getAttribute("data-id");
                        deleteModal.show();
                    }
                });

                // Confirm delete
                document.getElementById("deleteYes").addEventListener("click", () => {
                    if (!deleteUserId) return;
                    fetch(`/delete_account/${deleteUserId}`, { method: "DELETE" })
                        .then(res => res.json())
                        .then(result => {
                            deleteModal.hide();
                            deleteUserId = null;
                            showSuccessModal(result.message || "Account deleted successfully!");
                            fetchExistingAccounts(); // Refresh table
                        })
                        .catch(() => {
                            deleteModal.hide();
                            deleteUserId = null;
                            alert("Error deleting account.");
                        });
                });
            })
            .catch(err => {
                console.error("Error fetching existing accounts:", err);
                tableBody.innerHTML = `<td colspan="8" class="text-center text-danger py-3">Failed to load accounts.</td>`;
            });
    }

   document.addEventListener("click", (e) => {
      if (e.target.classList.contains("approve-btn")) {
        currentUserId = e.target.getAttribute("data-id");
        currentAction = "approve";
        const approveModalInstance = new bootstrap.Modal(document.getElementById("approveModal"));
        approveModalInstance.show();
      }
      else if (e.target.classList.contains("reject-btn")) {
        currentUserId = e.target.getAttribute("data-id");
        currentAction = "reject";
        const rejectModalInstance = new bootstrap.Modal(document.getElementById("rejectModal"));
        rejectModalInstance.show();
      }
    });

    // For showing success modal:
    function showSuccessModal(message) {
        document.getElementById("successMessage").textContent = message;
        const successModalInstance = new bootstrap.Modal(document.getElementById("successModal"));
        successModalInstance.show();
    }

    // APPROVE MODAL BUTTONS
    document.getElementById("approveYes").addEventListener("click", () => {
        const approveModalInstance = bootstrap.Modal.getInstance(document.getElementById("approveModal"));
        approveModalInstance.hide();
        updateAccountStatus(currentUserId, true);
    });

    // REJECT MODAL BUTTONS
    document.getElementById("rejectYes").addEventListener("click", () => {
        const rejectModalInstance = bootstrap.Modal.getInstance(document.getElementById("rejectModal"));
        rejectModalInstance.hide();
        updateAccountStatus(currentUserId, false);
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
            setTimeout(() => {
                fetchPendingAccounts();
                fetchExistingAccounts();
            }, 800);
        })
        .catch((err) => console.error("Error updating account:", err));
    }

    // INITIAL LOAD
    fetchExistingAccounts();
    fetchFilteredTickets();
    fetchPendingAccounts();

    // FILTER/SORT EVENT LISTENERS
    deptFilter?.addEventListener("change", fetchFilteredTickets);
    statusFilter?.addEventListener("change", fetchFilteredTickets);
    sortOrder?.addEventListener("change", fetchFilteredTickets);

});
