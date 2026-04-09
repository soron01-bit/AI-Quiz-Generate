import os
import json
import mimetypes
import PyPDF2
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth import login
from django.contrib import messages
from django.conf import settings
from .models import Document, Quiz
from .forms import RegisterForm, DocumentUploadForm, ImageUploadForm
import google.generativeai as genai


def _parse_quiz_json_response(response_text):
    cleaned = response_text.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(cleaned[start:end + 1])
        raise

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
    pdf_form = DocumentUploadForm()
    image_form = ImageUploadForm()
    
    if request.method == 'POST':
        if 'upload_pdf' in request.POST:
            pdf_form = DocumentUploadForm(request.POST, request.FILES)
            if pdf_form.is_valid():
                document = pdf_form.save(commit=False)
                document.user = request.user
                uploaded_pdf = request.FILES.get('pdf_file')
                document.title = uploaded_pdf.name if uploaded_pdf else 'Uploaded PDF'
                document.save()
                return redirect('analyze_pdf', document_id=document.id)

        if 'upload_image' in request.POST:
            image_form = ImageUploadForm(request.POST, request.FILES)
            if image_form.is_valid():
                document = image_form.save(commit=False)
                document.user = request.user
                uploaded_image = request.FILES.get('image_file')
                document.title = uploaded_image.name if uploaded_image else 'Uploaded Image'
                document.save()
                return redirect('analyze_image', document_id=document.id)
        
    return render(
        request,
        'assistant/dashboard.html',
        {
            'quizzes': quizzes,
            'form': pdf_form,
            'image_form': image_form,
        }
    )

@login_required
def analyze_pdf(request, document_id):
    document = get_object_or_404(Document, id=document_id, user=request.user)
    
    try:
        if not document.pdf_file:
            messages.error(request, "No PDF file found for this upload.")
            return redirect('dashboard')

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
        quiz_data = _parse_quiz_json_response(response.text)

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
def analyze_image(request, document_id):
    document = get_object_or_404(Document, id=document_id, user=request.user)

    try:
        if not document.image_file:
            messages.error(request, "No image file found for this upload.")
            return redirect('dashboard')

        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            messages.error(request, "Server missing GEMINI_API_KEY. Please set it in your environment/settings.")
            return redirect('dashboard')

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')

        with document.image_file.open('rb') as image_fp:
            image_bytes = image_fp.read()

        mime_type, _ = mimetypes.guess_type(document.image_file.name)
        mime_type = mime_type or 'image/jpeg'

        prompt = """
        You are an expert AI tutor.
        First, read and understand all visible text from this study page image.
        Then generate exactly 5 high-quality multiple-choice questions that test understanding of the key concepts.
        Format your response ONLY as a JSON object, exactly matching this structure, with no markdown formatting:
        {
            "title": "A fitting title for this quiz",
            "questions": [
                {
                    "question": "Question text",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correctAnswerIndex": 0,
                    "explanation": "Brief explanation of why this is correct."
                }
            ]
        }
        """

        response = model.generate_content([
            prompt,
            {
                "mime_type": mime_type,
                "data": image_bytes,
            },
        ])

        quiz_data = _parse_quiz_json_response(response.text)

        quiz = Quiz.objects.create(
            user=request.user,
            document=document,
            title=quiz_data.get('title', 'Generated Quiz from Image'),
            questions_json=quiz_data,
        )
        return redirect('quiz_view', quiz_id=quiz.id)

    except Exception as e:
        messages.error(request, f"Error processing image: {str(e)}")
        return redirect('dashboard')

@login_required
def quiz_view(request, quiz_id):
    quiz = get_object_or_404(Quiz, id=quiz_id, user=request.user)
    return render(request, 'assistant/quiz.html', {'quiz': quiz, 'quiz_json': json.dumps(quiz.questions_json)})
