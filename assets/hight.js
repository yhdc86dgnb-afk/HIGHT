/*
 * Hight 2.0 — comportamiento del tema.
 * Sin dependencias. Todo funciona sin JavaScript (formularios y enlaces normales); esto agrega el
 * carrito lateral, el selector de variantes, la galería con zoom, la búsqueda predictiva y la capa
 * interactiva: collage arrastrable, cintas que aceleran con el scroll, filas que se arrastran,
 * cambio de color de la tienda, puntos de anatomía, foto que sigue al cursor y texto que se enciende.
 * Respeta "reducir movimiento" del sistema y el ajuste Movimiento del tema.
 */
(function () {
  'use strict';

  var configEl = document.getElementById('HightConfig');
  var config = configEl ? JSON.parse(configEl.textContent) : {};
  var routes = config.routes || {};
  var strings = config.strings || {};

  /* ---------- Utilidades ---------- */

  function debounce(fn, wait) {
    var timer;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(ctx, args);
      }, wait);
    };
  }

  function parseHTML(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  function sectionIdOf(el) {
    var wrapper = el && el.closest('.shopify-section');
    return wrapper ? wrapper.id.replace('shopify-section-', '') : null;
  }

  function headerSectionId() {
    var header = document.querySelector('.hi-header-section');
    return header ? header.id.replace('shopify-section-', '') : null;
  }

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function motionOK() {
    return config.motion !== false && !reducedMotion();
  }

  function finePointer() {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function withTransition(update) {
    if (document.startViewTransition && motionOK()) {
      document.startViewTransition(update);
    } else {
      update();
    }
  }

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      if (value === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, value);
    } catch (e) {
      /* almacenamiento bloqueado: se ignora */
    }
  }

  function sessionGet(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function sessionSet(key, value) {
    try {
      if (value === null) window.sessionStorage.removeItem(key);
      else window.sessionStorage.setItem(key, value);
    } catch (e) {
      /* almacenamiento bloqueado: se ignora */
    }
  }

  function toast(text, actionLabel, onAction) {
    var region = document.querySelector('[data-toast-region]');
    if (!region || !text) return;
    var node = document.createElement('div');
    node.className = 'hi-toast';
    var span = document.createElement('span');
    span.className = 'hi-toast-text';
    span.textContent = text;
    node.appendChild(span);
    if (actionLabel && onAction) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'hi-toast-action';
      button.textContent = actionLabel;
      button.addEventListener('click', function () {
        node.remove();
        onAction();
      });
      node.appendChild(button);
    }
    region.appendChild(node);
    setTimeout(function () {
      node.remove();
    }, 4000);
  }

  // Monto en el formato de la tienda, sin decimales cuando es entero (como money_without_trailing_zeros).
  function formatMoney(cents) {
    var value = (Number(cents) || 0) / 100;
    function group(decimals, thousands, decimal) {
      var parts = value.toFixed(decimals).split('.');
      var whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      return parts[1] && !/^0+$/.test(parts[1]) ? whole + decimal + parts[1] : whole;
    }
    return (config.moneyFormat || '${{amount}}')
      .replace(/\{\{\s*(\w+)\s*\}\}/, function (match, key) {
        if (key === 'amount_no_decimals') return group(0, ',', '.');
        if (key === 'amount_with_comma_separator') return group(2, '.', ',');
        if (key === 'amount_no_decimals_with_comma_separator') return group(0, '.', ',');
        if (key === 'amount_with_apostrophe_separator') return group(2, "'", '.');
        if (key === 'amount_no_decimals_with_space_separator') return group(0, ' ', ',');
        if (key === 'amount_with_space_separator') return group(2, ' ', ',');
        if (key === 'amount_with_period_and_space_separator') return group(2, ' ', '.');
        return group(2, ',', '.');
      })
      .replace(/<[^>]*>/g, '');
  }

  /* ---------- Velocidad del scroll (para las cintas) ---------- */

  var ScrollVelocity = (function () {
    var state = { value: 0 };
    var lastY = window.scrollY;
    var lastT = performance.now();
    var raf = null;

    function decay() {
      state.value *= 0.92;
      if (state.value < 0.01) {
        state.value = 0;
        raf = null;
        return;
      }
      raf = requestAnimationFrame(decay);
    }

    window.addEventListener(
      'scroll',
      function () {
        var now = performance.now();
        var dy = Math.abs(window.scrollY - lastY);
        var dt = Math.max(16, now - lastT);
        state.value = Math.max(state.value, Math.min(3, dy / dt));
        lastY = window.scrollY;
        lastT = now;
        if (!raf) raf = requestAnimationFrame(decay);
      },
      { passive: true }
    );

    return state;
  })();

  /* ---------- Diálogos (drawers, menú, búsqueda, zoom) ---------- */

  function syncScrollLock() {
    var anyOpen = document.querySelector('dialog[open]');
    document.documentElement.classList.toggle('hi-locked', !!anyOpen);
  }

  function openDialog(id, opener) {
    var dialog = document.getElementById(id);
    if (!dialog || typeof dialog.showModal !== 'function') return false;
    if (!dialog.open) {
      dialog._opener = opener || document.activeElement;
      dialog.showModal();
      syncScrollLock();
      dialog.dispatchEvent(new CustomEvent('hight:open'));
    }
    return true;
  }

  function closeDialog(dialog) {
    if (dialog && dialog.open) dialog.close();
  }

  document.addEventListener('click', function (event) {
    var zoom = event.target.closest('[data-zoom]');
    if (zoom) {
      var zoomId = zoom.getAttribute('data-zoom');
      if (openDialog(zoomId, zoom)) {
        event.preventDefault();
        var target = document.getElementById(zoom.getAttribute('data-zoom-target'));
        if (target) target.scrollIntoView({ block: 'start' });
      }
      return;
    }

    var opener = event.target.closest('[data-open-dialog]');
    if (opener) {
      if (openDialog(opener.getAttribute('data-open-dialog'), opener)) event.preventDefault();
      return;
    }

    var closer = event.target.closest('[data-close-dialog]');
    if (closer) {
      closeDialog(closer.closest('dialog'));
      return;
    }

    var zoomDialog = event.target.closest('.hi-zoom');
    if (zoomDialog && event.target.tagName === 'IMG') {
      closeDialog(zoomDialog);
      return;
    }

    // Clic en el fondo (fuera de la caja del diálogo) cierra.
    if (event.target.tagName === 'DIALOG' && event.target.open) {
      var rect = event.target.getBoundingClientRect();
      var inside =
        event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) closeDialog(event.target);
    }
  });

  document.addEventListener(
    'close',
    function (event) {
      var dialog = event.target;
      if (dialog.tagName !== 'DIALOG') return;
      syncScrollLock();
      if (dialog._opener && document.contains(dialog._opener)) {
        dialog._opener.focus({ preventScroll: true });
      }
    },
    true
  );

  /* ---------- Vista 360: el visor y three.js se cargan recién al tocar un botón 360° ---------- */

  (function () {
    var viewer = null;
    function load() {
      if (!viewer && config.viewer360) {
        viewer = import(config.viewer360).catch(function (error) {
          viewer = null;
          throw error;
        });
      }
      return viewer;
    }
    function warm(event) {
      if (event.target.closest && event.target.closest('[data-360]')) load();
    }
    document.addEventListener('pointerover', warm, { passive: true });
    document.addEventListener('focusin', warm);
    document.addEventListener('click', function (event) {
      var button = event.target.closest('[data-360]');
      if (!button) return;
      event.preventDefault();
      var loading = load();
      if (!loading) return;
      button.setAttribute('aria-busy', 'true');
      loading
        .then(function (module) {
          module.open(button);
        })
        .catch(function () {
          toast(config.strings && config.strings.v360 ? config.strings.v360.error : '');
        })
        .then(function () {
          button.removeAttribute('aria-busy');
        });
    });
  })();

  /* ---------- Header: se esconde al bajar y vuelve al subir ---------- */

  (function () {
    var section = document.querySelector('.hi-header-section');
    if (!section) return;
    var lastY = window.scrollY;
    var ticking = false;

    window.addEventListener(
      'scroll',
      function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          var y = window.scrollY;
          if (Math.abs(y - lastY) > 6) {
            var hide = y > lastY && y > 260 && !section.contains(document.activeElement);
            section.classList.toggle('is-hidden', hide);
            document.body.classList.toggle('hi-header-hidden', hide);
            lastY = y;
          }
          ticking = false;
        });
      },
      { passive: true }
    );
  })();

  /* ---------- Menú: foto y color al pasar por cada enlace ---------- */

  var MENU_TARGET = '[data-menu-preview], [data-menu-color]';

  function activateMenuPreview(link) {
    var menu = link.closest('dialog');
    if (!menu) return;
    var id = link.getAttribute('data-menu-preview');
    if (id) {
      menu.querySelectorAll('.hi-menu-preview').forEach(function (figure) {
        figure.classList.toggle('is-active', figure.id === id);
      });
    }
    // Un enlace del submenú también marca a su enlace principal.
    menu.querySelectorAll('.hi-menu-link').forEach(function (other) {
      other.classList.toggle('is-active', other === link || other.parentNode.contains(link));
    });
    var tint = link.getAttribute('data-menu-color');
    if (tint) menu.style.setProperty('--menu-tint', tint);
    else menu.style.removeProperty('--menu-tint');
  }

  document.addEventListener('pointerover', function (event) {
    var link = event.target.closest && event.target.closest(MENU_TARGET);
    if (link) activateMenuPreview(link);
  });

  document.addEventListener('focusin', function (event) {
    var link = event.target.closest && event.target.closest(MENU_TARGET);
    if (link) activateMenuPreview(link);
  });

  (function () {
    var menu = document.getElementById('MenuDrawer');
    if (!menu) return;
    menu.addEventListener('hight:open', function () {
      var first = menu.querySelector('[data-menu-preview]');
      if (first) activateMenuPreview(first);
    });
  })();

  /* ---------- Cantidad ---------- */

  if (!customElements.get('quantity-input')) {
    customElements.define(
      'quantity-input',
      class extends HTMLElement {
        connectedCallback() {
          this.input = this.querySelector('input');
          if (!this.input) return;
          this.addEventListener('click', this.onClick.bind(this));
          this.input.addEventListener('change', this.update.bind(this));
          this.update();
        }

        onClick(event) {
          var button = event.target.closest('button');
          if (!button) return;
          event.preventDefault();
          var previous = this.input.value;
          if (button.name === 'plus') this.input.stepUp();
          else this.input.stepDown();
          if (previous !== this.input.value) this.input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        update() {
          var value = parseInt(this.input.value, 10) || 0;
          var min = parseInt(this.input.min, 10) || 0;
          var max = this.input.max ? parseInt(this.input.max, 10) : null;
          var minus = this.querySelector('button[name="minus"]');
          var plus = this.querySelector('button[name="plus"]');
          if (minus) minus.disabled = value <= min;
          if (plus) plus.disabled = max !== null && value >= max;
        }
      }
    );
  }

  /* ---------- Carrito ---------- */

  var Cart = {
    drawer: function () {
      return document.getElementById('CartDrawer');
    },

    sectionsToRender: function () {
      var ids = [];
      if (Cart.drawer()) ids.push('cart-drawer');
      var header = headerSectionId();
      if (header) ids.push(header);
      var page = document.querySelector('[data-cart-page]');
      if (page) ids.push(sectionIdOf(page));
      return ids.filter(Boolean);
    },

    open: function () {
      return openDialog('CartDrawer');
    },

    // Recuerda qué control del carrito tenía el foco para devolverlo después de volver a dibujarlo.
    focusMemo: function (container) {
      var active = document.activeElement;
      if (!container || !active || !container.contains(active)) return null;
      var line = active.closest('[data-cart-line]');
      var control = null;
      if (active.matches('[data-cart-remove]')) control = '[data-cart-remove]';
      else if (active.name === 'plus' || active.name === 'minus') control = 'button[name="' + active.name + '"]';
      else if (active.matches('input[data-line]')) control = 'input[data-line]';
      return { key: line ? line.getAttribute('data-cart-key') : null, control: control };
    },

    restoreFocus: function (container, memo) {
      if (!memo) return;
      var target = null;
      if (memo.key && memo.control) {
        var line = container.querySelector('[data-cart-key="' + CSS.escape(memo.key) + '"]');
        target = line && line.querySelector(memo.control);
        if (target && target.disabled) target = line.querySelector('input[data-line]');
      }
      // La línea ya no está: el foco va a otra línea, al botón de cerrar o al primer enlace del carrito.
      ['[data-cart-remove]', '[data-close-dialog]', 'a[href], button:not([disabled])'].some(function (selector) {
        target = target || container.querySelector(selector);
        return target;
      });
      if (target) target.focus({ preventScroll: true });
    },

    renderSections: function (sections) {
      if (!sections) return;
      Object.keys(sections).forEach(function (id) {
        var html = sections[id];
        if (!html) return;
        var doc = parseHTML(html);

        if (id === 'cart-drawer') {
          var current = Cart.drawer();
          var next = doc.getElementById('CartDrawer');
          if (current && next) {
            var memo = Cart.focusMemo(current);
            current.innerHTML = next.innerHTML;
            current.setAttribute('data-cart-count', next.getAttribute('data-cart-count'));
            Cart.restoreFocus(current, memo);
          }
          return;
        }

        var nextToggle = doc.querySelector('[data-cart-toggle]');
        if (nextToggle) {
          document.querySelectorAll('[data-cart-toggle]').forEach(function (toggle) {
            toggle.innerHTML = nextToggle.innerHTML;
            toggle.setAttribute('aria-label', nextToggle.getAttribute('aria-label'));
          });
        }

        var nextPage = doc.querySelector('[data-cart-page]');
        var currentPage = document.querySelector('[data-cart-page]');
        if (nextPage && currentPage && sectionIdOf(currentPage) === id) {
          // La nota del pedido que se está escribiendo no se ha guardado: se conserva.
          var note = currentPage.querySelector('textarea[name="note"]');
          var noteValue = note ? note.value : null;
          var pageMemo = Cart.focusMemo(currentPage);
          currentPage.innerHTML = nextPage.innerHTML;
          var nextNote = currentPage.querySelector('textarea[name="note"]');
          if (nextNote && noteValue !== null) nextNote.value = noteValue;
          Cart.restoreFocus(currentPage, pageMemo);
        }
      });
    },

    add: function (body) {
      var sections = Cart.sectionsToRender();
      if (sections.length) {
        body.append('sections', sections.join(','));
        body.append('sections_url', window.location.pathname);
      }
      return fetch(routes.cartAdd + '.js', {
        method: 'POST',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: body
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok || data.status) {
            throw new Error(data.description || data.message || strings.error);
          }
          return data;
        });
      });
    },

    // Varias prendas de una vez (probador y favoritas de Desliza).
    addItems: function (items) {
      return fetch(routes.cartAdd + '.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ items: items, sections: Cart.sectionsToRender(), sections_url: window.location.pathname })
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok || data.status) throw new Error(data.description || data.message || strings.error);
          return data;
        });
      });
    },

    queue: Promise.resolve(),

    // Los cambios van uno detrás de otro y por la clave de la línea, que no cambia cuando se quita
    // otra línea (el número de línea sí).
    change: function (lineEl, quantity) {
      var payload = { quantity: quantity, sections: Cart.sectionsToRender(), sections_url: window.location.pathname };
      var key = lineEl.getAttribute('data-cart-key');
      if (key) payload.id = key;
      else payload.line = parseInt(lineEl.getAttribute('data-cart-line'), 10);

      var request = function () {
        return fetch(routes.cartChange + '.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload)
        }).then(function (response) {
          return response.json().then(function (data) {
            if (!response.ok || data.status) throw new Error(data.description || data.message || strings.error);
            return data;
          });
        });
      };
      var result = Cart.queue.then(request, request);
      Cart.queue = result.catch(function () {});
      return result;
    }
  };

  // Abrir el carrito lateral desde el ícono del header.
  document.addEventListener('click', function (event) {
    var toggle = event.target.closest('[data-cart-toggle]');
    if (!toggle || config.cartType !== 'drawer') return;
    if (Cart.open()) event.preventDefault();
  });

  // Cambiar cantidades y quitar líneas (carrito lateral y página del carrito).
  function lineFromEvent(target) {
    return target.closest('[data-cart-line]');
  }

  function updateLine(lineEl, quantity) {
    if (!lineEl) return;
    lineEl.classList.add('is-updating');
    Cart.change(lineEl, quantity)
      .then(function (cart) {
        Cart.renderSections(cart.sections);
      })
      .catch(function (error) {
        lineEl.classList.remove('is-updating');
        var message = lineEl.querySelector('.hi-line-error');
        if (!message) {
          message = document.createElement('p');
          message.className = 'hi-line-error';
          message.setAttribute('role', 'alert');
          lineEl.appendChild(message);
        }
        message.textContent = error.message || strings.error;
      });
  }

  // Cada línea espera por su cuenta: tocar otra línea no cancela el cambio pendiente de la primera.
  var lineTimers = {};

  function onLineQuantity(input) {
    var lineEl = lineFromEvent(input);
    if (!lineEl) return;
    var key = lineEl.getAttribute('data-cart-key') || lineEl.getAttribute('data-cart-line');
    clearTimeout(lineTimers[key]);
    lineTimers[key] = setTimeout(function () {
      delete lineTimers[key];
      var quantity = parseInt(input.value, 10);
      if (isNaN(quantity) || quantity < 0) return;
      updateLine(lineEl, quantity);
    }, 350);
  }

  document.addEventListener('change', function (event) {
    var input = event.target;
    if (input.matches && input.matches('[data-cart-line] input[data-line]')) onLineQuantity(input);
  });

  document.addEventListener('click', function (event) {
    var remove = event.target.closest('[data-cart-remove]');
    if (!remove) return;
    event.preventDefault();
    updateLine(lineFromEvent(remove), 0);
  });

  /* ---------- Formulario de producto (ficha y agregado rápido) ---------- */

  if (!customElements.get('product-form')) {
    customElements.define(
      'product-form',
      class extends HTMLElement {
        connectedCallback() {
          this.form = this.querySelector('form');
          if (!this.form) return;
          this.form.addEventListener('submit', this.onSubmit.bind(this));
          // Navegadores sin event.submitter: se recuerda el botón tocado (las tallas del agregado rápido).
          var self = this;
          this.form.addEventListener('click', function (event) {
            var clicked = event.target.closest('button[type="submit"], button:not([type])');
            if (clicked) self.lastSubmitter = clicked;
          });
        }

        onSubmit(event) {
          if (config.cartType !== 'drawer' || !Cart.drawer()) return; // envío normal a la página del carrito
          event.preventDefault();
          var button = event.submitter || this.lastSubmitter || this.form.querySelector('[data-add-button]');
          this.lastSubmitter = null;
          var errorEl = this.form.querySelector('[data-product-error]');
          if (button && button.disabled) return;

          var body = new FormData(this.form);
          if (button && button.name && button.value) body.set(button.name, button.value);

          if (button) {
            button.classList.add('is-loading');
            button.setAttribute('aria-busy', 'true');
          }
          if (errorEl) errorEl.textContent = '';

          Cart.add(body)
            .then(function (data) {
              Cart.renderSections(data.sections);
              if (!Cart.open()) toast(strings.added, strings.viewCart, Cart.open);
            })
            .catch(function (error) {
              if (errorEl) errorEl.textContent = error.message || strings.error;
              else toast(error.message || strings.error);
            })
            .finally(function () {
              if (button) {
                button.classList.remove('is-loading');
                button.removeAttribute('aria-busy');
              }
            });
        }
      }
    );
  }

  /* ---------- Galería ---------- */

  if (!customElements.get('media-gallery')) {
    customElements.define(
      'media-gallery',
      class extends HTMLElement {
        connectedCallback() {
          this.track = this.querySelector('[data-gallery-track]');
          this.counter = this.querySelector('[data-gallery-count]');
          this.slides = Array.prototype.slice.call(this.querySelectorAll('.hi-gallery-slide'));
          this.thumbs = Array.prototype.slice.call(this.querySelectorAll('[data-thumb]'));
          if (!this.track || this.slides.length < 2) return;

          this.track.addEventListener('scroll', debounce(this.sync.bind(this), 60), { passive: true });
          this.thumbs.forEach(
            function (thumb) {
              thumb.addEventListener(
                'click',
                function () {
                  this.goTo(thumb.getAttribute('data-thumb'));
                }.bind(this)
              );
            }.bind(this)
          );

          var start = parseInt(this.getAttribute('data-start'), 10) || 1;
          if (start > 1) this.goTo(this.slides[start - 1].getAttribute('data-media-id'), true);
        }

        isStacked() {
          return this.track.scrollWidth <= this.track.clientWidth + 2;
        }

        goTo(mediaId, instant) {
          var slide = this.slides.find(function (s) {
            return s.getAttribute('data-media-id') === String(mediaId);
          });
          if (!slide) return;
          var behavior = instant || reducedMotion() ? 'auto' : 'smooth';
          if (this.isStacked()) {
            if (!instant) slide.scrollIntoView({ behavior: behavior, block: 'center' });
            return;
          }
          var left = slide.offsetLeft - (this.track.clientWidth - slide.clientWidth) / 2;
          this.track.scrollTo({ left: left, behavior: behavior });
        }

        sync() {
          var center = this.track.scrollLeft + this.track.clientWidth / 2;
          var index = 0;
          var best = Infinity;
          this.slides.forEach(function (slide, i) {
            var distance = Math.abs(slide.offsetLeft + slide.clientWidth / 2 - center);
            if (distance < best) {
              best = distance;
              index = i;
            }
          });
          var pad = function (n) {
            return (n < 10 ? '0' : '') + n;
          };
          if (this.counter) this.counter.textContent = pad(index + 1) + ' / ' + pad(this.slides.length);
          var activeId = this.slides[index].getAttribute('data-media-id');
          this.thumbs.forEach(function (thumb) {
            if (thumb.getAttribute('data-thumb') === activeId) thumb.setAttribute('aria-current', 'true');
            else thumb.removeAttribute('aria-current');
          });
        }
      }
    );
  }

  /* ---------- Ficha: variantes y barra fija ---------- */

  if (!customElements.get('product-page')) {
    customElements.define(
      'product-page',
      class extends HTMLElement {
        connectedCallback() {
          var json = this.querySelector('[data-product-variants]');
          this.variants = json ? JSON.parse(json.textContent) : [];
          this.sectionId = this.getAttribute('data-section-id');
          this.productUrl = this.getAttribute('data-product-url');
          this.addEventListener('change', this.onChange.bind(this));

          var guide = this.querySelector('dialog[data-size-option]');
          if (guide) guide.addEventListener('hight:open', this.highlightSize.bind(this, guide));

          this.setupBuyBar();
          this.setupStickyInfo();
        }

        setupStickyInfo() {
          // La columna de datos se pega arriba; si es más alta que la pantalla, se pega por abajo
          // para que se pueda leer completa mientras bajan las fotos.
          var info = this.querySelector('.hi-product-info');
          if (!info || !('ResizeObserver' in window)) return;
          new ResizeObserver(function () {
            info.style.setProperty('--info-h', info.offsetHeight + 'px');
          }).observe(info);
        }

        setupBuyBar() {
          var bar = this.querySelector('[data-buybar]');
          var main = this.querySelector('[data-main-add]');
          if (!bar || !main || !('IntersectionObserver' in window)) return;
          var barButton = bar.querySelector('[data-buybar-button]');
          // Con el margen inferior enorme, "no se cruza" solo pasa cuando el botón ya quedó arriba.
          new IntersectionObserver(
            function (entries) {
              var show = !entries[0].isIntersecting;
              bar.classList.toggle('is-visible', show);
              bar.setAttribute('aria-hidden', show ? 'false' : 'true');
              if (barButton) barButton.tabIndex = show ? 0 : -1;
            },
            { rootMargin: '0px 0px 100000px 0px' }
          ).observe(main);
        }

        selectedOptions() {
          var picker = this.querySelector('[data-variant-picker]');
          if (!picker) return [];
          var checked = Array.prototype.slice.call(picker.querySelectorAll('input[type="radio"]:checked'));
          checked.sort(function (a, b) {
            return a.getAttribute('data-option-position') - b.getAttribute('data-option-position');
          });
          return checked.map(function (input) {
            return input.value;
          });
        }

        setButtons(disabled, label) {
          this.querySelectorAll('[data-add-button], [data-buybar-button]').forEach(function (button) {
            button.disabled = disabled;
            if (label) button.textContent = label;
          });
        }

        onChange(event) {
          var input = event.target;
          if (!input.matches('[data-variant-picker] input[type="radio"]')) return;

          var legendValue = input.closest('fieldset') && input.closest('fieldset').querySelector('[data-selected-value]');
          if (legendValue) legendValue.textContent = input.value.toUpperCase();

          var options = this.selectedOptions();
          var variant = this.variants.find(function (v) {
            return v.options.every(function (value, i) {
              return value === options[i];
            });
          });

          var idInput = this.querySelector('input[name="id"][data-variant-id]');
          var paymentButton = this.querySelector('.hi-payment-button');

          if (!variant) {
            // Sin variante no se puede comprar: ni el botón de agregar ni el de pago rápido.
            this.setButtons(true, strings.unavailable);
            if (paymentButton) paymentButton.hidden = true;
            return;
          }

          if (paymentButton) paymentButton.hidden = false;
          if (idInput) {
            idInput.value = variant.id;
            idInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
          var url = new URL(window.location.href);
          url.searchParams.set('variant', variant.id);
          window.history.replaceState({}, '', url.toString());

          var gallery = this.querySelector('media-gallery');
          if (variant.media_id && gallery) gallery.goTo(variant.media_id);

          this.renderVariant(variant, input);
        }

        renderVariant(variant, input) {
          var self = this;
          if (this.controller) this.controller.abort();
          this.controller = new AbortController();
          var focusedName = input.name;
          var focusedValue = input.value;

          fetch(this.productUrl + '?variant=' + variant.id + '&section_id=' + this.sectionId, {
            signal: this.controller.signal
          })
            .then(function (response) {
              return response.text();
            })
            .then(function (html) {
              var doc = parseHTML(html);
              // Cada bloque se reemplaza por el suyo (el precio grande y el de la barra fija son distintos).
              ['[data-product-price]', '[data-product-per-wear]', '[data-variant-picker]', '[data-product-stock]', '[data-size-guide]'].forEach(function (selector) {
                var nextAll = doc.querySelectorAll(selector);
                if (!nextAll.length) return;
                self.querySelectorAll(selector).forEach(function (current, index) {
                  current.innerHTML = (nextAll[index] || nextAll[0]).innerHTML;
                });
              });

              var nextButton = doc.querySelector('[data-add-button]');
              var button = self.querySelector('[data-add-button]');
              if (nextButton && button) {
                button.disabled = nextButton.disabled;
                button.innerHTML = nextButton.innerHTML;
              }
              var nextBar = doc.querySelector('[data-buybar-button]');
              var bar = self.querySelector('[data-buybar-button]');
              if (nextBar && bar) {
                bar.disabled = nextBar.disabled;
                bar.innerHTML = nextBar.innerHTML;
              }

              var restore = self.querySelector(
                '[data-variant-picker] input[name="' + focusedName + '"][value="' + CSS.escape(focusedValue) + '"]'
              );
              if (restore) restore.focus({ preventScroll: true });
            })
            .catch(function (error) {
              if (error.name !== 'AbortError') console.error(error);
            });
        }

        highlightSize(guide) {
          var position = guide.getAttribute('data-size-option');
          var checked = this.querySelector('input[data-option-position="' + position + '"]:checked');
          var size = checked ? checked.value : null;
          guide.querySelectorAll('[data-size]').forEach(function (cell) {
            cell.classList.toggle('is-on', cell.getAttribute('data-size') === size);
          });
        }
      }
    );
  }

  /* ---------- Recomendados ---------- */

  if (!customElements.get('product-recommendations')) {
    customElements.define(
      'product-recommendations',
      class extends HTMLElement {
        connectedCallback() {
          var self = this;
          var url = this.getAttribute('data-url');
          if (!url || this.children.length) return;
          var observer = new IntersectionObserver(
            function (entries) {
              if (!entries[0].isIntersecting) return;
              observer.disconnect();
              fetch(url)
                .then(function (response) {
                  return response.text();
                })
                .then(function (html) {
                  var next = parseHTML(html).querySelector('product-recommendations');
                  if (next && next.innerHTML.trim().length) {
                    self.innerHTML = next.innerHTML;
                    initReveal(self);
                  }
                })
                .catch(function () {});
            },
            { rootMargin: '0px 0px 400px 0px' }
          );
          observer.observe(this);
        }
      }
    );
  }

  /* ---------- Búsqueda predictiva ---------- */

  if (!customElements.get('predictive-search')) {
    customElements.define(
      'predictive-search',
      class extends HTMLElement {
        connectedCallback() {
          this.input = this.querySelector('[data-predictive-input]');
          this.results = this.querySelector('[data-predictive-results]');
          var dialog = this.closest('dialog');
          var input = this.input;
          if (dialog && input) {
            dialog.addEventListener('hight:open', function () {
              input.focus();
            });
          }
          if (!this.input || this.getAttribute('data-enabled') !== 'true' || !routes.predictiveSearch) return;
          this.input.addEventListener('input', debounce(this.onInput.bind(this), 250));
        }

        onInput() {
          var self = this;
          var terms = this.input.value.trim();
          if (this.controller) this.controller.abort();
          if (!terms.length) {
            this.results.innerHTML = '';
            return;
          }
          this.controller = new AbortController();
          var url =
            routes.predictiveSearch +
            '?q=' +
            encodeURIComponent(terms) +
            '&resources[type]=product&resources[limit]=6&resources[options][unavailable_products]=last' +
            '&section_id=' +
            this.getAttribute('data-section-id');
          fetch(url, { signal: this.controller.signal })
            .then(function (response) {
              return response.text();
            })
            .then(function (html) {
              var section = parseHTML(html).querySelector('.shopify-section');
              self.results.innerHTML = section ? section.innerHTML : '';
            })
            .catch(function () {});
        }
      }
    );
  }

  /* ---------- Orden de colección ---------- */

  document.addEventListener('change', function (event) {
    var form = event.target.closest && event.target.closest('form[data-autosubmit]');
    if (form) form.submit();
  });

  /* ---------- Columnas de la retícula ---------- */

  function initDensity(root) {
    (root || document).querySelectorAll('[data-density-toggle]').forEach(function (group) {
      if (group._density) return;
      group._density = true;
      var grid = document.querySelector('[data-density-grid]');
      if (!grid) return;
      var mobile = window.innerWidth < 750;
      var key = 'hight-density-' + (mobile ? 'm' : 'd');
      var fallback = mobile ? '2' : group.getAttribute('data-default') || '4';

      function apply(value, save) {
        grid.setAttribute('data-density', value);
        group.querySelectorAll('[data-density]').forEach(function (button) {
          button.setAttribute('aria-pressed', button.getAttribute('data-density') === value ? 'true' : 'false');
        });
        if (save) storageSet(key, value);
      }

      apply(storageGet(key) || fallback, false);
      group.addEventListener('click', function (event) {
        var button = event.target.closest('[data-density]');
        if (!button) return;
        withTransition(function () {
          apply(button.getAttribute('data-density'), true);
        });
      });
    });
  }

  /* ---------- Cintas de texto (marquee) ---------- */

  if (!customElements.get('hi-marquee')) {
    customElements.define(
      'hi-marquee',
      class extends HTMLElement {
        connectedCallback() {
          if (reducedMotion()) return;
          this.track = this.querySelector('.hi-marquee-track');
          if (!this.track || !('IntersectionObserver' in window)) return;
          this.direction = this.getAttribute('data-direction') === 'right' ? 1 : -1;
          this.duration = parseFloat(this.getAttribute('data-speed')) || 30;
          this.boost = this.getAttribute('data-scroll-boost') === 'true';
          this.hover = false;
          this.visible = false;
          this.classList.add('is-js');
          this.measure();
          this.x = this.direction === 1 ? -this.width : 0;

          this.onResize = debounce(this.measure.bind(this), 150);
          window.addEventListener('resize', this.onResize);
          this.addEventListener('mouseenter', this.setHover.bind(this, true));
          this.addEventListener('mouseleave', this.setHover.bind(this, false));

          var self = this;
          this.observer = new IntersectionObserver(
            function (entries) {
              self.visible = entries[0].isIntersecting;
              if (self.visible) self.start();
            },
            { rootMargin: '120px' }
          );
          this.observer.observe(this);
        }

        disconnectedCallback() {
          if (this.observer) this.observer.disconnect();
          if (this.onResize) window.removeEventListener('resize', this.onResize);
          if (this.raf) cancelAnimationFrame(this.raf);
          this.raf = null;
        }

        setHover(value) {
          this.hover = value;
        }

        measure() {
          var group = this.track.firstElementChild;
          this.width = group ? group.getBoundingClientRect().width : 0;
        }

        start() {
          if (this.raf || !this.width) return;
          var self = this;
          var last = performance.now();
          function step(now) {
            var dt = Math.min(64, now - last);
            last = now;
            if (!self.visible) {
              self.raf = null;
              return;
            }
            var speed = self.width / (self.duration * 1000);
            var factor = self.hover ? 0.2 : 1;
            if (self.boost) factor += ScrollVelocity.value * 3;
            self.x += self.direction * speed * factor * dt;
            if (self.x <= -self.width) self.x += self.width;
            if (self.x > 0) self.x -= self.width;
            self.track.style.transform = 'translate3d(' + self.x.toFixed(2) + 'px,0,0)';
            self.raf = requestAnimationFrame(step);
          }
          this.raf = requestAnimationFrame(step);
        }
      }
    );
  }

  /* ---------- Hero collage: arrastrar, mezclar y profundidad ---------- */

  if (!customElements.get('hi-collage')) {
    customElements.define(
      'hi-collage',
      class extends HTMLElement {
        connectedCallback() {
          this.pieces = Array.prototype.slice.call(this.querySelectorAll('[data-piece]'));
          this.logo = this.querySelector('.hi-collage-logo');
          this.z = 10;
          this.target = { nx: 0, ny: 0 };

          if (motionOK()) this.classList.add('is-ready');

          if (finePointer()) {
            this.pieces.forEach(this.makeDraggable.bind(this));
            if (motionOK()) {
              this.addEventListener('pointermove', this.onMove.bind(this));
              this.addEventListener('pointerleave', this.onLeave.bind(this));
            }
          }

          var shuffle = this.querySelector('[data-collage-shuffle]');
          if (shuffle) shuffle.addEventListener('click', this.shuffle.bind(this));
        }

        onMove(event) {
          if (this.dragging) return;
          var rect = this.getBoundingClientRect();
          this.target = {
            nx: (event.clientX - rect.left) / rect.width - 0.5,
            ny: (event.clientY - rect.top) / rect.height - 0.5
          };
          if (!this.raf) this.raf = requestAnimationFrame(this.applyParallax.bind(this));
        }

        onLeave() {
          this.target = { nx: 0, ny: 0 };
          if (!this.raf) this.raf = requestAnimationFrame(this.applyParallax.bind(this));
        }

        applyParallax() {
          this.raf = null;
          var t = this.target;
          if (this.logo) {
            this.logo.style.setProperty('--px', (t.nx * -28).toFixed(1) + 'px');
            this.logo.style.setProperty('--py', (t.ny * -20).toFixed(1) + 'px');
          }
          this.pieces.forEach(function (piece) {
            if (piece.classList.contains('is-dragging')) return;
            var depth = parseFloat(piece.getAttribute('data-depth')) || 0.5;
            piece.style.setProperty('--px', (t.nx * 46 * depth).toFixed(1) + 'px');
            piece.style.setProperty('--py', (t.ny * 34 * depth).toFixed(1) + 'px');
          });
        }

        makeDraggable(piece) {
          var self = this;
          var press = null;
          var moved = false;

          function onMove(event) {
            if (!press) return;
            var mx = event.clientX - press.x;
            var my = event.clientY - press.y;
            if (!moved) {
              if (Math.abs(mx) + Math.abs(my) < 6) return;
              moved = true;
              self.dragging = true;
              piece.classList.add('is-dragging');
              piece.style.zIndex = ++self.z;
            }
            var stage = self.getBoundingClientRect();
            var cx = clamp(event.clientX, stage.left + 10, stage.right - 10);
            var cy = clamp(event.clientY, stage.top + 10, stage.bottom - 10);
            piece.style.setProperty('--dx', (press.dx + cx - press.x).toFixed(1) + 'px');
            piece.style.setProperty('--dy', (press.dy + cy - press.y).toFixed(1) + 'px');
          }

          function onUp() {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
            press = null;
            self.dragging = false;
            piece.classList.remove('is-dragging');
            if (moved) {
              piece._justDragged = true;
              setTimeout(function () {
                piece._justDragged = false;
              }, 0);
            }
          }

          piece.addEventListener('pointerdown', function (event) {
            if (event.button !== 0) return;
            moved = false;
            piece._justDragged = false;
            press = {
              x: event.clientX,
              y: event.clientY,
              dx: parseFloat(piece.style.getPropertyValue('--dx')) || 0,
              dy: parseFloat(piece.style.getPropertyValue('--dy')) || 0
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
          });

          piece.addEventListener(
            'click',
            function (event) {
              if (piece._justDragged) {
                event.preventDefault();
                event.stopPropagation();
                piece._justDragged = false;
              }
            },
            true
          );

          piece.addEventListener('dragstart', function (event) {
            event.preventDefault();
          });
        }

        shuffle() {
          var self = this;
          var mobile = window.innerWidth < 750;
          // Huecos alrededor del logo; cada foto cae en uno al azar, con un poco de desorden.
          var slots = mobile
            ? [[2, 2], [68, 0], [4, 46], [66, 44], [38, 60], [34, 0], [70, 22], [2, 24]]
            : [[3, 5], [76, 3], [11, 50], [67, 45], [43, 64], [27, 4], [58, 2], [84, 36]];
          slots.sort(function () {
            return Math.random() - 0.5;
          });
          this.pieces.forEach(function (piece, i) {
            var slot = slots[i % slots.length];
            var x = clamp(slot[0] + (Math.random() * 8 - 4), 0, 85);
            var y = clamp(slot[1] + (Math.random() * 8 - 4), 0, 72);
            var r = Math.random() * 20 - 10;
            piece.style.setProperty('--x', x.toFixed(1) + '%');
            piece.style.setProperty('--y', y.toFixed(1) + '%');
            piece.style.setProperty('--yn', y.toFixed(1));
            piece.style.setProperty('--r', r.toFixed(1) + 'deg');
            piece.style.setProperty('--dx', '0px');
            piece.style.setProperty('--dy', '0px');
            piece.style.zIndex = ++self.z;
          });
          // La rotación de estilo vuelve a ordenar los huecos alrededor del logo en el próximo turno.
          this._ring = null;
        }
      }
    );
  }

  /* ---------- Fila de productos que se arrastra ---------- */

  if (!customElements.get('hi-rail')) {
    customElements.define(
      'hi-rail',
      class extends HTMLElement {
        connectedCallback() {
          this.track = this.querySelector('.hi-rail-track');
          if (!this.track) return;
          this.bar = this.querySelector('.hi-rail-progress');
          var scope = this.closest('section') || this.closest('product-recommendations') || this.parentElement;
          this.prev = scope.querySelector('[data-rail-prev]');
          this.next = scope.querySelector('[data-rail-next]');
          var self = this;
          if (this.prev) this.prev.addEventListener('click', this.step.bind(this, -1));
          if (this.next) this.next.addEventListener('click', this.step.bind(this, 1));
          this.track.addEventListener(
            'scroll',
            function () {
              if (!self.ticking) {
                self.ticking = true;
                requestAnimationFrame(function () {
                  self.ticking = false;
                  self.update();
                });
              }
            },
            { passive: true }
          );
          this.onResize = debounce(this.update.bind(this), 120);
          window.addEventListener('resize', this.onResize);
          if (finePointer()) this.enableDrag();
          this.update();
        }

        disconnectedCallback() {
          if (this.onResize) window.removeEventListener('resize', this.onResize);
        }

        step(direction) {
          if (this.stopGlide) this.stopGlide();
          var item = this.track.querySelector(':scope > li');
          var gap = parseFloat(getComputedStyle(this.track).columnGap) || 24;
          var width = item ? item.getBoundingClientRect().width + gap : 320;
          var count = window.innerWidth >= 990 ? 2 : 1;
          this.track.scrollBy({ left: direction * width * count, behavior: reducedMotion() ? 'auto' : 'smooth' });
        }

        update() {
          var track = this.track;
          var max = track.scrollWidth - track.clientWidth;
          var ratio = track.scrollWidth ? track.clientWidth / track.scrollWidth : 1;
          var progress = max > 0 ? track.scrollLeft / max : 0;
          this.classList.toggle('is-static', max <= 2);
          if (this.bar) {
            var thumb = Math.max(0.08, ratio);
            this.bar.style.setProperty('--thumb-w', (thumb * 100).toFixed(2) + '%');
            this.bar.style.setProperty('--thumb-x', (progress * (1 - thumb) * 100).toFixed(2) + '%');
            this.bar.setAttribute('aria-valuenow', Math.round(progress * 100));
          }
          if (this.prev) this.prev.disabled = track.scrollLeft <= 2;
          if (this.next) this.next.disabled = track.scrollLeft >= max - 2;
        }

        enableDrag() {
          var track = this.track;
          var press = null;
          var moved = false;
          var velocity = 0;
          var lastX = 0;
          var lastT = 0;
          var glide = null;

          this.stopGlide = function () {
            if (glide) cancelAnimationFrame(glide);
            glide = null;
            track.classList.remove('is-dragging');
          };

          function onMove(event) {
            if (!press) return;
            var dx = event.clientX - press.x;
            if (!moved) {
              if (Math.abs(dx) < 6) return;
              moved = true;
              track.classList.add('is-dragging');
            }
            track.scrollLeft = press.scroll - dx;
            var now = performance.now();
            velocity = (event.clientX - lastX) / Math.max(1, now - lastT);
            lastX = event.clientX;
            lastT = now;
          }

          function onUp() {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            press = null;
            if (!moved) return;
            track._justDragged = true;
            setTimeout(function () {
              track._justDragged = false;
            }, 0);
            var v = clamp(-velocity * 16, -60, 60);
            if (reducedMotion()) v = 0;
            function frame() {
              if (Math.abs(v) < 0.6) {
                track.classList.remove('is-dragging');
                glide = null;
                return;
              }
              track.scrollLeft += v;
              v *= 0.93;
              glide = requestAnimationFrame(frame);
            }
            glide = requestAnimationFrame(frame);
          }

          track.addEventListener('pointerdown', function (event) {
            if (event.pointerType !== 'mouse' || event.button !== 0) return;
            if (glide) cancelAnimationFrame(glide);
            glide = null;
            moved = false;
            track._justDragged = false;
            press = { x: event.clientX, scroll: track.scrollLeft };
            lastX = event.clientX;
            lastT = performance.now();
            velocity = 0;
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
          });

          track.addEventListener(
            'click',
            function (event) {
              if (track._justDragged) {
                event.preventDefault();
                event.stopPropagation();
                track._justDragged = false;
              }
            },
            true
          );

          track.addEventListener('dragstart', function (event) {
            event.preventDefault();
          });
        }
      }
    );
  }

  /* ---------- Color de acento de la tienda ---------- */

  // El color que el visitante elige se guarda (localStorage). El de la última colección de color que
  // abrió vale solo para esa visita (sessionStorage, lo escribe layout/theme.liquid) y tiene prioridad.
  var Accent = {
    key: 'hight-accent',
    visitKey: 'hight-accent-visit',

    current: function () {
      try {
        return JSON.parse(sessionGet(Accent.visitKey) || storageGet(Accent.key) || 'null');
      } catch (e) {
        return null;
      }
    },

    set: function (color, on, name) {
      var root = document.documentElement;
      withTransition(function () {
        root.style.setProperty('--accent', color);
        root.style.setProperty('--on-accent', on);
      });
      if (config.visitorAccent) {
        storageSet(Accent.key, JSON.stringify({ color: color, on: on, name: name }));
        sessionSet(Accent.visitKey, null);
      }
      document.dispatchEvent(new CustomEvent('hight:accent', { detail: { color: color, on: on, name: name } }));
    },

    reset: function () {
      var root = document.documentElement;
      withTransition(function () {
        root.style.removeProperty('--accent');
        root.style.removeProperty('--on-accent');
      });
      storageSet(Accent.key, null);
      sessionSet(Accent.visitKey, null);
      document.dispatchEvent(new CustomEvent('hight:accent', { detail: null }));
    }
  };

  if (!customElements.get('hi-color-story')) {
    customElements.define(
      'hi-color-story',
      class extends HTMLElement {
        connectedCallback() {
          this.section = this.closest('section') || this;
          this.swatches = Array.prototype.slice.call(this.querySelectorAll('.hi-story-swatch'));
          this.panels = Array.prototype.slice.call(this.querySelectorAll('.hi-story-panel'));
          this.resetButton = this.querySelector('[data-story-reset]');
          this.global = this.getAttribute('data-global') === 'true';
          if (!this.swatches.length) return;

          var self = this;
          this.swatches.forEach(function (swatch) {
            swatch.addEventListener('click', function () {
              self.select(swatch, true);
            });
          });

          if (this.resetButton) {
            this.resetButton.addEventListener('click', function () {
              Accent.reset();
              self.resetButton.hidden = true;
              toast(strings.accentReset);
            });
          }

          var stored = this.global ? Accent.current() : null;
          if (stored) {
            var match = this.swatches.find(function (swatch) {
              return swatch.getAttribute('data-color').toLowerCase() === String(stored.color).toLowerCase();
            });
            if (match) this.select(match, false);
            if (this.resetButton) this.resetButton.hidden = false;
          }
        }

        select(swatch, fromUser) {
          var color = swatch.getAttribute('data-color');
          this.swatches.forEach(function (other) {
            other.setAttribute('aria-pressed', other === swatch ? 'true' : 'false');
          });
          this.section.style.setProperty('--story', color);

          var panelId = swatch.getAttribute('data-panel');
          this.panels.forEach(function (panel) {
            var show = panel.id === panelId;
            if (show && panel.hidden) {
              panel.hidden = false;
              panel.classList.remove('is-entering');
              void panel.offsetWidth;
              if (motionOK()) panel.classList.add('is-entering');
            } else if (!show) {
              panel.hidden = true;
            }
          });

          if (fromUser && this.global) {
            var name = swatch.getAttribute('data-name');
            Accent.set(color, swatch.getAttribute('data-on'), name);
            if (this.resetButton) this.resetButton.hidden = false;
            if (strings.accentChanged) toast(strings.accentChanged.replace('[name]', name));
          }
        }
      }
    );
  }

  /* ---------- Probador, Lupa y Desliza: ayudas comunes ---------- */

  // Mientras alguien usa estas secciones, la rotación de estilo espera para cambiar de turno.
  function holdRotation() {
    var R = window.HightRotation;
    if (R && R.hold) R.hold();
  }

  // Turno que está en pantalla (o null si la tienda no rota en esta página).
  function currentTurn() {
    var R = window.HightRotation;
    return R && R.turns && R.turns.length && R.shown >= 0 ? R.turns[R.shown] : null;
  }

  function turnByHandle(handle) {
    var R = window.HightRotation;
    if (!R || !R.turns) return null;
    for (var i = 0; i < R.turns.length; i++) {
      if (R.turns[i].handle === handle) return R.turns[i];
    }
    return null;
  }

  function cartAdded(data, message) {
    Cart.renderSections(data.sections);
    if (config.cartType === 'drawer' && Cart.drawer() && Cart.open()) return;
    toast(message || strings.added, strings.viewCart, function () {
      window.location.href = routes.cart;
    });
  }

  // Foto de una prenda (de los datos JSON de la sección) en un <img> que ya existe o uno nuevo.
  function putImage(box, product, sizes) {
    var img = box.querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.setAttribute('loading', 'lazy');
      img.setAttribute('draggable', 'false');
      box.appendChild(img);
    }
    img.hidden = false;
    img.setAttribute('sizes', sizes);
    img.setAttribute('srcset', product.srcset);
    img.setAttribute('src', product.src);
    img.setAttribute('width', product.w);
    img.setAttribute('height', product.h);
    img.setAttribute('alt', product.alt || product.title);
    return img;
  }

  // Selector de talla para las prendas con varias tallas disponibles.
  function fillSizes(select, product, label) {
    select.innerHTML = '';
    (product.sizes || []).forEach(function (size) {
      var option = document.createElement('option');
      option.value = size.id;
      option.textContent = size.title;
      option.setAttribute('data-cents', size.cents);
      select.appendChild(option);
    });
    select.setAttribute('aria-label', label.replace('[title]', product.title));
  }

  function chosenVariant(product, select) {
    if (select && product.sizes && product.sizes.length > 1 && select.value) {
      var option = select.options[select.selectedIndex];
      return { id: parseInt(select.value, 10), cents: parseInt(option.getAttribute('data-cents'), 10) || product.cents };
    }
    return { id: product.id, cents: product.cents };
  }

  /* ---------- Probador: arma tu look ---------- */

  // Una prenda para encima, una arriba y una abajo. Con "Del color del turno" sigue al color en pantalla;
  // si ese color no tiene prendas para un puesto, va una de los colores que combinan con todo.
  if (!customElements.get('hi-probador')) {
    customElements.define(
      'hi-probador',
      class extends HTMLElement {
        connectedCallback() {
          var dataEl = this.querySelector('[data-probador-data]');
          if (!dataEl || this.data) return;
          try {
            this.data = JSON.parse(dataEl.textContent);
          } catch (e) {
            return;
          }
          var self = this;
          this.slots = Array.prototype.slice.call(this.querySelectorAll('[data-group]'));
          this.color = this.querySelector('[data-probador-color]');
          this.totalEl = this.querySelector('[data-probador-total]');
          this.addButton = this.querySelector('[data-probador-add]');
          this.reset();

          if (currentTurn()) {
            this.querySelector('[data-probador-turn]').hidden = false;
            this.color.checked = this.getAttribute('data-turn-color') === 'true';
          }

          this.slots.forEach(function (slot) {
            slot.querySelectorAll('[data-dir]').forEach(function (button) {
              button.addEventListener('click', function () {
                var dir = parseInt(button.getAttribute('data-dir'), 10);
                self.index[slot.getAttribute('data-group')] += dir;
                self.touched = true;
                holdRotation();
                self.renderSlot(slot, true, dir);
                self.renderTotal();
              });
            });
            slot.querySelector('[data-probador-size] select').addEventListener('change', function () {
              self.touched = true;
              holdRotation();
              self.renderTotal();
            });
          });

          this.color.addEventListener('change', function () {
            self.touched = false;
            self.reset();
            self.renderAll(true);
          });
          this.querySelector('[data-probador-shuffle]').addEventListener('click', function () {
            Object.keys(self.index).forEach(function (group) {
              self.index[group] = Math.floor(Math.random() * 997);
            });
            self.touched = true;
            holdRotation();
            self.renderAll(true);
          });
          this.addButton.addEventListener('click', this.add.bind(this));

          // Sigue al turno mientras nadie haya armado su propio look; si ya lo armó, solo cambia la textura.
          this.onTurn = function () {
            if (!self.color.checked) return;
            if (self.touched) {
              self.slots.forEach(function (slot) {
                self.paintBackground(slot);
              });
              return;
            }
            self.reset();
            self.renderAll(true);
          };
          document.addEventListener('hight:turn', this.onTurn);
          this.renderAll(false);
        }

        disconnectedCallback() {
          if (this.onTurn) document.removeEventListener('hight:turn', this.onTurn);
        }

        reset() {
          this.index = { layer: 0, top: 0, bottom: 0 };
        }

        pool(group) {
          var all = this.data.groups[group] || [];
          var turn = this.color.checked ? currentTurn() : null;
          if (!turn) return { list: all, fallback: false };
          var own = all.filter(function (product) {
            return product.cols.indexOf(turn.handle) > -1;
          });
          if (own.length) return { list: own, fallback: false };
          var neutrals = this.data.neutrals || [];
          var neutral = all.filter(function (product) {
            return neutrals.some(function (handle) {
              return product.cols.indexOf(handle) > -1;
            });
          });
          return { list: neutral.length ? neutral : all, fallback: true, turn: turn };
        }

        pick(group) {
          var pool = this.pool(group);
          var n = pool.list.length;
          if (!n) return null;
          this.index[group] = ((this.index[group] % n) + n) % n;
          return { product: pool.list[this.index[group]], fallback: pool.fallback, turn: pool.turn, count: n };
        }

        neutralNames() {
          var names = (this.data.neutrals || [])
            .map(function (handle) {
              var turn = turnByHandle(handle);
              return turn ? turn.name : null;
            })
            .filter(Boolean);
          if (names.length < 2) return names.join('');
          return names.slice(0, -1).join(', ') + ' ' + this.getAttribute('data-label-or') + ' ' + names[names.length - 1];
        }

        renderAll(animate) {
          var self = this;
          this.slots.forEach(function (slot) {
            self.renderSlot(slot, animate, 1);
          });
          this.renderTotal();
        }

        renderSlot(slot, animate, dir) {
          var group = slot.getAttribute('data-group');
          var word = slot.getAttribute('data-group-word');
          var picked = this.pick(group);
          var link = slot.querySelector('[data-probador-link]');
          var sizeBox = slot.querySelector('[data-probador-size]');
          var select = sizeBox.querySelector('select');
          var note = slot.querySelector('[data-probador-note]');
          this.paintBackground(slot);

          slot.querySelectorAll('[data-dir]').forEach(function (button) {
            button.disabled = !picked || picked.count < 2;
          });
          slot._product = picked ? picked.product : null;

          if (!picked) {
            link.hidden = true;
            slot.querySelector('[data-probador-name]').textContent = '';
            slot.querySelector('[data-probador-price]').textContent = this.getAttribute('data-label-empty').replace('[group]', word);
            sizeBox.hidden = true;
            note.hidden = true;
            return;
          }

          var product = picked.product;
          link.hidden = false;
          link.setAttribute('href', product.url);
          putImage(link.querySelector('.hi-probador-media'), product, '(min-width: 990px) 24vw, 70vw');
          slot.querySelector('[data-probador-name]').textContent = product.title;
          slot.querySelector('[data-probador-price]').textContent = formatMoney(product.cents) + ' · ' + product.type;

          if (product.sizes && product.sizes.length > 1) {
            fillSizes(select, product, this.getAttribute('data-label-size'));
            sizeBox.hidden = false;
          } else {
            select.innerHTML = '';
            sizeBox.hidden = true;
          }

          note.hidden = !(picked.fallback && picked.turn);
          if (!note.hidden) {
            note.textContent = this.getAttribute('data-label-fallback')
              .replace('[name]', picked.turn.name)
              .replace('[group]', word)
              .replace('[neutrals]', this.neutralNames());
          }

          if (animate && motionOK()) {
            link.style.setProperty('--from', (dir || 1) * 24 + 'px');
            link.classList.remove('is-swap');
            void link.offsetWidth;
            link.classList.add('is-swap');
          }
        }

        // Fondo con la textura del turno, como el collage del inicio.
        paintBackground(slot) {
          var bg = slot.querySelector('[data-probador-bg]');
          var turn = currentTurn();
          bg.className = 'hi-probador-bg hi-tx' + (turn ? ' is-on hi-tx--' + (turn.texture ? 'foto' : turn.handle) : '');
          bg.style.backgroundImage = turn && turn.texture ? 'url("' + turn.texture + '")' : '';
        }

        chosen() {
          return this.slots
            .filter(function (slot) {
              return slot._product;
            })
            .map(function (slot) {
              return chosenVariant(slot._product, slot.querySelector('[data-probador-size] select'));
            });
        }

        renderTotal() {
          var total = this.chosen().reduce(function (sum, item) {
            return sum + item.cents;
          }, 0);
          this.totalEl.textContent = formatMoney(total);
          this.addButton.disabled = total === 0;
        }

        add() {
          var items = this.chosen().map(function (item) {
            return { id: item.id, quantity: 1 };
          });
          if (!items.length || this.addButton.classList.contains('is-loading')) return;
          var button = this.addButton;
          var message = this.getAttribute('data-label-added');
          button.classList.add('is-loading');
          button.setAttribute('aria-busy', 'true');
          Cart.addItems(items)
            .then(function (data) {
              cartAdded(data, message);
            })
            .catch(function (error) {
              toast(error.message || strings.error);
            })
            .finally(function () {
              button.classList.remove('is-loading');
              button.removeAttribute('aria-busy');
            });
        }
      }
    );
  }

  /* ---------- Lupa: la tela de cerca ---------- */

  // Una lupa redonda sigue al cursor o al dedo sobre la foto. Los números llevan a cada detalle de la prenda.
  if (!customElements.get('hi-lupa')) {
    customElements.define(
      'hi-lupa',
      class extends HTMLElement {
        connectedCallback() {
          var dataEl = this.querySelector('[data-lupa-data]');
          if (!dataEl || this.items) return;
          try {
            this.items = JSON.parse(dataEl.textContent);
          } catch (e) {
            return;
          }
          if (!this.items.length) return;
          var self = this;
          this.frame = this.querySelector('[data-lupa-stage]');
          this.img = this.frame.querySelector('img');
          this.lens = this.querySelector('[data-lupa-lens]');
          this.spotsBox = this.querySelector('[data-lupa-spots]');
          this.list = this.querySelector('[data-lupa-list]');
          this.detail = this.querySelector('[data-lupa-detail]');
          this.views = this.querySelector('[data-lupa-views]');
          this.state = { item: 0, view: 0, zoom: parseFloat(this.getAttribute('data-zoom')) || 2.5, spot: -1 };
          this.uid = 'Lupa' + Math.random().toString(36).slice(2, 8);

          var itemsBox = this.querySelector('[data-lupa-items]');
          itemsBox.hidden = this.items.length < 2;
          this.items.forEach(function (item, i) {
            itemsBox.appendChild(self.chip(self.uid + '-item', i, item.t, i === 0));
          });
          itemsBox.addEventListener('change', function (event) {
            self.state.item = parseInt(event.target.value, 10);
            self.state.view = 0;
            self.render();
          });
          this.views.addEventListener('change', function (event) {
            self.state.view = parseInt(event.target.value, 10);
            self.render();
          });
          this.querySelector('[data-lupa-zooms]').addEventListener('change', function (event) {
            self.state.zoom = parseFloat(event.target.value) || 2.5;
            self.renderHint();
            if (self.state.spot > -1) self.pickSpot(self.state.spot);
          });

          var onPointer = this.onPointer.bind(this);
          var warm = this.warm.bind(this);
          this.frame.addEventListener('pointerenter', warm);
          this.frame.addEventListener('pointerdown', warm);
          this.frame.addEventListener('focusin', warm);
          this.frame.addEventListener('pointermove', onPointer);
          this.frame.addEventListener('pointerdown', onPointer);
          // Con el dedo, la lupa se queda donde se levantó; con el mouse, se va al salir de la foto.
          this.frame.addEventListener('pointerleave', function (event) {
            if (event.pointerType === 'mouse' && self.state.spot < 0) self.lens.hidden = true;
          });
          this.img.addEventListener('load', function () {
            if (self.state.spot > -1) self.pickSpot(self.state.spot);
          });
          this.render();
        }

        chip(name, value, text, checked) {
          var label = document.createElement('label');
          var input = document.createElement('input');
          input.type = 'radio';
          input.name = name;
          input.value = value;
          input.checked = checked;
          var span = document.createElement('span');
          span.textContent = text;
          label.appendChild(input);
          label.appendChild(span);
          return label;
        }

        renderHint() {
          var hint = this.querySelector('[data-lupa-hint]');
          hint.textContent = this.getAttribute('data-label-hint').replace('[zoom]', String(this.state.zoom).replace('.', ',') + '×');
        }

        render() {
          var self = this;
          var item = this.items[this.state.item];
          var view = item.views[this.state.view] || item.views[0];
          this.state.spot = -1;
          this.lens.hidden = true;

          this.img.removeAttribute('srcset');
          this.img.setAttribute('src', view.src);
          this.img.setAttribute('width', view.w);
          this.img.setAttribute('height', view.h);
          this.img.setAttribute(
            'alt',
            item.views.length > 1 ? this.getAttribute('data-label-alt').replace('[title]', item.t).replace('[side]', view.label.toLowerCase()) : item.t
          );
          if (this.warmed) this.warm();

          this.querySelector('[data-lupa-title]').textContent = item.t;
          this.querySelector('[data-lupa-price]').textContent = item.price;
          this.querySelector('[data-lupa-link]').setAttribute('href', item.url);

          this.views.innerHTML = '';
          this.views.hidden = item.views.length < 2;
          item.views.forEach(function (v, i) {
            self.views.appendChild(self.chip(self.uid + '-view', i, v.label, i === self.state.view));
          });

          this.spotsBox.innerHTML = '';
          this.list.innerHTML = '';
          var spotLabel = this.getAttribute('data-label-spot');
          view.spots.forEach(function (spot, i) {
            var pin = document.createElement('button');
            pin.type = 'button';
            pin.className = 'hi-lupa-spot';
            pin.style.left = spot.x + '%';
            pin.style.top = spot.y + '%';
            pin.textContent = i + 1;
            pin.setAttribute('aria-pressed', 'false');
            pin.setAttribute('aria-label', spotLabel.replace('[number]', i + 1).replace('[title]', spot.t));
            pin.addEventListener('click', function () {
              self.pickSpot(i);
            });
            self.spotsBox.appendChild(pin);

            var li = document.createElement('li');
            var row = document.createElement('button');
            row.type = 'button';
            row.className = 'hi-lupa-row';
            row.setAttribute('aria-pressed', 'false');
            var number = document.createElement('b');
            number.textContent = i + 1;
            var title = document.createElement('strong');
            title.textContent = spot.t;
            row.appendChild(number);
            row.appendChild(title);
            row.addEventListener('click', function () {
              self.pickSpot(i);
            });
            li.appendChild(row);
            self.list.appendChild(li);
          });
          if (!view.spots.length) {
            (item.details || []).forEach(function (text, i) {
              var li = document.createElement('li');
              var row = document.createElement('span');
              row.className = 'hi-lupa-row';
              var number = document.createElement('b');
              number.textContent = i + 1;
              var body = document.createElement('span');
              body.textContent = text;
              row.appendChild(number);
              row.appendChild(body);
              li.appendChild(row);
              self.list.appendChild(li);
            });
          }
          this.detail.textContent = this.getAttribute(view.spots.length ? 'data-label-spots' : 'data-label-plain');
          this.renderHint();
        }

        view() {
          var item = this.items[this.state.item];
          return item.views[this.state.view] || item.views[0];
        }

        // La foto en alta (2400 px) se baja cuando alguien llega a la foto, no al abrir la página.
        warm() {
          this.warmed = true;
          var src = this.view().zoom;
          if (this.warmSrc === src) return;
          this.warmSrc = src;
          new Image().src = src;
        }

        lensAt(fx, fy) {
          var rect = this.img.getBoundingClientRect();
          if (!rect.width) return;
          var zoom = this.state.zoom;
          this.lens.hidden = false;
          var size = this.lens.offsetWidth || 160;
          this.lens.style.left = fx * rect.width + 'px';
          this.lens.style.top = fy * rect.height + 'px';
          this.lens.style.backgroundImage = 'url("' + this.view().zoom + '"), url("' + (this.img.currentSrc || this.img.src) + '")';
          this.lens.style.backgroundSize = rect.width * zoom + 'px ' + rect.height * zoom + 'px';
          this.lens.style.backgroundPosition = -(fx * rect.width * zoom - size / 2) + 'px ' + -(fy * rect.height * zoom - size / 2) + 'px';
        }

        onPointer(event) {
          if (event.target.closest('.hi-lupa-spot')) return;
          var rect = this.img.getBoundingClientRect();
          var fx = (event.clientX - rect.left) / rect.width;
          var fy = (event.clientY - rect.top) / rect.height;
          if (fx < 0 || fx > 1 || fy < 0 || fy > 1) {
            if (this.state.spot < 0) this.lens.hidden = true;
            return;
          }
          holdRotation();
          this.lensAt(fx, fy);
        }

        pickSpot(i) {
          var spot = this.view().spots[i];
          if (!spot) return;
          this.state.spot = i;
          holdRotation();
          this.warm();
          this.lensAt(spot.x / 100, spot.y / 100);
          this.detail.textContent = i + 1 + '. ' + spot.t + (spot.d ? ': ' + spot.d : '');
          this.spotsBox.querySelectorAll('.hi-lupa-spot').forEach(function (pin, j) {
            pin.setAttribute('aria-pressed', j === i ? 'true' : 'false');
          });
          this.list.querySelectorAll('button').forEach(function (row, j) {
            row.setAttribute('aria-pressed', j === i ? 'true' : 'false');
          });
        }
      }
    );
  }

  /* ---------- Desliza: ¿te la pondrías? ---------- */

  // Las prendas salen una por una: a la derecha si te la pondrías, a la izquierda si no. Las favoritas se
  // guardan en el navegador (localStorage) y se agregan juntas al carrito.
  if (!customElements.get('hi-desliza')) {
    customElements.define(
      'hi-desliza',
      class extends HTMLElement {
        connectedCallback() {
          var dataEl = this.querySelector('[data-desliza-data]');
          if (!dataEl || this.products) return;
          try {
            this.products = JSON.parse(dataEl.textContent);
          } catch (e) {
            return;
          }
          var self = this;
          this.key = 'hight-favoritas';
          this.count = parseInt(this.getAttribute('data-count'), 10) || 10;
          this.deckEl = this.querySelector('[data-desliza-deck]');
          this.listEl = this.querySelector('[data-desliza-list]');
          this.byUrl = {};
          this.products.forEach(function (product) {
            self.byUrl[product.url] = product;
          });
          this.sizes = {};
          var stored = [];
          try {
            stored = JSON.parse(storageGet(this.key) || '[]');
          } catch (e) {
            stored = [];
          }
          this.favs = (Array.isArray(stored) ? stored : [])
            .map(function (url) {
              return self.byUrl[url];
            })
            .filter(Boolean);

          this.querySelector('[data-desliza-yes]').addEventListener('click', function () {
            self.decide(true);
          });
          this.querySelector('[data-desliza-no]').addEventListener('click', function () {
            self.decide(false);
          });
          this.deckEl.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowRight') {
              event.preventDefault();
              self.decide(true);
            } else if (event.key === 'ArrowLeft') {
              event.preventDefault();
              self.decide(false);
            }
          });
          this.querySelector('[data-desliza-reset]').addEventListener('click', function () {
            self.newDeck(true);
          });
          this.querySelector('[data-desliza-add]').addEventListener('click', this.add.bind(this));
          this.listEl.addEventListener('click', function (event) {
            var remove = event.target.closest('[data-fav-remove]');
            if (!remove) return;
            self.favs = self.favs.filter(function (product) {
              return product.url !== remove.getAttribute('data-fav-remove');
            });
            self.store();
            self.renderFavs();
          });
          this.listEl.addEventListener('change', function (event) {
            var select = event.target.closest('select[data-fav-size]');
            if (!select) return;
            self.sizes[select.getAttribute('data-fav-size')] = select.value;
            self.renderTotal();
          });
          this.newDeck(false);
        }

        isFav(url) {
          return this.favs.some(function (product) {
            return product.url === url;
          });
        }

        store() {
          storageSet(
            this.key,
            this.favs.length
              ? JSON.stringify(
                  this.favs.map(function (product) {
                    return product.url;
                  })
                )
              : null
          );
        }

        newDeck(clear) {
          var self = this;
          if (clear) {
            this.favs = [];
            this.store();
          }
          var pool = this.products.filter(function (product) {
            return !self.isFav(product.url);
          });
          for (var i = pool.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var swap = pool[i];
            pool[i] = pool[j];
            pool[j] = swap;
          }
          this.deck = pool.slice(0, this.count);
          this.deckSize = this.deck.length;
          this.renderDeck();
          this.renderFavs();
        }

        card(product, depth) {
          var card = document.createElement('article');
          card.className = 'hi-desliza-card' + (depth === 0 ? ' is-top' : '');
          card.style.setProperty('--depth', depth);
          if (depth > 0) card.setAttribute('aria-hidden', 'true');
          var media = document.createElement('div');
          media.className = 'hi-desliza-card-media';
          putImage(media, product, '(min-width: 990px) 320px, 76vw');
          var info = document.createElement('div');
          info.className = 'hi-desliza-card-info';
          if (product.colorName) {
            var chip = document.createElement('span');
            chip.className = 'hi-desliza-chip t-label';
            chip.style.setProperty('--c', product.color);
            chip.appendChild(document.createElement('i'));
            chip.appendChild(document.createTextNode(product.colorName));
            info.appendChild(chip);
          }
          var title = document.createElement('h4');
          title.className = 'hi-desliza-card-title';
          title.textContent = product.title;
          var meta = document.createElement('p');
          meta.className = 't-label';
          meta.textContent = formatMoney(product.cents) + ' · ' + product.type;
          info.appendChild(title);
          info.appendChild(meta);
          var yes = document.createElement('span');
          yes.className = 'hi-desliza-stamp is-yes';
          yes.setAttribute('aria-hidden', 'true');
          yes.textContent = this.getAttribute('data-label-yes');
          var no = document.createElement('span');
          no.className = 'hi-desliza-stamp is-no';
          no.setAttribute('aria-hidden', 'true');
          no.textContent = this.getAttribute('data-label-no');
          card.appendChild(media);
          card.appendChild(info);
          card.appendChild(yes);
          card.appendChild(no);
          return card;
        }

        renderDeck() {
          var self = this;
          var left = this.querySelector('[data-desliza-left]');
          this.deckEl.innerHTML = '';
          if (!this.deck.length) {
            var done = document.createElement('p');
            done.className = 'hi-desliza-done';
            done.textContent = this.getAttribute('data-label-empty');
            this.deckEl.appendChild(done);
            left.textContent = '';
            return;
          }
          this.deck
            .slice(0, 3)
            .map(function (product, depth) {
              return self.card(product, depth);
            })
            .reverse()
            .forEach(function (card) {
              self.deckEl.appendChild(card);
            });
          left.textContent = this.getAttribute('data-label-left')
            .replace('[count]', this.deck.length)
            .replace('[total]', this.deckSize);
          this.bindDrag(this.deckEl.querySelector('.is-top'));
        }

        decide(yes) {
          var self = this;
          var product = this.deck[0];
          var card = this.deckEl.querySelector('.hi-desliza-card.is-top');
          if (!product || !card || this.busy) return;
          holdRotation();
          var done = function () {
            self.busy = false;
            self.deck.shift();
            if (yes && !self.isFav(product.url)) {
              self.favs.push(product);
              self.store();
            }
            self.renderDeck();
            self.renderFavs();
          };
          if (!motionOK()) {
            done();
            return;
          }
          this.busy = true;
          card.style.transform = '';
          card.classList.add(yes ? 'is-yes' : 'is-no');
          setTimeout(done, 340);
        }

        bindDrag(card) {
          if (!card) return;
          var self = this;
          var startX = 0;
          var dx = 0;
          var dragging = false;
          var yes = card.querySelector('.hi-desliza-stamp.is-yes');
          var no = card.querySelector('.hi-desliza-stamp.is-no');
          card.addEventListener('pointerdown', function (event) {
            if (event.button !== 0 || self.busy) return;
            dragging = true;
            startX = event.clientX;
            dx = 0;
            if (card.setPointerCapture) card.setPointerCapture(event.pointerId);
            card.classList.add('is-drag');
          });
          card.addEventListener('pointermove', function (event) {
            if (!dragging) return;
            dx = event.clientX - startX;
            if (Math.abs(dx) > 4) holdRotation();
            card.style.transform = 'translateX(' + dx + 'px) rotate(' + dx * 0.06 + 'deg)';
            yes.style.opacity = String(clamp(dx / 90, 0, 1));
            no.style.opacity = String(clamp(-dx / 90, 0, 1));
          });
          var end = function () {
            if (!dragging) return;
            dragging = false;
            card.classList.remove('is-drag');
            if (dx > 90) self.decide(true);
            else if (dx < -90) self.decide(false);
            else {
              card.style.transform = '';
              yes.style.opacity = '';
              no.style.opacity = '';
            }
          };
          card.addEventListener('pointerup', end);
          card.addEventListener('pointercancel', end);
          card.addEventListener('dragstart', function (event) {
            event.preventDefault();
          });
        }

        renderFavs() {
          var self = this;
          this.querySelector('[data-desliza-count]').textContent = '(' + this.favs.length + ')';
          this.querySelector('[data-desliza-empty]').hidden = this.favs.length > 0;
          this.listEl.innerHTML = '';
          this.favs.forEach(function (product) {
            var li = document.createElement('li');
            li.className = 'hi-desliza-fav';
            var media = document.createElement('a');
            media.className = 'hi-desliza-fav-media hi-print';
            media.href = product.url;
            media.setAttribute('tabindex', '-1');
            media.setAttribute('aria-hidden', 'true');
            putImage(media, product, '120px');
            var name = document.createElement('a');
            name.className = 'hi-desliza-fav-name';
            name.href = product.url;
            name.textContent = product.title;
            var remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'hi-desliza-fav-remove';
            remove.setAttribute('data-fav-remove', product.url);
            remove.setAttribute('aria-label', self.getAttribute('data-label-remove').replace('[title]', product.title));
            remove.textContent = '×';
            li.appendChild(media);
            li.appendChild(name);
            if (product.sizes && product.sizes.length > 1) {
              var wrap = document.createElement('div');
              wrap.className = 'hi-select-wrap hi-desliza-fav-size';
              var select = document.createElement('select');
              select.className = 'hi-select';
              select.setAttribute('data-fav-size', product.url);
              fillSizes(select, product, self.getAttribute('data-label-size'));
              if (self.sizes[product.url]) select.value = self.sizes[product.url];
              wrap.appendChild(select);
              li.appendChild(wrap);
            }
            li.appendChild(remove);
            self.listEl.appendChild(li);
          });
          this.renderTotal();
        }

        chosen() {
          var self = this;
          return this.favs.map(function (product) {
            return chosenVariant(product, self.listEl.querySelector('select[data-fav-size="' + CSS.escape(product.url) + '"]'));
          });
        }

        renderTotal() {
          var total = this.chosen().reduce(function (sum, item) {
            return sum + item.cents;
          }, 0);
          this.querySelector('[data-desliza-total]').textContent = formatMoney(total);
        }

        add() {
          var button = this.querySelector('[data-desliza-add]');
          if (button.classList.contains('is-loading')) return;
          if (!this.favs.length) {
            toast(this.getAttribute('data-label-need'));
            return;
          }
          var items = this.chosen().map(function (item) {
            return { id: item.id, quantity: 1 };
          });
          var message = this.getAttribute('data-label-added');
          button.classList.add('is-loading');
          button.setAttribute('aria-busy', 'true');
          Cart.addItems(items)
            .then(function (data) {
              cartAdded(data, message);
            })
            .catch(function (error) {
              toast(error.message || strings.error);
            })
            .finally(function () {
              button.classList.remove('is-loading');
              button.removeAttribute('aria-busy');
            });
        }
      }
    );
  }

  /* ---------- Rotación de estilo ---------- */

  // El turno sale de la hora (window.HightRotation, snippets/rotation-data.liquid): cambia justo al
  // empezar cada minuto, en el mismo orden y a la vez para todos. Cada cambio se programa contra el reloj,
  // así que no se atrasa. Aquí van los cambios siguientes, el control para pausar, la agenda de turnos y la
  // espera mientras alguien usa el probador, la lupa o Desliza.
  (function () {
    var R = window.HightRotation;
    if (!R || R.mode !== 'live' || !R.turns || R.turns.length < 2) return;

    var root = document.documentElement;
    var pausedKey = 'hight-rotation-paused';
    var offsetKey = 'hight-rotation-offset';
    var stages = Array.prototype.slice.call(document.querySelectorAll('[data-rotation-stage]'));
    var pill = document.querySelector('[data-rotation-pill]');
    var label = pill && pill.querySelector('[data-rotation-label]');
    var name = pill && pill.querySelector('[data-rotation-name]');
    var time = pill && pill.querySelector('[data-rotation-time]');
    var toggle = pill && pill.querySelector('[data-rotation-toggle]');
    var auto = pill && pill.querySelector('[data-rotation-auto]');
    var sync = pill && pill.querySelector('[data-rotation-sync]');
    var agenda = document.querySelector('[data-rotation-agenda]');
    var agendaList = agenda && agenda.querySelector('[data-agenda-list]');
    var agendaNote = agenda && agenda.querySelector('[data-agenda-note]');
    var allHref = name && name.getAttribute('href');
    var sizes = stages.length ? R.sizes(stages[0]) : '';
    var lang = root.getAttribute('lang') || 'es';
    var timer = 0;
    var fadeTimer = 0;
    var holdTimer = 0;
    var holdUntil = 0;
    var waiting = false;

    function untilNext() {
      return R.ms - (Date.now() % R.ms);
    }

    function preload(index) {
      var turn = R.turns[index];
      (turn.pieces || []).forEach(function (piece) {
        var img = new Image();
        img.sizes = sizes;
        img.srcset = piece.srcset;
        img.src = piece.src;
      });
      if (turn.texture) new Image().src = turn.texture;
    }

    // Transición de CSS (hight.css, html.hi-accent-fade) y no de vista: la página sigue tomando clics.
    function paint(turn, animate) {
      clearTimeout(fadeTimer);
      root.classList.toggle('hi-accent-fade', !!animate);
      root.style.setProperty('--accent', turn.color);
      root.style.setProperty('--on-accent', turn.on);
      if (animate) {
        fadeTimer = setTimeout(function () {
          root.classList.remove('hi-accent-fade');
        }, 1000);
      }
    }

    function swap(stage, index, animate) {
      R.texture(stage, index, animate);
      if (!stage.hasAttribute('data-rotation-pieces')) return;
      if (!animate) {
        R.pieces(stage, index);
        return;
      }
      stage.classList.add('is-swapping');
      setTimeout(function () {
        R.pieces(stage, index);
        stage.classList.remove('is-swapping');
      }, 320);
    }

    // La cinta mide su ancho para dar la vuelta sin saltos; los nombres de los colores lo cambian.
    function measureMarquees() {
      Array.prototype.forEach.call(document.querySelectorAll('hi-marquee'), function (marquee) {
        if (marquee.track && marquee.measure && marquee.querySelector('[data-turn-template]')) marquee.measure();
      });
    }

    // Prendas, textura y textos del turno (cinta, inicio, agenda). El probador escucha hight:turn.
    function showGarments(index, animate) {
      R.shown = index;
      stages.forEach(function (stage) {
        swap(stage, index, animate);
      });
      R.text(document, index);
      measureMarquees();
      renderAgenda();
      preload((index + 1) % R.turns.length);
      document.dispatchEvent(new CustomEvent('hight:turn', { detail: { index: index, turn: R.turns[index] } }));
    }

    function show(index, animate) {
      if (index === R.shown && R.painted) return;
      R.painted = true;
      paint(R.turns[index], animate);
      showGarments(index, animate);
      render();
    }

    function setState(state) {
      R.state = state;
      if (state !== 'live') waiting = false;
      root.setAttribute('data-rotation', state);
      render();
    }

    function clock() {
      if (!time || R.state !== 'live' || waiting) return;
      var seconds = Math.ceil(untilNext() / 1000);
      var text = Math.floor(seconds / 60) + ':' + ('0' + (seconds % 60)).slice(-2);
      time.textContent = text;
      time.setAttribute('aria-label', (pill.getAttribute('data-label-next') || '').replace('[time]', text));
    }

    function render() {
      if (!pill) return;
      var own = R.state === 'own' && R.pick;
      var turn = R.turns[R.shown] || R.turns[0];
      var match = own ? R.find(R.pick.color) : R.shown;
      pill.style.setProperty('--dot', own ? R.pick.color : turn.color);
      var key = 'data-label-own';
      if (R.state === 'live') key = waiting ? 'data-label-waiting' : 'data-label-now';
      else if (R.state === 'paused') key = 'data-label-paused';
      label.textContent = pill.getAttribute(key);
      name.textContent = own ? R.pick.name || turn.name : turn.name;
      if (name.tagName === 'A') name.setAttribute('href', match > -1 ? R.turns[match].url : allHref);
      time.hidden = R.state !== 'live' || waiting;
      toggle.hidden = R.state === 'own';
      auto.hidden = R.state !== 'own';
      if (sync) sync.hidden = R.state === 'own' || !R.offset;
      toggle.setAttribute('aria-pressed', R.state === 'paused' ? 'true' : 'false');
      toggle.setAttribute('aria-label', pill.getAttribute(R.state === 'paused' ? 'data-label-resume' : 'data-label-pause'));
      clock();
    }

    // Agenda: los próximos turnos con su hora. El primero es el de ahora; tocar uno lo muestra de una vez.
    function renderAgenda() {
      if (!agendaList) return;
      var n = R.turns.length;
      var base = Math.floor(Date.now() / R.ms);
      var withSeconds = R.ms % 60000 !== 0;
      var jumpLabel = agendaList.getAttribute('data-label-jump') || '';
      agendaList.innerHTML = '';
      for (var i = 0; i < n; i++) {
        var index = (((base + i + R.offset) % n) + n) % n;
        var turn = R.turns[index];
        var at = new Date((base + i) * R.ms).toLocaleTimeString(lang, {
          hour: '2-digit',
          minute: '2-digit',
          second: withSeconds ? '2-digit' : undefined,
          hour12: false
        });
        var li = document.createElement('li');
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'hi-agenda-item';
        button.setAttribute('data-agenda-index', index);
        button.setAttribute('aria-label', jumpLabel.replace('[name]', turn.name).replace('[time]', at));
        if (index === R.shown && (R.state !== 'own' || R.find(R.pick && R.pick.color) === index)) {
          button.setAttribute('aria-current', 'true');
        }
        var when = document.createElement('time');
        when.textContent = i === 0 ? agendaList.getAttribute('data-label-now') : at;
        var who = document.createElement('span');
        who.className = 'hi-agenda-who';
        var dot = document.createElement('i');
        dot.style.setProperty('--c', turn.color);
        who.appendChild(dot);
        who.appendChild(document.createTextNode(turn.name));
        button.appendChild(when);
        button.appendChild(who);
        li.appendChild(button);
        agendaList.appendChild(li);
      }
      if (agendaNote) agendaNote.hidden = !R.offset;
      agenda.hidden = false;
    }

    function setOffset(value) {
      R.offset = value;
      sessionSet(offsetKey, value ? String(value) : null);
    }

    // Ver un turno de la agenda ya: la tienda sigue rotando desde ahí, corrida frente a la hora.
    function jump(target) {
      var n = R.turns.length;
      setOffset((((target - Math.floor(Date.now() / R.ms)) % n) + n) % n);
      if (R.state === 'own') {
        Accent.reset();
        return;
      }
      waiting = false;
      if (R.state === 'paused') storageSet(pausedKey, String(target));
      R.painted = false;
      show(target, motionOK());
    }

    // Volver a la hora: el mismo turno que ven todos, y sin pausa.
    function resync() {
      setOffset(0);
      storageSet(pausedKey, null);
      waiting = false;
      if (R.state !== 'own') setState('live');
      R.painted = false;
      if (R.state === 'live') show(R.index(Date.now()), motionOK());
      else renderAgenda();
    }

    // Mientras alguien usa el probador, la lupa o Desliza, el cambio espera hasta 4 s después del último gesto.
    R.hold = function () {
      holdUntil = Date.now() + 4000;
    };

    function tick() {
      if (R.state !== 'live') return;
      var index = R.index(Date.now());
      if (index === R.shown && R.painted) {
        if (waiting) {
          waiting = false;
          render();
        }
        return;
      }
      var wait = holdUntil - Date.now();
      if (wait > 0) {
        if (!waiting) {
          waiting = true;
          render();
        }
        clearTimeout(holdTimer);
        holdTimer = setTimeout(tick, wait + 30);
        return;
      }
      waiting = false;
      show(index, motionOK());
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        tick();
        renderAgenda();
        schedule();
      }, untilNext() + 30);
    }

    if (pill) {
      toggle.addEventListener('click', function () {
        if (R.state === 'live') {
          storageSet(pausedKey, String(R.shown));
          setState('paused');
          renderAgenda();
        } else if (R.state === 'paused') {
          storageSet(pausedKey, null);
          setState('live');
          show(R.index(Date.now()), motionOK());
        }
      });
      auto.addEventListener('click', function () {
        Accent.reset();
      });
      pill.hidden = false;
    }

    document.querySelectorAll('[data-rotation-sync]').forEach(function (button) {
      button.addEventListener('click', resync);
    });

    if (agendaList) {
      agendaList.addEventListener('click', function (event) {
        var item = event.target.closest('[data-agenda-index]');
        if (item) jump(parseInt(item.getAttribute('data-agenda-index'), 10));
      });
    }

    // Elige tu color: el color que el visitante escoge manda; al volver al original, la tienda sigue sola.
    document.addEventListener('hight:accent', function (event) {
      if (event.detail) {
        R.pick = event.detail;
        setState('own');
        var match = R.find(event.detail.color);
        if (match > -1 && match !== R.shown) showGarments(match, motionOK());
        else renderAgenda();
      } else {
        R.pick = null;
        storageSet(pausedKey, null);
        setState('live');
        // Accent.reset quita el color dentro de una transición de vista: el turno se pinta en otra para que
        // quede después de esa (y con el turno de ese momento, por si justo cambió el minuto).
        withTransition(function () {
          R.painted = false;
          show(R.index(Date.now()), false);
        });
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      if (R.state === 'live') {
        waiting = false;
        show(R.index(Date.now()), false);
      }
      renderAgenda();
      schedule();
    });

    R.painted = R.state === 'live';
    render();
    renderAgenda();
    schedule();
    // Si el turno cambió mientras cargaba la página (entre el primer color y este archivo), se pone al día ya.
    tick();
    preload((R.shown + 1) % R.turns.length);
    setTimeout(function () {
      clock();
      setInterval(clock, 1000);
    }, 1000 - (Date.now() % 1000) + 10);
  })();

  /* ---------- Colores de la colección: el color actual a la vista en el teléfono ---------- */

  document.querySelectorAll('.hi-color-nav-list').forEach(function (list) {
    var current = list.querySelector('[aria-current]');
    if (!current || list.scrollWidth <= list.clientWidth) return;
    var offset = current.getBoundingClientRect().left - list.getBoundingClientRect().left;
    list.scrollLeft += offset - (list.clientWidth - current.offsetWidth) / 2;
  });

  /* ---------- Anatomía de una pieza (puntos sobre la foto) ---------- */

  if (!customElements.get('hi-hotspots')) {
    customElements.define(
      'hi-hotspots',
      class extends HTMLElement {
        connectedCallback() {
          this.pins = Array.prototype.slice.call(this.querySelectorAll('[data-spot]'));
          this.items = Array.prototype.slice.call(this.querySelectorAll('[data-spot-item]'));
          if (!this.items.length) return;
          var self = this;

          this.pins.forEach(function (pin) {
            var id = pin.getAttribute('data-spot');
            pin.addEventListener('click', function () {
              self.open(id, true);
            });
            pin.addEventListener('mouseenter', function () {
              self.highlight(id);
            });
            pin.addEventListener('mouseleave', function () {
              self.highlight(self.openId);
            });
          });

          this.querySelectorAll('[data-spot-toggle]').forEach(function (toggle) {
            var id = toggle.getAttribute('data-spot-toggle');
            toggle.addEventListener('click', function () {
              self.open(self.openId === id ? null : id, false);
            });
            toggle.addEventListener('mouseenter', function () {
              self.highlight(id);
            });
            toggle.addEventListener('mouseleave', function () {
              self.highlight(self.openId);
            });
          });

          this.open(this.items[0].getAttribute('data-spot-item'), false);
        }

        open(id, fromPin) {
          this.openId = id;
          this.items.forEach(function (item) {
            var on = item.getAttribute('data-spot-item') === id;
            item.classList.toggle('is-open', on);
            var toggle = item.querySelector('[data-spot-toggle]');
            if (toggle) toggle.setAttribute('aria-expanded', on ? 'true' : 'false');
          });
          this.pins.forEach(function (pin) {
            pin.setAttribute('aria-expanded', pin.getAttribute('data-spot') === id ? 'true' : 'false');
          });
          this.highlight(id);

          if (fromPin && id && window.innerWidth < 990) {
            var item = this.items.find(function (el) {
              return el.getAttribute('data-spot-item') === id;
            });
            if (item) item.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
          }
        }

        highlight(id) {
          this.pins.forEach(function (pin) {
            pin.classList.toggle('is-active', pin.getAttribute('data-spot') === id);
          });
          this.items.forEach(function (item) {
            item.classList.toggle('is-active', item.getAttribute('data-spot-item') === id);
          });
        }
      }
    );
  }

  /* ---------- Archivo: la foto sigue al cursor ---------- */

  if (!customElements.get('hi-reveal-list')) {
    customElements.define(
      'hi-reveal-list',
      class extends HTMLElement {
        connectedCallback() {
          this.float = this.querySelector('[data-reveal-float]');
          if (!this.float || !finePointer()) return;
          this.img = document.createElement('img');
          this.img.alt = '';
          this.img.width = 700;
          this.img.height = 875;
          this.img.decoding = 'async';
          this.float.appendChild(this.img);
          this.x = 0;
          this.y = 0;
          this.tx = 0;
          this.ty = 0;
          this.rotation = -3;
          this.shown = false;

          var self = this;
          this.querySelectorAll('[data-reveal-src]').forEach(function (link) {
            link.addEventListener('mouseenter', function (event) {
              self.show(link, event);
            });
            link.addEventListener('mouseleave', function () {
              self.hide();
            });
          });
          this.addEventListener('mousemove', function (event) {
            self.aim(event);
            if (!self.raf) self.raf = requestAnimationFrame(self.loop.bind(self));
          });
        }

        aim(event) {
          var width = this.float.offsetWidth || 280;
          var height = this.float.offsetHeight || 350;
          var x = event.clientX + 32;
          if (x + width > window.innerWidth - 16) x = event.clientX - width - 32;
          this.tx = x;
          this.ty = clamp(event.clientY - height / 2, 16, window.innerHeight - height - 16);
        }

        show(link, event) {
          var src = link.getAttribute('data-reveal-src');
          if (this.img.getAttribute('src') !== src) this.img.src = src;
          this.rotation = Math.random() * 10 - 5;
          this.aim(event);
          if (!this.shown) {
            this.x = this.tx;
            this.y = this.ty;
          }
          this.shown = true;
          this.float.classList.add('is-visible');
          if (!this.raf) this.raf = requestAnimationFrame(this.loop.bind(this));
        }

        hide() {
          this.shown = false;
          this.float.classList.remove('is-visible');
        }

        loop() {
          var ease = reducedMotion() ? 1 : 0.16;
          this.x += (this.tx - this.x) * ease;
          this.y += (this.ty - this.y) * ease;
          this.float.style.transform =
            'translate3d(' + this.x.toFixed(1) + 'px,' + this.y.toFixed(1) + 'px,0) rotate(' + this.rotation.toFixed(1) + 'deg)';
          if (Math.abs(this.tx - this.x) > 0.4 || Math.abs(this.ty - this.y) > 0.4) {
            this.raf = requestAnimationFrame(this.loop.bind(this));
          } else {
            this.raf = null;
          }
        }
      }
    );
  }

  /* ---------- Manifiesto: el texto se enciende con el scroll ---------- */

  if (!customElements.get('hi-scroll-text')) {
    customElements.define(
      'hi-scroll-text',
      class extends HTMLElement {
        connectedCallback() {
          if (!this.classList.contains('is-fill') || !motionOK() || this.words) return;
          this.words = this.wrapWords();
          if (!this.words.length) return;
          this.lit = -1;
          this.classList.add('is-live');
          var self = this;
          this.onScroll = function () {
            if (self.ticking) return;
            self.ticking = true;
            requestAnimationFrame(function () {
              self.ticking = false;
              self.update();
            });
          };
          window.addEventListener('scroll', this.onScroll, { passive: true });
          window.addEventListener('resize', this.onScroll);
          this.update();
        }

        disconnectedCallback() {
          if (!this.onScroll) return;
          window.removeEventListener('scroll', this.onScroll);
          window.removeEventListener('resize', this.onScroll);
        }

        wrapWords() {
          var walker = document.createTreeWalker(this, NodeFilter.SHOW_TEXT);
          var nodes = [];
          while (walker.nextNode()) nodes.push(walker.currentNode);
          var words = [];
          nodes.forEach(function (node) {
            if (!node.textContent.trim()) return;
            var fragment = document.createDocumentFragment();
            node.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) {
                fragment.appendChild(document.createTextNode(part));
              } else {
                var span = document.createElement('span');
                span.className = 'hi-w';
                span.textContent = part;
                fragment.appendChild(span);
                words.push(span);
              }
            });
            node.parentNode.replaceChild(fragment, node);
          });
          return words;
        }

        update() {
          var rect = this.getBoundingClientRect();
          var vh = window.innerHeight;
          var start = vh * 0.88;
          var end = vh * 0.38;
          var progress = clamp((start - rect.top) / (rect.height + start - end), 0, 1);
          var lit = Math.round(progress * this.words.length);
          if (lit === this.lit) return;
          this.lit = lit;
          this.words.forEach(function (word, i) {
            word.classList.toggle('is-lit', i < lit);
          });
        }
      }
    );
  }

  /* ---------- Aparición al hacer scroll ---------- */

  var revealObserver = null;

  function initReveal(root) {
    if (!motionOK() || !('IntersectionObserver' in window)) return;
    if (!revealObserver) {
      revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-in');
            revealObserver.unobserve(entry.target);
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.04 }
      );
    }
    var vh = window.innerHeight;
    (root || document).querySelectorAll('[data-reveal]:not(.is-in)').forEach(function (el) {
      var rect = el.getBoundingClientRect();
      if (rect.top < vh * 0.96 && rect.bottom > 0) el.classList.add('is-in');
      else revealObserver.observe(el);
    });
    document.documentElement.classList.add('hi-reveal-ready');
  }

  /* ---------- Tarjetas que se inclinan con el cursor ---------- */

  (function () {
    if (!config.cardTilt || !motionOK() || !finePointer()) return;
    var current = null;

    function reset(el) {
      el.classList.remove('is-tilting');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    }

    document.addEventListener(
      'pointermove',
      function (event) {
        var el = event.target.closest && event.target.closest('[data-tilt]');
        if (el !== current) {
          if (current) reset(current);
          current = el;
        }
        if (!el) return;
        var rect = el.getBoundingClientRect();
        var nx = (event.clientX - rect.left) / rect.width - 0.5;
        var ny = (event.clientY - rect.top) / rect.height - 0.5;
        el.classList.add('is-tilting');
        el.style.setProperty('--ry', (nx * 10).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (ny * -10).toFixed(2) + 'deg');
      },
      { passive: true }
    );

    document.documentElement.addEventListener('pointerleave', function () {
      if (current) reset(current);
      current = null;
    });
  })();

  /* ---------- Etiqueta junto al cursor (VER, ARRASTRA) ---------- */

  (function () {
    if (!config.cursorLabel || !finePointer()) return;
    var el = document.createElement('div');
    el.className = 'hi-cursor';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    var x = -200;
    var y = -200;
    var tx = -200;
    var ty = -200;
    var raf = null;
    var label = '';

    function loop() {
      var ease = reducedMotion() ? 1 : 0.3;
      x += (tx - x) * ease;
      y += (ty - y) * ease;
      el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      raf = Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3 ? requestAnimationFrame(loop) : null;
    }

    document.addEventListener(
      'pointermove',
      function (event) {
        if (event.pointerType && event.pointerType !== 'mouse') return;
        tx = event.clientX + 18;
        ty = event.clientY + 20;
        var target = event.target.closest && event.target.closest('[data-cursor]');
        var next = target ? target.getAttribute('data-cursor') : '';
        if (document.querySelector('dialog[open]') && target && !target.closest('dialog')) next = '';
        if (next !== label) {
          label = next;
          if (label) el.textContent = label;
          el.classList.toggle('is-on', !!label);
          if (label && x < -100) {
            x = tx;
            y = ty;
          }
        }
        if (!raf) raf = requestAnimationFrame(loop);
      },
      { passive: true }
    );

    document.documentElement.addEventListener('pointerleave', function () {
      label = '';
      el.classList.remove('is-on');
    });
  })();

  /* ---------- Videos en bucle: no arrancan solos si se pide menos movimiento; el de campaña se pausa con su botón ---------- */

  function initVideos(root) {
    if (reducedMotion()) {
      root.querySelectorAll('video[autoplay]').forEach(function (video) {
        video.removeAttribute('autoplay');
        video.pause();
      });
    }
    root.querySelectorAll('[data-video-toggle]').forEach(function (button) {
      var video = button.parentElement.querySelector('video');
      if (!video) {
        button.hidden = true;
        return;
      }
      function sync() {
        button.classList.toggle('is-paused', video.paused);
        button.setAttribute('aria-label', button.getAttribute(video.paused ? 'data-label-play' : 'data-label-pause'));
      }
      video.addEventListener('play', sync);
      video.addEventListener('pause', sync);
      button.addEventListener('click', function () {
        if (video.paused) video.play().catch(function () {});
        else video.pause();
      });
      sync();
    });
  }

  /* ---------- Inicio y editor de temas ---------- */

  initReveal(document);
  initDensity(document);
  initVideos(document);

  document.addEventListener('shopify:section:load', function (event) {
    initReveal(event.target);
    initDensity(event.target);
    initVideos(event.target);
  });
})();
