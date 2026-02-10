// ============ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ============
let currentPath = "";
let selectionType = "";
let selectedItemPath = "";
let lastResultPath = "";
let previewInterval = null;
let lastOutputPath = "";
let currentPageIndex = 0;
let galleryPages = [];

// ============ ФУНКЦИИ ФАЙЛОВОГО БРАУЗЕРА ============

// Открытие файлового браузера
async function openFileBrowser(type) {
    selectionType = type;
    const modal = document.getElementById("file-browser-modal");
    const modalTitle = document.getElementById("modal-title");
    const outputNameContainer = document.getElementById("output-name-container");
    const pdfOnlyCheckbox = document.getElementById("pdf-only");
    
    modalTitle.innerText = type === 'input' ? "Выберите входной PDF файл" : "Укажите путь для выходного файла";
    outputNameContainer.style.display = type === 'output' ? "flex" : "none";
    pdfOnlyCheckbox.disabled = type === 'output';
    pdfOnlyCheckbox.checked = type === 'input';
    modal.style.display = "flex";

    document.getElementById("search-input").value = "";
    selectedItemPath = "";
    loadDirectory("");
}

// Закрытие файлового браузера
function closeFileBrowser() {
    const modal = document.getElementById("file-browser-modal");
    modal.style.display = "none";
    selectionType = "";
    selectedItemPath = "";

    if (selectionType === 'input') {
        updateOutputFilePath();
    }
}

// Обновление имени выходного файла
function updateOutputFilePath() {
    const inputPath = document.getElementById("input-file").value.trim();
    const outputField = document.getElementById("output-file");

    if (inputPath) {
        let fileName = "";
        let dirPath = "";
        const lastSlashIndex = inputPath.lastIndexOf('/');
        const lastBackSlashIndex = inputPath.lastIndexOf('\\');
        const lastSeparatorIndex = Math.max(lastSlashIndex, lastBackSlashIndex);

        if (lastSeparatorIndex !== -1) {
            fileName = inputPath.substring(lastSeparatorIndex + 1);
            dirPath = inputPath.substring(0, lastSeparatorIndex);
        } else {
            fileName = inputPath;
            dirPath = "";
        }

        const dotIndex = fileName.lastIndexOf('.');
        const baseName = dotIndex !== -1 ? fileName.substring(0, dotIndex) : fileName;
        const newFileName = `${baseName}_booklet.pdf`;
        const newOutputPath = dirPath ? `${dirPath}/${newFileName}` : newFileName;
        
        outputField.value = newOutputPath;
    }
}

// Загрузка директории с фильтрами
async function loadDirectoryWithFilters() {
    const searchQuery = document.getElementById("search-input").value;
    const onlyPdf = document.getElementById("pdf-only").checked && selectionType === 'input';
    loadDirectory(currentPath, searchQuery, onlyPdf);
}

// Загрузка содержимого директории
async function loadDirectory(path, searchQuery = "", onlyPdf = false) {
    const result = await eel.get_directory_contents(path, searchQuery, onlyPdf)();
    const fileList = document.getElementById("file-list");
    
    if (result.status === "success") {
        currentPath = result.path;
        document.getElementById("current-path").innerText = currentPath;
        fileList.innerHTML = "";

        if (result.contents.length === 0) {
            const emptyDiv = document.createElement("div");
            emptyDiv.innerText = "Папка пуста или файлы не найдены.";
            emptyDiv.style.color = "#777";
            emptyDiv.style.textAlign = "center";
            emptyDiv.style.padding = "20px";
            fileList.appendChild(emptyDiv);
            return;
        }

        result.contents.forEach(item => {
            const div = document.createElement("div");
            div.className = "file-item";
            if (item.is_pdf) {
                div.classList.add("pdf");
            }

            const icon = document.createElement("span");
            icon.className = "file-icon";
            icon.innerText = item.is_dir ? "📁" : (item.is_pdf ? "📄" : "🗎");

            const nameSpan = document.createElement("span");
            nameSpan.innerText = item.name;

            div.appendChild(icon);
            div.appendChild(nameSpan);

            div.onclick = () => {
                if (item.is_dir) {
                    loadDirectory(item.path, searchQuery, onlyPdf);
                } else if (item.is_pdf && selectionType === 'input') {
                    document.getElementById("input-file").value = item.path;
                    updateOutputFilePath();
                    closeFileBrowser();
                } else if (selectionType === 'output') {
                    selectedItemPath = item.is_dir ? item.path : item.path;
                    const defaultName = item.is_pdf ? item.name : "booklet_output.pdf";
                    document.getElementById("output-name").value = defaultName;
                }
            };

            fileList.appendChild(div);
        });
    } else {
        fileList.innerHTML = "";
        const errorDiv = document.createElement("div");
        errorDiv.innerText = result.message;
        errorDiv.style.color = "#ff4444";
        errorDiv.style.textAlign = "center";
        errorDiv.style.padding = "20px";
        fileList.appendChild(errorDiv);
    }
}

// Подтверждение выбора выходного файла
function confirmOutputSelection() {
    if (selectionType === 'output' && selectedItemPath) {
        const fileName = document.getElementById("output-name").value.trim();
        if (!fileName) {
            alert("Введите имя файла для сохранения.");
            return;
        }

        const finalFileName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
        let outputPath = "";
        
        if (selectedItemPath.toLowerCase().endsWith('.pdf')) {
            const lastSlashIndex = selectedItemPath.lastIndexOf('/');
            if (lastSlashIndex !== -1) {
                outputPath = `${selectedItemPath.substring(0, lastSlashIndex)}/${finalFileName}`;
            } else {
                outputPath = finalFileName;
            }
        } else {
            outputPath = `${selectedItemPath}/${finalFileName}`;
        }

        document.getElementById("output-file").value = outputPath;
        closeFileBrowser();
    } else if (selectionType === 'output') {
        alert("Сначала выберите папку или файл для определения директории сохранения.");
    }
}

// Переход в родительскую директорию
async function goBack() {
    const searchQuery = document.getElementById("search-input").value;
    const onlyPdf = document.getElementById("pdf-only").checked && selectionType === 'input';
    const result = await eel.get_parent_directory(currentPath)();

    if (result.status === "success") {
        loadDirectory(result.path, searchQuery, onlyPdf);
    } else {
        alert(result.message);
    }
}

// ============ ФУНКЦИИ РАБОТЫ С ФАЙЛАМИ ============

// Открытие папки выходного файла
async function openOutputFolder() {
    const outputPath = document.getElementById("output-file").value.trim();
    if (!outputPath) {
        alert("Путь для выходного файла не указан.");
        return;
    }

    let folderPath = outputPath;
    const lastSlashIndex = outputPath.lastIndexOf('/');
    const lastBackSlashIndex = outputPath.lastIndexOf('\\');
    const lastSeparatorIndex = Math.max(lastSlashIndex, lastBackSlashIndex);

    if (lastSeparatorIndex !== -1) {
        folderPath = outputPath.substring(0, lastSeparatorIndex);
    }

    try {
        const result = await eel.open_folder_with_file(folderPath)();
        if (result.status !== "success") {
            alert(result.message);
        }
    } catch (error) {
        alert(`Не удалось открыть папку: ${error.message}`);
        console.error("Ошибка при открытии папки выходного файла:", error);
    }
}

// Проверка и обновление превью PDF
function checkAndUpdatePreview() {
    const outputPath = document.getElementById("output-file").value.trim();

    if (outputPath === lastOutputPath) {
        return;
    }

    lastOutputPath = outputPath;

    if (!outputPath) {
        const noPreview = document.getElementById("no-preview");
        const pdfFrame = document.getElementById("pdf-frame");

        noPreview.style.display = "block";
        pdfFrame.style.display = "none";
        return;
    }

    checkFileExists(outputPath);
}

// Проверка существования файла
function checkFileExists(filePath) {
    try {
        eel.check_file_exists(filePath)(function(result) {
            if (result.exists) {
                updatePdfPreview(filePath);
            } else {
                const noPreview = document.getElementById("no-preview");
                const pdfFrame = document.getElementById("pdf-frame");

                noPreview.style.display = "block";
                pdfFrame.style.display = "none";
            }
        });
    } catch (error) {
        console.error("Ошибка при проверке файла:", error);
    }
}

// Обновление превью PDF
function updatePdfPreview(filePath) {
    const noPreview = document.getElementById("no-preview");
    const pdfFrame = document.getElementById("pdf-frame");

    let safeFilePath = filePath.replace(/\\/g, "/");
    if (!safeFilePath.startsWith("file://")) {
        safeFilePath = "file:///" + safeFilePath;
    }

    noPreview.style.display = "none";
    pdfFrame.style.display = "block";
    pdfFrame.src = safeFilePath;
    pdfFrame.src = safeFilePath + "?t=" + new Date().getTime();
}

// ============ ФУНКЦИИ СОЗДАНИЯ БУКЛЕТА ============

// Подготовка буклета
async function prepareBooklet() {
    const inputPath = document.getElementById("input-file").value.trim();
    const outputPath = document.getElementById("output-file").value.trim();
    const statusElement = document.getElementById("status");
    const progressText = document.getElementById("progress-text");
    const prepareBtn = document.getElementById("prepare-btn");

    const rotate_all = document.getElementById("rotate-all").checked;
    const rotate = document.getElementById("rotate").checked;
    const flipHorizontal = document.getElementById("flip-horizontal").checked;
    const flipVertical = document.getElementById("flip-vertical").checked;

    // Очистка и инициализация галереи
    galleryPages = [];
    currentPageIndex = 0;

    const galleryTrack = document.getElementById('gallery-track');
    if (galleryTrack) {
        galleryTrack.innerHTML = `
            <div class="gallery-loading">
                <div class="spinner"></div>
                <div>Генерация превью...</div>
            </div>
        `;
    }

    updateGalleryDisplay();

    logAction('Начало подготовки буклета', 'info', {
        inputPath: inputPath,
        outputPath: outputPath,
        settings: { rotate_all, rotate, flipHorizontal, flipVertical }
    });

    // Валидация
    if (!inputPath) {
        statusElement.innerText = "Ошибка: выберите входной файл!";
        statusElement.className = "status error";
        statusElement.style.display = "block";
        logAction('Ошибка валидации: входной файл не выбран', 'error');
        return;
    }

    if (!outputPath) {
        statusElement.innerText = "Ошибка: укажите путь для выходного файла!";
        statusElement.className = "status error";
        statusElement.style.display = "block";
        logAction('Ошибка валидации: путь для выходного файла не указан', 'error');
        return;
    }

    // Показ прогресса
    progressText.innerText = "Обработка...";
    prepareBtn.disabled = true;
    statusElement.className = "status info";
    statusElement.style.display = "block";
    statusElement.innerText = "Начинаю обработку...";

    try {
        logAction('Вызов функции создания буклета', 'info');
        const result = await eel.create_booklet(inputPath, outputPath, rotate_all, rotate, flipHorizontal, flipVertical)();

        if (result.status === "success") {
            statusElement.className = "status success";
            progressText.innerText = "Готово!";
            logAction('Буклет успешно создан', 'success', { resultPath: result.result_path });

            // Обновление превью PDF
            if (result.result_path) {
                const noPreview = document.getElementById("no-preview");
                const pdfFrame = document.getElementById("pdf-frame");

                noPreview.style.display = "none";
                pdfFrame.style.display = "block";

                let filePath = result.result_path.replace(/\\/g, "/");
                if (!filePath.startsWith("file://")) {
                    filePath = "file:///" + filePath;
                }
                pdfFrame.src = filePath;
                logAction('Превью PDF обновлено', 'info');
            }

            // Обновление галереи
            if (result.gallery_pages && result.gallery_pages.length > 0) {
                addPagesToGallery(result.gallery_pages);
                logAction(`Галерея обновлена с ${result.gallery_pages.length} страницами`, 'info');
            }
        } else {
            statusElement.className = "status error";
            progressText.innerText = "Ошибка";
            logAction('Ошибка при создании буклета', 'error', { message: result.message });
        }

        statusElement.innerText = result.message;
    } catch (error) {
        statusElement.className = "status error";
        statusElement.innerText = `Ошибка выполнения: ${error.message}`;
        progressText.innerText = "Ошибка";
        logError(error, 'При создании буклета');
    } finally {
        prepareBtn.disabled = false;
        logAction('Завершение обработки буклета', 'info');
    }
}

// ============ ФУНКЦИИ ГАЛЕРЕИ ============

// Обновление отображения галереи
function updateGalleryDisplay() {
    const galleryTrack = document.getElementById('gallery-track');
    const galleryCounter = document.getElementById('gallery-counter');
    const prevBtn = document.getElementById('gallery-prev');
    const nextBtn = document.getElementById('gallery-next');

    if (!galleryTrack) return;

    if (galleryPages.length === 0) {
        galleryTrack.innerHTML = `
            <div class="gallery-empty" id="no-preview">
                <div class="welcome-icon">
                    <i class="fas fa-file-pdf"></i>
                </div>
                <h3>Создайте ваш буклет</h3>
                <p>Выберите PDF файл и нажмите "ПОДГОТОВИТЬ"<br>для генерации превью буклета</p>
            </div>
        `;
        galleryCounter.textContent = '0/0';

        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
    } else {
        galleryCounter.textContent = `${currentPageIndex + 1}/${galleryPages.length}`;

        if (prevBtn) prevBtn.disabled = currentPageIndex === 0;
        if (nextBtn) nextBtn.disabled = currentPageIndex >= galleryPages.length - 1;

        const pageItem = galleryPages[currentPageIndex];
        const sideText = pageItem.isBackSide ? "Обратная сторона" : "Лицевая сторона";
        const pageInfo = pageItem.leftPage && pageItem.rightPage
            ? `Страницы: ${pageItem.leftPage} и ${pageItem.rightPage}`
            : pageItem.leftPage
                ? `Страница: ${pageItem.leftPage}`
                : pageItem.rightPage
                    ? `Страница: ${pageItem.rightPage}`
                    : "Пустая страница";

        galleryTrack.innerHTML = `
            <div class="gallery-item ${currentPageIndex === 0 ? 'active' : ''}">
                <div class="gallery-side-info ${pageItem.isBackSide ? 'back-side' : 'front-side'}">
                    <i class="fas ${pageItem.isBackSide ? 'fa-undo' : 'fa-file-alt'}"></i>
                    ${sideText}
                </div>
                <img src="${pageItem.src}" alt="Страница ${pageItem.pageNumber}" class="gallery-image">
                <div class="gallery-page-info">
                    <div>Страница буклета: ${pageItem.pageNumber} / ${galleryPages.length}</div>
                    <div class="page-numbers">${pageInfo}</div>
                </div>
            </div>
        `;
    }
}

// Навигация по галерее
function previousPage() {
    if (currentPageIndex > 0) {
        currentPageIndex--;
        updateGalleryDisplay();
    }
}

function nextPage() {
    if (currentPageIndex < galleryPages.length - 1) {
        currentPageIndex++;
        updateGalleryDisplay();
    }
}

// Добавление страниц в галерею
function addPagesToGallery(pages) {
    galleryPages = pages.map((pageData, index) => ({
        src: pageData.image_path,
        pageNumber: pageData.page_number,
        isBackSide: pageData.is_back_side,
        leftPage: pageData.left_page_num,
        rightPage: pageData.right_page_num
    }));

    currentPageIndex = 0;
    updateGalleryDisplay();
}

// ============ ФУНКЦИИ КОНФИГУРАЦИИ ============

// Сохранение настроек
function saveSettings() {
    try {
        const settings = {
            inputFile: document.getElementById("input-file").value,
            outputFile: document.getElementById("output-file").value,
            rotate_all: document.getElementById("rotate-all").checked,
            rotate: document.getElementById("rotate").checked,
            flipHorizontal: document.getElementById("flip-horizontal").checked,
            flipVertical: document.getElementById("flip-vertical").checked,
            timestamp: new Date().toISOString()
        };

        localStorage.setItem('pdfBookletSettings', JSON.stringify(settings));

        if (typeof eel !== 'undefined') {
            eel.save_config(settings)(function(result) {
                if (!result.success) {
                    console.warn("Не удалось сохранить конфиг:", result.message);
                }
            });
        }
    } catch (error) {
        console.error("Ошибка при сохранении настроек:", error);
    }
}

// Загрузка настроек
function loadSettings() {
    try {
        if (typeof eel !== 'undefined') {
            eel.load_config()(function(result) {
                if (result.success && result.settings) {
                    applySettings(result.settings);
                } else {
                    loadFromLocalStorage();
                }
            });
        } else {
            loadFromLocalStorage();
        }
    } catch (error) {
        console.error("Ошибка при загрузке настроек:", error);
        loadFromLocalStorage();
    }
}

// Загрузка из localStorage
function loadFromLocalStorage() {
    try {
        const savedSettings = localStorage.getItem('pdfBookletSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            applySettings(settings);
        }
    } catch (error) {
        console.error("Ошибка при загрузке настроек из localStorage:", error);
    }
}

// Применение настроек
function applySettings(settings) {
    try {
        if (!settings || typeof settings !== 'object') {
            return;
        }

        if (settings.inputFile) {
            document.getElementById("input-file").value = settings.inputFile;
            if (typeof eel !== 'undefined') {
                eel.check_file_exists(settings.inputFile)(function(result) {
                    if (!result.exists) {
                        console.warn("Сохраненный входной файл не существует:", settings.inputFile);
                    }
                });
            }
        }

        if (settings.outputFile) {
            document.getElementById("output-file").value = settings.outputFile;
            if (typeof eel !== 'undefined') {
                const outputDir = settings.outputFile.substring(0, settings.outputFile.lastIndexOf('/'));
                if (outputDir) {
                    eel.check_file_exists(outputDir)(function(result) {
                        if (!result.exists) {
                            console.warn("Сохраненная директория для выходного файла не существует:", outputDir);
                        }
                    });
                }
            }
        }

        if (typeof settings.rotate === 'boolean') {
            document.getElementById("rotate-all").checked = settings.rotate;
        }
        if (typeof settings.rotate === 'boolean') {
            document.getElementById("rotate").checked = settings.rotate;
        }
        if (typeof settings.flipHorizontal === 'boolean') {
            document.getElementById("flip-horizontal").checked = settings.flipHorizontal;
        }
        if (typeof settings.flipVertical === 'boolean') {
            document.getElementById("flip-vertical").checked = settings.flipVertical;
        }

        console.log("Настройки успешно загружены");
    } catch (error) {
        console.error("Ошибка при применении настроек:", error);
    }
}

// Автосохранение настроек
function setupAutoSave() {
    setInterval(saveSettings, 120000);

    document.getElementById("input-file").addEventListener("change", saveSettings);
    document.getElementById("output-file").addEventListener("change", saveSettings);
    document.getElementById("rotate-all").addEventListener("change", saveSettings);
    document.getElementById("rotate").addEventListener("change", saveSettings);
    document.getElementById("flip-horizontal").addEventListener("change", saveSettings);
    document.getElementById("flip-vertical").addEventListener("change", saveSettings);
}

// ============ ФУНКЦИИ ЛОГИРОВАНИЯ ============

// Логирование действий
function logAction(message, type = 'info', data = null) {
    try {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp: timestamp,
            type: type,
            message: message,
            data: data
        };

        switch(type) {
            case 'error':
                console.error(`[${timestamp}] [ERROR] ${message}`, data || '');
                break;
            case 'warning':
                console.warn(`[${timestamp}] [WARNING] ${message}`, data || '');
                break;
            case 'success':
                console.log(`[${timestamp}] [SUCCESS] ${message}`, data || '');
                break;
            default:
                console.log(`[${timestamp}] [INFO] ${message}`, data || '');
        }

        if (typeof eel !== 'undefined') {
            eel.log_client_action(logEntry)(function(result) {
                if (!result.success) {
                    console.warn("Не удалось отправить лог на сервер:", result.message);
                }
            });
        }
    } catch (error) {
        console.error("Ошибка при логировании:", error);
    }
}

// Логирование ошибок
function logError(error, context = '') {
    const errorInfo = {
        message: error.message,
        stack: error.stack,
        context: context,
        timestamp: new Date().toISOString()
    };
    logAction(`Ошибка: ${error.message}`, 'error', errorInfo);
}

// ============ КАСТОМНЫЙ АЛЕРТ ============
const customAlert = (function() {
    let isInitialized = false;
    let currentConfirmCallback = null;

    function init() {
        if (isInitialized) return;

        const alertHTML = `
            <div class="custom-alert-overlay" id="customAlertOverlay">
                <div class="custom-alert" id="customAlert">
                    <div class="alert-header">
                        <h3><i class="fas fa-info-circle"></i> <span id="alertTitle">Уведомление</span></h3>
                    </div>
                    <div class="alert-body" id="alertBody">
                        Сообщение
                    </div>
                    <div class="alert-footer">
                        <button class="alert-btn alert-btn-primary" id="alertConfirmBtn">OK</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', alertHTML);
        isInitialized = true;
        setupEventListeners();
    }

    function setupEventListeners() {
        const overlay = document.getElementById('customAlertOverlay');
        const alertDiv = document.getElementById('customAlert');
        const confirmBtn = document.getElementById('alertConfirmBtn');

        function closeAlert() {
            alertDiv.classList.add('closing');
            setTimeout(() => {
                overlay.style.display = 'none';
                alertDiv.classList.remove('closing');
            }, 300);
        }

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeAlert();
            }
        });

        confirmBtn.addEventListener('click', () => {
            if (currentConfirmCallback) {
                currentConfirmCallback();
            }
            closeAlert();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && overlay.style.display === 'flex') {
                closeAlert();
            }
        });
    }

    function show(message, options = {}) {
        init();

        const {
            title = 'Уведомление',
            type = 'default',
            confirmText = 'OK',
            showCancel = false,
            cancelText = 'Отмена',
            onConfirm = null,
            onCancel = null,
            icon = null
        } = options;

        const overlay = document.getElementById('customAlertOverlay');
        const alertDiv = document.getElementById('customAlert');
        const titleElement = document.getElementById('alertTitle');
        const bodyElement = document.getElementById('alertBody');
        const confirmBtn = document.getElementById('alertConfirmBtn');
        const footer = alertDiv.querySelector('.alert-footer');

        ['default', 'success', 'warning', 'error', 'info'].forEach(cls => {
            alertDiv.classList.remove(cls);
        });
        alertDiv.classList.add('custom-alert', type);

        titleElement.textContent = title;

        let iconClass = 'fas fa-info-circle';
        switch(type) {
            case 'success':
                iconClass = 'fas fa-check-circle';
                break;
            case 'warning':
                iconClass = 'fas fa-exclamation-triangle';
                break;
            case 'error':
                iconClass = 'fas fa-times-circle';
                break;
            case 'info':
                iconClass = 'fas fa-info-circle';
                break;
            case 'default':
                iconClass = 'fas fa-bell';
                break;
        }

        if (icon) iconClass = icon;
        const iconElement = alertDiv.querySelector('.alert-header h3 i');
        iconElement.className = iconClass;

        bodyElement.innerHTML = message;

        confirmBtn.textContent = confirmText;
        confirmBtn.innerHTML = `<i class="fas fa-check"></i> ${confirmText}`;

        const oldCancelBtn = document.getElementById('alertCancelBtn');
        if (oldCancelBtn) oldCancelBtn.remove();

        if (showCancel) {
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'alertCancelBtn';
            cancelBtn.className = 'alert-btn alert-btn-secondary';
            cancelBtn.innerHTML = `<i class="fas fa-times"></i> ${cancelText}`;

            cancelBtn.addEventListener('click', () => {
                alertDiv.classList.add('closing');
                setTimeout(() => {
                    overlay.style.display = 'none';
                    alertDiv.classList.remove('closing');
                    if (onCancel) onCancel();
                }, 300);
            });

            footer.insertBefore(cancelBtn, confirmBtn);
        }

        currentConfirmCallback = onConfirm;
        overlay.style.display = 'flex';
    }

    function alert(message, onConfirm = null) {
        show(message, {
            onConfirm: onConfirm
        });
    }

    function success(message, options = {}) {
        show(message, {
            ...options,
            title: options.title || 'Успех!',
            type: 'success'
        });
    }

    function warning(message, options = {}) {
        show(message, {
            ...options,
            title: options.title || 'Внимание!',
            type: 'warning'
        });
    }

    function error(message, options = {}) {
        show(message, {
            ...options,
            title: options.title || 'Ошибка!',
            type: 'error'
        });
    }

    function info(message, options = {}) {
        show(message, {
            ...options,
            title: options.title || 'Информация',
            type: 'info'
        });
    }

    function confirm(message, options = {}) {
        return new Promise((resolve) => {
            show(message, {
                title: options.title || 'Подтверждение',
                type: options.type || 'warning',
                confirmText: options.confirmText || 'Да',
                cancelText: options.cancelText || 'Нет',
                showCancel: true,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false)
            });
        });
    }

    return {
        show,
        alert,
        success,
        warning,
        error,
        info,
        confirm
    };
})();

// Глобальные экспорты
window.customAlert = customAlert;
window.showAlert = customAlert.alert;
window.showSuccess = customAlert.success;
window.showWarning = customAlert.warning;
window.showError = customAlert.error;
window.showInfo = customAlert.info;
window.showConfirm = customAlert.confirm;

const originalAlert = window.alert;
window.alert = function(message) {
    customAlert.alert(message);
};

// ============ ИНИЦИАЛИЗАЦИЯ ============

// Обработчики событий
document.getElementById("search-input").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        loadDirectoryWithFilters();
    }
});

document.getElementById("file-browser-modal").addEventListener("click", function(event) {
    if (event.target === this) {
        closeFileBrowser();
    }
});

// Инициализация при загрузке
window.addEventListener('DOMContentLoaded', function() {
    previewInterval = setInterval(checkAndUpdatePreview, 10000);

    document.getElementById("output-file").addEventListener("change", function() {
        checkAndUpdatePreview();
    });

    checkAndUpdatePreview();
    loadSettings();
    setupAutoSave();
});

// Очистка при закрытии
window.addEventListener('beforeunload', function() {
    if (previewInterval) {
        clearInterval(previewInterval);
    }
    saveSettings();
    logAction('Приложение закрыто', 'info');
});