from django.contrib import admin
from .models import GalleryCategory, GalleryImage

@admin.register(GalleryCategory)
class GalleryCategoryAdmin(admin.ModelAdmin):
    list_display = ["name","category_type","is_active","sort_order"]
    list_filter  = ["category_type","is_active"]
    prepopulated_fields = {"slug":("name",)}

@admin.register(GalleryImage)
class GalleryImageAdmin(admin.ModelAdmin):
    list_display = ["title","category","is_featured","is_active","sort_order","width","height","uploaded_at"]
    list_filter  = ["is_featured","is_active","category"]
    search_fields= ["title","description","alt_text"]
    readonly_fields = ["width","height","file_size_kb","uploaded_at"]