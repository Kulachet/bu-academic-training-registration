import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Course, AcademicYear } from '../types';
import { Search, User, Building, Calendar, Download, Loader2, Filter, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate, formatInstructorName } from '../utils';

interface Registration {
  id: string;
  instructorId: string;
  courseId: string;
  academicYearId: string;
  timestamp: any;
  instructorName: string;
  department: string;
}

import { User as FirebaseUser } from 'firebase/auth';

interface Props {
  academicYears: AcademicYear[];
  courses: Course[];
  user: FirebaseUser | null;
}

export default function Registrations({ academicYears, courses, user }: Props) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingRegId, setDeletingRegId] = useState<string | null>(null);

  const handleDeleteRegistration = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'registrations', id));
      setDeletingRegId(null);
    } catch (error) {
      console.error("Error deleting registration:", error);
      alert("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'registrations'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setRegistrations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Registration)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching registrations:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const filteredRegistrations = registrations.filter(reg => {
    if (!selectedCourseId) return false;
    const matchesCourse = selectedCourseId === 'all' || reg.courseId === selectedCourseId;
    const matchesSearch = reg.instructorName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         reg.instructorId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         reg.department.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCourse && matchesSearch;
  });

  const exportToCSV = () => {
    const headers = ['Instructor ID', 'Name', 'Position', 'Department', 'Course', 'Date Registered'];
    const rows = filteredRegistrations.map(reg => {
      const course = courses.find(c => c.id === reg.courseId);
      return [
        reg.instructorId,
        formatInstructorName(reg.instructorName),
        reg.instructorPosition || '-',
        reg.department,
        course ? `${course.title} (${course.startTime}-${course.endTime})` : 'Unknown Course',
        reg.timestamp?.toDate().toLocaleString('th-TH') || '-'
      ];
    });

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `registrations_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 serif mb-2">รายชื่อผู้ลงทะเบียน</h1>
          <p className="text-gray-500">ตรวจสอบและจัดการรายชื่ออาจารย์ที่สมัครเข้าร่วมอบรม</p>
        </div>
        <button 
          onClick={exportToCSV}
          disabled={!selectedCourseId || filteredRegistrations.length === 0}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold shadow-lg transition-all ${
            !selectedCourseId || filteredRegistrations.length === 0
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary/90 shadow-primary/20'
          }`}
        >
          <Download className="w-5 h-5" />
          ส่งออกข้อมูล (CSV)
        </button>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative md:col-span-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="ค้นหาชื่อ, รหัส หรือหน่วยงาน..."
              className="w-full bg-gray-50 border-none rounded-xl p-3 pl-12 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="relative md:col-span-1">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select 
              className="w-full bg-gray-50 border-none rounded-xl p-3 pl-12 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm appearance-none transition-all"
              value={selectedCourseId}
              onChange={e => setSelectedCourseId(e.target.value)}
            >
              <option value="">-- กรุณาเลือกหลักสูตร --</option>
              <option value="all">ทุกหลักสูตร</option>
              {courses.map(course => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end text-xs text-gray-400 font-bold uppercase tracking-widest">
            พบ {filteredRegistrations.length} รายการ
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">รหัสอาจารย์</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">ชื่อ-นามสกุล</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">หน่วยงาน</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">หลักสูตรที่สมัคร</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                  </td>
                </tr>
              ) : !selectedCourseId ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-400">
                      <Filter className="w-12 h-12 opacity-20" />
                      <p className="font-bold serif text-lg">กรุณาเลือกหลักสูตรเพื่อดูรายชื่อ</p>
                      <p className="text-xs uppercase tracking-widest">เลือกจากเมนู "กรองตามหลักสูตร" ด้านบน</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                    ไม่พบข้อมูลการลงทะเบียนในหลักสูตรนี้
                  </td>
                </tr>
              ) : (
                filteredRegistrations.map((reg) => {
                  const course = courses.find(c => c.id === reg.courseId);
                  return (
                    <tr key={reg.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs font-bold bg-gray-100 px-2 py-1 rounded text-gray-600">
                          {reg.instructorId}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900">{formatInstructorName(reg.instructorName)}</span>
                            {reg.instructorPosition && (
                              <span className="text-[10px] text-gray-400 font-medium">{reg.instructorPosition}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Building className="w-3.5 h-3.5" />
                          <span className="text-xs">{reg.department}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs">
                          <p className="text-sm font-bold text-gray-900 truncate">{course?.title || 'Unknown Course'}</p>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase">
                            <span>{course ? formatDate(course.date) : '-'}</span>
                            {course && (
                              <span className="bg-primary/10 px-1 rounded text-primary">
                                {course.startTime}-{course.endTime}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <span className="text-xs">
                            {reg.timestamp?.toDate().toLocaleDateString('th-TH', { 
                              day: '2-digit', 
                              month: 'short', 
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setDeletingRegId(reg.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="ลบรายชื่อ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingRegId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-red-600 w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2 serif">ยืนยันการลบรายชื่อ</h3>
              <p className="text-gray-500 mb-8 text-sm">
                คุณต้องการลบรายชื่อของ <span className="font-bold text-gray-900">{registrations.find(r => r.id === deletingRegId)?.instructorName}</span> ออกจากหลักสูตรนี้ใช่หรือไม่?
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeletingRegId(null)}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-bold text-gray-500 hover:bg-gray-50"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={() => handleDeleteRegistration(deletingRegId)}
                  className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-md hover:bg-red-700"
                >
                  ยืนยันการลบ
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
