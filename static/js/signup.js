document.addEventListener("DOMContentLoaded", function() {

    function showToast(message, type = "info") {
        const toast = document.getElementById("toast");
        if (!toast) return;

        toast.textContent = message;
        toast.style.backgroundColor = type === "error" ? "#f28b82" : "#4CAF50";
        toast.className = "show";
        setTimeout(() => {
          toast.className = toast.className.replace("show", "");
        }, 3000);
    }

    const form = document.getElementById("signupForm");
    const roleSelect = document.getElementById("role");
    const maintenanceDiv = document.getElementById("maintenanceTypeDiv");
    const maintenanceSelect = document.getElementById("maintenanceType");
    const passwordInput = document.getElementById("password");

    // Sanitize regex: letters, numbers, spaces only
    const safeText = /^[A-Za-z0-9\s]+$/;
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])[A-Za-z\d]{8,}$/;

    if (roleSelect) {
        const toggleMaintenance = () => {
            const isMaintenance = roleSelect.value === "maintenance";
            maintenanceDiv.style.display = isMaintenance ? "block" : "none";
            maintenanceSelect.disabled = !isMaintenance;
            if (!isMaintenance) maintenanceSelect.value = "";
        };
        toggleMaintenance();
        roleSelect.addEventListener("change", toggleMaintenance);
    }

    if (form) {
        form.addEventListener("submit", function(e) {
            e.preventDefault();

            // Get all fields
            const firstName = document.getElementById("first_name").value.trim();
            const lastName = document.getElementById("last_name").value.trim();
            const username = document.getElementById("username").value.trim();
            const email = document.getElementById("email").value.trim();
            const role = roleSelect.value.trim();
            const maintenanceType = maintenanceSelect.value.trim();
            const password = document.getElementById("password").value.trim();
            const confirmPassword = document.getElementById("confirm_password").value.trim();

            // Check required fields
            if (!firstName || !lastName || !username || !email || !password || !confirmPassword || !role) {
                showToast("All fields are required!", "error");
                return;
            }

            // If Maintenance is selected, type is required
            if (role === "maintenance" && !maintenanceType) {
                showToast("Please select a maintenance department.", "error");
                return;
            }

            // Sanitize text input (prevent SQL/XSS injections)
            if (!safeText.test(firstName) || !safeText.test(lastName) || !safeText.test(username)) {
                showToast("Names and username cannot contain symbols or special characters.", "error");
                return;
            }

            // Password rule check
            if (!passwordPattern.test(password)) {
                showToast("Password must contain at least 1 uppercase, 1 lowercase, no special symbols, and be 8+ chars.", "error");
                return;
            }

            // Confirm password check
            if (password !== confirmPassword) {
                showToast("Passwords do not match!", "error");
                return;
            }

            // Successful → disable button and submit
            form.querySelector("button[type='submit']").disabled = true;
            form.submit();
        });
    }

    // Smooth page fade-in animation
    requestAnimationFrame(() => document.body.classList.add("fade-in"));

    // Smooth fade-out transition for internal links
    const mainContentWrapper = document.getElementById("main-content-wrapper");
    requestAnimationFrame(() => mainContentWrapper.classList.add("fade-in"));
    document.querySelectorAll("a").forEach(link => {
        if (link.hostname === window.location.hostname) {
            link.addEventListener("click", e => {
                e.preventDefault();
                document.body.classList.remove("fade-in");
                document.body.classList.add("fade-out");
                setTimeout(() => window.location.href = link.href, 500);
            });
        }
    });
});

