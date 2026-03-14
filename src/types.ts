import { Timestamp } from 'firebase/firestore';

export interface AcademicYear {
  id: string;
  year: string;
  status: 'active' | 'archived';
}

export interface Course {
  id: string;
  title: string;
  academicYearId: string;
  date: Timestamp;
  startTime: string;
  endTime: string;
  speaker: string;
  description: string;
  maxParticipants: number;
  room?: string;
  published: boolean;
  posterUrl?: string;
}

export interface InstructorMaster {
  instructorId: string;
  position: string;
  name: string;
  email: string;
  phone: string;
  department: string;
}

export interface Registration {
  id: string;
  instructorId: string;
  courseId: string;
  academicYearId: string;
  timestamp: Timestamp;
  instructorName: string;
  instructorPosition: string;
  department: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'user';
}
