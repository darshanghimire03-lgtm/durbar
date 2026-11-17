const ModelsSheet = (() => {
  const PROVIDERS = { groq: 'Groq', gemini: 'Gemini', openrouter: 'OpenRouter' };
  let wrap = null;
  let loading = null;

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function close() {
    if (wrap) wrap.hidden = true;
  }

  function mount() {
    if (wrap) return Promise.resolve(wrap);
    if (loading) return loading;
    loading = fetch('models-sheet.html')
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(html => {
        const holder = document.createElement('div');
        holder.innerHTML = html.trim();
        wrap = holder.firstElementChild;
        document.body.appendChild(wrap);
        wrap.addEventListener('click', e => {
          if (e.target === wrap || e.target.closest('#sheetClose')) close();
        });
        document.addEventListener('keydown', e => {
          if (e.key === 'Escape' && !wrap.hidden) close();
        });
        return wrap;
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  }

  async function open(options) {
    const root = await mount();
    const list = root.querySelector('#models');
    list.innerHTML = '';
    options.models.forEach(model => {
      const provider = PROVIDERS[model.provider] || model.provider || '';
      const sub = model.description ? provider + ' • ' + model.description : provider;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'mo' + (model.id === options.selectedId ? ' on' : '');
      row.innerHTML =
        '<div><b>' + esc(model.label || model.id) + '</b><small>' + esc(sub) + '</small></div>' +
        '<svg class="i"><use href="#i-check"/></svg>';
      row.addEventListener('click', () => {
        close();
        options.onSelect(model);
      });
      list.appendChild(row);
    });
    root.hidden = false;
  }

  return { open, close };
})();