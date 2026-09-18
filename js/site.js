// Shared behaviour for every page: the mobile navigation toggle and the
// News & Updates carousel (homepage).
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
  // Carousel: a scroll-snap track with prev/next arrows and page dots.
  function carousel(root) {
    var track = root.querySelector('.news-track');
    var prev = root.querySelector('.news-arrow.prev');
    var next = root.querySelector('.news-arrow.next');
    var dots = root.querySelector('.news-dots');
    var cards = track.querySelectorAll('.news-card');
    if (!track || !cards.length) return;
    function step() { return cards[0].offsetWidth + parseFloat(getComputedStyle(track).gap || 24); }
    function perView() { return Math.max(1, Math.round(track.clientWidth / step())); }
    function pages() { return Math.ceil(cards.length / perView()); }
    function page() { return Math.min(pages() - 1, Math.round(track.scrollLeft / (step() * perView()))); }
    function goTo(p) { track.scrollTo({ left: p * step() * perView(), behavior: 'smooth' }); }
    function render() {
      var n = pages(), cur = page();
      if (dots) {
        dots.innerHTML = '';
        for (var i = 0; i < n; i++) {
          var d = document.createElement('button'); d.type = 'button';
          d.setAttribute('aria-label', 'Go to page ' + (i + 1));
          if (i === cur) d.setAttribute('aria-current', 'true');
          d.addEventListener('click', goTo.bind(null, i));
          dots.appendChild(d);
        }
      }
      if (prev) prev.disabled = cur === 0;
      if (next) next.disabled = cur >= n - 1;
    }
    if (prev) prev.addEventListener('click', function () { goTo(Math.max(0, page() - 1)); });
    if (next) next.addEventListener('click', function () { goTo(Math.min(pages() - 1, page() + 1)); });
    var raf;
    track.addEventListener('scroll', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }, { passive: true });
    window.addEventListener('resize', render);
    render();
  }
  function boot() { init(); document.querySelectorAll('[data-carousel]').forEach(carousel); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
