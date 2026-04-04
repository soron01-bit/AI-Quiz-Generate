import os
import json
import PyPDF2
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login
from django.contrib import messages
from django.conf import settings
from .models import Document, Quiz
from .forms import RegisterForm, DocumentUploadForm
import google.generativeai as genai

def landing_page(request):
    if request.user.is_authenticated:
        return redirect('dashboard')
    return render(request, 'assistant/landing.html')

def register(request):
    if request.method == 'POST':
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save(commit=False)
            user.set_password(form.cleaned_data['password'])
            user.save()
            login(request, user)
            return redirect('dashboard')
    else:
        form = RegisterForm()
    return render(request, 'assistant/register.html', {'form': form})

@login_required
def dashboard(request):
    quizzes = Quiz.objects.filter(user=request.user).order_by('-created_at')
    
    if request.method == 'POST':
        form = DocumentUploadForm(request.POST, request.FILES)
        if form.is_valid():
            document = form.save(commit=False)
            document.user = request.user
            document.title = request.FILES['pdf_file'].name
            document.save()
            return redirect('analyze_pdf', document_id=document.id)
    else:
        form = DocumentUploadForm()
        
    return render(request, 'assistant/dashboard.html', {'quizzes': quizzes, 'form': form})

@login_required
def analyze_pdf(request, document_id):
    document = get_object_or_404(Document, id=document_id, user=request.user)
    
    try:
        # Extract Text
        pdf_path = document.pdf_file.path
        text_content = ""
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    text_content += text + "\n"
        
        if not text_content or len(text_content) < 50:
            messages.error(request, "Could not extract sufficient text from PDF.")
            return redirect('dashboard')

        # Configure Gemini
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            messages.error(request, "Server missing GEMINI_API_KEY. Please set it in your environment/settings.")
            return redirect('dashboard')

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        prompt = f"""
        You are an expert AI tutor. Based on the following document text, create a high-quality quiz.
        Generate exactly 5 multiple-choice questions that test understanding of the core concepts in the text.
        Format your response ONLY as a JSON object, exactly matching this structure, with no markdown formatting:
        {{
            "title": "A fitting title for this quiz",
            "questions": [
                {{
                    "question": "Question text",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correctAnswerIndex": 0,
                    "explanation": "Brief explanation of why this is correct."
                }}
            ]
        }}
        
        Document text:
        {text_content[:30000]}
        """

        response = model.generate_content(prompt)
        # Clean up response if it contains markdown code blocks
        json_text = response.text.replace("```json", "").replace("```", "").strip()
        quiz_data = json.loads(json_text)

        # Save Quiz Result
        quiz = Quiz.objects.create(
            user=request.user,
            document=document,
            title=quiz_data.get('title', 'Generated Quiz'),
            questions_json=quiz_data
        )
        return redirect('quiz_view', quiz_id=quiz.id)

    except Exception as e:
        messages.error(request, f"Error processing file: {str(e)}")
        return redirect('dashboard')

@login_required
def quiz_view(request, quiz_id):
    quiz = get_object_or_404(Quiz, id=quiz_id, user=request.user)
    return render(request, 'assistant/quiz.html', {'quiz': quiz, 'quiz_json': json.dumps(quiz.questions_json)})
