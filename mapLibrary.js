// Shared local map-folder picker. Keep identical in Battle and MapEditor.
(() => {
  'use strict';
  const mode = { mode: 'read' };
  async function storedFolder(key, value) {
    if (!window.indexedDB) return null;
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('kanneghem-map-folders', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('folders');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('folders', value === undefined ? 'readonly' : 'readwrite');
        const request = value === undefined ? tx.objectStore('folders').get(key) : tx.objectStore('folders').put(value, key);
        tx.oncomplete = () => resolve(value === undefined ? request.result : true);
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }
  async function scan(handle, prefix = '') {
    const files = [];
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === 'directory') files.push(...await scan(entry, `${prefix}${name}/`));
      else if (/\.json$/i.test(name)) files.push({ path: prefix + name, getFile: () => entry.getFile() });
    }
    return files;
  }
  window.MapLibrary = {
    mount({ host, storageKey, onLoad, isBusy = () => false }) {
      const root = document.createElement('div');
      root.className = 'map-library';
      root.innerHTML = '<button type="button" id="choose-map-folder">Выбрать папку</button>'
        + '<select id="map-library-select" aria-label="Карты в выбранной папке" disabled><option value="">Выберите папку с картами</option></select>'
        + '<button type="button" id="load-library-map" disabled>Загрузить</button>'
        + '<button type="button" id="refresh-map-folder" title="Обновить список карт" aria-label="Обновить список карт" disabled>↻</button>'
        + '<button type="button" id="map-library-access" hidden>Разрешить доступ</button>'
        + '<input type="file" id="map-folder-input" webkitdirectory multiple hidden>'
        + '<span id="map-library-status" role="status" aria-live="polite"></span>';
      host.appendChild(root);
      const find = id => root.querySelector(`#${id}`);
      const choose = find('choose-map-folder'), select = find('map-library-select'), load = find('load-library-map');
      const refresh = find('refresh-map-folder'), access = find('map-library-access'), input = find('map-folder-input'), status = find('map-library-status');
      let handle = null, files = [], folderName = '', busy = false, generation = 0;
      let native = typeof window.showDirectoryPicker === 'function';
      const controls = () => {
        choose.disabled = busy;
        select.disabled = busy || files.length === 0;
        load.disabled = busy || !files.some(file => file.path === select.value);
        refresh.disabled = busy || (!handle && !folderName);
        access.disabled = busy;
      };
      const describe = sessionOnly => {
        status.textContent = `${folderName} · ${files.length ? `Карт: ${files.length}` : 'Нет JSON-карт'}`
          + (sessionOnly ? ' · На текущий сеанс' : '');
      };
      const listFiles = (items, name, sessionOnly = false) => {
        const selected = select.value;
        files = items.sort((a, b) => a.path.localeCompare(b.path, 'ru', { numeric: true, sensitivity: 'base' }));
        folderName = name;
        select.replaceChildren(new Option(files.length ? 'Выберите карту' : 'Нет JSON-карт', ''));
        for (const file of files) select.add(new Option(file.path, file.path));
        if (files.some(file => file.path === selected)) select.value = selected;
        access.hidden = true;
        describe(sessionOnly);
        controls();
      };
      const errorMessage = error => {
        if (error.name === 'AbortError') return;
        status.textContent = error.name === 'NotFoundError' ? 'Файл или папка не найдены. Обновите список.'
          : error.name === 'NotAllowedError' ? 'Нужен доступ к папке с картами.' : `Не удалось открыть карту или папку: ${error.message}`;
        if (error.name === 'NotAllowedError' && handle) access.hidden = false;
      };
      async function chooseFolder() {
        if (busy || isBusy()) return;
        generation++;
        if (!native) { input.value = ''; input.click(); return; }
        busy = true; controls();
        try {
          // The picker is invoked directly from the click, before any asynchronous storage work.
          const picked = await window.showDirectoryPicker({ id: 'kanneghem-maps', ...mode, ...(handle ? { startIn: handle } : {}) });
          const items = await scan(picked);
          handle = picked;
          let saved = false;
          try { saved = await storedFolder(storageKey, picked); } catch { /* Some local-file browsers cannot store handles. */ }
          listFiles(items, picked.name, !saved);
        } catch (error) {
          if (['SecurityError', 'NotSupportedError', 'NotAllowedError'].includes(error.name)) {
            native = false;
            status.textContent = 'Выберите папку с картами ещё раз.';
          } else errorMessage(error);
        } finally { busy = false; controls(); }
      }
      async function reopen() {
        if (busy || isBusy()) return;
        if (!handle) { chooseFolder(); return; }
        generation++;
        busy = true; controls();
        try {
          if (await handle.requestPermission(mode) !== 'granted') {
            access.hidden = false;
            status.textContent = `${handle.name} · Для чтения карт разрешите доступ к папке.`;
            return;
          }
          listFiles(await scan(handle), handle.name);
        } catch (error) { errorMessage(error); }
        finally { busy = false; controls(); }
      }
      choose.addEventListener('click', chooseFolder);
      refresh.addEventListener('click', reopen);
      access.addEventListener('click', reopen);
      select.addEventListener('change', controls);
      input.addEventListener('change', () => {
        if (busy || isBusy() || !input.files.length) return;
        generation++;
        handle = null;
        const selected = Array.from(input.files);
        const name = selected[0].webkitRelativePath.split('/')[0];
        listFiles(selected.filter(file => /\.json$/i.test(file.name)).map(file => ({
          path: file.webkitRelativePath.split('/').slice(1).join('/') || file.name, getFile: async () => file
        })), name, true);
        // A session-only folder must not resurrect a previously remembered native folder.
        storedFolder(storageKey, null).catch(() => {});
        refresh.title = 'Обновить список: выбрать папку повторно';
        input.value = '';
      });
      load.addEventListener('click', async () => {
        if (busy || isBusy()) return;
        const selected = files.find(file => file.path === select.value);
        if (!selected) return;
        busy = true; controls();
        try { await onLoad(await selected.getFile()); }
        catch (error) { errorMessage(error); }
        finally { busy = false; controls(); }
      });
      // Restore access only if permission is already granted. Never prompt on page load.
      (async () => {
        const version = generation;
        try {
          if (!native) return;
          const saved = await storedFolder(storageKey);
          if (!saved || version !== generation) return;
          handle = saved; folderName = saved.name;
          if (await saved.queryPermission(mode) === 'granted') {
            const items = await scan(saved);
            if (version === generation) listFiles(items, saved.name);
          } else if (version === generation) {
            access.hidden = false;
            status.textContent = `${saved.name} · Разрешите доступ, чтобы открыть список карт.`;
          }
        } catch { /* Folder selection remains available when browser storage is unavailable. */ }
        finally { controls(); }
      })();
      return root;
    }
  };
})();
