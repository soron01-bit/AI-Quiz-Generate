'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from '../quiz.module.css';

export default function QuizPage({ params }) {
  const { currentUser } = useAuth();
  const router = useRouter();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  useEffect(() => {
    if (currentUser === null) {
      router.push('/auth/login');
      return;
    }
    
    const fetchQuiz = async () => {
      try {
        const docRef = doc(db, "quizzes", params.id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const quizData = docSnap.data();
          if (quizData.userId !== currentUser.uid) {
            setError('Unauthorized access.');
          } else {
            setQuiz({ id: docSnap.id, ...quizData });
          }
        } else {
          setError('Quiz not found.');
        }
      } catch (err) {
        setError('Error loading quiz: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuiz();
  }, [params.id, currentUser, router]);

  if (loading) return <div className={styles.loading}>Loading Quiz...</div>;
  if (error) return <div className={styles.errorContainer}>{error} <Link href="/dashboard" className={styles.btn}>Back to Dashboard</Link></div>;
  if (!quiz || !quiz.questions || quiz.questions.length === 0) return <div>Invalid Quiz Format</div>;

  const currentQuestion = quiz.questions[currentQuestionIndex];

  const handleOptionClick = (index) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    
    if (index === currentQuestion.correctAnswerIndex) {
      setScore(score + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setQuizFinished(true);
    }
  };

  if (quizFinished) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.finishedState}>
            <h2>Quiz Complete!</h2>
            <div className={styles.scoreCircle}>
              <span>{score}</span>
              <span className={styles.scoreDivider}>/</span>
              <span>{quiz.questions.length}</span>
            </div>
            <p className={styles.feedback}>
              {score === quiz.questions.length ? 'Perfect Score! Outstanding work.' : 
               score >= quiz.questions.length / 2 ? 'Good job! You have a solid grasp of the material.' :
               'Keep studying! Review the document and try again.'}
            </p>
            <div className={styles.actions}>
              <button onClick={() => window.location.reload()} className={styles.btnOutline}>Retake Quiz</button>
              <Link href="/dashboard" className={styles.btnPrimary}>Back to Dashboard</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>{quiz.title}</h3>
        <span className={styles.progressCounter}>
          Question {currentQuestionIndex + 1} of {quiz.questions.length}
        </span>
      </div>
      
      <div className={styles.progressBarContainer}>
        <div 
          className={styles.progressBar} 
          style={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
        />
      </div>

      <div className={styles.card}>
        <h2 className={styles.questionText}>{currentQuestion.question}</h2>
        
        <div className={styles.optionsList}>
          {currentQuestion.options.map((option, index) => {
            let itemClass = styles.optionItem;
            if (isAnswered) {
              if (index === currentQuestion.correctAnswerIndex) {
                itemClass = `${styles.optionItem} ${styles.correct}`;
              } else if (index === selectedOption) {
                itemClass = `${styles.optionItem} ${styles.incorrect}`;
              } else {
                itemClass = `${styles.optionItem} ${styles.dimmed}`;
              }
            } else if (selectedOption === index) {
               itemClass = `${styles.optionItem} ${styles.selected}`;
            }

            return (
              <button 
                key={index} 
                className={itemClass}
                onClick={() => handleOptionClick(index)}
                disabled={isAnswered}
              >
                <div className={styles.optionLetter}>{String.fromCharCode(65 + index)}</div>
                <div className={styles.optionText}>{option}</div>
              </button>
            );
          })}
        </div>

        {isAnswered && (
          <div className={styles.explanationBox}>
            <div className={styles.explanationHeader}>Explanation</div>
            <p>{currentQuestion.explanation}</p>
          </div>
        )}

      </div>
      
      {isAnswered && (
        <div className={styles.footerActions}>
          <button onClick={handleNext} className={styles.btnPrimary}>
            {currentQuestionIndex < quiz.questions.length - 1 ? 'Next Question' : 'See Results'}
          </button>
        </div>
      )}
    </div>
  );
}
