'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { storage } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import styles from './dashboard.module.css';

export default function Dashboard() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [uploadState, setUploadState] = useState('idle'); // 'idle', 'uploading', 'analyzing', 'done'
  const [error, setError] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  
  useEffect(() => {
    if (currentUser === null) {
      router.push('/auth/login');
    } else {
      fetchQuizzes();
    }
  }, [currentUser, router]);

  const fetchQuizzes = async () => {
    if (!currentUser) return;
    try {
      const q = query(
        collection(db, "quizzes"), 
        where("userId", "==", currentUser.uid),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(q);
      const fetchedQuizzes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuizzes(fetchedQuizzes);
    } catch (err) {
      setError("Error fetching quizzes: " + err.message);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Please select a valid PDF file.');
      setFile(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file || !currentUser) return;
    
    try {
      setUploadState('uploading');
      setError('');
      
      // 1. Upload to Firebase Storage
      const storageRef = ref(storage, `pdfs/${currentUser.uid}_${Date.now()}_${file.name}`);
      
      try {
        await uploadBytes(storageRef, file);
      } catch (uploadError) {
        throw new Error('Storage Upload Failed (Did you remember to update Storage Rules?): ' + uploadError.message);
      }
      
      const downloadURL = await getDownloadURL(storageRef);
      setUploadState('analyzing');
      
      // 2. Call our API Route to analyze the PDF with Gemini
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: downloadURL,
          userId: currentUser.uid,
          fileName: file.name
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to analyze PDF');
      
      setUploadState('done');
      setFile(null);
      router.push(`/quiz/${data.quizId}`);

    } catch (err) {
      setError(err.message);
      setUploadState('idle');
    }
  };

  if (!currentUser) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>My Dashboard</h2>
        <p>Welcome back, {currentUser.email}</p>
      </header>

      <div className={styles.grid}>
        <section className={styles.uploadSection}>
          <div className={styles.card}>
            <h3>Create New Quiz</h3>
            <p className={styles.subtitle}>Upload a PDF to generate a new quiz.</p>
            
            {error && <div className={styles.error}>{error}</div>}
            
            <div className={styles.dropzone}>
              <input 
                type="file" 
                accept=".pdf" 
                onChange={handleFileChange} 
                id="pdf-upload"
                className={styles.fileInput}
              />
              <label htmlFor="pdf-upload" className={styles.fileLabel}>
                {file ? <span>{file.name}</span> : <span>Drag & Drop or Click to Upload PDF</span>}
              </label>
            </div>

            {file && uploadState === 'idle' && (
              <button onClick={handleAnalyze} className={styles.actionBtn}>
                Analyze & Create Quiz
              </button>
            )}

            {uploadState === 'uploading' && <div className={styles.status}>Uploading PDF... <span className={styles.spinner}></span></div>}
            {uploadState === 'analyzing' && <div className={styles.status}>AI is analyzing your document... this may take up to a minute. <span className={styles.spinner}></span></div>}
          </div>
        </section>

        <section className={styles.historySection}>
          <div className={styles.card}>
            <h3>My Quizzes</h3>
            {quizzes.length === 0 ? (
              <p className={styles.emptyState}>No quizzes yet. Upload a PDF to get started!</p>
            ) : (
              <ul className={styles.quizList}>
                {quizzes.map((quiz) => (
                  <li key={quiz.id} className={styles.quizItem}>
                    <div>
                      <h4>{quiz.title || quiz.fileName}</h4>
                      <span className={styles.date}>{new Date(quiz.createdAt).toLocaleDateString()}</span>
                    </div>
                    <Link href={`/quiz/${quiz.id}`} className={styles.viewBtn}>Take Quiz</Link>
                  </li>
                ))}
            </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
