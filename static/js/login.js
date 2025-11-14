document.addEventListener("DOMContentLoaded", function () {
  requestAnimationFrame(() => {
    document.body.classList.add("fade-in");
  });

  document.querySelectorAll("a").forEach(link => {
    if (link.hostname === window.location.hostname) {
      link.addEventListener("click", e => {
        e.preventDefault();
        document.body.classList.remove("fade-in");
        document.body.classList.add("fade-out");
        setTimeout(() => {
          window.location.href = link.href;
        }, 500); // to match sa CSS DURATION (login.css)
      });
    }
  });
});
