from django import forms
from django.contrib.auth.models import User
from .models import Document

class DocumentUploadForm(forms.ModelForm):
    class Meta:
        model = Document
        fields = ['pdf_file']
        widgets = {
            'pdf_file': forms.ClearableFileInput(attrs={'class': 'form-control', 'accept': '.pdf'})
        }


class ImageUploadForm(forms.ModelForm):
    class Meta:
        model = Document
        fields = ['image_file']
        widgets = {
            'image_file': forms.ClearableFileInput(attrs={'class': 'form-control', 'accept': 'image/*', 'capture': 'environment'})
        }

class RegisterForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput(attrs={'class': 'form-control'}))
    confirm_password = forms.CharField(widget=forms.PasswordInput(attrs={'class': 'form-control'}))

    class Meta:
        model = User
        fields = ['username', 'email']

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        confirm_password = cleaned_data.get("confirm_password")

        if password != confirm_password:
            self.add_error('confirm_password', "Passwords do not match")
        return cleaned_data
