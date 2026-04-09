from django.urls import path
from . import views
from django.contrib.auth import views as auth_views

urlpatterns = [
    path('', views.landing_page, name='home'),
    path('register/', views.register, name='register'),
    path('login/', auth_views.LoginView.as_view(template_name='assistant/login.html'), name='login'),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('analyze/<int:document_id>/', views.analyze_pdf, name='analyze_pdf'),
    path('analyze-image/<int:document_id>/', views.analyze_image, name='analyze_image'),
    path('quiz/<int:quiz_id>/', views.quiz_view, name='quiz_view'),
]
