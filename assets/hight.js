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

  /* ---------- Menú: foto al pasar por cada enlace ---------- */

  function activateMenuPreview(link) {
    var menu = link.closest('dialog');
    if (!menu) return;
    var id = link.getAttribute('data-menu-preview');
    menu.querySelectorAll('.hi-menu-preview').forEach(function (figure) {
      figure.classList.toggle('is-active', figure.id === id);
    });
    menu.querySelectorAll('.hi-menu-link').forEach(function (other) {
      other.classList.toggle('is-active', other === link);
    });
  }

  document.addEventListener('pointerover', function (event) {
    var link = event.target.closest && event.target.closest('[data-menu-preview]');
    if (link) activateMenuPreview(link);
  });

  document.addEventListener('focusin', function (event) {
    var link = event.target.closest && event.target.closest('[data-menu-preview]');
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
            current.innerHTML = next.innerHTML;
            current.setAttribute('data-cart-count', next.getAttribute('data-cart-count'));
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
          currentPage.innerHTML = nextPage.innerHTML;
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

    change: function (line, quantity) {
      return fetch(routes.cartChange + '.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          line: line,
          quantity: quantity,
          sections: Cart.sectionsToRender(),
          sections_url: window.location.pathname
        })
      }).then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok || data.status) throw new Error(data.description || data.message || strings.error);
          return data;
        });
      });
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
    var line = parseInt(lineEl.getAttribute('data-cart-line'), 10);
    lineEl.classList.add('is-updating');
    Cart.change(line, quantity)
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

  var onLineQuantity = debounce(function (input) {
    var quantity = parseInt(input.value, 10);
    if (isNaN(quantity) || quantity < 0) return;
    updateLine(lineFromEvent(input), quantity);
  }, 350);

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
        }

        onSubmit(event) {
          if (config.cartType !== 'drawer' || !Cart.drawer()) return; // envío normal a la página del carrito
          event.preventDefault();
          var button = event.submitter || this.form.querySelector('[data-add-button]');
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

          if (!variant) {
            this.setButtons(true, strings.unavailable);
            return;
          }

          if (idInput) idInput.value = variant.id;
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
              ['[data-product-price]', '[data-variant-picker]', '[data-product-stock]', '[data-size-guide]'].forEach(function (selector) {
                var next = doc.querySelector(selector);
                if (!next) return;
                self.querySelectorAll(selector).forEach(function (current) {
                  current.innerHTML = next.innerHTML;
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

  var Accent = {
    key: 'hight-accent',

    current: function () {
      try {
        return JSON.parse(storageGet(Accent.key) || 'null');
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
      if (config.visitorAccent) storageSet(Accent.key, JSON.stringify({ color: color, on: on, name: name }));
      document.dispatchEvent(new CustomEvent('hight:accent', { detail: { color: color, on: on, name: name } }));
    },

    reset: function () {
      var root = document.documentElement;
      withTransition(function () {
        root.style.removeProperty('--accent');
        root.style.removeProperty('--on-accent');
      });
      storageSet(Accent.key, null);
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

  /* ---------- Inicio y editor de temas ---------- */

  initReveal(document);
  initDensity(document);

  document.addEventListener('shopify:section:load', function (event) {
    initReveal(event.target);
    initDensity(event.target);
  });
})();
