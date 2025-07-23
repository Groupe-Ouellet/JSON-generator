document.addEventListener('DOMContentLoaded', () => {

  // --- STATE ---
  let data = {
    categories: [
      {
        "name": "Romance",
        "cards": [
          "A story about two lovers overcoming obstacles.",
          "A heartwarming tale of unexpected love.",
          "A forbidden relationship that defies society."
        ]
      },
      {
        "name": "Science Fiction",
        "cards": [
          "A futuristic adventure in space.",
          "Humans exploring alien planets.",
          "Technology gone wrong in dystopian future."
        ]
      },
      {
        "name": "Mystery",
        "cards": [
          "A detective solving a complex murder case.",
          "An unsolved crime with hidden clues.",
          "Secrets unravel in a small town."
        ]
      }
    ]
  };
  let draggedItem = null;
  let isDragging = false;
  let isTrimEnabled = true;
  const trimToggle = document.getElementById('trim-toggle');

  // --- SELECTORS ---
  const boardContainer = document.getElementById('board-container');
  const addCategoryBtn = document.getElementById('add-category-btn');
  const fileInput = document.getElementById('fileInput');
  const downloadBtn = document.getElementById('download-json-btn');
  const toggleJsonBtn = document.getElementById('toggle-json-btn');
  const jsonViewer = document.getElementById('json-viewer');
  const jsonOutput = document.getElementById('json-output');
  const closeJsonViewerBtn = document.getElementById('close-json-viewer');
  
  // Modal selectors
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalActions = document.getElementById('modal-actions');

  // --- RENDER & SYNC ---
  const renderAndSync = () => { render(); updateJsonView(); };
  const render = () => {
    boardContainer.innerHTML = '';
    data.categories.forEach((category, catIndex) => {
      boardContainer.appendChild(createColumn(category, catIndex));
    });
  };

  // --- CUSTOM MODAL (FIXED) ---
  function showModal({ type = 'alert', title, message, placeholder = '' }) {
    return new Promise(resolve => {
      modalTitle.textContent = title;
      modalBody.innerHTML = `<p>${message}</p>${type === 'prompt' ? `<input type="text" id="modal-input" placeholder="${placeholder}">` : ''}`;
      modalActions.innerHTML = `
        ${type === 'confirm' ? `<button class="btn btn-secondary" id="modal-cancel">Cancel</button>` : ''}
        <button class="btn" id="modal-ok">OK</button>
      `;
      
      const okBtn = modalActions.querySelector('#modal-ok');
      const cancelBtn = modalActions.querySelector('#modal-cancel');
      const input = modalBody.querySelector('#modal-input');
      
      const closeModal = (value) => {
        modalOverlay.classList.remove('visible');
        resolve(value);
      };
      
      const okHandler = () => closeModal(type === 'prompt' ? input.value : true);
      const cancelHandler = () => closeModal(false);
      
      okBtn.addEventListener('click', okHandler, { once: true });
      if (cancelBtn) cancelBtn.addEventListener('click', cancelHandler, { once: true });
      
      modalOverlay.classList.add('visible');
      if (input) input.focus();
    });
  }

  // --- CREATE ELEMENTS ---
  function createColumn(category, catIndex) {
    const column = document.createElement('div');
    column.className = 'column';

    const columnHeader = document.createElement('div');
    columnHeader.className = 'column-header';
    const columnTitle = document.createElement('span');
    columnTitle.className = 'column-title';
    columnTitle.textContent = category.name;
    columnTitle.onclick = () => editColumnTitle(columnTitle, catIndex);
    
    const deleteColumnBtn = document.createElement('button');
    deleteColumnBtn.className = 'delete-btn';
    deleteColumnBtn.innerHTML = '×';
    deleteColumnBtn.title = 'Delete Category';
    deleteColumnBtn.onclick = () => deleteCategory(catIndex);
    columnHeader.append(columnTitle, deleteColumnBtn);

    const cardList = document.createElement('div');
    cardList.className = 'card-list';
    category.cards.forEach((cardText, cardIndex) => {
      cardList.appendChild(createCard(cardText, catIndex, cardIndex));
    });
    
    setupDropzone(cardList, catIndex);

    const addCardBtn = document.createElement('button');
    addCardBtn.className = 'btn add-card-btn';
    addCardBtn.textContent = '+ Add Card';
    addCardBtn.onclick = () => addCard(catIndex);
    
    column.append(columnHeader, cardList, addCardBtn);
    return column;
  }

  function createCard(text, catIndex, cardIndex) {
    const card = document.createElement('div');
    card.className = 'card';
    card.draggable = true;
    
    const cardText = document.createElement('div');
    cardText.className = 'card-text';
    cardText.textContent = text;
    cardText.onclick = () => { if (!isDragging) editCardText(card, text, catIndex, cardIndex); };
    
    const deleteCardBtn = document.createElement('button');
    deleteCardBtn.className = 'delete-btn';
    deleteCardBtn.innerHTML = '×';
    deleteCardBtn.title = 'Delete Card';
    deleteCardBtn.onclick = (e) => { e.stopPropagation(); deleteCard(catIndex, cardIndex); };

    card.append(cardText, deleteCardBtn);

    card.addEventListener('dragstart', (e) => {
      isDragging = true;
      draggedItem = { fromCatIndex: catIndex, fromCardIndex: cardIndex };
      setTimeout(() => e.target.classList.add('dragging'), 0);
    });
    card.addEventListener('dragend', (e) => {
      e.target.classList.remove('dragging');
      document.querySelectorAll('.drop-placeholder').forEach(p => p.remove());
      draggedItem = null;
      setTimeout(() => { isDragging = false; }, 50);
    });
    
    return card;
  }

  // --- DRAG & DROP (IMPROVED) ---
  function setupDropzone(cardList, toCatIndex) {
    const placeholder = document.createElement('div');
    placeholder.className = 'drop-placeholder';

    cardList.addEventListener('dragover', (e) => {
      e.preventDefault();
      // Remove any other placeholders before adding a new one
      const existingPlaceholder = document.querySelector('.drop-placeholder');
      if (existingPlaceholder && existingPlaceholder.parentElement !== cardList) {
        existingPlaceholder.remove();
      }

      const afterElement = getDragAfterElement(cardList, e.clientY);
      if (afterElement == null) {
        cardList.appendChild(placeholder);
      } else {
        cardList.insertBefore(placeholder, afterElement);
      }
    });

    cardList.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!draggedItem) return;
        
        const placeholderInList = cardList.querySelector('.drop-placeholder');
        if (!placeholderInList) return;

        const toIndex = Array.from(cardList.children).indexOf(placeholderInList);
        const { fromCatIndex, fromCardIndex } = draggedItem;
        
        moveCard(fromCatIndex, fromCardIndex, toCatIndex, toIndex);
    });
  }

  function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  // --- ACTIONS ---
  async function addCategory() {
    const name = await showModal({ type: 'prompt', title: 'New Category', message: 'Enter a name for the new category:' });
    if (name && (isTrimEnabled ? name.trim() : name)) {
      data.categories.push({ name: isTrimEnabled ? name.trim() : name, cards: [] });
      renderAndSync();
    }
  }
  
  async function deleteCategory(catIndex) {
    const confirmed = await showModal({ type: 'confirm', title: 'Delete Category', message: `Are you sure you want to delete "${data.categories[catIndex].name}"?` });
    if (confirmed) {
      data.categories.splice(catIndex, 1);
      renderAndSync();
    }
  }

  async function addCard(catIndex) {
    const text = await showModal({ type: 'prompt', title: 'New Card', message: 'Enter the text for the new card:' });
    if (text && (isTrimEnabled ? text.trim() : text)) {
      data.categories[catIndex].cards.push(isTrimEnabled ? text.trim() : text);
      renderAndSync();
    }
  }

  function deleteCard(catIndex, cardIndex) {
    data.categories[catIndex].cards.splice(cardIndex, 1);
    renderAndSync();
  }

  function editCardText(cardElement, oldText, catIndex, cardIndex) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'card-input';
    input.value = oldText;
    
    cardElement.innerHTML = '';
    cardElement.appendChild(input);
    input.focus();
    
    const save = () => {
      data.categories[catIndex].cards[cardIndex] = isTrimEnabled ? (input.value.trim() || "Untitled Card") : (input.value || "Untitled Card");
      renderAndSync();
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') renderAndSync();
    });
  }
  
  function editColumnTitle(titleElement, catIndex) {
      const oldText = data.categories[catIndex].name;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'column-header-input';
      input.value = oldText;
      
      titleElement.replaceWith(input);
      input.focus();

      const save = () => {
        data.categories[catIndex].name = isTrimEnabled ? (input.value.trim() || "Untitled") : (input.value || "Untitled");
        renderAndSync();
      };
      input.addEventListener('blur', save);
      input.addEventListener('keydown', e => {
          if (e.key === 'Enter') input.blur();
          if (e.key === 'Escape') renderAndSync();
      });
  }

  function moveCard(fromCatIndex, fromCardIndex, toCatIndex, toIndex) {
    const [movedCardData] = data.categories[fromCatIndex].cards.splice(fromCardIndex, 1);

    if (fromCatIndex === toCatIndex && fromCardIndex < toIndex) {
      toIndex--;
    }
    
    data.categories[toCatIndex].cards.splice(toIndex, 0, movedCardData);
    renderAndSync();
  }
  
  // --- JSON & FILE HANDLING (FIXED) ---
  const updateJsonView = () => jsonOutput.textContent = JSON.stringify(data, null, 2);
  const toggleJsonPanel = () => {
    jsonViewer.classList.toggle('visible');
    toggleJsonBtn.textContent = jsonViewer.classList.contains('visible') ? 'Hide JSON' : 'Show JSON';
  };
  const downloadJsonFile = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'kanban-board.json';
    a.click(); URL.revokeObjectURL(url);
  };
  const loadFromJsonFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let parsed = JSON.parse(e.target.result);
        
        // Backward compatibility check for old format
        if (parsed.categories && parsed.categories.some(cat => cat.hasOwnProperty('examples'))) {
            parsed.categories.forEach(cat => {
                if (cat.examples) {
                    cat.cards = cat.examples;
                    delete cat.examples;
                }
            });
        }
        
        if (parsed.categories && Array.isArray(parsed.categories)) {
          data = parsed;
          renderAndSync();
          await showModal({ title: 'Success', message: 'Board loaded successfully!' });
        } else {
          await showModal({ title: 'Error', message: 'Invalid JSON file. Must contain a "categories" array.' });
        }
      } catch (err) {
        await showModal({ title: 'Error', message: 'Error reading or parsing file: ' + err.message });
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  };
  
  // --- INITIALIZATION ---
  addCategoryBtn.addEventListener('click', addCategory);
  downloadBtn.addEventListener('click', downloadJsonFile);
  fileInput.addEventListener('change', loadFromJsonFile);
  toggleJsonBtn.addEventListener('click', toggleJsonPanel);
  closeJsonViewerBtn.addEventListener('click', toggleJsonPanel);
  trimToggle.addEventListener('change', () => {
    isTrimEnabled = trimToggle.checked;
  });

  renderAndSync();
});