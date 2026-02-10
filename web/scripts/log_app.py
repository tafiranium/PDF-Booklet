import os
import datetime
import json

# ============ КОНФИГУРАЦИЯ И ЛОГИРОВАНИЕ ============
CONFIG_FILE_NAME = 'pdf_booklet_config.json'
LOG_FILE_NAME = 'pdf_booklet_creator.log'
LOG_DIR = os.path.join(os.path.expanduser("~"), ".pdf_booklet_creator")


def ensure_log_dir_exists():
    if not os.path.exists(LOG_DIR):
        os.makedirs(LOG_DIR)


def log_server_action(message, type='info', data=None):
    try:
        ensure_log_dir_exists()
        log_path = os.path.join(LOG_DIR, LOG_FILE_NAME)

        log_entry = {
            'timestamp': datetime.datetime.now().isoformat(),
            'type': type,
            'message': message,
            'data': data
        }

        # Записываем в файл
        with open(log_path, 'a', encoding='utf-8') as f:
            f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')

        print(f"[{log_entry['timestamp']}] [{type.upper()}] {message}")

    except Exception as e:
        print(f"Ошибка при логировании на сервере: {str(e)}")


