"""
Resizes and compresses existing uploaded images in place so the site loads
fast. Run this once after migrating real photos into production (or any time
you notice slow-loading, oversized images).

Usage:
    python manage.py optimize_images
    python manage.py optimize_images --max-width 1600 --quality 80
    python manage.py optimize_images --dry-run
"""
import os
from io import BytesIO

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from PIL import Image, ImageOps

# (app_label, model_name, field_name) for every ImageField we want to optimize
IMAGE_FIELDS = [
    ("gallery", "GalleryImage", "image"),
    ("hotels", "Hotel", "cover_image"),
    ("hotels", "HotelImage", "image"),
    ("rooms", "RoomImage", "image"),
    ("rooms", "RoomCategory", "thumbnail"),
]


class Command(BaseCommand):
    help = "Resize and compress existing uploaded images in place."

    def add_arguments(self, parser):
        parser.add_argument("--max-width", type=int, default=1600,
                             help="Max width in pixels (height scales proportionally). Default 1600.")
        parser.add_argument("--quality", type=int, default=80,
                             help="JPEG/WebP quality 1-95. Default 80.")
        parser.add_argument("--dry-run", action="store_true",
                             help="Report what would change without saving anything.")

    def handle(self, *args, **options):
        from django.apps import apps

        max_width = options["max_width"]
        quality = options["quality"]
        dry_run = options["dry_run"]

        total_before = 0
        total_after = 0
        touched = 0
        skipped = 0

        for app_label, model_name, field_name in IMAGE_FIELDS:
            try:
                Model = apps.get_model(app_label, model_name)
            except LookupError:
                self.stdout.write(self.style.WARNING(
                    f"Skipping {app_label}.{model_name} — model not found."))
                continue

            queryset = Model.objects.exclude(**{f"{field_name}": ""}) \
                                     .exclude(**{f"{field_name}__isnull": True})

            for obj in queryset:
                field_file = getattr(obj, field_name)
                if not field_file:
                    continue

                try:
                    field_file.open("rb")
                    original_bytes = field_file.read()
                    field_file.close()
                except (FileNotFoundError, ValueError):
                    self.stdout.write(self.style.WARNING(
                        f"  Missing file on disk, skipping: {field_file.name}"))
                    skipped += 1
                    continue

                before_size = len(original_bytes)

                try:
                    img = Image.open(BytesIO(original_bytes))
                    img = ImageOps.exif_transpose(img)  # respect phone camera rotation
                    if img.mode in ("RGBA", "P"):
                        img = img.convert("RGB")

                    if img.width > max_width:
                        ratio = max_width / float(img.width)
                        new_height = int(img.height * ratio)
                        img = img.resize((max_width, new_height), Image.LANCZOS)

                    buffer = BytesIO()
                    img.save(buffer, format="JPEG", quality=quality, optimize=True)
                    new_bytes = buffer.getvalue()
                except Exception as exc:
                    self.stdout.write(self.style.ERROR(
                        f"  Failed to process {field_file.name}: {exc}"))
                    skipped += 1
                    continue

                after_size = len(new_bytes)
                total_before += before_size
                total_after += after_size

                saved_pct = (1 - after_size / before_size) * 100 if before_size else 0
                self.stdout.write(
                    f"  {field_file.name}: {before_size/1024:.0f}KB -> "
                    f"{after_size/1024:.0f}KB ({saved_pct:.0f}% smaller)"
                )

                if not dry_run and after_size < before_size:
                    name = os.path.basename(field_file.name)
                    field_file.save(name, ContentFile(new_bytes), save=True)
                    touched += 1
                elif after_size >= before_size:
                    skipped += 1

        self.stdout.write("")
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no files were changed."))
        self.stdout.write(self.style.SUCCESS(
            f"Done. {touched} images optimized, {skipped} skipped. "
            f"Total: {total_before/1024/1024:.1f}MB -> {total_after/1024/1024:.1f}MB"
        ))
