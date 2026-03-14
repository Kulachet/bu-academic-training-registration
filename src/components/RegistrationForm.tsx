import React, { useState, useEffect } from 'react';
import { collection, addDoc, query, where, getDocs, doc, getDoc, setDoc, Timestamp, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { AcademicYear, Course, InstructorMaster } from '../types';
import { Search, User, Building, CheckCircle, AlertCircle, Loader2, ClipboardCheck, Clock } from 'lucide-react';
import { formatDate, formatInstructorName } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

import { User as FirebaseUser } from 'firebase/auth';

interface Props {
  academicYears: AcademicYear[];
  courses: Course[];
  user: FirebaseUser | null;
}

export default function RegistrationForm({ academicYears, courses, user }: Props) {
  const [instructorId, setInstructorId] = useState('');
  const [instructor, setInstructor] = useState<InstructorMaster | null>(null);
  const [searching, setSearching] = useState(false);
  const [isRegisteringNew, setIsRegisteringNew] = useState(false);
  const [newInstructorForm, setNewInstructorForm] = useState({
    instructorId: '',
    position: 'อาจารย์ประจำ',
    name: '',
    email: '',
    phone: '',
    department: ''
  });
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-lookup for logged-in user
  useEffect(() => {
    if (!user) return;

    const autoLookup = async () => {
      setSearching(true);
      setError(null);
      try {
        // 1. Try lookup by email (most accurate)
        if (user.email) {
          const qEmail = query(
            collection(db, 'instructors_master'),
            where('email', '==', user.email.trim()),
            limit(1)
          );
          const snapEmail = await getDocs(qEmail);
          if (!snapEmail.empty) {
            const data = snapEmail.docs[0].data() as InstructorMaster;
            setInstructor(data);
            setInstructorId(data.instructorId);
            return;
          }
        }

        // 2. Try lookup by name
        if (user.displayName) {
          const qName = query(
            collection(db, 'instructors_master'),
            where('name', '==', user.displayName.trim()),
            limit(1)
          );
          const snapName = await getDocs(qName);
          if (!snapName.empty) {
            const data = snapName.docs[0].data() as InstructorMaster;
            setInstructor(data);
            setInstructorId(data.instructorId);
            return;
          }
        }

        // 3. Final Fallback: Client-side search by name/email
        const allSnap = await getDocs(collection(db, 'instructors_master'));
        const found = allSnap.docs.find(d => {
          const data = d.data() as InstructorMaster;
          return (user.email && data.email?.toLowerCase() === user.email.toLowerCase()) ||
                 (user.displayName && data.name?.toLowerCase() === user.displayName.toLowerCase());
        });

        if (found) {
          const data = found.data() as InstructorMaster;
          setInstructor(data);
          setInstructorId(data.instructorId);
        } else {
          // If not found automatically, let them enter ID manually
          setError('ไม่พบข้อมูลอัตโนมัติจากบัญชี Google กรุณากรอกรหัสอาจารย์เพื่อยืนยันตัวตน หรือลงทะเบียนใหม่');
          setNewInstructorForm(prev => ({
            ...prev,
            name: user.displayName || '',
            email: user.email || ''
          }));
        }
      } catch (err) {
        console.error('Auto-lookup error:', err);
      } finally {
        setSearching(false);
      }
    };

    autoLookup();
  }, [user]);

  // ID Matching Logic (Manual)
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      const cleanId = instructorId.trim().toUpperCase();
      if (cleanId.length >= 5) {
        setSearching(true);
        setError(null);
        try {
          // Try direct ID lookup first (fastest)
          const docRef = doc(db, 'instructors_master', cleanId);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setInstructor(docSnap.data() as InstructorMaster);
          } else {
            // Fallback: Search by field instructorId (more robust)
            const q = query(
              collection(db, 'instructors_master'), 
              where('instructorId', '==', cleanId),
              limit(1)
            );
            const querySnap = await getDocs(q);
            
            if (!querySnap.empty) {
              setInstructor(querySnap.docs[0].data() as InstructorMaster);
            } else {
              // Final Fallback: Client-side search (fetch all and find)
              // This handles cases where Document ID or field matching might still fail due to hidden chars
              const allSnap = await getDocs(collection(db, 'instructors_master'));
              const found = allSnap.docs.find(d => {
                const data = d.data() as InstructorMaster;
                return d.id.toUpperCase() === cleanId || 
                       data.instructorId?.toUpperCase() === cleanId;
              });

              if (found) {
                setInstructor(found.data() as InstructorMaster);
              } else {
                setInstructor(null);
                setError('ไม่พบข้อมูลอาจารย์ในระบบ กรุณาตรวจสอบรหัสอาจารย์');
              }
            }
          }
        } catch (err) {
          console.error(err);
          setError('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล');
        } finally {
          setSearching(false);
        }
      } else {
        setInstructor(null);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [instructorId]);

  const handleRegisterNewInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const cleanId = newInstructorForm.instructorId.trim().toUpperCase();
      
      // Check if ID already exists
      const docRef = doc(db, 'instructors_master', cleanId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        throw new Error('รหัสอาจารย์นี้มีอยู่ในระบบแล้ว');
      }

      const instructorData: InstructorMaster = {
        ...newInstructorForm,
        instructorId: cleanId,
        name: newInstructorForm.name.trim(),
        email: newInstructorForm.email.trim(),
        status: 'active'
      };

      // Save to Firestore
      await setDoc(doc(db, 'instructors_master', cleanId), instructorData);
      
      setInstructor(instructorData);
      setInstructorId(cleanId);
      setIsRegisteringNew(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'เกิดข้อผิดพลาดในการลงทะเบียนอาจารย์ใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instructor || !selectedCourseId) return;

    setSubmitting(true);
    setError(null);

    try {
      const selectedCourse = courses.find(c => c.id === selectedCourseId);
      if (!selectedCourse) throw new Error('Course not found');

      // Duplicate Prevention
      const q = query(
        collection(db, 'registrations'),
        where('instructorId', '==', instructor.instructorId),
        where('courseId', '==', selectedCourseId)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setError('คุณได้ลงทะเบียนหลักสูตรนี้ไปแล้ว');
        setSubmitting(false);
        return;
      }

      // Record Registration
      await addDoc(collection(db, 'registrations'), {
        instructorId: instructor.instructorId,
        courseId: selectedCourseId,
        academicYearId: selectedCourse.academicYearId,
        timestamp: Timestamp.now(),
        instructorName: formatInstructorName(instructor.name),
        instructorPosition: instructor.position,
        department: instructor.department
      });

      // Create Google Calendar Event
      try {
        await fetch('/api/calendar/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instructorEmail: instructor.email,
            instructorName: instructor.name,
            courseTitle: selectedCourse.title,
            courseDate: selectedCourse.date.toDate().toISOString().split('T')[0],
            startTime: selectedCourse.startTime,
            endTime: selectedCourse.endTime,
            courseRoom: selectedCourse.room,
          }),
        });
      } catch (calErr) {
        console.error('Failed to create calendar event:', calErr);
        // We don't block the UI success if calendar fails, but we log it
      }

      setSuccess(true);
      setInstructorId('');
      setInstructor(null);
      setSelectedCourseId('');
    } catch (err) {
      console.error(err);
      setError('เกิดข้อผิดพลาดในการลงทะเบียน');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-12 rounded-3xl shadow-xl border border-green-100"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="text-green-600 w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold mb-2 serif">ลงทะเบียนสำเร็จ!</h2>
          <p className="text-gray-600 mb-8">ข้อมูลการลงทะเบียนของคุณถูกบันทึกเรียบร้อยแล้ว</p>
          <button 
            onClick={() => setSuccess(false)}
            className="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors"
          >
            ลงทะเบียนหลักสูตรอื่น
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 serif mb-2">ลงทะเบียนอบรม</h1>
        <p className="text-gray-500">กรุณากรอกรหัสอาจารย์เพื่อตรวจสอบข้อมูลและเลือกหลักสูตรที่ต้องการ</p>
      </div>

      <form onSubmit={handleRegister} className="space-y-6">
        {/* Step 1: Instructor ID */}
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Search className="text-primary w-4 h-4" />
            </div>
            <h3 className="font-bold serif">ขั้นตอนที่ 1: ตรวจสอบข้อมูลอาจารย์</h3>
          </div>

          <div className="space-y-4">
            {!instructor && !isRegisteringNew && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase">รหัสอาจารย์ (Instructor ID)</label>
                  <button 
                    type="button"
                    onClick={() => setIsRegisteringNew(true)}
                    className="text-xs text-primary font-bold hover:underline"
                  >
                    + ลงทะเบียนอาจารย์ใหม่
                  </button>
                </div>
                <div className="relative">
                  <input 
                    required
                    type="text" 
                    placeholder="เช่น 6012345"
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 pl-12 focus:ring-2 focus:ring-primary/20 focus:border-primary text-lg font-bold outline-none transition-all"
                    value={instructorId}
                    onChange={e => setInstructorId(e.target.value)}
                  />
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  {searching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-primary w-5 h-5 animate-spin" />}
                </div>
              </div>
            )}

            {!instructor && isRegisteringNew && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 border-t border-gray-100 pt-4"
              >
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-primary">ลงทะเบียนข้อมูลอาจารย์ใหม่</h4>
                  <button 
                    type="button"
                    onClick={() => setIsRegisteringNew(false)}
                    className="text-xs text-gray-400 hover:text-red-500"
                  >
                    ยกเลิก
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">รหัสอาจารย์</label>
                    <input 
                      required
                      type="text"
                      className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      value={newInstructorForm.instructorId}
                      onChange={e => setNewInstructorForm({...newInstructorForm, instructorId: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">ตำแหน่ง</label>
                    <input 
                      required
                      type="text"
                      placeholder="อาจารย์ประจำ"
                      className={`w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none ${newInstructorForm.position === 'อาจารย์ประจำ' ? 'text-gray-400' : 'text-gray-900'}`}
                      value={newInstructorForm.position}
                      onChange={e => setNewInstructorForm({...newInstructorForm, position: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">ชื่อ-นามสกุล</label>
                    <input 
                      required
                      type="text"
                      className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      value={newInstructorForm.name}
                      onChange={e => setNewInstructorForm({...newInstructorForm, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Email</label>
                    <input 
                      required
                      type="email"
                      className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      value={newInstructorForm.email}
                      onChange={e => setNewInstructorForm({...newInstructorForm, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">เบอร์โทรศัพท์</label>
                    <input 
                      required
                      type="tel"
                      className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      value={newInstructorForm.phone}
                      onChange={e => setNewInstructorForm({...newInstructorForm, phone: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">หน่วยงาน</label>
                    <input 
                      required
                      type="text"
                      className="w-full bg-gray-50 border-none rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      value={newInstructorForm.department}
                      onChange={e => setNewInstructorForm({...newInstructorForm, department: e.target.value})}
                    />
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={handleRegisterNewInstructor}
                  disabled={submitting}
                  className="w-full bg-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50 shadow-lg shadow-primary/20"
                >
                  {submitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูลอาจารย์'}
                </button>
              </motion.div>
            )}

            <AnimatePresence>
              {instructor && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> ยืนยันตัวตนสำเร็จ
                    </span>
                    <button 
                      type="button"
                      onClick={() => {
                        setInstructor(null);
                        setInstructorId('');
                      }}
                      className="text-[10px] text-gray-400 hover:text-red-500 underline"
                    >
                      ไม่ใช่ข้อมูลของฉัน?
                    </button>
                  </div>
                  
                  <div className="bg-gray-50 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                      <User className="text-primary w-5 h-5" />
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">ชื่อ-นามสกุล</p>
                        <p className="font-bold text-gray-900">{formatInstructorName(instructor.name)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{instructor.position}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Building className="text-primary w-5 h-5" />
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">หน่วยงาน</p>
                        <p className="font-bold">{instructor.department}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <AlertCircle className="text-primary w-5 h-5" />
                      <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase">อีเมล์ / โทรศัพท์</p>
                        <p className="font-bold">{instructor.email} | {instructor.phone || '-'}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Step 2: Course Selection */}
        <div className={`bg-white rounded-3xl p-8 shadow-sm border border-gray-100 transition-opacity ${!instructor ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <ClipboardCheck className="text-primary w-4 h-4" />
            </div>
            <h3 className="font-bold serif">ขั้นตอนที่ 2: เลือกหลักสูตรอบรม</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.filter(c => {
              const year = academicYears.find(y => y.id === c.academicYearId);
              return year?.status === 'active' && c.published === true;
            }).map(course => (
              <label 
                key={course.id}
                className={`relative cursor-pointer rounded-2xl p-4 border-2 transition-all ${
                  selectedCourseId === course.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <input 
                  type="radio" 
                  name="course" 
                  className="hidden"
                  value={course.id}
                  onChange={e => setSelectedCourseId(e.target.value)}
                />
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">{formatDate(course.date)}</span>
                    <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {course.startTime} - {course.endTime}
                    </span>
                  </div>
                  {selectedCourseId === course.id && <CheckCircle className="text-primary w-4 h-4" />}
                </div>
                <div className="flex gap-3">
                  {course.posterUrl && (
                    <div className="w-16 h-20 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                      <img src={course.posterUrl} alt="Poster" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-sm mb-1 line-clamp-1">{course.title}</p>
                    <p className="text-xs text-gray-500">วิทยากร: {course.speaker}</p>
                    {course.room && <p className="text-[10px] text-gray-400 mt-1">ห้อง: {course.room}</p>}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
            <AlertCircle className="text-red-600 w-5 h-5" />
            <p className="text-red-800 text-sm font-bold">{error}</p>
          </div>
        )}

        <button 
          type="submit"
          disabled={!instructor || !selectedCourseId || submitting}
          className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg transition-all ${
            !instructor || !selectedCourseId || submitting
              ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary/90 active:scale-[0.98] shadow-primary/20'
          }`}
        >
          {submitting ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              กำลังดำเนินการ...
            </div>
          ) : 'ยืนยันการลงทะเบียน'}
        </button>
      </form>
    </div>
  );
}
