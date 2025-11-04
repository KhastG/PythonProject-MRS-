document.addEventListener("DOMContentLoaded", function() {
    requestAnimationFrame(() => {
    document.body.classList.add("fade-in");
  });

  // Add fade-out + slide transition when navigating links
  document.querySelectorAll("a").forEach(link => {
    if (link.hostname === window.location.hostname) {
      link.addEventListener("click", e => {
        e.preventDefault();
        document.body.classList.remove("fade-in");
        document.body.classList.add("fade-out");
        setTimeout(() => {
          window.location.href = link.href;
        }, 500); // matches the CSS transition duration
      });
    }
  });
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
