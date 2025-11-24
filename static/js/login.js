document.addEventListener("DOMContentLoaded", function () {
    // GLOBAL VARIABLES
    const modal = document.getElementById("errorModal"); // Error Modal
    const errorMessage = document.getElementById("errorMessage");
    const closeBtn = document.getElementById("closeModalBtn"); // Error Modal Close Button

    // Modals for Reset Flow
    const forgotModal = document.getElementById("forgotPasswordModal");
    const enterOtpModal = document.getElementById("enterOtpModal");
    const resetModal = document.getElementById("resetPasswordModal");
    const successModal = document.getElementById("successModal");

    // Buttons & Inputs
    const forgotLink = document.getElementById("forgotPasswordLink");
    const sendOtpBtn = document.getElementById("sendOtpBtn");
    const verifyOtpBtn = document.getElementById("verifyOtpBtn");
    const resetPasswordBtn = document.getElementById("resetPasswordBtn");
    const closeSuccessBtn = document.getElementById("closeSuccessBtn");
    const closeButtons = document.querySelectorAll(".closeModal"); // Cancel buttons

    // Main Login Form
    const form = document.querySelector("form");
    const loginBtn = form ? form.querySelector("button[type='submit']") : null;
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const togglePasswordBtn = document.getElementById("togglePassword");

    // State Variables
    // This will hold the OTP entered by the user in Step 2, passed to the final reset API call.
    let verifiedOtp = null;
    const safePattern = /^[A-Za-z0-9._]+$/;
    // Requires: Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, no symbols.
    const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;

    const MAX_ATTEMPTS = 5;
    const LOCKOUT_TIME = 30; // seconds
    let attempts = parseInt(localStorage.getItem("login_attempts")) || 0;
    let lockoutEnd = parseInt(localStorage.getItem("lockout_end")) || 0;

    // UTILITY FUNCTIONS
    function showError(msg) {
        if (errorMessage && modal) {
            errorMessage.textContent = msg;
            modal.classList.add("show", "shake");
            setTimeout(() => modal.classList.remove("shake"), 500);
            setTimeout(() => modal.classList.remove("show"), 3000);
        } else {
            // Fallback for missing error modal (though one is defined above)
            console.error(msg);
        }
    }

    function closeAllResetModals() {
        if (forgotModal) forgotModal.classList.remove("show");
        if (enterOtpModal) enterOtpModal.classList.remove("show");
        if (resetModal) resetModal.classList.remove("show");
        if (successModal) successModal.classList.remove("show");
    }

    // Close buttons logic (Cancel)
    closeButtons.forEach(btn => {
        btn.addEventListener("click", closeAllResetModals);
    });

    // Close Error Modal logic
    if (closeBtn) {
        closeBtn.addEventListener("click", () => modal.classList.remove("show"));
    }

    // Close Success Modal logic
    if (closeSuccessBtn) {
        closeSuccessBtn.addEventListener("click", () => {
            window.location.reload();
        });
    }

    // PAGE ANIMATIONS
    // ANIMATION
    const mainContentWrapper = document.getElementById("main-content-wrapper");
    if (mainContentWrapper) {
        requestAnimationFrame(() => mainContentWrapper.classList.add("fade-in"));
    }
    // Simple page transition handler
    document.querySelectorAll("a").forEach(link => {
        if (link.hostname === window.location.hostname && link.getAttribute('href') !== "#" && link.id !== "forgotPasswordLink") {
            link.addEventListener("click", e => {
                e.preventDefault();
                if (mainContentWrapper) {
                    mainContentWrapper.classList.remove("fade-in");
                    mainContentWrapper.classList.add("fade-out");
                }
                setTimeout(() => window.location.href = link.href, 500);
            });
        }
    });

    // PASSWORD TOGGLE
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener("click", function () {
            const type = passwordInput.type === "password" ? "text" : "password";
            passwordInput.type = type;
            const icon = this.querySelector('i');
            icon.classList.toggle('fa-eye-slash');
            icon.classList.toggle('fa-eye');
            this.classList.toggle('active');
        });
    }

    // RESET PASSWORD FLOW
    if (forgotLink && forgotModal) {
        forgotLink.addEventListener("click", (e) => {
            e.preventDefault();
            forgotModal.classList.add("show");
        });
    }

    // 1: Send OTP
    if (sendOtpBtn) {
        sendOtpBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById("fp_email");
            const email = emailInput.value.trim();

            if (!email) {
                showError("Please enter your email.");
                return;
            }

            sendOtpBtn.disabled = true;
            sendOtpBtn.textContent = "Sending...";

            try {
                const res = await fetch("/forgot_password/send_otp", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();

                if (data.status === "success") {
                    forgotModal.classList.remove("show");
                    enterOtpModal.classList.add("show");
                } else {
                    showError(data.message);
                }
            } catch (err) {
                showError("Server error. Please try again.");
            } finally {
                sendOtpBtn.disabled = false;
                sendOtpBtn.textContent = "Send OTP";
            }
        });
    }

    // 2: User OTP
    if (verifyOtpBtn) {
        verifyOtpBtn.addEventListener("click", (e) => {
            e.preventDefault();
            const otpInput = document.getElementById("otp_input");
            const otp = otpInput.value.trim();

            if (otp.length !== 6 || isNaN(otp)) {
                showError("Please enter a valid 6-digit number for the OTP.");
                return;
            }

            verifiedOtp = otp;
            enterOtpModal.classList.remove("show");
            resetModal.classList.add("show");
        });
    }

    // 3: Reset Password
    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            const newPass = document.getElementById("rp_password").value.trim();
            const confirmPass = document.getElementById("rp_confirm").value.trim();

            if (!newPass || !confirmPass) {
                showError("Please fill in all fields.");
                return;
            }
            if (newPass !== confirmPass) {
                showError("Passwords do not match.");
                return;
            }

             // --- NEW PASSWORD VALIDATION ---
            if (!strongPasswordPattern.test(newPass)) {
                showError("Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, and one number.");
                return;
            }

            if (!verifiedOtp) {
                showError("Session expired. Please start over.");
                closeAllResetModals();
                return;
            }

            resetPasswordBtn.disabled = true;
            resetPasswordBtn.textContent = "Resetting...";

            try {
                const res = await fetch("/forgot_password/reset", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ otp: verifiedOtp, newPass: newPass })
                });
                const data = await res.json();

                if (data.status === "success") {
                    // This is where Python verifies the OTP.
                    resetModal.classList.remove("show");
                    if (successModal) {
                        successModal.classList.add("show");
                    } else {
                        // Fallback
                        alert("Password Reset Successful!");
                        window.location.reload();
                    }
                } else {
                    showError(data.message); // Will show "Invalid OTP." if verification fails
                }
            } catch (err) {
                showError("Server error. Try again.");
            } finally {
                resetPasswordBtn.disabled = false;
                resetPasswordBtn.textContent = "Reset Password";
            }
        });
    }

    // LOGIN VALIDATION & LOCKOUT
    // lockout and form validation logic ...
    function showMaxAttemptsModal() {
        errorMessage.textContent = "You have reached the maximum 5 attempts.";
        modal.querySelector("h3").textContent = "Maximum Attempts";
        modal.classList.add("show");
        disableLoginButton();
    }

    function startLockout() {
        const now = Date.now();
        lockoutEnd = now + LOCKOUT_TIME * 1000;
        localStorage.setItem("lockout_end", lockoutEnd);
        disableLoginButton();
        runCountdown();
    }

    function disableLoginButton() {
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.style.backgroundColor = "gray";
            loginBtn.style.cursor = "not-allowed";
        }
    }

    function enableLoginButton() {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.style.backgroundColor = "";
            loginBtn.style.cursor = "pointer";
            loginBtn.textContent = "Login";
        }
        if (modal) modal.querySelector("h3").textContent = "Invalid Input";
    }

    function runCountdown() {
        const timer = setInterval(() => {
            const remaining = Math.floor((lockoutEnd - Date.now()) / 1000);
            if (remaining <= 0) {
                clearInterval(timer);
                enableLoginButton();
                attempts = 0;
                localStorage.setItem("login_attempts", "0");
                localStorage.removeItem("lockout_end");
                return;
            }
            if (loginBtn) loginBtn.textContent = `Retry in ${remaining}s`;
        }, 1000);
    }

    // Check lockout on load
    if (Date.now() < lockoutEnd) {
        disableLoginButton();
        runCountdown();
    }

    function incrementAttempts(reason) {
        attempts++;
        localStorage.setItem("login_attempts", attempts);
        if (attempts >= MAX_ATTEMPTS) {
            showMaxAttemptsModal();
            startLockout();
        } else {
            showError(`${reason} (Attempt ${attempts}/${MAX_ATTEMPTS})`);
        }
    }

    // Display Backend Error
    const backendError = document.getElementById("loginError")?.value;
    if (backendError && backendError.trim() !== "") {
        incrementAttempts(backendError);
    }

    // Form Submit Listener
    if (form) {
        form.addEventListener("submit", function (e) {
            if (loginBtn && loginBtn.disabled) {
                e.preventDefault();
                return;
            }
            const uVal = usernameInput.value.trim();
            const pVal = passwordInput.value.trim();

            if (!uVal || !pVal) {
                e.preventDefault();
                incrementAttempts("Both username and password are required.");
                return;
            }
            if (!safePattern.test(uVal)) {
                e.preventDefault();
                incrementAttempts("Username contains invalid symbols.");
                return;
            }
            if (/['"<>;`]/.test(pVal)) {
                e.preventDefault();
                incrementAttempts("Password contains illegal characters.");
                return;
            }
            // If the form submits successfully, we reset attempts.
            if (uVal && pVal) {
                attempts = 0;
                localStorage.setItem("login_attempts", "0");
            }
        });
    }

});