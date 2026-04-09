import os
from django.db import models
from django.contrib.auth.models import User

class Document(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=255, blank=True)
    pdf_file = models.FileField(upload_to='pdfs/', null=True, blank=True)
    image_file = models.FileField(upload_to='images/', null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.title:
            return self.title

        if self.pdf_file:
            return os.path.basename(self.pdf_file.name)

        if self.image_file:
            return os.path.basename(self.image_file.name)

        return f"Document {self.pk}"

class Quiz(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, null=True, blank=True)
    title = models.CharField(max_length=255)
    questions_json = models.JSONField(help_text="Stores the generated quiz structure")
    score = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title
