// ===== DATA =====
let vehicles = JSON.parse(localStorage.getItem('vehicles') || '[]');
let editingId = null;
let currentPhotoBase64 = null;
let pendingDeleteId = null;

// ===== RENDER =====
function renderList() {
    const query = document.getElementById('searchInput').value.trim().toUpperCase();
    const list = document.getElementById('vehicleList');

    let filtered = vehicles;
    if (query) {
        filtered = vehicles.filter(v =>
            v.number.toUpperCase().includes(query) ||
            (v.note && v.note.toUpperCase().includes(query))
        );
    }

    // Сортировка: новые сверху
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    document.getElementById('totalCount').textContent = `Всего: ${vehicles.length}`;

    if (filtered.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="icon">${query ? '🔍' : '⋆｡‧˚ʚ🍓ɞ˚‧｡⋆'}</div>
                <h3>${query ? 'Ничего не найдено' : 'Список пуст'}</h3>
            </div>
        `;
        return;
    }

    list.innerHTML = filtered.map(v => `
        <div class="vehicle-card" data-id="${v.id}">
            <div class="vehicle-card-inner">
                <div class="vehicle-photo" onclick="${v.photo ? `viewPhoto('${v.id}')` : ''}">
                    ${v.photo
                        ? `<img src="${v.photo}" alt="${v.number}">`
                        : '<span class="placeholder">⋆｡‧˚ʚ🍓ɞ˚‧｡⋆</span>'}
                </div>
                <div class="vehicle-info">
                    <div class="vehicle-number">${escapeHtml(v.number)}</div>
                    ${v.note ? `<div class="vehicle-note">${escapeHtml(v.note)}</div>` : ''}
                    <div class="vehicle-date">${formatDate(v.timestamp)}</div>
                </div>
            </div>
            <div class="vehicle-actions">
                <button class="btn-edit" onclick="openEditModal('${v.id}')">✏️ Изменить</button>
                <div class="divider"></div>
                <button class="btn-photo" onclick="quickPhoto('${v.id}')">📷 Фото</button>
                <div class="divider"></div>
                <button class="btn-delete" onclick="confirmDelete('${v.id}')">🗑️ Удалить</button>
            </div>
        </div>
    `).join('');
}

// ===== SAVE DATA =====
function saveData() {
    localStorage.setItem('vehicles', JSON.stringify(vehicles));
}

// ===== ADD MODAL =====
function openAddModal() {
    editingId = null;
    currentPhotoBase64 = null;
    document.getElementById('modalTitle').textContent = 'Добавить';
    document.getElementById('inputNumber').value = '';
    document.getElementById('inputNote').value = '';
    resetPhotoArea();
    document.getElementById('btnSave').textContent = 'Добавить';
    document.getElementById('modalOverlay').classList.add('active');
    setTimeout(() => document.getElementById('inputNumber').focus(), 300);
}

// ===== EDIT MODAL =====
function openEditModal(id) {
    const v = vehicles.find(x => x.id === id);
    if (!v) return;

    editingId = id;
    currentPhotoBase64 = v.photo || null;
    document.getElementById('modalTitle').textContent = 'Редактировать';
    document.getElementById('inputNumber').value = v.number;
    document.getElementById('inputNote').value = v.note || '';
    document.getElementById('btnSave').textContent = 'Сохранить';

    if (v.photo) {
        showPhotoInUpload(v.photo);
    } else {
        resetPhotoArea();
    }

    document.getElementById('modalOverlay').classList.add('active');
}

// ===== CLOSE MODAL =====
function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    editingId = null;
    currentPhotoBase64 = null;
}

function closeModalOutside(e) {
    if (e.target === document.getElementById('modalOverlay')) {
        closeModal();
    }
}

// ===== SAVE VEHICLE =====
function saveVehicle() {
    const number = document.getElementById('inputNumber').value.trim();
    const note = document.getElementById('inputNote').value.trim();

    if (!number) {
        showToast('⚠️ Введите номер');
        document.getElementById('inputNumber').focus();
        return;
    }

    if (editingId) {
        // Редактирование
        const idx = vehicles.findIndex(v => v.id === editingId);
        if (idx !== -1) {
            vehicles[idx].number = number.toUpperCase();
            vehicles[idx].note = note;
            vehicles[idx].photo = currentPhotoBase64;
            vehicles[idx].timestamp = Date.now();
            showToast('Запись обновлена');
        }
    } else {
        // Проверка дубликата
        const exists = vehicles.find(v => v.number.toUpperCase() === number.toUpperCase());
        if (exists) {
            showToast('Такой номер уже есть');
            return;
        }

        vehicles.push({
            id: generateId(),
            number: number.toUpperCase(),
            note: note,
            photo: currentPhotoBase64,
            timestamp: Date.now()
        });
        showToast('ЯПИИИ +1');
    }

    saveData();
    renderList();
    closeModal();
}

// ===== CONFIRM DELETE =====
function confirmDelete(id) {
    const v = vehicles.find(x => x.id === id);
    if (!v) return;
    pendingDeleteId = id;
    document.getElementById('confirmText').textContent =
        `Удалить запись "${v.number}"? Это действие нельзя отменить.`;
    document.getElementById('confirmOverlay').classList.add('active');
    document.getElementById('btnConfirmDelete').onclick = () => {
        deleteVehicle();
    };
}

function closeConfirm() {
    document.getElementById('confirmOverlay').classList.remove('active');
    pendingDeleteId = null;
}

function deleteVehicle() {
    if (!pendingDeleteId) return;
    vehicles = vehicles.filter(v => v.id !== pendingDeleteId);
    saveData();
    renderList();
    closeConfirm();
    showToast('🗑️ Запись удалена');
}

// ===== PHOTO HANDLING =====
function triggerFileInput() {
    document.getElementById('fileInput').click();
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    compressImage(file, (base64) => {
        currentPhotoBase64 = base64;
        showPhotoInUpload(base64);
    });

    event.target.value = '';
}

function compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX = 800;
            let w = img.width, h = img.height;

            if (w > MAX || h > MAX) {
                if (w > h) { h = h * MAX / w; w = MAX; }
                else { w = w * MAX / h; h = MAX; }
            }

            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function showPhotoInUpload(base64) {
    const area = document.getElementById('photoUploadArea');
    area.innerHTML = `
        <img src="${base64}" alt="Фото">
        <button class="remove-photo" onclick="event.stopPropagation(); removePhoto()">✕</button>
    `;
}

function resetPhotoArea() {
    const area = document.getElementById('photoUploadArea');
    area.innerHTML = `
        <span class="upload-icon">📷</span>
        <span class="upload-text">Нажмите для выбора фото</span>
    `;
}

function removePhoto() {
    currentPhotoBase64 = null;
    resetPhotoArea();
}

// Quick photo from card
function quickPhoto(id) {
    editingId = id;
    const input = document.getElementById('fileInput');
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        compressImage(file, (base64) => {
            const idx = vehicles.findIndex(v => v.id === editingId);
            if (idx !== -1) {
                vehicles[idx].photo = base64;
                saveData();
                renderList();
                showToast('📷 Фото обновлено');
            }
            editingId = null;
        });
        input.value = '';
        input.onchange = handleFileSelect; // восстановить
    };
    input.click();
}

// ===== PHOTO VIEWER =====
function viewPhoto(id) {
    const v = vehicles.find(x => x.id === id);
    if (!v || !v.photo) return;
    document.getElementById('viewerImage').src = v.photo;
    document.getElementById('photoViewer').classList.add('active');
}

function closeViewer() {
    document.getElementById('photoViewer').classList.remove('active');
}

// ===== TOAST =====
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== UTILS =====
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(ts) {
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${mon}.${year} ${hh}:${mm}`;
}

// ===== INIT =====
renderList();
