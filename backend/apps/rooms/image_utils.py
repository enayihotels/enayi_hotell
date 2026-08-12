"""Shared image resize/compress logic.

Used two places:
  1. Every upload endpoint (rooms, room photos, event halls, gallery) runs
     new uploads through this automatically — so images are optimized the
     moment they're uploaded, not just when someone remembers to run
     `optimize_images` afterward.
  2. The `optimize_images` management command, for cleaning up anything
     uploaded before this was wired in, or bulk-imported some other way.
"""
from io import BytesIO
from django.core.files.uploadedfile import InMemoryUploadedFile
from PIL import Image, ImageOps


def optimize_image_file(uploaded_file, max_width: int = 1600, quality: int = 80):
    """Takes a Django UploadedFile (or any file-like object opened for
    reading), returns a NEW InMemoryUploadedFile that's been resized (if
    wider than max_width) and re-compressed as JPEG. Safe to assign
    directly to an ImageField in place of the original upload.

    Falls back to returning the ORIGINAL file untouched if anything about
    the optimization fails (corrupt image, unsupported format, etc) —
    a failed optimization should never block the upload itself.
    """
    try:
        original_bytes = uploaded_file.read()
        uploaded_file.seek(0)  # leave the original file object usable if optimization fails

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

        # Only use the optimized version if it's actually smaller —
        # tiny/already-compressed images can occasionally grow slightly
        # when forced through JPEG re-encoding.
        if len(new_bytes) >= len(original_bytes):
            uploaded_file.seek(0)
            return uploaded_file

        base_name = uploaded_file.name.rsplit(".", 1)[0] if "." in uploaded_file.name else uploaded_file.name
        return InMemoryUploadedFile(
            BytesIO(new_bytes), None, f"{base_name}.jpg", "image/jpeg",
            len(new_bytes), None,
        )
    except Exception:
        # Never let a bad/corrupt image block the actual upload — just
        # pass the original through unmodified.
        try:
            uploaded_file.seek(0)
        except Exception:
            pass
        return uploaded_file
