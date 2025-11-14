document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('secretAdminForm');
    const messageDiv = document.getElementById('message');

    const secretModal = document.getElementById('secretKeyModal');
    const secretClose = secretModal.querySelector('.close');
    const secretSubmit = document.getElementById('modal_submit_btn');

    const errorModal = document.getElementById('errorModal');
    const errorClose = errorModal.querySelector('.close');
    const errorMessage = document.getElementById('errorMessage');

    const otpModal = document.getElementById('otpModal');
    const otpClose = otpModal.querySelector('.close');
    const otpSubmit = document.getElementById('otp_submit_btn');

    // Page load animation
    window.addEventListener('load', () => document.body.classList.add('loaded'));

    // Open secret key modal on form submit
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        secretModal.style.display = 'block';
    });

    // Close modals
    secretClose.onclick = () => secretModal.style.display = 'none';
    errorClose.onclick = () => errorModal.style.display = 'none';
    otpClose.onclick = () => otpModal.style.display = 'none';

    window.onclick = (event) => {
        if (event.target === secretModal) secretModal.style.display = 'none';
        if (event.target === errorModal) errorModal.style.display = 'none';
        if (event.target === otpModal) otpModal.style.display = 'none';
    }

    // Secret key modal submit
    secretSubmit.addEventListener('click', async () => {
        const secretKeyValue = document.getElementById('modal_secret_key').value;
        const password = document.getElementById('password').value.trim();
        const confirmPassword = document.getElementById('confirm_password').value.trim();

        const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])[A-Za-z\d]{8,}$/;

        if (!passwordPattern.test(password)) {
            secretModal.style.display = 'none';
            errorMessage.textContent = "Password must have at least 1 uppercase, 1 lowercase, and 8 characters (no special symbols).";
            errorModal.style.display = 'block';
            return;
        }

        if (password !== confirmPassword) {
            secretModal.style.display = 'none';
            errorMessage.textContent = "Passwords do not match!";
            errorModal.style.display = 'block';
            return;
        }

        const data = {
            secret_key: secretKeyValue,
            first_name: document.getElementById('first_name').value.trim(),
            last_name: document.getElementById('last_name').value.trim(),
            username: document.getElementById('username').value.trim(),
            email: document.getElementById('email').value.trim(),
            password: password
        };

        try {
            const response = await fetch('/send_admin_otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                secretModal.style.display = 'none';
                otpModal.style.display = 'block';  // Show OTP modal
            } else {
                secretModal.style.display = 'none';
                errorMessage.textContent = result.message;
                errorModal.style.display = 'block';
            }
        } catch (error) {
            console.error('Error:', error);
            secretModal.style.display = 'none';
            errorMessage.textContent = 'An unexpected error occurred. Please try again.';
            errorModal.style.display = 'block';
        }
    });

    // OTP verification
    otpSubmit.addEventListener('click', async () => {
        const otpValue = document.getElementById('otp_input').value.trim();
        const email = document.getElementById('email').value.trim();

        try {
            const response = await fetch('/verify_admin_otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp: otpValue })
            });

            const result = await response.json();

            if (result.success) {
                otpModal.style.display = 'none';
                messageDiv.innerHTML = `<div class="alert alert-success">${result.message} Redirecting to login...</div>`;
                form.reset();

                // Redirect after 2 seconds
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                errorMessage.textContent = result.message;
                errorModal.style.display = 'block';
            }
        } catch (error) {
            console.error('Error:', error);
            errorMessage.textContent = 'An unexpected error occurred. Please try again.';
            errorModal.style.display = 'block';
        }
    });
});
