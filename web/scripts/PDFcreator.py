import os
import io
import tempfile
from pathlib import Path
from typing import List, Tuple, Optional
from PIL import Image
import warnings
from math import ceil

warnings.filterwarnings("ignore")

class PDFBookletCreator:
    def __init__(self, input_pdf_path: str, output_pdf_path: str = None):
        self.input_pdf_path = Path(input_pdf_path)
        if output_pdf_path is None:
            output_name = self.input_pdf_path.stem + "_booklet.pdf"
            self.output_pdf_path = self.input_pdf_path.parent / output_name
        else:
            self.output_pdf_path = Path(output_pdf_path)
        self.temp_dir = tempfile.mkdtemp(prefix="pdf_booklet_")

    def pdf_to_images(self, pdf_path: str, dpi: int = 200) -> List[Image.Image]:
        try:
            import fitz  # PyMuPDF
            images = []
            pdf_document = fitz.open(pdf_path)
            for page_num in range(len(pdf_document)):
                page = pdf_document.load_page(page_num)
                zoom = dpi / 72
                mat = fitz.Matrix(zoom, zoom)
                pix = page.get_pixmap(matrix=mat)
                img_data = pix.tobytes("ppm")
                img = Image.open(io.BytesIO(img_data))
                images.append(img)
            pdf_document.close()
            return images
        except Exception as e:
            raise RuntimeError(f"Ошибка при конвертации PDF в изображения: {e}")

    def calculate_booklet_order(self, total_pages: int, rotate_all: bool, rotate: bool = False,
                                flip_horizontal: bool = False, flip_vertical: bool = False):
        # Создает последовательность страниц для буклета
        if total_pages <= 0:
            return []

        num_rows = ceil(total_pages / 4)

        # Создаем матрицу 4xnum_rows (4 колонки, num_rows строк)
        matrix = [[None, None, None, None] for _ in range(num_rows)]

        # Заполняем матрицу
        current_page = 1

        # 1. Заполняем четные позиции (0 и 2) по возрастанию
        for i in range(num_rows):
            for j in range(4):
                if current_page > total_pages:
                    break
                if j % 2 == 0:
                    matrix[i][j] = current_page
                    current_page += 1
            if current_page > total_pages:
                break


        for i in range(num_rows - 1, -1, -1):
            for j in range(3, -1, -1):
                if current_page > total_pages:
                    break
                if j % 2 != 0:
                    matrix[i][j] = current_page
                    current_page += 1
            if current_page > total_pages:
                break


        flat_list = []

        for row in range(num_rows):
            for col in range(4):
                flat_list.append(matrix[row][col])

        lst = [flat_list[i:i + 2] for i in range(0, len(flat_list), 2)]



        # Функция swap исправлена - работает с индексами
        if rotate_all:
            for i in range(len(lst)):
                temp = lst[i][0]
                lst[i][0] = lst[i][1]
                lst[i][1] = temp

        if rotate:
            for i in range(1, len(lst), 2):
                temp = lst[i][0]
                lst[i][0] = lst[i][1]
                lst[i][1] = temp

        flat_list = []
        for row in range(len(lst)):
            for col in range(2):
                flat_list.append(lst[row][col])
        result_pairs = []
        for i in range(0, len(flat_list) - 1, 2):
            if i + 1 < len(flat_list):
                if flat_list[i] is not None and flat_list[i + 1] is not None:
                    result_pairs.append((flat_list[i], flat_list[i + 1]))
                elif flat_list[i] is not None:
                    result_pairs.append((flat_list[i], None))
                elif flat_list[i + 1] is not None:
                    result_pairs.append((None, flat_list[i + 1]))
            elif flat_list[i] is not None:
                result_pairs.append((flat_list[i], None))
        return result_pairs
    def create_combined_page(self, left_page: Optional[Image.Image], right_page: Optional[Image.Image], page_size: Tuple[int, int] = (3508, 2480), is_back_side: bool = False, flip_horizontal: bool = False, flip_vertical: bool = False) -> Image.Image:
        output_img = Image.new("RGB", page_size, "white")
        page_width = page_size[0] // 2
        page_height = page_size[1]

        def prepare_image(img: Optional[Image.Image], target_width: int, target_height: int,
                          flip_for_back: bool = False) -> Image.Image:
            if img is None:
                return Image.new("RGB", (target_width, target_height), "white")
            if img.height > img.width:
                pass
            else:
                img = img.rotate(90, expand=True)

            if flip_for_back and img:
                if flip_vertical:
                    img = img.transpose(Image.FLIP_TOP_BOTTOM)
                if flip_horizontal:
                    img = img.transpose(Image.FLIP_LEFT_RIGHT)

            img_ratio = img.width / img.height
            target_ratio = target_width / target_height
            if img_ratio > target_ratio:
                new_width = target_width
                new_height = int(target_width / img_ratio)
            else:
                new_height = target_height
                new_width = int(target_height * img_ratio)
            img_resized = img.resize((new_width, new_height), Image.LANCZOS)
            result = Image.new("RGB", (target_width, target_height), "white")
            x_offset = (target_width - new_width) // 2
            y_offset = (target_height - new_height) // 2
            result.paste(img_resized, (x_offset, y_offset))
            return result

        if left_page is not None:
            left_img = prepare_image(left_page, page_width, page_height, is_back_side)
            output_img.paste(left_img, (0, 0))
        if right_page is not None:
            right_img = prepare_image(right_page, page_width, page_height, is_back_side)
            output_img.paste(right_img, (page_width, 0))
        return output_img

    def create_booklet_pdf(self, rotate_all: bool, rotate: bool = False, flip_horizontal: bool = False, flip_vertical: bool = False) -> str:
        all_images = self.pdf_to_images(str(self.input_pdf_path))
        total_pages = len(all_images)
        booklet_pairs = self.calculate_booklet_order(total_pages, rotate_all, rotate, flip_horizontal, flip_vertical)
        output_images = []
        a4_size_landscape = (3508, 2480)
        gallery_pages = []

        # Создаем папку для временных изображений
        temp_images_dir = os.path.join("web", "assets", "temp_pictures")
        if not os.path.exists(temp_images_dir):
            os.makedirs(temp_images_dir)

        # Очищаем предыдущие временные файлы
        for file in os.listdir(temp_images_dir):
            if file.endswith(".jpg"):
                os.remove(os.path.join(temp_images_dir, file))


        for i, (left_num, right_num) in enumerate(booklet_pairs):
            left_img = all_images[left_num - 1] if left_num else None
            right_img = all_images[right_num - 1] if right_num else None
            is_back_side = (i % 2 == 1)
            combined_img = self.create_combined_page(left_img, right_img, a4_size_landscape, is_back_side,
                                                     flip_horizontal, flip_vertical)
            output_images.append(combined_img)

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

        if output_images:
            output_images[0].save(
                self.output_pdf_path,
                "PDF",
                resolution=300.0,
                save_all=True,
                append_images=output_images[1:]
            )
        return str(self.output_pdf_path)

    def cleanup(self):
        import shutil
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)

    def __del__(self):
        self.cleanup()
