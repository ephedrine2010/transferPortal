/**
 * Links Menu — a self-contained dropdown of tool links.
 *
 * Portable: this file injects its own CSS and needs no other dependency.
 * To reuse elsewhere, copy this file, include it with
 *   <script src="js/links-menu.js"></script>
 * and (optionally) edit the LINKS array below.
 *
 * By default the dropdown is inserted right after the first <h1> on the page.
 * To target a different element, set data-links-anchor="#your-selector"
 * on the <script> tag, e.g.
 *   <script src="js/links-menu.js" data-links-anchor=".app-header h1"></script>
 */
(function () {
    'use strict';

    // Capture our own <script> now — document.currentScript is null later,
    // once init() runs inside the DOMContentLoaded callback.
    var THIS_SCRIPT = document.currentScript;

    // ---- Links (mirrors links.csv: tool_name, tool_link) ----
    var LINKS = [
        { name: 'Transfer register', url: 'https://ephedrine2010.github.io/transferPortal/' },
        { name: 'Cash followup sheet', url: 'https://ephedrine2010.github.io/cashFollowup/' },
        { name: 'Price print', url: 'https://ephedrine2010.github.io/printPriceTag/' }
    ];

    // ---- Styles (scoped to .links-menu) ----
    var CSS = [
        '.links-menu-group{display:inline-flex;align-items:center;}',
        '.links-menu{position:relative;display:inline-block;margin-left:0.6rem;vertical-align:middle;font-family:inherit;}',
        '.links-menu__btn{display:inline-flex;align-items:center;gap:0.35rem;padding:0.3rem 0.6rem;',
        'border:1px solid #d0d0d8;border-radius:8px;background:#fff;color:#16213e;font-size:0.85rem;',
        'font-weight:600;cursor:pointer;line-height:1;}',
        '.links-menu__btn:hover{background:#f2f2f7;}',
        '.links-menu__caret{font-size:0.6rem;transition:transform 0.15s ease;}',
        '.links-menu.open .links-menu__caret{transform:rotate(180deg);}',
        '.links-menu__list{position:absolute;top:calc(100% + 6px);left:0;min-width:200px;margin:0;padding:0.25rem;',
        'list-style:none;background:#fff;border:1px solid #e0e0e0;border-radius:10px;',
        'box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:1000;display:none;}',
        '.links-menu.open .links-menu__list{display:block;}',
        '.links-menu__list a{display:block;padding:0.55rem 0.7rem;border-radius:7px;color:#16213e;',
        'text-decoration:none;font-size:0.9rem;font-weight:500;white-space:nowrap;}',
        '.links-menu__list a:hover{background:#eef1ff;}'
    ].join('');

    function injectStyles() {
        if (document.getElementById('links-menu-styles')) return;
        var style = document.createElement('style');
        style.id = 'links-menu-styles';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    function buildMenu() {
        var wrap = document.createElement('span');
        wrap.className = 'links-menu';

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'links-menu__btn';
        btn.setAttribute('aria-haspopup', 'true');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = 'Links <span class="links-menu__caret">▼</span>';

        var list = document.createElement('ul');
        list.className = 'links-menu__list';
        for (var i = 0; i < LINKS.length; i++) {
            var li = document.createElement('li');
            var a = document.createElement('a');
            a.href = LINKS[i].url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = LINKS[i].name;
            li.appendChild(a);
            list.appendChild(li);
        }

        function close() {
            wrap.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
        }
        function toggle(e) {
            e.stopPropagation();
            var willOpen = !wrap.classList.contains('open');
            wrap.classList.toggle('open', willOpen);
            btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        }

        btn.addEventListener('click', toggle);
        list.addEventListener('click', function (e) { e.stopPropagation(); });
        document.addEventListener('click', close);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') close();
        });

        wrap.appendChild(btn);
        wrap.appendChild(list);
        return wrap;
    }

    function getAnchor() {
        var selector = THIS_SCRIPT && THIS_SCRIPT.getAttribute('data-links-anchor');
        if (selector) return document.querySelector(selector);
        return document.querySelector('h1');
    }

    function init() {
        var anchor = getAnchor();
        if (!anchor) return;
        injectStyles();
        var menu = buildMenu();
        // Group the title and dropdown so they stay together even when the
        // parent uses a spread-out layout (e.g. flex space-between).
        var group = document.createElement('span');
        group.className = 'links-menu-group';
        anchor.parentNode.insertBefore(group, anchor);
        group.appendChild(anchor);
        group.appendChild(menu);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
