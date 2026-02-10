
import eel
import os
import json
import datetime
from PIL import Image
import warnings
from web.scripts.PDFcreator import PDFBookletCreator
from web.scripts.Explorer import create_folder_html
from web.scripts.log_app import log_server_action, CONFIG_FILE_NAME
import webbrowser

warnings.filterwarnings("ignore")

eel.init('web')
def setup_window_title():
    """Устанавливает заголовок окна"""
    # Создаем красивый заголовок с иконкой
    eel.set_app_title("PDF Booklet Creator Pro")
    print("✓ Заголовок окна установлен")

@eel.expose
def open_folder_with_file(folder_path):
    try:
        # Преобразуем в абсолютный путь
        folder_path = os.path.abspath(folder_path)

        if not os.path.exists(folder_path):
            return {"status": "error", "message": "Папка не существует"}

        # Получаем список файлов и папок
        items = os.listdir(folder_path)

        # Сортируем: сначала папки, потом файлы
        items.sort(key=lambda x: (not os.path.isdir(os.path.join(folder_path, x)), x.lower()))

        # Создаем HTML с CSS стилями
        html_content = create_folder_html(folder_path, items)

        # Сохраняем HTML во временный файл
        current_dir = os.path.dirname(os.path.abspath(__file__))
        temp_html_path = os.path.join(current_dir, "folder.html")

        with open(temp_html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        # Открываем в браузере
        webbrowser.open(f'file://{temp_html_path}')

        return {"status": "success", "message": "Папка открыта в браузере"}

    except Exception as e:
        return {"status": "error", "message": str(e)}

@eel.expose
def get_directory_contents(path="", search_query="", only_pdf=False):
    try:
        # Если путь не указан, начинаем с домашней директории пользователя
        if not path:
            path = os.path.expanduser("~")
        # Проверяем, существует ли путь
        if not os.path.exists(path):
            return {"status": "error", "message": "Указанный путь не существует", "path": path}
        # Проверяем, является ли путь директорией
        if not os.path.isdir(path):
            return {"status": "error", "message": "Указанный путь не является директорией", "path": path}
        # Получаем список файлов и папок
        contents = []
        search_query = search_query.lower().strip() if search_query else ""
        for item in os.listdir(path):
            item_path = os.path.join(path, item)
            is_dir = os.path.isdir(item_path)
            is_pdf = item.lower().endswith('.pdf') if not is_dir else False
            # Применяем фильтры
            if search_query and search_query not in item.lower():
                continue  # Пропускаем элементы, не соответствующие поисковому запросу
            if only_pdf and not is_dir and not is_pdf:
                continue  # Пропускаем файлы, которые не являются PDF, если включён фильтр
            contents.append({
                "name": item,
                "path": item_path,
                "is_dir": is_dir,
                "is_pdf": is_pdf
            })
        # Сортируем: сначала папки, потом файлы
        contents.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        return {
            "status": "success",
            "path": path,
            "contents": contents
        }
    except PermissionError:
        return {"status": "error", "message": "Доступ к директории запрещён. Попробуйте другую папку.", "path": path}
    except Exception as e:
        return {"status": "error", "message": f"Ошибка при получении содержимого директории: {str(e)}", "path": path}

@eel.expose
def get_parent_directory(path):
    try:
        if not path:
            return {"status": "error", "message": "Путь не указан"}
        parent = os.path.dirname(path)
        if parent == path:  # Корневая директория
            return {"status": "error", "message": "Вы уже в корневой директории", "path": path}
        return {"status": "success", "path": parent}
    except Exception as e:
        return {"status": "error", "message": f"Ошибка при получении родительской директории: {str(e)}", "path": path}

@eel.expose
def check_file_exists(file_path):
    try:
        if not file_path:
            return {"exists": False, "message": "Путь к файлу не указан"}
        return {"exists": os.path.exists(file_path), "message": "Проверка выполнена"}
    except Exception as e:
        return {"exists": False, "message": f"Ошибка при проверке файла: {str(e)}"}

@eel.expose
def log_client_action(log_entry):
    try:
        if not log_entry or not isinstance(log_entry, dict):
            return {"success": False, "message": "Некорректный формат лога"}

        # Добавляем информацию о сервере
        log_entry['source'] = 'client'
        log_entry['server_timestamp'] = datetime.datetime.now().isoformat()

        # Логируем действие
        log_server_action(
            f"Клиентское действие: {log_entry.get('message', 'без сообщения')}",
            log_entry.get('type', 'info'),
            log_entry
        )

        return {"success": True, "message": "Лог успешно сохранен на сервере"}

    except Exception as e:
        return {"success": False, "message": f"Ошибка при логировании клиентского действия: {str(e)}"}

@eel.expose
def save_config(settings):
    try:
        if not settings:
            return {"success": False, "message": "Настройки не указаны"}

        # Определяем путь к конфигу
        config_dir = os.path.join(os.path.expanduser("~"), ".pdf_booklet_creator")
        if not os.path.exists(config_dir):
            os.makedirs(config_dir)

        config_path = os.path.join(config_dir, CONFIG_FILE_NAME)

        # Сохраняем конфигурацию
        with open(config_path, 'w', encoding='utf-8') as f:
            json.dump(settings, f, indent=2, ensure_ascii=False)

        log_server_action('Конфигурация сохранена', 'info', {'settings': settings})
        return {"success": True, "message": "Конфигурация успешно сохранена"}

    except Exception as e:
        log_server_action('Ошибка при сохранении конфигурации', 'error', {'error': str(e)})
        return {"success": False, "message": f"Ошибка при сохранении конфигурации: {str(e)}"}

@eel.expose
def load_config():
    try:
        # Определяем путь к конфигу
        config_dir = os.path.join(os.path.expanduser("~"), ".pdf_booklet_creator")
        config_path = os.path.join(config_dir, CONFIG_FILE_NAME)

        # Проверяем существование файла
        if not os.path.exists(config_path):
            log_server_action('Файл конфигурации не найден', 'warning')
            return {"success": False, "message": "Файл конфигурации не найден"}

        # Загружаем конфигурацию
        with open(config_path, 'r', encoding='utf-8') as f:
            settings = json.load(f)

        log_server_action('Конфигурация загружена', 'info', {'settings': settings})
        return {"success": True, "message": "Конфигурация успешно загружена", "settings": settings}

    except Exception as e:
        log_server_action('Ошибка при загрузке конфигурации', 'error', {'error': str(e)})
        return {"success": False, "message": f"Ошибка при загрузке конфигурации: {str(e)}"}

@eel.expose
def create_booklet(input_path, output_path, rotate_all=False, rotate=False, flip_horizontal=False, flip_vertical=False):
    try:
        if not input_path:
            return {"status": "error", "message": "Не выбран входной PDF файл."}
        if not output_path:
            return {"status": "error", "message": "Не указан путь для выходного файла."}
        if not os.path.exists(input_path):
            return {"status": "error", "message": "Входной файл не найден."}

        # Создаем экземпляр класса
        booklet_creator = PDFBookletCreator(input_pdf_path=input_path, output_pdf_path=output_path)

        # Получаем все изображения страниц
        all_images = booklet_creator.pdf_to_images(str(input_path))
        total_pages = len(all_images)

        # Рассчитываем порядок страниц
        booklet_pairs = booklet_creator.calculate_booklet_order(
            total_pages,
            rotate_all,
            rotate,
            flip_horizontal,
            flip_vertical
        )

        gallery_pages = []

        # Создаем папку для временных изображений
        temp_images_dir = os.path.join("assets", "temp_pictures")
        if not os.path.exists(temp_images_dir):
            os.makedirs(temp_images_dir)

        # Очищаем предыдущие временные файлы
        for file in os.listdir(temp_images_dir):
            if file.endswith(".jpg"):
                os.remove(os.path.join(temp_images_dir, file))

        # Создаем комбинированные страницы для галереи
        a4_size_landscape = (3508, 2480)
        for i, (left_num, right_num) in enumerate(booklet_pairs):
            left_img = all_images[left_num - 1] if left_num else None
            right_img = all_images[right_num - 1] if right_num else None
            is_back_side = (i % 2 == 1)

            # Создаем комбинированную страницу
            combined_img = booklet_creator.create_combined_page(
                left_img,
                right_img,
                a4_size_landscape,
                is_back_side,
                flip_horizontal,
                flip_vertical
            )

            # Масштабируем для превью (уменьшаем размер)
            preview_size = (1200, 850)  # Размер для превью
            preview_img = combined_img.copy()
            preview_img.thumbnail(preview_size, Image.LANCZOS)

            # Сохраняем изображение в папку temp_pictures
            temp_img_path = os.path.join(temp_images_dir, f"{i + 1}.jpg")
            preview_img.save(temp_img_path, "JPEG", quality=90)

            gallery_pages.append({
                "page_number": i + 1,
                "image_path": f"assets/temp_pictures/{i + 1}.jpg",
                "is_back_side": is_back_side,
                "left_page_num": left_num,
                "right_page_num": right_num
            })

        # Создаем финальный буклет PDF
        result_path = booklet_creator.create_booklet_pdf(
            rotate_all=rotate_all,
            rotate=rotate,
            flip_horizontal=flip_horizontal,
            flip_vertical=flip_vertical
        )

        return {
            "status": "success",
            "message": f"Буклет успешно создан: {result_path}",
            "result_path": result_path,
            "gallery_pages": gallery_pages,
            "total_pages": len(gallery_pages)
        }
    except Exception as e:
        return {"status": "error", "message": f"Ошибка при создании буклета: {str(e)}"}


if __name__ == "__main__":
    try:
        eel.start('index.html',
                  size=(1200, 800),
                  mode='chrome',
                  cmdline_args=['--start-maximized', '--disable-features=TranslateUI'])
    except KeyboardInterrupt:
        print("\nПриложение завершено пользователем")
