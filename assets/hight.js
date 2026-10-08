/*
 * Hight — comportamiento del tema.
 * Sin dependencias. Todo funciona sin JavaScript (formularios normales); esto agrega el carrito
 * lateral, el selector de variantes, la galería deslizable, la búsqueda predictiva y los diálogos.
 */
(function () {
  'use strict';

  var configEl = document.getElementById('HightConfig');
  var config = configEl ? JSON.parse(configEl.textContent) : { routes: {}, strings: {} };
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

  function toast(text, actionLabel, onAction) {
    var region = document.querySelector('[data-toast-region]');
    if (!region) return;
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

  /* ---------- Diálogos (drawers y modales con <dialog>) ---------- */

  function openDialog(id, opener) {
    var dialog = document.getElementById(id);
    if (!dialog || typeof dialog.showModal !== 'function') return false;
    if (!dialog.open) {
      dialog._opener = opener || document.activeElement;
      dialog.showModal();
      dialog.dispatchEvent(new CustomEvent('hight:open'));
    }
    return true;
  }

  function closeDialog(dialog) {
    if (dialog && dialog.open) dialog.close();
  }

  document.addEventListener('click', function (event) {
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
      if (dialog.tagName === 'DIALOG' && dialog._opener && document.contains(dialog._opener)) {
        dialog._opener.focus({ preventScroll: true });
      }
    },
    true
  );

  // Menús desplegables del header: uno abierto a la vez, se cierran al salir.
  document.addEventListener('click', function (event) {
    document.querySelectorAll('[data-nav-details][open]').forEach(function (details) {
      if (!details.contains(event.target)) details.removeAttribute('open');
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('[data-nav-details][open]').forEach(function (details) {
      details.removeAttribute('open');
      var summary = details.querySelector('summary');
      if (summary) summary.focus();
    });
  });

  /* ---------- Cantidad ---------- */

  if (!customElements.get('quantity-input')) {
    customElements.define(
      'quantity-input',
      class extends HTMLElement {
        connectedCallback() {
          this.input = this.querySelector('input');
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

    add: function (form) {
      var body = new FormData(form);
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
            var error = new Error(data.description || data.message || strings.error);
            throw error;
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

  /* ---------- Formulario de producto ---------- */

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
          var button = this.form.querySelector('[data-add-button]');
          var errorEl = this.form.querySelector('[data-product-error]');
          if (!button || button.disabled) return;
          button.classList.add('is-loading');
          button.setAttribute('aria-busy', 'true');
          if (errorEl) errorEl.textContent = '';

          Cart.add(this.form)
            .then(function (data) {
              Cart.renderSections(data.sections);
              if (!Cart.open()) toast(strings.added, strings.viewCart, Cart.open);
            })
            .catch(function (error) {
              if (errorEl) errorEl.textContent = error.message || strings.error;
            })
            .finally(function () {
              button.classList.remove('is-loading');
              button.removeAttribute('aria-busy');
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
          if (start > 1) {
            var slide = this.slides[start - 1];
            this.track.scrollLeft = slide.offsetLeft;
          }
        }

        goTo(mediaId, instant) {
          var slide = this.slides.find(function (s) {
            return s.getAttribute('data-media-id') === String(mediaId);
          });
          if (!slide) return;
          var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          this.track.scrollTo({ left: slide.offsetLeft, behavior: instant || reduce ? 'auto' : 'smooth' });
        }

        sync() {
          var index = Math.round(this.track.scrollLeft / this.track.clientWidth);
          index = Math.max(0, Math.min(this.slides.length - 1, index));
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

  /* ---------- Variantes: color y talla ---------- */

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
          var button = this.querySelector('[data-add-button]');

          if (!variant) {
            if (button) {
              button.disabled = true;
              button.textContent = strings.unavailable;
            }
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
                var current = self.querySelector(selector);
                if (next && current) current.innerHTML = next.innerHTML;
              });

              var nextButton = doc.querySelector('[data-add-button]');
              var button = self.querySelector('[data-add-button]');
              if (nextButton && button) {
                button.disabled = nextButton.disabled;
                button.innerHTML = nextButton.innerHTML;
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
                  if (next && next.innerHTML.trim().length) self.innerHTML = next.innerHTML;
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
          if (!this.input || this.getAttribute('data-enabled') !== 'true' || !routes.predictiveSearch) return;
          this.input.addEventListener('input', debounce(this.onInput.bind(this), 250));

          var dialog = this.closest('dialog');
          var input = this.input;
          if (dialog) {
            dialog.addEventListener('hight:open', function () {
              input.focus();
            });
          }
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
})();
