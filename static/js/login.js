document.addEventListener("DOMContentLoaded", function () {
    const modal = document.getElementById("errorModal");
    const errorMessage = document.getElementById("errorMessage");
    const closeBtn = document.getElementById("closeModalBtn");

    const form = document.querySelector("form");
    const loginBtn = form.querySelector("button[type='submit']");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");

    // Allowed username characters
    const safePattern = /^[A-Za-z0-9._]+$/;

    // MAX ATTEMPTS + LOCKOUT TIME
    const MAX_ATTEMPTS = 5;
    const LOCKOUT_TIME = 30; // seconds

    // Retrieve attempt count & lockout timer
    let attempts = parseInt(localStorage.getItem("login_attempts")) || 0;
    let lockoutEnd = parseInt(localStorage.getItem("lockout_end")) || 0;

    // MODAL UTILS
    function showError(msg) {
        errorMessage.textContent = msg;
        modal.classList.add("show", "shake");

        setTimeout(() => modal.classList.remove("shake"), 500);
        setTimeout(() => modal.classList.remove("show"), 3000);
    }

    function showMaxAttemptsModal() {
        errorMessage.textContent = "You have reached the maximum 5 attempts.";
        modal.querySelector("h3").textContent = "Maximum Attempts";
        modal.classList.add("show");
        disableLoginButton();
    }

    // LOCKOUT HANDLER
    function startLockout() {
        const now = Date.now();
        lockoutEnd = now + LOCKOUT_TIME * 1000;
        localStorage.setItem("lockout_end", lockoutEnd);

        disableLoginButton();
        runCountdown();
    }

    function disableLoginButton() {
        loginBtn.disabled = true;
        loginBtn.style.backgroundColor = "gray";
        loginBtn.style.cursor = "not-allowed";
    }

    function enableLoginButton() {
        loginBtn.disabled = false;
        loginBtn.style.backgroundColor = "";
        loginBtn.style.cursor = "pointer";
        loginBtn.textContent = "Login";
        modal.querySelector("h3").textContent = "Invalid Input";
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

            loginBtn.textContent = `Retry in ${remaining}s`;
        }, 1000);
    }

    // Check if lockout is active on load
    if (Date.now() < lockoutEnd) {
        disableLoginButton();
        runCountdown();
    }

    // ATTEMPT TRACKER
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

    const togglePasswordBtn = document.getElementById("togglePassword");

    if (togglePasswordBtn) {
        togglePasswordBtn.addEventListener("click", function () {
            const type = passwordInput.type === "password" ? "text" : "password";
            passwordInput.type = type;

            const icon = this.querySelector('i');
            icon.classList.toggle('fa-eye-slash');
            icon.classList.toggle('fa-eye');

            this.classList.toggle('active');
        });
    }

    // DISPLAY BACKEND ERROR
    const backendError = document.getElementById("loginError")?.value;
    if (backendError && backendError.trim() !== "") {
        incrementAttempts(backendError);
    }

    // Manual close
    if (closeBtn) {
        closeBtn.addEventListener("click", () => modal.classList.remove("show"));
    }

    // FORM VALIDATION
    form.addEventListener("submit", function (e) {
        if (loginBtn.disabled) {
            e.preventDefault();
            return;
        }
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        // RESET ATTEMPTS if inputs are valid
        if (username && password && safePattern.test(username) && !/['"<>;`]/.test(password)) {
            attempts = 0; // reset counter
            localStorage.setItem("login_attempts", "0");
        }

        if (!username || !password) {
            e.preventDefault();
            incrementAttempts("Both username and password are required.");
            return;
        }

        if (!safePattern.test(username)) {
            e.preventDefault();
            incrementAttempts("Username contains invalid symbols.");
            return;
        }

        const bannedChars = /['"<>;`]/;
        if (bannedChars.test(password)) {
            e.preventDefault();
            incrementAttempts("Password contains illegal characters.");
            return;
        }
    });

    const fpLink = document.getElementById("forgotPasswordLink");
    const forgotModal = document.getElementById("forgotPasswordModal");
    const resetModal = document.getElementById("resetPasswordModal");

    fpLink.onclick = () => {
        forgotModal.classList.add("show");
    };

    document.querySelectorAll(".closeModal").forEach(btn => {
        btn.onclick = () => {
            forgotModal.classList.remove("show");
            resetModal.classList.remove("show");
        };
    });

    document.getElementById("sendOtpBtn").onclick = async () => {
        const email = document.getElementById("fp_email").value.trim();
        if (!email) {
            showError("Please enter your email.");
            return;
        }

        try {
            const res = await fetch("/forgot_password/send_otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });

            const data = await res.json();

            if (data.status === "error") {
                showError(data.message);
            } else {
                // move to next modal
                document.getElementById("rp_username").value = data.username;
                forgotModal.classList.remove("show");
                resetModal.classList.add("show");
            }
        } catch (err) {
            showError("Server error. Try again later.");
        }
    };

    document.getElementById("resetPasswordBtn").onclick = async () => {
        const otp = prompt("Enter the OTP sent to your email:");
        const newPass = document.getElementById("rp_password").value.trim();
        const confirm = document.getElementById("rp_confirm").value.trim();

        if (!otp || !newPass || !confirm) {
            showError("Please complete all fields.");
            return;
        }

        if (newPass !== confirm) {
            showError("Passwords do not match.");
            return;
        }

        try {
            const res = await fetch("/forgot_password/reset", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ otp, newPass })
            });

            const data = await res.json();

            if (data.status === "success") {
                alert("Password reset successful. You can now login.");
                location.reload();
            } else {
                showError(data.message);
            }
        } catch (error) {
            showError("Server error.");
        }
    };

    // PAGE ANIMATIONS
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
