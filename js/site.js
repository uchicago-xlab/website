// Shared behaviour for every page: the mobile navigation toggle.
// The MENU button (.nav-toggle) is only visible at tablet/phone widths — see css/site.css.
(function () {
  function init() {
    var nav = document.querySelector('nav');
    var btn = nav && nav.querySelector('.nav-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('nav-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // Close the menu again when a link inside it is chosen.
    nav.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.nav-links a')) {
        nav.classList.remove('nav-open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
