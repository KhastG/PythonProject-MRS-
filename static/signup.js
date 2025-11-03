document.addEventListener("DOMContentLoaded", function() {
    const form = document.getElementById("signupForm");
    form.addEventListener("submit", function(e) {
        e.preventDefault();

        const username = document.getElementById("username").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value.trim();

        if (!username || !email || !password) {
            alert("All fields are required!");
            return;
        }

        console.log("Submitting:", { username, email, password });

        form.submit();
    });
});
